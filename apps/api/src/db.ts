import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

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
    // Resolve database file location
    if (!process.env.DATABASE_URL) {
      const candidates = [
        path.resolve(process.cwd(), 'apps/api/prisma/upgradelens.db'),
        path.resolve(process.cwd(), 'prisma/upgradelens.db'),
        path.resolve(__dirname, '../prisma/upgradelens.db'),
        path.resolve(process.cwd(), 'dev.db')
      ];
      const existing = candidates.find(c => fs.existsSync(c));
      const chosen = existing || candidates[0];
      process.env.DATABASE_URL = `file:${chosen}`;
    }

    try {
      const client = new PrismaClient();
      await client.$connect();

      // Check if User table exists; if not, apply schema migrations dynamically
      try {
        await client.user.count();
      } catch (tableErr: any) {
        if (tableErr.code === 'P2021' || tableErr.message?.includes('does not exist')) {
          console.log('[DB] Fresh database detected. Synchronizing schema...');
          const { execSync } = await import('child_process');
          const prismaDir = path.resolve(__dirname, '..');
          try {
            execSync('npx prisma db push --skip-generate --accept-data-loss', {
              cwd: prismaDir,
              env: process.env,
              stdio: 'inherit'
            });
            console.log('[DB] Schema pushed successfully.');
          } catch (syncErr: any) {
            console.warn('[DB] Schema push notice:', syncErr.message);
          }
        }
      }

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
