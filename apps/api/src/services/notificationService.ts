import { prisma, NotificationType } from '@furnlo/db';
import { emitDesignerEvent } from './designerEvents';
import logger from '../config/logger';

/* ─── Types ────────────────────────────────────────────── */

export interface CreateNotificationPayload {
  designerId: string;
  type: NotificationType;
  title: string;
  body?: string;
  projectId?: string;
  resourceType?: string;
  resourceId?: string;
}

/* ─── CRUD ─────────────────────────────────────────────── */

export async function createNotification(payload: CreateNotificationPayload) {
  const notification = await prisma.notification.create({
    data: {
      designerId: payload.designerId,
      type: payload.type,
      title: payload.title,
      body: payload.body ?? null,
      projectId: payload.projectId ?? null,
      resourceType: payload.resourceType ?? null,
      resourceId: payload.resourceId ?? null,
    },
  });

  // Broadcast to designer's SSE stream
  emitDesignerEvent(payload.designerId, 'notification', {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    projectId: notification.projectId,
    resourceType: notification.resourceType,
    resourceId: notification.resourceId,
    read: false,
    createdAt: notification.createdAt.toISOString(),
  });

  // Also push updated unread count
  const unreadCount = await getUnreadCount(payload.designerId);
  emitDesignerEvent(payload.designerId, 'unread_count', { count: unreadCount });

  return notification;
}

export async function getNotifications(
  designerId: string,
  opts?: { unreadOnly?: boolean; limit?: number; cursor?: string },
) {
  const { unreadOnly, limit = 50, cursor } = opts ?? {};
  return prisma.notification.findMany({
    where: {
      designerId,
      ...(unreadOnly ? { read: false } : {}),
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function markRead(id: string, designerId: string) {
  const notification = await prisma.notification.updateMany({
    where: { id, designerId, read: false },
    data: { read: true },
  });

  if (notification.count > 0) {
    const unreadCount = await getUnreadCount(designerId);
    emitDesignerEvent(designerId, 'unread_count', { count: unreadCount });
  }

  return notification.count;
}

export async function markAllRead(designerId: string) {
  const result = await prisma.notification.updateMany({
    where: { designerId, read: false },
    data: { read: true },
  });

  if (result.count > 0) {
    emitDesignerEvent(designerId, 'unread_count', { count: 0 });
  }

  return result.count;
}

export async function getUnreadCount(designerId: string) {
  return prisma.notification.count({
    where: { designerId, read: false },
  });
}

/* ─── TTL Cleanup ──────────────────────────────────────── */

export async function purgeOldNotifications(days = 90) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const result = await prisma.notification.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  if (result.count > 0) {
    logger.info(`Purged ${result.count} notifications older than ${days} days`);
  }
  return result.count;
}

/* ─── Trigger Helpers ──────────────────────────────────── */

/**
 * Convenience wrapper: looks up the designer for a project and creates a notification.
 * Used by event hooks that only have a projectId.
 */
export async function notifyProjectDesigner(
  projectId: string,
  type: NotificationType,
  title: string,
  body?: string,
  resourceType?: string,
  resourceId?: string,
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { designerId: true },
  });
  if (!project) return null;

  return createNotification({
    designerId: project.designerId,
    type,
    title,
    body,
    projectId,
    resourceType,
    resourceId,
  });
}
