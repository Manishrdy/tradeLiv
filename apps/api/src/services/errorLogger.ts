import crypto from 'crypto';
import { prisma, Prisma } from '@furnlo/db';
import logger from '../config/logger';
import {
  createGithubIssue,
  isGithubIssueIntegrationEnabled,
  reopenGithubIssue,
} from './githubIssueService';

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
  useDbEnv?: string;
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
const AUTO_ISSUE_SEVERITIES = new Set(['error', 'critical']);

function normalizeErrorMessage(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/\b\d{5,}\b/g, '<num>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function buildFingerprint(params: {
  fileName: string;
  routePath?: string;
  httpMethod?: string;
  normalizedErrorMessage: string;
  useDbEnv?: string;
}): string {
  return crypto
    .createHash('sha256')
    .update(
      [
        params.fileName,
        params.routePath ?? '',
        params.httpMethod ?? '',
        params.normalizedErrorMessage,
        params.useDbEnv ?? '',
      ].join('|'),
    )
    .digest('hex');
}

function shouldCreateIssue(severity: string): boolean {
  return AUTO_ISSUE_SEVERITIES.has(severity);
}

function buildIssueTitle(params: {
  severity: string;
  fileName: string;
  routePath?: string;
  httpMethod?: string;
  normalizedErrorMessage: string;
  useDbEnv?: string;
}): string {
  const location = params.routePath
    ? `${params.httpMethod ?? 'N/A'} ${params.routePath}`
    : params.fileName;
  return `[${params.useDbEnv ?? 'unknown'}][${params.severity}] ${location} :: ${params.normalizedErrorMessage}`.slice(0, 255);
}

function buildIssueBody(params: {
  fileName: string;
  routePath?: string;
  httpMethod?: string;
  severity: string;
  useDbEnv?: string;
  fingerprint: string;
  errorMessage: string;
  errorStack?: string;
  errorPayload?: Record<string, unknown>;
  inputPayload?: Record<string, unknown>;
}): string {
  const payload = params.errorPayload ? JSON.stringify(params.errorPayload, null, 2) : '(none)';
  const input = params.inputPayload ? JSON.stringify(params.inputPayload, null, 2) : '(none)';
  const stack = params.errorStack || '(none)';
  return [
    'Auto-created from API `logError`.',
    '',
    `- env: \`${params.useDbEnv ?? 'unknown'}\``,
    `- severity: \`${params.severity}\``,
    `- file: \`${params.fileName}\``,
    `- route: \`${params.routePath ?? 'N/A'}\``,
    `- method: \`${params.httpMethod ?? 'N/A'}\``,
    `- fingerprint: \`${params.fingerprint}\``,
    '',
    '### Error message',
    '```txt',
    params.errorMessage.slice(0, 5_000),
    '```',
    '',
    '### Error stack',
    '```txt',
    stack.slice(0, 20_000),
    '```',
    '',
    '### Error payload',
    '```json',
    payload.slice(0, 20_000),
    '```',
    '',
    '### Input payload',
    '```json',
    input.slice(0, 20_000),
    '```',
  ].join('\n');
}

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
    const severity = params.severity ?? 'error';
    const useDbEnv = params.useDbEnv ?? process.env.USE_DB ?? 'dev';
    const normalizedErrorMessage = normalizeErrorMessage(params.errorMessage);
    const fingerprint = buildFingerprint({
      fileName: params.fileName,
      routePath: params.routePath,
      httpMethod: params.httpMethod,
      normalizedErrorMessage,
      useDbEnv,
    });
    const sanitizedInput = truncatePayload(sanitize(params.inputPayload));
    const sanitizedErrorPayload = truncatePayload(sanitize(params.errorPayload));

    await prisma.errorLog.create({
      data: {
        fileName: params.fileName,
        routePath: params.routePath ?? null,
        httpMethod: params.httpMethod ?? null,
        errorMessage: params.errorMessage,
        errorStack: params.errorStack ?? null,
        errorPayload: (sanitizedErrorPayload as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        inputPayload: (sanitizedInput as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        designerId: params.designerId ?? null,
        severity,
        useDbEnv,
        errorFingerprint: fingerprint,
      },
    });

    const incident = await prisma.errorIncident.upsert({
      where: { fingerprint },
      create: {
        fingerprint,
        fileName: params.fileName,
        routePath: params.routePath ?? null,
        httpMethod: params.httpMethod ?? null,
        normalizedErrorMessage,
        severity,
        useDbEnv,
        lastSeenAt: new Date(),
      },
      update: {
        lastSeenAt: new Date(),
        occurrenceCount: { increment: 1 },
        severity,
        useDbEnv,
      },
    });

    if (!isGithubIssueIntegrationEnabled() || !shouldCreateIssue(severity)) return;

    if (incident.githubIssueNumber && incident.githubIssueState === 'closed') {
      try {
        const reopened = await reopenGithubIssue(incident.githubIssueNumber);
        await prisma.errorIncident.update({
          where: { id: incident.id },
          data: {
            githubIssueState: reopened.state,
            issueClosedAt: reopened.state === 'closed' ? new Date() : null,
            lastSeenAt: new Date(),
          },
        });
      } catch (reopenErr) {
        logger.warn('error incident github reopen failed', {
          err: reopenErr,
          incidentId: incident.id,
          githubIssueNumber: incident.githubIssueNumber,
        });
      }
      return;
    }

    if (incident.githubIssueNumber) return;

    const claimed = await prisma.errorIncident.updateMany({
      where: {
        id: incident.id,
        githubIssueNumber: null,
        issueCreationInProgress: false,
      },
      data: { issueCreationInProgress: true },
    });
    if (claimed.count === 0) return;

    try {
      const issue = await createGithubIssue({
        title: buildIssueTitle({
          severity,
          fileName: params.fileName,
          routePath: params.routePath,
          httpMethod: params.httpMethod,
          normalizedErrorMessage,
          useDbEnv,
        }),
        body: buildIssueBody({
          fileName: params.fileName,
          routePath: params.routePath,
          httpMethod: params.httpMethod,
          severity,
          useDbEnv,
          fingerprint,
          errorMessage: params.errorMessage,
          errorStack: params.errorStack,
          errorPayload: sanitizedErrorPayload,
          inputPayload: sanitizedInput,
        }),
      });

      await prisma.errorIncident.update({
        where: { id: incident.id },
        data: {
          githubIssueNumber: issue.number,
          githubIssueUrl: issue.html_url,
          githubIssueState: issue.state,
          issueCreationInProgress: false,
        },
      });
    } catch (issueErr) {
      await prisma.errorIncident.update({
        where: { id: incident.id },
        data: { issueCreationInProgress: false },
      });
      logger.warn('error incident github issue create failed', {
        err: issueErr,
        incidentId: incident.id,
        fileName: params.fileName,
      });
    }
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
