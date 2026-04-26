import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Prefer explicit NODE_ENV from process manager/container.
// Fallback to development to avoid accidental production mode in local runs.
const resolvedNodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
process.env.NODE_ENV = resolvedNodeEnv === 'production' ? 'production' : 'development';

// FRONTEND_URL drives CORS. If not explicitly set, derive from environment-specific defaults.
if (!process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL = process.env.NODE_ENV === 'production'
    ? (process.env.PROD_FRONTEND_URL || 'http://localhost:3000')
    : (process.env.DEV_FRONTEND_URL || 'http://localhost:3000');
}

// Resolve DATABASE_URL from USE_DB toggle (dev | prod)
import { resolveDbUrl, runMigrations } from './config/db';
const { url: resolvedDbUrl, directUrl: resolvedDirectUrl, backupUrl: resolvedBackupUrl, dbEnv: useDb } = resolveDbUrl(process.env);
process.env.DATABASE_URL = resolvedDbUrl;
process.env.DIRECT_DATABASE_URL = resolvedDirectUrl ?? resolvedDbUrl;
process.env.BACKUP_DATABASE_URL = resolvedBackupUrl ?? resolvedDirectUrl ?? resolvedDbUrl;

import { assertAuthEnv } from './config';
assertAuthEnv();

import logger from './config/logger';
import { createApp } from './app';
import { verifySmtpConnection } from './services/emailService';
import { purgeExpiredMessages } from './services/messageService';
import { purgeOldNotifications } from './services/notificationService';
import { startBackupJob } from './jobs/backupJob';
import { startKeepAliveJob } from './jobs/keepAliveJob';
import { runBackup } from './services/backupService';

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
