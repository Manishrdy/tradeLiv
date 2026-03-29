import dotenv from 'dotenv';
import path from 'path';

/**
 * Runs once before all test suites.
 * Loads .env and resolves DATABASE_URL so Prisma connects to the dev DB.
 */
export default async function globalSetup() {
  dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

  // Force dev database for tests — never run tests against prod
  const useDb = (process.env.USE_DB || 'dev').toLowerCase();
  if (useDb === 'prod') {
    throw new Error(
      'Refusing to run tests against production database. Set USE_DB=dev in .env.',
    );
  }

  const dbUrl = process.env.DEV_DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DEV_DATABASE_URL is not set in .env — cannot run tests.');
  }

  process.env.DATABASE_URL = dbUrl;
}
