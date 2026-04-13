import { spawnSync } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const tag = '[db:drift]';

function info(msg: string) { console.log(`${tag} ${msg}`); }
function warn(msg: string) { console.warn(`${tag} ${msg}`); }
function fail(msg: string, code = 1): never {
  console.error(`${tag} ${msg}`);
  process.exit(code);
}

if (process.env.SKIP_DRIFT_CHECK === '1') {
  info('SKIP_DRIFT_CHECK=1 — skipping.');
  process.exit(0);
}

const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
const migrationsDir = path.resolve(__dirname, '../prisma/migrations');
const dbCwd = path.resolve(__dirname, '..');

const useDb = (process.env.USE_DB || 'dev').toLowerCase();
const baseUrl =
  process.env.SHADOW_SOURCE_DATABASE_URL ||
  (useDb === 'prod' ? process.env.PROD_DATABASE_URL : process.env.DEV_DATABASE_URL) ||
  process.env.DATABASE_URL;

const explicitShadow = process.env.SHADOW_DATABASE_URL;

if (!explicitShadow && !baseUrl) {
  // No way to obtain a shadow DB — skip rather than block the build. This keeps
  // fresh clones and disconnected environments unblocked while still catching
  // drift in any environment where a DB URL is configured.
  warn('No SHADOW_DATABASE_URL or DB URL available — skipping drift check.');
  process.exit(0);
}

function psql(url: string, sql: string): { ok: boolean; err: string } {
  const r = spawnSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { ok: r.status === 0, err: (r.stderr || r.stdout || '').trim() };
}

let shadowUrl: string;
let cleanup: (() => void) | null = null;

if (explicitShadow) {
  shadowUrl = explicitShadow;
  info('Using SHADOW_DATABASE_URL from env.');
} else {
  // Auto-provision a temp shadow DB on the same server as the configured DB.
  let parsed: URL;
  try {
    parsed = new URL(baseUrl!);
  } catch {
    fail(`Invalid DB URL — cannot derive shadow.`);
  }

  const shadowDbName = `tradeliv_drift_shadow_${process.pid}_${Date.now()}`;
  const adminUrl = new URL(baseUrl!);
  adminUrl.pathname = '/postgres';
  const shadow = new URL(baseUrl!);
  shadow.pathname = `/${shadowDbName}`;

  const create = psql(adminUrl.toString(), `CREATE DATABASE "${shadowDbName}"`);
  if (!create.ok) {
    // Likely missing psql or createdb privilege. Skip rather than block.
    warn(`Could not create shadow DB (${create.err.split('\n')[0] || 'psql unavailable'}) — skipping.`);
    process.exit(0);
  }

  shadowUrl = shadow.toString();
  cleanup = () => {
    psql(adminUrl.toString(), `DROP DATABASE IF EXISTS "${shadowDbName}"`);
  };
}

const r = spawnSync(
  'npx',
  [
    'prisma',
    'migrate',
    'diff',
    '--from-migrations', migrationsDir,
    '--to-schema-datamodel', schemaPath,
    '--shadow-database-url', shadowUrl,
    '--exit-code',
  ],
  { stdio: 'inherit', cwd: dbCwd },
);

cleanup?.();

if (r.status === 0) {
  info('OK — schema.prisma is in sync with migrations.');
  process.exit(0);
}

if (r.status === 2) {
  fail(
    'Schema drift detected — schema.prisma has changes not captured in any migration.\n' +
    `${tag} Run \`npm run db:migrate:dev <migration-name>\` to generate one, or set SKIP_DRIFT_CHECK=1 to bypass.`,
    2,
  );
}

fail(`prisma migrate diff failed with exit code ${r.status}.`);
