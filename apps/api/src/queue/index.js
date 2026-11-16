"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalEventBus = void 0;
exports.getQueueService = getQueueService;
const events_1 = __importDefault(require("events"));
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const db_js_1 = require("../db.js");
// In-process event bus for live SSE streaming and event fan-out
exports.globalEventBus = new events_1.default();
exports.globalEventBus.setMaxListeners(200);
class BullMQQueueService {
    queue;
    redisConnection;
    cancelledJobs = new Set();
    constructor(redisUrl) {
        this.redisConnection = new ioredis_1.default(redisUrl, { maxRetriesPerRequest: null });
        this.queue = new bullmq_1.Queue('analysis-queue', { connection: this.redisConnection });
        console.log('[Queue] Initialized BullMQ with Redis at', redisUrl.replace(/\/\/[^@]*@/, '//***@'));
    }
    async enqueueJob(data) {
        // Idempotent job creation using analysisId as jobId
        await this.queue.add('analyze', data, {
            jobId: `analysis_${data.analysisId}_attempt_${data.attemptNumber}`,
            removeOnComplete: 100,
            removeOnFail: 200,
            attempts: 1 // Managed explicitly via AnalysisAttempt records
        });
    }
    async cancelJob(analysisId) {
        this.cancelledJobs.add(analysisId);
        exports.globalEventBus.emit(`cancel:${analysisId}`);
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
    async publishEvent(event) {
        // Save event to database
        try {
            const prisma = await (0, db_js_1.getPrismaClient)();
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
        }
        catch (err) {
            console.warn('[Queue] Failed to persist event to DB:', err.message);
        }
        // Emit on local bus
        exports.globalEventBus.emit(`event:${event.analysisId}`, event);
    }
    onEvent(analysisId, handler) {
        const eventName = `event:${analysisId}`;
        exports.globalEventBus.on(eventName, handler);
        return () => {
            exports.globalEventBus.off(eventName, handler);
        };
    }
    getActiveWorkerCount() {
        return 1;
    }
    async getPendingJobCount() {
        const counts = await this.queue.getJobCounts('waiting', 'active', 'delayed');
        return (counts.waiting || 0) + (counts.active || 0);
    }
}
class InProcessQueueService {
    pendingQueue = [];
    activeJobs = new Map();
    processor;
    constructor() {
        console.log('[Queue] Initialized in-process QueueAdapter (local mode without Redis)');
    }
    registerProcessor(processor) {
        this.processor = processor;
        this.drain();
    }
    async enqueueJob(data) {
        this.pendingQueue.push(data);
        this.drain();
    }
    async cancelJob(analysisId) {
        // 1. Remove from pending if waiting
        this.pendingQueue = this.pendingQueue.filter(j => j.analysisId !== analysisId);
        // 2. Abort if currently active
        const controller = this.activeJobs.get(analysisId);
        if (controller) {
            controller.abort();
            this.activeJobs.delete(analysisId);
        }
        exports.globalEventBus.emit(`cancel:${analysisId}`);
        return true;
    }
    async publishEvent(event) {
        try {
            const prisma = await (0, db_js_1.getPrismaClient)();
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
        }
        catch (err) {
            console.warn('[Queue] Failed to persist event to DB:', err.message);
        }
        exports.globalEventBus.emit(`event:${event.analysisId}`, event);
    }
    onEvent(analysisId, handler) {
        const eventName = `event:${analysisId}`;
        exports.globalEventBus.on(eventName, handler);
        return () => {
            exports.globalEventBus.off(eventName, handler);
        };
    }
    getActiveWorkerCount() {
        return this.activeJobs.size;
    }
    async getPendingJobCount() {
        return this.pendingQueue.length + this.activeJobs.size;
    }
    async drain() {
        if (!this.processor)
            return;
        if (this.pendingQueue.length === 0)
            return;
        // Process up to 2 concurrent jobs locally
        if (this.activeJobs.size >= 2)
            return;
        const jobData = this.pendingQueue.shift();
        if (!jobData)
            return;
        const abortController = new AbortController();
        this.activeJobs.set(jobData.analysisId, abortController);
        // Run asynchronously
        (async () => {
            try {
                await this.processor(jobData, abortController.signal);
            }
            catch (err) {
                console.error(`[Queue] Job ${jobData.analysisId} error:`, err);
            }
            finally {
                this.activeJobs.delete(jobData.analysisId);
                this.drain();
            }
        })();
    }
}
let queueServiceInstance = null;
function getQueueService() {
    if (queueServiceInstance) {
        return queueServiceInstance;
    }
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl && redisUrl.startsWith('redis://')) {
        try {
            queueServiceInstance = new BullMQQueueService(redisUrl);
            return queueServiceInstance;
        }
        catch (err) {
            console.warn(`[Queue] Failed to connect to Redis (${err.message}). Using in-process queue adapter.`);
        }
    }
    queueServiceInstance = new InProcessQueueService();
    return queueServiceInstance;
}
//# sourceMappingURL=index.js.map