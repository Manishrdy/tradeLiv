import { PrismaClient } from './generated/client';

// Singleton: reuse existing client in development to avoid exhausting connections
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Re-export all generated types so consumers only need to import from @furnlo/db
export * from './generated/client';
