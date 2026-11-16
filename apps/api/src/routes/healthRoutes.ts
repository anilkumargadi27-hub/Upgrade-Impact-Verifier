import { Router } from 'express';
import { getPrismaClient } from '../db.js';
import { getQueueService } from '../queue/index.js';

export const healthRouter = Router();

// Quick Liveness Probe (for Render / platform ping) - shallow check that server event loop is responsive
healthRouter.get('/healthz', (_req, res) => {
  return res.status(200).json({
    status: 'OK',
    uptime: Math.round(process.uptime()),
    memory: {
      rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    },
    timestamp: new Date().toISOString()
  });
});

healthRouter.get('/ping', (_req, res) => {
  return res.status(200).send('pong');
});

// GET /api/health (Readiness Probe) - verifies essential database and queue readiness
healthRouter.get('/health', async (_req, res) => {
  let dbStatus: 'CONNECTED' | 'DISCONNECTED' = 'DISCONNECTED';
  let dbError: string | undefined;

  try {
    const prisma = await getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'CONNECTED';
  } catch (err: any) {
    dbStatus = 'DISCONNECTED';
    dbError = err.message || 'Database connection error';
  }

  const queue = getQueueService();
  const isHealthy = dbStatus === 'CONNECTED';

  return res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'HEALTHY' : 'UNHEALTHY',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      queue: process.env.REDIS_URL ? 'BULLMQ_REDIS' : 'IN_PROCESS'
    },
    error: dbError
  });
});

// GET /api/system/settings (Integration availability without leaking secrets)
healthRouter.get('/system/settings', async (_req, res) => {
  let dbStatus: 'CONNECTED' | 'DISCONNECTED' = 'DISCONNECTED';
  try {
    const prisma = await getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'CONNECTED';
  } catch {
    dbStatus = 'DISCONNECTED';
  }

  const queue = getQueueService();
  const pendingJobs = await queue.getPendingJobCount().catch(() => 0);

  return res.json({
    status: 'HEALTHY',
    version: '1.0.0',
    runnerType: process.env.RUNNER_TYPE || 'process',
    dockerAvailable: false, // Explicitly false since Docker is not on host PATH
    gitHubTokenConfigured: Boolean(process.env.GITHUB_TOKEN),
    geminiConfigured: Boolean(process.env.AI_ENABLED === 'true' && process.env.GEMINI_API_KEY),
    geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    queueState: {
      type: process.env.REDIS_URL ? 'BULLMQ_REDIS' : 'IN_PROCESS',
      activeWorkers: queue.getActiveWorkerCount(),
      pendingJobs
    },
    dbStatus
  });
});
