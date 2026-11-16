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
      // Test connectivity with a timeout
      await client.$connect();
      prismaInstance = client;
      console.log('[DB] Connected to PostgreSQL via DATABASE_URL');
      return prismaInstance;
    } catch (err: any) {
      console.warn(`[DB] External PostgreSQL connection failed (${err.message}). Falling back to embedded PGlite.`);
    }
  }

  // Fallback: Embedded PGlite (WebAssembly Postgres)
  const dataDir = path.resolve(process.cwd(), '.data/pglite');
  fs.mkdirSync(dataDir, { recursive: true });

  pgliteInstance = new PGlite(dataDir);
  await pgliteInstance.waitReady;

  // Run initial schema DDL if needed
  const migrationPath = path.resolve(__dirname, '../prisma/migrations/0_init/migration.sql');
  const fallbackMigrationPath = path.resolve(process.cwd(), 'apps/api/prisma/migrations/0_init/migration.sql');
  const actualMigrationPath = fs.existsSync(migrationPath) ? migrationPath : fallbackMigrationPath;

  if (fs.existsSync(actualMigrationPath)) {
    try {
      let ddl = fs.readFileSync(actualMigrationPath, 'utf-8');
      // Strip UTF-8 BOM if present
      ddl = ddl.replace(/^\uFEFF/, '');
      await pgliteInstance.exec(ddl);
      console.log('[DB] Embedded PGlite initialized with schema migrations.');
    } catch (err: any) {
      if (!err.message?.includes('already exists')) {
        console.warn('[DB] PGlite migration notice:', err.message);
      }
    }
  }

  const adapter = new PrismaPGlite(pgliteInstance);
  prismaInstance = new PrismaClient({ adapter: adapter as any });
  await prismaInstance.$connect();
  console.log('[DB] Connected via Prisma PGlite driver adapter');
  return prismaInstance;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!prismaInstance) {
      throw new Error('Database not initialized. Call initDatabase() before accessing prisma.');
    }
    return (prismaInstance as any)[prop];
  }
});
