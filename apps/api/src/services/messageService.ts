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
  opts?: {
    after?: string;    // cursor: fetch messages newer than this ID (for SSE polling / new messages)
    before?: string;   // cursor: fetch messages older than this ID (for scroll-up lazy loading)
    contextType?: string;
    contextId?: string;
    limit?: number;
  },
) {
  const { after, before, contextType, contextId, limit = 50 } = opts ?? {};
  const clampedLimit = Math.min(limit, 100);

  const where: any = {
    projectId,
    ...(contextType ? { contextType } : {}),
    ...(contextId ? { contextId } : {}),
  };

  if (after) {
    // Forward: newer messages after cursor (for polling / SSE catch-up)
    where.id = { gt: after };
    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: clampedLimit,
    });
    return {
      messages,
      hasMore: messages.length === clampedLimit,
    };
  }

  if (before) {
    // Backward: older messages before cursor (lazy-load on scroll up)
    where.id = { lt: before };
  }

  // Default: newest first (LIFO). Fetch in desc order, then reverse for
  // chronological display so the client gets messages in chat order.
  const messages = await prisma.message.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: clampedLimit,
  });

  return {
    messages: messages.reverse(), // return in chronological order
    hasMore: messages.length === clampedLimit,
  };
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

/* ─── Presence Tracking (in-memory with TTL eviction) ──── */

interface PresenceEntry {
  lastSeen: Date;
  online: boolean;
}

// Key: `${projectId}:${actorType}` (e.g. "uuid:designer" or "uuid:client")
const presenceMap = new Map<string, PresenceEntry>();

// Entries older than this are considered stale and evicted
const PRESENCE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Periodic cleanup every 5 minutes to prevent unbounded growth
const PRESENCE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

function evictStalePresence() {
  const cutoff = Date.now() - PRESENCE_TTL_MS;
  for (const [key, entry] of presenceMap) {
    if (entry.lastSeen.getTime() < cutoff) {
      presenceMap.delete(key);
    }
  }
}

const presenceCleanupTimer = setInterval(evictStalePresence, PRESENCE_CLEANUP_INTERVAL_MS);
presenceCleanupTimer.unref(); // don't prevent process exit

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
  const entry = presenceMap.get(presenceKey(projectId, actorType));
  if (!entry) return { lastSeen: new Date(0), online: false };
  // Auto-expire: if lastSeen is beyond TTL, treat as offline
  if (Date.now() - entry.lastSeen.getTime() > PRESENCE_TTL_MS) {
    return { lastSeen: entry.lastSeen, online: false };
  }
  return entry;
}

export function getProjectPresence(projectId: string) {
  return {
    designer: getPresence(projectId, 'designer'),
    client: getPresence(projectId, 'client'),
  };
}
