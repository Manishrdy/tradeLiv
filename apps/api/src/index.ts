import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Auto-detect OCI cloud environment: hostname contains "ubuntu" → prod, else dev
const isOCI = os.hostname().toLowerCase().includes('ubuntu');
process.env.NODE_ENV = isOCI ? process.env.PROD_NODE_ENV : process.env.DEV_NODE_ENV;
process.env.FRONTEND_URL = isOCI ? process.env.PROD_FRONTEND_URL : process.env.DEV_FRONTEND_URL;

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
import { runBackup } from './services/backupService';

const app = createApp();
const PORT = process.env.API_PORT ?? 4000;

/* ─── Auto-migrate & start ────────────────────────── */
async function start() {
  try {
    runMigrations(resolvedDirectUrl ?? process.env.DATABASE_URL!);
  } catch (err) {
    logger.error('Migration failed — aborting startup', { error: (err as Error).message });
    process.exit(1);
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

    // Take a backup on every server restart
    runBackup('restart').catch((err) => logger.warn('[backup] Restart backup failed', { err }));
  });
}

start();

export default app;
