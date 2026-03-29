/**
 * Tests for messageService.
 *
 * - TTL cleanup (purgeExpiredMessages) — hits real DB
 * - Presence tracking — pure in-memory logic
 * - Message CRUD — hits real DB
 */

import '../helpers/setup';
import { cleanDatabase, disconnectDatabase, prisma } from '../helpers/setup';
import { createTestDesigner, createTestClient } from '../helpers/auth';
import { createTestProject } from '../helpers/factories';
import {
  createMessage,
  getMessages,
  markMessagesRead,
  getUnreadCount,
  purgeExpiredMessages,
  setOnline,
  setOffline,
  getPresence,
  getProjectPresence,
  touchPresence,
} from '../../services/messageService';

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await disconnectDatabase();
});

/* ═══════════════════════════════════════════════════════
   Presence tracking (pure in-memory, no DB)
   ═══════════════════════════════════════════════════════ */

describe('presence tracking', () => {
  const projectId = 'test-project-presence';

  it('defaults to offline for unknown project', () => {
    const p = getPresence('unknown-project', 'designer');
    expect(p.online).toBe(false);
  });

  it('setOnline marks actor as online', () => {
    setOnline(projectId, 'designer');
    const p = getPresence(projectId, 'designer');
    expect(p.online).toBe(true);
    expect(p.lastSeen).toBeInstanceOf(Date);
  });

  it('setOffline marks actor as offline', () => {
    setOnline(projectId, 'client');
    setOffline(projectId, 'client');
    const p = getPresence(projectId, 'client');
    expect(p.online).toBe(false);
  });

  it('touchPresence updates lastSeen and stays online', () => {
    setOnline(projectId, 'designer');
    const before = getPresence(projectId, 'designer').lastSeen;

    // Small delay to ensure timestamp differs
    touchPresence(projectId, 'designer');
    const after = getPresence(projectId, 'designer');
    expect(after.online).toBe(true);
    expect(after.lastSeen.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('getProjectPresence returns both designer and client status', () => {
    setOnline(projectId, 'designer');
    setOffline(projectId, 'client');
    const presence = getProjectPresence(projectId);
    expect(presence.designer.online).toBe(true);
    expect(presence.client.online).toBe(false);
  });

  it('designer and client presence are independent', () => {
    const pid = 'independent-test';
    setOnline(pid, 'designer');
    const p = getPresence(pid, 'client');
    expect(p.online).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════
   Message CRUD (real DB)
   ═══════════════════════════════════════════════════════ */

describe('message CRUD', () => {
  let projectId: string;
  let designerId: string;

  beforeEach(async () => {
    const { designer } = await createTestDesigner();
    designerId = designer.id;
    const client = await createTestClient({ designerId });
    const project = await createTestProject({ designerId, clientId: client.id });
    projectId = project.id;
  });

  it('createMessage stores a message in the database', async () => {
    const msg = await createMessage({
      projectId,
      senderType: 'designer',
      senderId: designerId,
      senderName: 'Test Designer',
      text: 'Hello from tests!',
    });

    expect(msg.id).toBeDefined();
    expect(msg.text).toBe('Hello from tests!');
    expect(msg.senderType).toBe('designer');
    expect(msg.readAt).toBeNull();
  });

  it('createMessage stores contextType and contextId', async () => {
    const msg = await createMessage({
      projectId,
      senderType: 'designer',
      senderId: designerId,
      senderName: 'Designer',
      text: 'About this room',
      contextType: 'room',
      contextId: 'some-room-id',
    });

    expect(msg.contextType).toBe('room');
    expect(msg.contextId).toBe('some-room-id');
  });

  it('getMessages returns messages in chronological order', async () => {
    for (let i = 0; i < 3; i++) {
      await createMessage({
        projectId,
        senderType: 'designer',
        senderId: designerId,
        senderName: 'Designer',
        text: `Message ${i}`,
      });
    }

    const { messages } = await getMessages(projectId);
    expect(messages).toHaveLength(3);
    expect(messages[0].text).toBe('Message 0');
    expect(messages[2].text).toBe('Message 2');
  });

  it('getMessages respects limit', async () => {
    for (let i = 0; i < 10; i++) {
      await createMessage({
        projectId,
        senderType: 'designer',
        senderId: designerId,
        senderName: 'Designer',
        text: `Msg ${i}`,
      });
    }

    const { messages, hasMore } = await getMessages(projectId, { limit: 5 });
    expect(messages).toHaveLength(5);
    expect(hasMore).toBe(true);
  });

  it('getMessages clamps limit to 100', async () => {
    // This just checks it doesn't crash with a high limit
    const { messages } = await getMessages(projectId, { limit: 999 });
    expect(messages).toHaveLength(0);
  });

  it('getMessages filters by contextType', async () => {
    await createMessage({
      projectId,
      senderType: 'designer',
      senderId: designerId,
      senderName: 'Designer',
      text: 'General message',
      contextType: 'general',
    });
    await createMessage({
      projectId,
      senderType: 'designer',
      senderId: designerId,
      senderName: 'Designer',
      text: 'Room message',
      contextType: 'room',
      contextId: 'room-1',
    });

    const { messages } = await getMessages(projectId, { contextType: 'room' });
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toBe('Room message');
  });
});

/* ═══════════════════════════════════════════════════════
   Read tracking
   ═══════════════════════════════════════════════════════ */

describe('read tracking', () => {
  let projectId: string;
  let designerId: string;

  beforeEach(async () => {
    const { designer } = await createTestDesigner();
    designerId = designer.id;
    const client = await createTestClient({ designerId });
    const project = await createTestProject({ designerId, clientId: client.id });
    projectId = project.id;
  });

  it('getUnreadCount counts unread messages from the other party', async () => {
    // Client sends 3 messages (unread by designer)
    for (let i = 0; i < 3; i++) {
      await createMessage({
        projectId,
        senderType: 'client',
        senderName: 'Client',
        text: `Client msg ${i}`,
      });
    }

    const count = await getUnreadCount(projectId, 'designer');
    expect(count).toBe(3);

    // Designer's own messages don't count as unread for designer
    await createMessage({
      projectId,
      senderType: 'designer',
      senderId: designerId,
      senderName: 'Designer',
      text: 'Designer msg',
    });
    const countAfter = await getUnreadCount(projectId, 'designer');
    expect(countAfter).toBe(3);
  });

  it('markMessagesRead marks messages from the other party as read', async () => {
    await createMessage({
      projectId,
      senderType: 'client',
      senderName: 'Client',
      text: 'Unread msg',
    });

    const beforeCount = await getUnreadCount(projectId, 'designer');
    expect(beforeCount).toBe(1);

    const marked = await markMessagesRead(projectId, 'designer');
    expect(marked).toBe(1);

    const afterCount = await getUnreadCount(projectId, 'designer');
    expect(afterCount).toBe(0);
  });

  it('markMessagesRead with context filter only marks matching messages', async () => {
    await createMessage({
      projectId,
      senderType: 'client',
      senderName: 'Client',
      text: 'Room msg',
      contextType: 'room',
      contextId: 'room-1',
    });
    await createMessage({
      projectId,
      senderType: 'client',
      senderName: 'Client',
      text: 'General msg',
      contextType: 'general',
    });

    const marked = await markMessagesRead(projectId, 'designer', { contextType: 'room' });
    expect(marked).toBe(1);

    // General message still unread
    const remaining = await getUnreadCount(projectId, 'designer');
    expect(remaining).toBe(1);
  });
});

/* ═══════════════════════════════════════════════════════
   TTL cleanup (real DB)
   ═══════════════════════════════════════════════════════ */

describe('purgeExpiredMessages', () => {
  let projectId: string;
  let designerId: string;

  beforeEach(async () => {
    const { designer } = await createTestDesigner();
    designerId = designer.id;
    const client = await createTestClient({ designerId });
    const project = await createTestProject({ designerId, clientId: client.id });
    projectId = project.id;
  });

  it('deletes messages older than TTL days', async () => {
    // Create a message and backdate it to 60 days ago
    const msg = await createMessage({
      projectId,
      senderType: 'designer',
      senderId: designerId,
      senderName: 'Designer',
      text: 'Old message',
    });

    await prisma.message.update({
      where: { id: msg.id },
      data: { createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
    });

    const purged = await purgeExpiredMessages();
    expect(purged).toBe(1);

    const remaining = await prisma.message.count({ where: { projectId } });
    expect(remaining).toBe(0);
  });

  it('does not delete messages within TTL', async () => {
    await createMessage({
      projectId,
      senderType: 'designer',
      senderId: designerId,
      senderName: 'Designer',
      text: 'Recent message',
    });

    const purged = await purgeExpiredMessages();
    expect(purged).toBe(0);

    const remaining = await prisma.message.count({ where: { projectId } });
    expect(remaining).toBe(1);
  });

  it('only deletes expired messages, keeps recent ones', async () => {
    const old = await createMessage({
      projectId,
      senderType: 'designer',
      senderId: designerId,
      senderName: 'Designer',
      text: 'Old',
    });
    await prisma.message.update({
      where: { id: old.id },
      data: { createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000) },
    });

    await createMessage({
      projectId,
      senderType: 'designer',
      senderId: designerId,
      senderName: 'Designer',
      text: 'New',
    });

    const purged = await purgeExpiredMessages();
    expect(purged).toBe(1);

    const remaining = await prisma.message.findMany({ where: { projectId } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].text).toBe('New');
  });

  it('returns 0 when no messages exist', async () => {
    const purged = await purgeExpiredMessages();
    expect(purged).toBe(0);
  });
});
