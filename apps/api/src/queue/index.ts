import EventEmitter from 'events';
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import type { AnalysisEvent, AnalysisStage } from '@upgradelens/contracts';
import { getPrismaClient } from '../db.js';

export interface AnalysisJobData {
  analysisId: string;
  userId: string;
  mode: 'pr' | 'manual' | 'fixture';
  prUrl?: string;
  repoUrl?: string;
  dependencyName?: string;
  targetVersion?: string;
  baselineCommitSha?: string;
  scenarioId?: string;
  attemptNumber: number;
}

export interface IQueueService {
  enqueueJob(data: AnalysisJobData): Promise<void>;
  cancelJob(analysisId: string): Promise<boolean>;
  publishEvent(event: AnalysisEvent): Promise<void>;
  onEvent(analysisId: string, handler: (event: AnalysisEvent) => void): () => void;
  getActiveWorkerCount(): number;
  getPendingJobCount(): Promise<number>;
}

// In-process event bus for live SSE streaming and event fan-out
export const globalEventBus = new EventEmitter();
globalEventBus.setMaxListeners(200);

class BullMQQueueService implements IQueueService {
  private queue: Queue;
  private redisConnection: Redis;
  private cancelledJobs = new Set<string>();

  constructor(redisUrl: string) {
    this.redisConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue('analysis-queue', { connection: this.redisConnection });
    console.log('[Queue] Initialized BullMQ with Redis at', redisUrl.replace(/\/\/[^@]*@/, '//***@'));
  }

  async enqueueJob(data: AnalysisJobData): Promise<void> {
    // Idempotent job creation using analysisId as jobId
    await this.queue.add('analyze', data, {
      jobId: `analysis_${data.analysisId}_attempt_${data.attemptNumber}`,
      removeOnComplete: 100,
      removeOnFail: 200,
      attempts: 1 // Managed explicitly via AnalysisAttempt records
    });
  }

  async cancelJob(analysisId: string): Promise<boolean> {
    this.cancelledJobs.add(analysisId);
    globalEventBus.emit(`cancel:${analysisId}`);

    // Try finding and removing from queue if not yet active
    const jobs = await this.queue.getJobs(['waiting', 'delayed', 'active']);
    for (const job of jobs) {
      if (job.data?.analysisId === analysisId) {
        await job.discard();
        return true;
      }
    }
    return true;
  }

  async publishEvent(event: AnalysisEvent): Promise<void> {
    // Save event to database
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
      console.warn('[Queue] Failed to persist event to DB:', err.message);
    }

    // Emit on local bus
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
    const counts = await this.queue.getJobCounts('waiting', 'active', 'delayed');
    return (counts.waiting || 0) + (counts.active || 0);
  }
}

class InProcessQueueService implements IQueueService {
  private pendingQueue: AnalysisJobData[] = [];
  private activeJobs = new Map<string, AbortController>();
  private processor?: (data: AnalysisJobData, signal: AbortSignal) => Promise<void>;

  constructor() {
    console.log('[Queue] Initialized in-process QueueAdapter (local mode without Redis)');
  }

  registerProcessor(processor: (data: AnalysisJobData, signal: AbortSignal) => Promise<void>) {
    this.processor = processor;
    this.drain();
  }

  async enqueueJob(data: AnalysisJobData): Promise<void> {
    this.pendingQueue.push(data);
    this.drain();
  }

  async cancelJob(analysisId: string): Promise<boolean> {
    // 1. Remove from pending if waiting
    this.pendingQueue = this.pendingQueue.filter(j => j.analysisId !== analysisId);

    // 2. Abort if currently active
    const controller = this.activeJobs.get(analysisId);
    if (controller) {
      controller.abort();
      this.activeJobs.delete(analysisId);
    }

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
      console.warn('[Queue] Failed to persist event to DB:', err.message);
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
    return this.activeJobs.size;
  }

  async getPendingJobCount(): Promise<number> {
    return this.pendingQueue.length + this.activeJobs.size;
  }

  private async drain() {
    if (!this.processor) return;
    if (this.pendingQueue.length === 0) return;

    // Process up to 2 concurrent jobs locally
    if (this.activeJobs.size >= 2) return;

    const jobData = this.pendingQueue.shift();
    if (!jobData) return;

    const abortController = new AbortController();
    this.activeJobs.set(jobData.analysisId, abortController);

    // Run asynchronously
    (async () => {
      try {
        await this.processor!(jobData, abortController.signal);
      } catch (err: any) {
        console.error(`[Queue] Job ${jobData.analysisId} error:`, err);
      } finally {
        this.activeJobs.delete(jobData.analysisId);
        this.drain();
      }
    })();
  }
}

let queueServiceInstance: IQueueService | null = null;

export function getQueueService(): IQueueService {
  if (queueServiceInstance) {
    return queueServiceInstance;
  }

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl && redisUrl.startsWith('redis://')) {
    try {
      queueServiceInstance = new BullMQQueueService(redisUrl);
      return queueServiceInstance;
    } catch (err: any) {
      console.warn(`[Queue] Failed to connect to Redis (${err.message}). Using in-process queue adapter.`);
    }
  }

  queueServiceInstance = new InProcessQueueService();
  return queueServiceInstance;
}
