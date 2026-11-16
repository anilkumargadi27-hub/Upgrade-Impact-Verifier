import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

import { getPrismaClient } from './db.js';
import { getQueueService } from './queue/index.js';
import { authRouter } from './routes/authRoutes.js';
import { projectRouter } from './routes/projectRoutes.js';
import { analysisRouter } from './routes/analysisRoutes.js';
import { fixtureRouter } from './routes/fixtureRoutes.js';
import { healthRouter } from './routes/healthRoutes.js';
import { openApiSpec } from './openapi.js';

const app = express();
const port = parseInt(process.env.PORT || '4000', 10);

// Request ID middleware
app.use((req, _res, next) => {
  req.requestId = crypto.randomUUID();
  next();
});

// Security & Parsing Middlewares
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or same-origin SPA)
    if (!origin || origin === allowedOrigin || process.env.NODE_ENV === 'production') {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true
}));

app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));

// OpenAPI Spec endpoint
app.get('/api/docs/openapi.json', (_req, res) => {
  res.json(openApiSpec);
});

// Mount API Routers
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/projects', projectRouter);
app.use('/api/analyses', analysisRouter);
app.use('/api/fixtures', fixtureRouter);

// Serve Built Frontend Assets in Production (Same-origin SPA)
const webDistPath = path.resolve(process.cwd(), 'apps/web/dist');
const altWebDistPath = path.resolve(__dirname, '../../web/dist');
const finalDistPath = fs.existsSync(webDistPath) ? webDistPath : altWebDistPath;

if (fs.existsSync(finalDistPath)) {
  console.log(`[Server] Serving production frontend from ${finalDistPath}`);
  app.use(express.static(finalDistPath));

  // SPA fallback for client-side routing (ignoring /api routes)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(finalDistPath, 'index.html'));
  });
}

// Global 404 for unhandled API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `API endpoint '${req.originalUrl}' does not exist.`,
    requestId: req.requestId
  });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[Error] Request ${req.requestId} failed:`, err);

  const statusCode = err.statusCode || err.status || 500;
  const message = statusCode === 500 && process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message || 'An unexpected error occurred';

  res.status(statusCode).json({
    code: err.code || 'INTERNAL_ERROR',
    message,
    requestId: req.requestId,
    details: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  });
});

// Server Startup
async function startServer() {
  try {
    // Initialize database
    await getPrismaClient();

    // Initialize queue service
    const queueService = getQueueService();
    if (!process.env.REDIS_URL || !process.env.REDIS_URL.startsWith('redis://')) {
      try {
        const importDynamic = (spec: string) => (Function('spec', 'return import(spec)') as any)(spec);
        const { runAnalysisPipeline } = await importDynamic('../../worker/dist/orchestrator.js');
        (queueService as any).registerProcessor(async (data: any, signal: AbortSignal) => {
          const prisma = await getPrismaClient();
          await runAnalysisPipeline(prisma, queueService, data, signal);
        });
        console.log('[Server] Registered in-process analysis pipeline processor.');
      } catch (err: any) {
        console.warn('[Server] Worker orchestrator will run via standalone worker service:', err.message);
      }
    }

    app.listen(port, '0.0.0.0', () => {
      console.log(`[Server] UpgradeLens API listening on http://0.0.0.0:${port}`);
      console.log(`[Server] Health check: http://localhost:${port}/api/health`);
    });
  } catch (err) {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
  }
}

startServer();

export { app };
