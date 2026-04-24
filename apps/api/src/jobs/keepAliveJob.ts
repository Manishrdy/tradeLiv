import cron from 'node-cron';
import { prisma } from '@furnlo/db';
import logger from '../config/logger';

// Runs every 24 hours to prevent Supabase from pausing due to inactivity
export function startKeepAliveJob(): void {
  cron.schedule('0 0 * * *', async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      logger.info('[keep-alive] DB ping succeeded');
    } catch (err) {
      logger.warn('[keep-alive] DB ping failed', { err });
    }
  });

  logger.info('[keep-alive] DB keep-alive job scheduled (every 24h)');
}
