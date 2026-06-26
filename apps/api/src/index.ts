// MUST be the first import: loads .env and sets DATABASE_URL before any module
// initializes the Prisma client. tsx/esbuild hoist imports to the top, so relying
// on statement order (dotenv between imports) is unsafe. See bootstrap-env.ts.
import { dbEnv as useDb, directUrl as resolvedDirectUrl } from './bootstrap-env';

import { runMigrations } from './config/db';
import { assertAuthEnv } from './config';
import logger from './config/logger';
import { createApp } from './app';
import { verifySmtpConnection } from './services/emailService';
import { purgeExpiredMessages } from './services/messageService';
import { purgeOldNotifications } from './services/notificationService';
import { startBackupJob } from './jobs/backupJob';
import { startKeepAliveJob } from './jobs/keepAliveJob';
import { runBackup } from './services/backupService';

assertAuthEnv();

const app = createApp();
const PORT = process.env.API_PORT ?? 4000;

/* ─── Auto-migrate & start ────────────────────────── */
async function start() {
  if (process.env.RUN_MIGRATIONS_ON_STARTUP === 'true') {
    try {
      runMigrations(resolvedDirectUrl ?? process.env.DATABASE_URL!);
    } catch (err) {
      logger.error('Migration failed — aborting startup', { error: (err as Error).message });
      process.exit(1);
    }
  } else {
    logger.info('Skipping startup migrations; deploy pipeline handles migrate deploy');
  }

  // Verify SMTP connection on startup — logs warning if misconfigured but never blocks boot
  verifySmtpConnection().catch((err) =>
    logger.warn('[email] SMTP connection failed — emails will not send', { err }),
  );

  app.listen(PORT, () => {
    logger.info(`tradeLiv API running on port ${PORT} (db: ${useDb})`);

    // Run message TTL cleanup every 6 hours
    purgeExpiredMessages().catch(() => {});
    setInterval(() => purgeExpiredMessages().catch(() => {}), 6 * 60 * 60 * 1000);

    // Run notification TTL cleanup every 24 hours (90-day retention)
    purgeOldNotifications().catch(() => {});
    setInterval(() => purgeOldNotifications().catch(() => {}), 24 * 60 * 60 * 1000);

    // Start database backup cron job
    startBackupJob().catch((err) => logger.warn('[backup] Failed to start backup job', { err }));

    // Keep Supabase active — pings DB every 24h to prevent inactivity pause
    startKeepAliveJob();

    if (process.env.RUN_BACKUP_ON_STARTUP === 'true') {
      runBackup('restart').catch((err) => logger.warn('[backup] Restart backup failed', { err }));
    } else {
      logger.info('[backup] Startup backup disabled');
    }
  });
}

start();

export default app;
