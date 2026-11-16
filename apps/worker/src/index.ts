import dotenv from 'dotenv';
dotenv.config();

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import type { AnalysisJobData } from '@upgradelens/contracts';
import { getPrismaClient } from './db.js';
import { BullMQWorkerQueueService } from './queue.js';
import { runAnalysisPipeline } from './orchestrator.js';

async function startWorker() {
  console.log('[Worker] Starting UpgradeLens Analysis Worker...');
  const prisma = await getPrismaClient();
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl && redisUrl.startsWith('redis://')) {
    const queueService = new BullMQWorkerQueueService(redisUrl);
    const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

    const bullWorker = new Worker(
      'analysis-queue',
      async (job: Job<AnalysisJobData>) => {
        console.log(`[Worker] Received BullMQ job ${job.id} for analysis ${job.data.analysisId}`);
        const abortController = new AbortController();

        const cleanupBus = queueService.onEvent(job.data.analysisId, (event) => {
          if (event.stage === 'cancelling' || event.stage === 'cancelled') {
            abortController.abort();
          }
        });

        try {
          await runAnalysisPipeline(prisma, queueService, job.data, abortController.signal);
        } finally {
          cleanupBus();
        }
      },
      {
        connection,
        concurrency: 2
      }
    );

    bullWorker.on('completed', (job) => {
      console.log(`[Worker] BullMQ job ${job.id} finished successfully.`);
    });

    bullWorker.on('failed', (job, err) => {
      console.error(`[Worker] BullMQ job ${job?.id} failed:`, err);
    });

    console.log('[Worker] BullMQ worker listening for jobs on Redis.');
  } else {
    console.log('[Worker] No external REDIS_URL configured. Worker will run in tandem with API in-process queue adapter or polling.');
  }

  const shutdown = async () => {
    console.log('[Worker] Shutting down worker...');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startWorker().catch((err) => {
  console.error('[Worker] Fatal worker startup error:', err);
  process.exit(1);
});
