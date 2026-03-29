import { prisma, Prisma } from '@furnlo/db';
import logger from '../config/logger';

interface ErrorLogParams {
  fileName: string;
  routePath?: string;
  httpMethod?: string;
  errorMessage: string;
  errorStack?: string;
  errorPayload?: Record<string, unknown>;
  inputPayload?: Record<string, unknown>;
  designerId?: string;
  severity?: 'error' | 'warn' | 'critical';
}

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'refreshtoken',
  'authorization',
  'secret',
  'apikey',
  'accesstoken',
  'currentpassword',
  'newpassword',
  'confirmpassword',
]);

const MAX_PAYLOAD_SIZE = 10_000;

function sanitize(obj?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!obj) return undefined;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      clean[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      clean[key] = sanitize(value as Record<string, unknown>);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

function truncatePayload(obj?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!obj) return undefined;
  const str = JSON.stringify(obj);
  if (str.length <= MAX_PAYLOAD_SIZE) return obj;
  return { _truncated: true, _size: str.length, _preview: str.slice(0, MAX_PAYLOAD_SIZE) };
}

/**
 * Fire-and-forget error log writer.
 * Failures are logged to Winston but never propagate to the caller.
 */
export async function logError(params: ErrorLogParams): Promise<void> {
  try {
    const sanitizedInput = truncatePayload(sanitize(params.inputPayload));
    await prisma.errorLog.create({
      data: {
        fileName: params.fileName,
        routePath: params.routePath ?? null,
        httpMethod: params.httpMethod ?? null,
        errorMessage: params.errorMessage,
        errorStack: params.errorStack ?? null,
        errorPayload: (params.errorPayload as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        inputPayload: (sanitizedInput as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        designerId: params.designerId ?? null,
        severity: params.severity ?? 'error',
      },
    });
  } catch (err) {
    logger.warn('error log write failed', { err, fileName: params.fileName });
  }
}

/**
 * Convenience helper for Express route catch blocks.
 * Extracts common fields from the request and error automatically.
 */
export function logRouteError(
  fileName: string,
  err: unknown,
  req: { path?: string; method?: string; body?: unknown; params?: unknown; query?: unknown; user?: { id?: string } },
): void {
  const error = err instanceof Error ? err : new Error(String(err));
  logError({
    fileName,
    routePath: req.path,
    httpMethod: req.method,
    errorMessage: error.message,
    errorStack: error.stack,
    errorPayload: !(err instanceof Error) ? { raw: String(err) } : undefined,
    inputPayload: {
      body: req.body as Record<string, unknown>,
      params: req.params as Record<string, unknown>,
      query: req.query as Record<string, unknown>,
    },
    designerId: req.user?.id,
  });
}
