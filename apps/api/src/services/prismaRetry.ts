import logger from '../config/logger';

interface RetryOptions {
  attempts?: number;
  delayMs?: number;
  context?: string;
}

const TRANSIENT_PRISMA_CODES = new Set([
  'P1001', // Can't reach DB
  'P1002', // DB reached but timed out
  'P1008', // Operations timed out
  'P1017', // Server closed the connection
  'P2024', // Connection pool timeout
]);

const BLANK_INVOCATION_RE = /Invalid `prisma\.[\w.]+\(\)` invocation:\s*$/m;

export function isTransientPrismaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: unknown }).name;
  if (typeof name !== 'string') return false;

  if (
    name === 'PrismaClientUnknownRequestError' ||
    name === 'PrismaClientRustPanicError' ||
    name === 'PrismaClientInitializationError'
  ) {
    return true;
  }

  if (name === 'PrismaClientKnownRequestError') {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string' && TRANSIENT_PRISMA_CODES.has(code)) return true;
    // Blank-body engine glitches seen in prod: "Invalid `prisma.x.y()` invocation:"
    // with no diagnostic body. Treat as transient and retry once.
    const message = typeof (err as { message?: unknown }).message === 'string' ? (err as Error).message : '';
    if (!code && BLANK_INVOCATION_RE.test(message.trim())) return true;
  }

  return false;
}

export async function withPrismaRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { attempts = 2, delayMs = 50, context } = opts;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1 || !isTransientPrismaError(err)) throw err;
      logger.warn('prisma retry: transient error, retrying', {
        context,
        attempt: i + 1,
        nextDelayMs: delayMs,
        errName: (err as Error)?.name,
        errCode: (err as { code?: unknown })?.code,
      });
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}
