import cron from 'node-cron';
import { PrismaClient } from '@furnlo/db';
import { runBackup } from '../services/backupService';
import logger from '../config/logger';

const prisma = new PrismaClient();

let currentTask: cron.ScheduledTask | null = null;

// Converts intervalHours to a cron expression: e.g. 6 → "0 */6 * * *"
function toCronExpression(intervalHours: number): string {
  return `0 */${intervalHours} * * *`;
}

export async function startBackupJob(): Promise<void> {
  // Stop any existing job before re-scheduling
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }

  const config = await prisma.backupConfig.findFirst();

  // No config row yet — seed a default and schedule with defaults
  if (!config) {
    await prisma.backupConfig.create({
      data: { enabled: true, intervalHours: 6, ttlDays: 7, driveFolderId: '' },
    });
    logger.info('[backup] No BackupConfig found — created default (6h interval, 7d TTL)');
  }

  const cfg = config ?? { enabled: true, intervalHours: 6 };

  if (!cfg.enabled) {
    logger.info('[backup] Backup job is disabled — skipping schedule');
    return;
  }

  const expression = toCronExpression(cfg.intervalHours);
  logger.info(`[backup] Scheduling backup job: ${expression} (every ${cfg.intervalHours}h)`);

  currentTask = cron.schedule(expression, async () => {
    try {
      await runBackup('scheduled');
    } catch {
      // Error is already logged + persisted in BackupRun — don't crash the job
    }
  });
}

export function stopBackupJob(): void {
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
    logger.info('[backup] Backup job stopped');
  }
}

// Called by admin routes after config update to reload the schedule
export async function restartBackupJob(): Promise<void> {
  logger.info('[backup] Restarting backup job with updated config');
  await startBackupJob();
}
