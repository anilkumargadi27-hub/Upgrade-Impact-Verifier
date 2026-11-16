import EventEmitter from 'events';
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import type { AnalysisEvent, AnalysisJobData, IQueueService } from '@upgradelens/contracts';
import { getPrismaClient } from './db.js';

export const globalEventBus = new EventEmitter();
globalEventBus.setMaxListeners(200);

export class BullMQWorkerQueueService implements IQueueService {
  private queue: Queue;
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue('analysis-queue', { connection: this.redis });
  }

  async enqueueJob(data: AnalysisJobData): Promise<void> {
    await this.queue.add('analyze', data, {
      jobId: `analysis_${data.analysisId}_attempt_${data.attemptNumber}`,
      removeOnComplete: 100,
      removeOnFail: 200,
      attempts: 1
    });
  }

  async cancelJob(analysisId: string): Promise<boolean> {
    globalEventBus.emit(`cancel:${analysisId}`);
    return true;
  }

  async publishEvent(event: AnalysisEvent): Promise<void> {
    try {
      const prisma = await getPrismaClient();
      await prisma.analysisEvent.create({
        data: {
          id: event.id,
          analysisId: event.analysisId,
          stage: event.stage,
          message: event.message,
          dataJson: event.data ? JSON.stringify(event.data) : null,
          timestamp: new Date(event.timestamp)
        }
      });
    } catch (err: any) {
      console.warn('[WorkerQueue] Failed to persist event:', err.message);
    }
    globalEventBus.emit(`event:${event.analysisId}`, event);
  }

  onEvent(analysisId: string, handler: (event: AnalysisEvent) => void): () => void {
    const eventName = `event:${analysisId}`;
    globalEventBus.on(eventName, handler);
    return () => {
      globalEventBus.off(eventName, handler);
    };
  }

  getActiveWorkerCount(): number {
    return 1;
  }

  async getPendingJobCount(): Promise<number> {
    const counts = await this.queue.getJobCounts('waiting', 'active');
    return (counts.waiting || 0) + (counts.active || 0);
  }
}
