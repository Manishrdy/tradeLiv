import { prisma, AdminNotificationType } from '@furnlo/db';
import { emitAdminEvent } from './adminEvents';
import logger from '../config/logger';

/* ─── Types ────────────────────────────────────────────── */

export interface CreateAdminNotificationPayload {
  type: AdminNotificationType;
  title: string;
  body?: string;
  designerId?: string;
}

/* ─── CRUD ─────────────────────────────────────────────── */

export async function createAdminNotification(payload: CreateAdminNotificationPayload) {
  const notification = await prisma.adminNotification.create({
    data: {
      type: payload.type,
      title: payload.title,
      body: payload.body ?? null,
      designerId: payload.designerId ?? null,
    },
  });

  // Broadcast to all admin SSE streams
  emitAdminEvent('admin_notification', {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    designerId: notification.designerId,
    read: false,
    createdAt: notification.createdAt.toISOString(),
  });

  // Also push updated unread count
  const unreadCount = await getAdminUnreadCount();
  emitAdminEvent('admin_unread_count', { count: unreadCount });

  return notification;
}

export async function getAdminNotifications(
  opts?: { unreadOnly?: boolean; limit?: number; cursor?: string },
) {
  const { unreadOnly, limit = 50, cursor } = opts ?? {};
  let cursorDate: Date | undefined;
  if (cursor) {
    const parsed = new Date(cursor);
    if (!isNaN(parsed.getTime())) cursorDate = parsed;
  }
  return prisma.adminNotification.findMany({
    where: {
      ...(unreadOnly ? { read: false } : {}),
      ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
    },
    include: {
      designer: { select: { id: true, fullName: true, email: true, businessName: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function markAdminNotificationRead(id: string) {
  const result = await prisma.adminNotification.updateMany({
    where: { id, read: false },
    data: { read: true },
  });

  if (result.count > 0) {
    const unreadCount = await getAdminUnreadCount();
    emitAdminEvent('admin_unread_count', { count: unreadCount });
  }

  return result.count;
}

export async function markAllAdminNotificationsRead() {
  const result = await prisma.adminNotification.updateMany({
    where: { read: false },
    data: { read: true },
  });

  if (result.count > 0) {
    emitAdminEvent('admin_unread_count', { count: 0 });
  }

  return result.count;
}

export async function getAdminUnreadCount() {
  return prisma.adminNotification.count({
    where: { read: false },
  });
}
