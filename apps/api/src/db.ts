import { PrismaClient } from '@prisma/client';
import path from 'path';

let prismaInstance: PrismaClient | null = null;
let initPromise: Promise<PrismaClient> | null = null;

export async function getPrismaClient(): Promise<PrismaClient> {
  if (prismaInstance) {
    return prismaInstance;
  }
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    // Ensure DATABASE_URL is set so Prisma runtime never throws an env missing exception
    if (!process.env.DATABASE_URL) {
      const dbPath = process.env.SQLITE_PATH || (process.platform === 'win32'
        ? path.resolve(process.cwd(), 'dev.db')
        : '/tmp/upgradelens.db');
      process.env.DATABASE_URL = `file:${dbPath}`;
    }

    try {
      const client = new PrismaClient();
      await client.$connect();
      prismaInstance = client;
      console.log('[DB] Connected to database via Prisma Client');
      return prismaInstance;
    } catch (err: any) {
      console.error('[DB] Database connection error:', err.message);
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

export async function closeDatabase(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect().catch(() => {});
    prismaInstance = null;
  }
}
