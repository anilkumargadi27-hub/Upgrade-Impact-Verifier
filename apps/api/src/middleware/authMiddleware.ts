import type { Request, Response, NextFunction } from 'express';
import type { User } from '@prisma/client';
import { validateSession, SESSION_COOKIE_NAME } from '../auth.js';
import { getPrismaClient } from '../db.js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      requestId?: string;
    }
  }
}

/**
 * Middleware to ensure request is authenticated via HttpOnly cookie or Bearer token
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const rawToken = req.cookies?.[SESSION_COOKIE_NAME] ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

    if (!rawToken) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please log in.',
        requestId: req.requestId
      });
    }

    const prisma = await getPrismaClient();
    const result = await validateSession(prisma, rawToken);

    if (!result) {
      // Clear invalid cookie
      res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
      return res.status(401).json({
        code: 'SESSION_EXPIRED',
        message: 'Your session has expired or is invalid. Please log in again.',
        requestId: req.requestId
      });
    }

    req.user = result.user;
    next();
  } catch (err: any) {
    next(err);
  }
}

/**
 * Middleware to verify resource ownership for analyses
 */
export async function requireAnalysisOwnership(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const analysisId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!analysisId) {
      return res.status(400).json({ code: 'BAD_REQUEST', message: 'Missing analysis ID' });
    }

    const prisma = await getPrismaClient();
    const analysis = await prisma.analysis.findUnique({
      where: { id: analysisId },
      select: { id: true, userId: true }
    });

    if (!analysis) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: `Analysis '${analysisId}' not found.`,
        requestId: req.requestId
      });
    }

    if (analysis.userId !== req.user.id) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access or modify this analysis.',
        requestId: req.requestId
      });
    }

    next();
  } catch (err: any) {
    next(err);
  }
}
