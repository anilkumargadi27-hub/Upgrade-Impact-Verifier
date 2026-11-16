import { PrismaClient } from '@prisma/client';
import { PGlite } from '@electric-sql/pglite';
import { PrismaPGlite } from 'pglite-prisma-adapter';
import fs from 'fs';
import path from 'path';

let prismaInstance: PrismaClient | null = null;
let pgliteInstance: PGlite | null = null;

export async function getPrismaClient(): Promise<PrismaClient> {
  if (prismaInstance) {
    return prismaInstance;
  }

  const databaseUrl = process.env.DATABASE_URL;
  const isPostgresUrl = databaseUrl && databaseUrl.startsWith('postgresql://') && !databaseUrl.includes('stub');

  if (isPostgresUrl) {
    try {
      const client = new PrismaClient();
      await client.$connect();
      prismaInstance = client;
      console.log('[Worker-DB] Connected to PostgreSQL via DATABASE_URL');
      return prismaInstance;
    } catch (err: any) {
      console.warn(`[Worker-DB] External PostgreSQL connection failed (${err.message}). Falling back to embedded PGlite.`);
    }
  }

  const dataDir = path.resolve(process.cwd(), '.data/pglite');
  fs.mkdirSync(dataDir, { recursive: true });

  pgliteInstance = new PGlite(dataDir);
  await pgliteInstance.waitReady;

  const adapter = new PrismaPGlite(pgliteInstance);
  prismaInstance = new PrismaClient({ adapter: adapter as any });
  await prismaInstance.$connect();
  console.log('[Worker-DB] Connected via Prisma PGlite driver adapter');
  return prismaInstance;
}
