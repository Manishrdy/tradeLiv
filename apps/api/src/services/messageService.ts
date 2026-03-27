import { prisma, ActorType } from '@furnlo/db';
import { config } from '../config';
import logger from '../config/logger';

/* ─── Types ────────────────────────────────────────────── */

export interface MessagePayload {
  projectId: string;
  senderType: ActorType;
  senderId?: string;
  senderName: string;
  text: string;
  contextType?: string;
  contextId?: string;
  metadata?: Record<string, unknown>;
}

/* ─── CRUD ─────────────────────────────────────────────── */

export async function createMessage(payload: MessagePayload) {
  return prisma.message.create({
    data: {
      projectId: payload.projectId,
      senderType: payload.senderType,
      senderId: payload.senderId,
      senderName: payload.senderName,
      text: payload.text,
      contextType: payload.contextType ?? null,
      contextId: payload.contextId ?? null,
      metadata: payload.metadata ?? undefined,
    },
  });
}

export async function getMessages(
  projectId: string,
  opts?: { after?: string; contextType?: string; contextId?: string; limit?: number },
) {
  const { after, contextType, contextId, limit = 200 } = opts ?? {};
  return prisma.message.findMany({
    where: {
      projectId,
      ...(after ? { createdAt: { gt: new Date(after) } } : {}),
      ...(contextType ? { contextType } : {}),
      ...(contextId ? { contextId } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
}

export async function markMessagesRead(
  projectId: string,
  readerType: 'designer' | 'client',
  contextFilter?: { contextType?: string; contextId?: string },
) {
  const senderType: ActorType = readerType === 'designer' ? 'client' : 'designer';
  const result = await prisma.message.updateMany({
    where: {
      projectId,
      senderType,
      readAt: null,
      ...(contextFilter?.contextType ? { contextType: contextFilter.contextType } : {}),
      ...(contextFilter?.contextId ? { contextId: contextFilter.contextId } : {}),
    },
    data: { readAt: new Date() },
  });
  return result.count;
}

export async function getUnreadCount(projectId: string, readerType: 'designer' | 'client') {
  const senderType: ActorType = readerType === 'designer' ? 'client' : 'designer';
  return prisma.message.count({
    where: { projectId, senderType, readAt: null },
  });
}

/* ─── TTL Cleanup ──────────────────────────────────────── */

export async function purgeExpiredMessages() {
  const ttlDays = config.messageTtlDays;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ttlDays);

  const result = await prisma.message.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  if (result.count > 0) {
    logger.info(`Purged ${result.count} messages older than ${ttlDays} days`);
  }
  return result.count;
}

/* ─── Presence Tracking (in-memory) ────────────────────── */

interface PresenceEntry {
  lastSeen: Date;
  online: boolean;
}

// Key: `${projectId}:${actorType}` (e.g. "uuid:designer" or "uuid:client")
const presenceMap = new Map<string, PresenceEntry>();

function presenceKey(projectId: string, actorType: string) {
  return `${projectId}:${actorType}`;
}

export function setOnline(projectId: string, actorType: string) {
  presenceMap.set(presenceKey(projectId, actorType), {
    lastSeen: new Date(),
    online: true,
  });
}

export function setOffline(projectId: string, actorType: string) {
  const key = presenceKey(projectId, actorType);
  const entry = presenceMap.get(key);
  presenceMap.set(key, {
    lastSeen: entry?.lastSeen ?? new Date(),
    online: false,
  });
}

export function touchPresence(projectId: string, actorType: string) {
  const key = presenceKey(projectId, actorType);
  presenceMap.set(key, { lastSeen: new Date(), online: true });
}

export function getPresence(projectId: string, actorType: string): PresenceEntry {
  return presenceMap.get(presenceKey(projectId, actorType)) ?? { lastSeen: new Date(0), online: false };
}

export function getProjectPresence(projectId: string) {
  return {
    designer: getPresence(projectId, 'designer'),
    client: getPresence(projectId, 'client'),
  };
}
