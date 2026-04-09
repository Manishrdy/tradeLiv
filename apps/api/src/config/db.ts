import { execSync } from 'child_process';
import path from 'path';
import logger from './logger';

/**
 * Resolves the DATABASE_URL based on USE_DB toggle.
 * Returns the resolved URL and which db environment was selected.
 */
export function resolveDbUrl(env: Record<string, string | undefined>): {
  url: string | undefined;
  directUrl: string | undefined;
  backupUrl: string | undefined;
  dbEnv: string;
} {
  const dbEnv = (env.USE_DB || 'dev').toLowerCase();
  const url = dbEnv === 'prod' ? env.PROD_DATABASE_URL : env.DEV_DATABASE_URL;
  // Session pooler — supports DDL/prepared statements needed for migrations
  const directUrl = dbEnv === 'prod' ? env.PROD_DIRECT_DATABASE_URL : env.DEV_DATABASE_URL;
  // True direct connection (non-pooler) — required for pg_dump
  const backupUrl = dbEnv === 'prod' ? (env.PROD_BACKUP_DATABASE_URL ?? directUrl) : env.DEV_DATABASE_URL;
  return { url, directUrl, backupUrl, dbEnv };
}

/**
 * Runs `prisma migrate deploy` against the current DATABASE_URL.
 * Throws if migration fails.
 */
export function runMigrations(databaseUrl: string): void {
  const schemaPath = path.resolve(__dirname, '../../../../packages/db/prisma/schema.prisma');
  logger.info('Running prisma migrate deploy…');
  execSync(`npx prisma migrate deploy --schema "${schemaPath}"`, {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  logger.info('Migrations applied successfully');
}
