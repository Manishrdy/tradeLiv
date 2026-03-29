import { prisma, Prisma } from '@furnlo/db';
import logger from '../config/logger';

/**
 * Fire-and-forget audit log writer.
 * Failures are logged but never propagate to the caller.
 */
export async function writeAuditLog(params: {
  actorType: 'designer' | 'client' | 'admin' | 'system';
  actorId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        ...params,
        payload: params.payload as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    logger.warn('audit log write failed', { err, action: params.action });
  }
}
