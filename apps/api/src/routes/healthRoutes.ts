import { Router } from 'express';
import { getPrismaClient } from '../db.js';
import { getQueueService } from '../queue/index.js';

export const healthRouter = Router();

// Quick Liveness Probe (for Render / uptime pings)
healthRouter.get('/healthz', (_req, res) => {
  return res.status(200).json({ status: 'OK' });
});

healthRouter.get('/ping', (_req, res) => {
  return res.status(200).send('pong');
});

// GET /api/health (Liveness / Readiness)
healthRouter.get('/health', async (_req, res) => {
  let dbStatus = 'DISCONNECTED';
  try {
    const prisma = await getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'CONNECTED';
  } catch {
    dbStatus = 'INITIALIZING';
  }

  const queue = getQueueService();
  const isHealthy = dbStatus === 'CONNECTED';

  // Always return 200 so host load balancers / Render health check do not terminate the service
  return res.status(200).json({
    status: isHealthy ? 'HEALTHY' : 'INITIALIZING',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      queue: process.env.REDIS_URL ? 'BULLMQ_REDIS' : 'IN_PROCESS'
    }
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
