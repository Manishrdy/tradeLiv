import { resolveDbUrl, runMigrations } from '../db';
import { execSync } from 'child_process';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

jest.mock('../logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn() },
}));

const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;

/* ─────────────────────────────────────────────────────
   resolveDbUrl
   ───────────────────────────────────────────────────── */
describe('resolveDbUrl', () => {
  const DEV_URL = 'postgresql://dev-host:5432/dev';
  const PROD_URL = 'postgresql://prod-host:5432/prod';

  // ── Positive cases ──────────────────────────────────

  it('returns DEV_DATABASE_URL when USE_DB is "dev"', () => {
    const result = resolveDbUrl({
      USE_DB: 'dev',
      DEV_DATABASE_URL: DEV_URL,
      PROD_DATABASE_URL: PROD_URL,
    });
    expect(result.url).toBe(DEV_URL);
    expect(result.dbEnv).toBe('dev');
  });

  it('returns PROD_DATABASE_URL when USE_DB is "prod"', () => {
    const result = resolveDbUrl({
      USE_DB: 'prod',
      DEV_DATABASE_URL: DEV_URL,
      PROD_DATABASE_URL: PROD_URL,
    });
    expect(result.url).toBe(PROD_URL);
    expect(result.dbEnv).toBe('prod');
  });

  it('defaults to dev when USE_DB is not set', () => {
    const result = resolveDbUrl({
      DEV_DATABASE_URL: DEV_URL,
      PROD_DATABASE_URL: PROD_URL,
    });
    expect(result.url).toBe(DEV_URL);
    expect(result.dbEnv).toBe('dev');
  });

  it('defaults to dev when USE_DB is empty string', () => {
    const result = resolveDbUrl({
      USE_DB: '',
      DEV_DATABASE_URL: DEV_URL,
      PROD_DATABASE_URL: PROD_URL,
    });
    expect(result.url).toBe(DEV_URL);
    expect(result.dbEnv).toBe('dev');
  });

  it('handles USE_DB case-insensitively ("PROD" → prod)', () => {
    const result = resolveDbUrl({
      USE_DB: 'PROD',
      DEV_DATABASE_URL: DEV_URL,
      PROD_DATABASE_URL: PROD_URL,
    });
    expect(result.url).toBe(PROD_URL);
    expect(result.dbEnv).toBe('prod');
  });

  it('handles USE_DB mixed case ("Prod" → prod)', () => {
    const result = resolveDbUrl({
      USE_DB: 'Prod',
      DEV_DATABASE_URL: DEV_URL,
      PROD_DATABASE_URL: PROD_URL,
    });
    expect(result.url).toBe(PROD_URL);
    expect(result.dbEnv).toBe('prod');
  });

  it('handles USE_DB "DEV" (uppercase) → dev', () => {
    const result = resolveDbUrl({
      USE_DB: 'DEV',
      DEV_DATABASE_URL: DEV_URL,
      PROD_DATABASE_URL: PROD_URL,
    });
    expect(result.url).toBe(DEV_URL);
    expect(result.dbEnv).toBe('dev');
  });

  // ── Negative / edge cases ──────────────────────────

  it('returns undefined url when USE_DB is "dev" but DEV_DATABASE_URL is missing', () => {
    const result = resolveDbUrl({
      USE_DB: 'dev',
      PROD_DATABASE_URL: PROD_URL,
    });
    expect(result.url).toBeUndefined();
    expect(result.dbEnv).toBe('dev');
  });

  it('returns undefined url when USE_DB is "prod" but PROD_DATABASE_URL is missing', () => {
    const result = resolveDbUrl({
      USE_DB: 'prod',
      DEV_DATABASE_URL: DEV_URL,
    });
    expect(result.url).toBeUndefined();
    expect(result.dbEnv).toBe('prod');
  });

  it('falls back to dev for unrecognized USE_DB values', () => {
    const result = resolveDbUrl({
      USE_DB: 'staging',
      DEV_DATABASE_URL: DEV_URL,
      PROD_DATABASE_URL: PROD_URL,
    });
    expect(result.url).toBe(DEV_URL);
    expect(result.dbEnv).toBe('staging');
  });

  it('returns undefined url when no database URLs are provided', () => {
    const result = resolveDbUrl({});
    expect(result.url).toBeUndefined();
    expect(result.dbEnv).toBe('dev');
  });

  it('does not mutate the input env object', () => {
    const env = {
      USE_DB: 'prod',
      DEV_DATABASE_URL: DEV_URL,
      PROD_DATABASE_URL: PROD_URL,
    };
    const envCopy = { ...env };
    resolveDbUrl(env);
    expect(env).toEqual(envCopy);
  });
});

/* ─────────────────────────────────────────────────────
   runMigrations
   ───────────────────────────────────────────────────── */
describe('runMigrations', () => {
  beforeEach(() => {
    mockedExecSync.mockReset();
  });

  // ── Positive cases ──────────────────────────────────

  it('calls execSync with prisma migrate deploy and the correct schema path', () => {
    mockedExecSync.mockReturnValue(Buffer.from(''));

    runMigrations('postgresql://localhost:5432/test');

    expect(mockedExecSync).toHaveBeenCalledTimes(1);
    const command = mockedExecSync.mock.calls[0][0] as string;
    expect(command).toContain('npx prisma migrate deploy');
    expect(command).toContain('--schema');
    expect(command).toContain('schema.prisma');
  });

  it('passes DATABASE_URL in the env to execSync', () => {
    mockedExecSync.mockReturnValue(Buffer.from(''));
    const dbUrl = 'postgresql://prod-host:5432/prod';

    runMigrations(dbUrl);

    const options = mockedExecSync.mock.calls[0][1] as { env: Record<string, string> };
    expect(options.env.DATABASE_URL).toBe(dbUrl);
  });

  it('does not throw when migration succeeds', () => {
    mockedExecSync.mockReturnValue(Buffer.from(''));
    expect(() => runMigrations('postgresql://localhost:5432/test')).not.toThrow();
  });

  // ── Negative cases ──────────────────────────────────

  it('throws when execSync fails (migration error)', () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error('Migration failed: could not connect to database');
    });

    expect(() => runMigrations('postgresql://bad-host:5432/db')).toThrow(
      'Migration failed: could not connect to database',
    );
  });

  it('throws when database URL is unreachable', () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error('P1001: Can\'t reach database server');
    });

    expect(() => runMigrations('postgresql://unreachable:5432/db')).toThrow('P1001');
  });

  it('throws on invalid connection string', () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error('Error parsing connection string: invalid format');
    });

    expect(() => runMigrations('not-a-valid-url')).toThrow('Error parsing connection string');
  });

  it('throws on permission denied', () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error('P3014: Prisma Migrate could not create the shadow database');
    });

    expect(() => runMigrations('postgresql://readonly:5432/db')).toThrow('P3014');
  });

  it('uses stdio: inherit for visible output', () => {
    mockedExecSync.mockReturnValue(Buffer.from(''));

    runMigrations('postgresql://localhost:5432/test');

    const options = mockedExecSync.mock.calls[0][1] as { stdio: string };
    expect(options.stdio).toBe('inherit');
  });
});
