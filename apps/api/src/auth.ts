import crypto from 'crypto';
import * as argon2 from '@node-rs/argon2';
import type { PrismaClient, User, Session } from '@prisma/client';

export const SESSION_COOKIE_NAME = 'upgradelens_session';
export const SESSION_EXPIRY_DAYS = 7;

/**
 * Hash password with Argon2id
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    algorithm: argon2.Algorithm.Argon2id,
    memoryCost: 19456, // 19 MiB
    timeCost: 2,
    outputLen: 32,
    parallelism: 1
  });
}

/**
 * Verify password against Argon2id hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Hash session token using SHA-256 for secure database storage
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new user session
 */
export async function createSession(
  prisma: PrismaClient,
  userId: string
): Promise<{ rawToken: string; expiresAt: Date; session: Session }> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt
    }
  });

  return { rawToken, expiresAt, session };
}

/**
 * Validate a raw session token and return the associated user
 */
export async function validateSession(
  prisma: PrismaClient,
  rawToken: string
): Promise<{ user: User; session: Session } | null> {
  if (!rawToken || rawToken.length < 16) {
    return null;
  }

  const tokenHash = hashToken(rawToken);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!session) {
    return null;
  }

  // Check expiration
  if (session.expiresAt.getTime() < Date.now()) {
    // Delete expired session
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return { user: session.user, session };
}

/**
 * Revoke a session token
 */
export async function revokeSession(
  prisma: PrismaClient,
  rawToken: string
): Promise<boolean> {
  if (!rawToken) return false;
  const tokenHash = hashToken(rawToken);

  try {
    await prisma.session.delete({ where: { tokenHash } });
    return true;
  } catch {
    return false;
  }
}
