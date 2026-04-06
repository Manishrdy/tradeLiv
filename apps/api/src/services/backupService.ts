import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { PrismaClient } from '@furnlo/db';
import logger from '../config/logger';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

export type BackupTrigger = 'scheduled' | 'manual' | 'pre-migration' | 'restart';

// Resolved at runtime so the process CWD is already set
export function getBackupDir(): string {
  return process.env.BACKUP_DIR ?? path.resolve(process.cwd(), 'db-backups');
}

// ─── File naming ──────────────────────────────────────────────────

function buildFileName(env: string, trigger: BackupTrigger): string {
  const ts = new Date()
    .toISOString()
    .replace(/T/, '_')
    .replace(/:/g, '-')
    .replace(/\..+/, '');
  return `tradeliv_${env}_${trigger}_${ts}.dump`;
}

// ─── TTL cleanup ──────────────────────────────────────────────────

async function cleanupOldBackups(backupDir: string, ttlDays: number): Promise<void> {
  try {
    const cutoff = Date.now() - ttlDays * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(backupDir).filter((f) => f.startsWith('tradeliv_'));

    let deleted = 0;
    for (const file of files) {
      const filePath = path.join(backupDir, file);
      const { birthtimeMs } = fs.statSync(filePath);
      if (birthtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        logger.info(`[backup] TTL cleanup — deleted ${file}`);
        deleted++;
      }
    }

    if (deleted > 0) {
      logger.info(`[backup] TTL cleanup — removed ${deleted} file(s) older than ${ttlDays} days`);
    }
  } catch (err) {
    logger.warn('[backup] TTL cleanup failed (non-fatal)', { err });
  }
}

// ─── Core backup runner ───────────────────────────────────────────

export async function runBackup(trigger: BackupTrigger): Promise<void> {
  const env = (process.env.USE_DB || 'dev').toLowerCase();
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is not resolved');

  const backupDir = getBackupDir();
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  // Load config for TTL (fall back to defaults if no config row yet)
  const config = await prisma.backupConfig.findFirst();
  const ttlDays = config?.ttlDays ?? 7;

  const fileName = buildFileName(env, trigger);
  const destPath = path.join(backupDir, fileName);
  const tmpPath = path.join(os.tmpdir(), fileName);
  const startedAt = new Date();

  // Atomic guard — skip if a backup for this env is already in progress
  const run = await prisma.$transaction(async (tx) => {
    const running = await tx.backupRun.count({ where: { env, status: 'running' } });
    if (running > 0) return null;
    return tx.backupRun.create({ data: { env, trigger, status: 'running' } });
  });

  if (!run) {
    logger.info(`[backup] Skipping ${trigger} — a ${env} backup is already running`);
    return;
  }

  logger.info(`[backup] Starting ${trigger} backup → ${fileName}`);

  try {
    await execAsync(`pg_dump "${dbUrl}" -F c -f "${tmpPath}"`);

    fs.renameSync(tmpPath, destPath);

    const fileSizeBytes = fs.statSync(destPath).size;
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    await prisma.backupRun.update({
      where: { id: run.id },
      data: {
        status: 'success',
        completedAt,
        durationMs,
        fileSizeBytes,
        driveFileId: fileName,
        driveFileName: fileName,
      },
    });

    logger.info(`[backup] Done — ${fileName} (${(fileSizeBytes / 1024 / 1024).toFixed(2)} MB, ${durationMs}ms)`);

    await cleanupOldBackups(backupDir, ttlDays);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await prisma.backupRun.update({
      where: { id: run.id },
      data: { status: 'failed', completedAt: new Date(), error },
    });
    logger.error(`[backup] Failed — ${fileName}`, { err });
    throw err;
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
}
