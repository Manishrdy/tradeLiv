// Environment bootstrap — MUST be imported before any module that touches the
// Prisma client. tsx/esbuild hoist `import` statements to the top of each module,
// so loading .env and setting DATABASE_URL via statements *between* imports (as a
// plain index.ts would) runs too late: the pg pool initializes with an empty
// connection string and falls back to localhost (ECONNREFUSED). Importing this
// module first guarantees the env is ready before the client is created.
import dotenv from 'dotenv';
import path from 'path';
import { resolveDbUrl } from './config/db';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Prefer an explicit NODE_ENV from the process manager/container; default to dev.
const resolvedNodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
process.env.NODE_ENV = resolvedNodeEnv === 'production' ? 'production' : 'development';

// FRONTEND_URL drives CORS. If unset, derive from environment-specific defaults.
if (!process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL = process.env.NODE_ENV === 'production'
    ? (process.env.PROD_FRONTEND_URL || 'http://localhost:3000')
    : (process.env.DEV_FRONTEND_URL || 'http://localhost:3000');
}

// Resolve DATABASE_URL (+ direct/backup variants) from the USE_DB toggle.
const resolved = resolveDbUrl(process.env);
process.env.DATABASE_URL = resolved.url;
process.env.DIRECT_DATABASE_URL = resolved.directUrl ?? resolved.url;
process.env.BACKUP_DATABASE_URL = resolved.backupUrl ?? resolved.directUrl ?? resolved.url;

export const dbEnv = resolved.dbEnv;
export const databaseUrl = resolved.url;
export const directUrl = resolved.directUrl;
export const backupUrl = resolved.backupUrl;
