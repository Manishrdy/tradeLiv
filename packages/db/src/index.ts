import { PrismaClient } from './generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Sized for a 1 GB single-VM API behind Supabase's transaction-mode pooler.
    max: Number(process.env.PG_POOL_MAX ?? 15),
    // Recycle idle handles before pgbouncer/Supabase silently kills the server side
    // (Supabase's pooler default is ~10 min; staying well under avoids stale sockets).
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30_000),
    // Fail fast instead of stacking requests when the pool is starved.
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS ?? 5_000),
    // Keep TCP alive so cross-region (pooler) connections don't die silently.
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Re-export all generated types so consumers only need to import from @furnlo/db
export * from './generated/client';
