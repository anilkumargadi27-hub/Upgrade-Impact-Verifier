import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  RegisterRequestSchema,
  LoginRequestSchema,
  ChangePasswordRequestSchema
} from '@upgradelens/contracts';
import { getPrismaClient } from '../db.js';
import {
  hashPassword,
  verifyPassword,
  createSession,
  revokeSession,
  SESSION_COOKIE_NAME,
  SESSION_EXPIRY_DAYS
} from '../auth.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export const authRouter = Router();

// Rate limiter for login and registration
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many authentication attempts. Please try again in 15 minutes.'
  }
});

function setSessionCookie(res: any, rawToken: string) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path: '/',
    maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  });
}

// POST /api/auth/register
authRouter.post('/register', authLimiter, async (req, res, next) => {
  try {
    const parsed = RegisterRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid registration input',
        details: parsed.error.format(),
        requestId: req.requestId
      });
    }

    const { email, password, name } = parsed.data;
    const prisma = await getPrismaClient();

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return res.status(409).json({
        code: 'USER_EXISTS',
        message: 'An account with this email address already exists.',
        requestId: req.requestId
      });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name
      }
    });

    const { rawToken } = await createSession(prisma, user.id);
    setSessionCookie(res, rawToken);

    return res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
authRouter.post('/login', authLimiter, async (req, res, next) => {
  try {
    const parsed = LoginRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Email and password are required',
        details: parsed.error.format(),
        requestId: req.requestId
      });
    }

    const { email, password } = parsed.data;
    const prisma = await getPrismaClient();

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    // Generic error message for security
    if (!user) {
      return res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email address or password.',
        requestId: req.requestId
      });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email address or password.',
        requestId: req.requestId
      });
    }

    const { rawToken } = await createSession(prisma, user.id);
    setSessionCookie(res, rawToken);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
authRouter.post('/logout', async (req, res, next) => {
  try {
    const rawToken = req.cookies?.[SESSION_COOKIE_NAME];
    if (rawToken) {
      const prisma = await getPrismaClient();
      await revokeSession(prisma, rawToken);
    }
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, async (req, res) => {
  const user = req.user!;
  return res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString()
    }
  });
});

// POST /api/auth/change-password
authRouter.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const parsed = ChangePasswordRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid input for password change',
        details: parsed.error.format(),
        requestId: req.requestId
      });
    }

    const { currentPassword, newPassword } = parsed.data;
    const user = req.user!;
    const prisma = await getPrismaClient();

    const isMatch = await verifyPassword(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({
        code: 'INCORRECT_PASSWORD',
        message: 'Current password does not match.',
        requestId: req.requestId
      });
    }

    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash }
    });

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
});
