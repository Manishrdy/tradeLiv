/**
 * Pre-migration backup script.
 *
 * Run this BEFORE any `prisma migrate deploy` or `prisma db push` to
 * capture a full snapshot of the current database state.
 *
 * Usage:
 *   npx tsx src/scripts/pre-migrate-backup.ts
 *
 * Add to package.json scripts:
 *   "backup:pre-migrate": "tsx src/scripts/pre-migrate-backup.ts"
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

// Resolve DATABASE_URL from USE_DB toggle before importing backupService
import { resolveDbUrl } from '../config/db';
const { directUrl: resolvedDirectUrl } = resolveDbUrl(process.env);
process.env.DATABASE_URL = resolvedDirectUrl!;

import { runBackup } from '../services/backupService';
import logger from '../config/logger';

async function main() {
  logger.info('[pre-migrate-backup] Starting pre-migration backup…');
  try {
    await runBackup('pre-migration');
    logger.info('[pre-migrate-backup] Backup complete. Safe to run migrations.');
    process.exit(0);
  } catch (err) {
    logger.error('[pre-migrate-backup] Backup FAILED — do NOT proceed with migrations until resolved.', { err });
    process.exit(1);
  }
}

main();
