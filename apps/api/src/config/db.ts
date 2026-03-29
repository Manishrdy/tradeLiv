import { execSync } from 'child_process';
import path from 'path';
import logger from './logger';

/**
 * Resolves the DATABASE_URL based on USE_DB toggle.
 * Returns the resolved URL and which db environment was selected.
 */
export function resolveDbUrl(env: Record<string, string | undefined>): {
  url: string | undefined;
  dbEnv: string;
} {
  const dbEnv = (env.USE_DB || 'dev').toLowerCase();
  const url = dbEnv === 'prod' ? env.PROD_DATABASE_URL : env.DEV_DATABASE_URL;
  return { url, dbEnv };
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
