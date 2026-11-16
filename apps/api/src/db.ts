import { PrismaClient } from '@prisma/client';
import { PGlite } from '@electric-sql/pglite';
import { PrismaPGlite } from 'pglite-prisma-adapter';
import fs from 'fs';
import path from 'path';

let prismaInstance: PrismaClient | null = null;
let pgliteInstance: PGlite | null = null;
let initPromise: Promise<PrismaClient> | null = null;

export async function getPrismaClient(): Promise<PrismaClient> {
  if (prismaInstance) {
    return prismaInstance;
  }
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const databaseUrl = process.env.DATABASE_URL;
    // External PostgreSQL: require postgresql:// and not a localhost/stub address
    const isPostgresUrl = databaseUrl && 
      databaseUrl.startsWith('postgresql://') && 
      !databaseUrl.includes('stub') &&
      (!databaseUrl.includes('localhost') || process.platform === 'win32');

    if (isPostgresUrl) {
      try {
        const client = new PrismaClient();
        await client.$connect();
        prismaInstance = client;
        console.log('[DB] Connected to PostgreSQL via DATABASE_URL');
        return prismaInstance;
      } catch (err: any) {
        console.warn(`[DB] External PostgreSQL connection failed (${err.message}). Falling back to embedded PGlite.`);
      }
    }

    // Ensure DATABASE_URL is set so Prisma runtime never throws an env missing exception
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = 'postgresql://pglite:pglite@localhost:5432/upgradelens?schema=public';
    }

    // Fallback: Embedded PGlite (WebAssembly Postgres)
    const dataDir = process.env.PGLITE_DATA_DIR || (process.platform === 'win32'
      ? path.resolve(process.cwd(), '.data/pglite')
      : '/tmp/upgradelens-pglite');
    
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (dirErr: any) {
      console.warn('[DB] Notice creating dataDir:', dirErr.message);
    }

    try {
      pgliteInstance = new PGlite(dataDir, { relaxedDurability: true });
      await pgliteInstance.waitReady;

      // Run initial schema DDL if needed
      const migrationPath = path.resolve(__dirname, '../prisma/migrations/0_init/migration.sql');
      const fallbackMigrationPath = path.resolve(process.cwd(), 'apps/api/prisma/migrations/0_init/migration.sql');
      const actualMigrationPath = fs.existsSync(migrationPath) ? migrationPath : fallbackMigrationPath;

      if (fs.existsSync(actualMigrationPath)) {
        try {
          let ddl = fs.readFileSync(actualMigrationPath, 'utf-8');
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
    } catch (pgliteErr: any) {
      console.error('[DB] PGlite initialization error:', pgliteErr.message);
      initPromise = null; // allow retry on failure
      throw pgliteErr;
    }
  })();

  return initPromise;
}

export async function closeDatabase(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect().catch(() => {});
    prismaInstance = null;
  }
  if (pgliteInstance) {
    await pgliteInstance.close().catch(() => {});
    pgliteInstance = null;
  }
  initPromise = null;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!prismaInstance) {
      throw new Error('Database not initialized. Call getPrismaClient() before accessing prisma.');
    }
    return (prismaInstance as any)[prop];
  }
});
