"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.getPrismaClient = getPrismaClient;
const client_1 = require("@prisma/client");
const pglite_1 = require("@electric-sql/pglite");
const pglite_prisma_adapter_1 = require("pglite-prisma-adapter");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
let prismaInstance = null;
let pgliteInstance = null;
async function getPrismaClient() {
    if (prismaInstance) {
        return prismaInstance;
    }
    const databaseUrl = process.env.DATABASE_URL;
    const isPostgresUrl = databaseUrl && databaseUrl.startsWith('postgresql://') && !databaseUrl.includes('stub');
    if (isPostgresUrl) {
        try {
            const client = new client_1.PrismaClient();
            // Test connectivity with a timeout
            await client.$connect();
            prismaInstance = client;
            console.log('[DB] Connected to PostgreSQL via DATABASE_URL');
            return prismaInstance;
        }
        catch (err) {
            console.warn(`[DB] External PostgreSQL connection failed (${err.message}). Falling back to embedded PGlite.`);
        }
    }
    // Fallback: Embedded PGlite (WebAssembly Postgres)
    const dataDir = path_1.default.resolve(process.cwd(), '.data/pglite');
    fs_1.default.mkdirSync(dataDir, { recursive: true });
    pgliteInstance = new pglite_1.PGlite(dataDir);
    await pgliteInstance.waitReady;
    // Run initial schema DDL if needed
    const migrationPath = path_1.default.resolve(__dirname, '../prisma/migrations/0_init/migration.sql');
    const fallbackMigrationPath = path_1.default.resolve(process.cwd(), 'apps/api/prisma/migrations/0_init/migration.sql');
    const actualMigrationPath = fs_1.default.existsSync(migrationPath) ? migrationPath : fallbackMigrationPath;
    if (fs_1.default.existsSync(actualMigrationPath)) {
        try {
            let ddl = fs_1.default.readFileSync(actualMigrationPath, 'utf-8');
            // Strip UTF-8 BOM if present
            ddl = ddl.replace(/^\uFEFF/, '');
            await pgliteInstance.exec(ddl);
            console.log('[DB] Embedded PGlite initialized with schema migrations.');
        }
        catch (err) {
            if (!err.message?.includes('already exists')) {
                console.warn('[DB] PGlite migration notice:', err.message);
            }
        }
    }
    const adapter = new pglite_prisma_adapter_1.PrismaPGlite(pgliteInstance);
    prismaInstance = new client_1.PrismaClient({ adapter: adapter });
    await prismaInstance.$connect();
    console.log('[DB] Connected via Prisma PGlite driver adapter');
    return prismaInstance;
}
exports.prisma = new Proxy({}, {
    get(_target, prop) {
        if (!prismaInstance) {
            throw new Error('Database not initialized. Call initDatabase() before accessing prisma.');
        }
        return prismaInstance[prop];
    }
});
//# sourceMappingURL=db.js.map