import { Router, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '@furnlo/db';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { writeAuditLog } from '../services/auditLog';
import { emitProjectEvent } from '../services/projectEvents';
import { createMessage, getMessages, markMessagesRead, getUnreadCount, getProjectPresence } from '../services/messageService';
import logger from '../config/logger';

const router = Router();
router.use(requireAuth, requireRole('designer'));

/* ─── Validation schemas ────────────────────────────── */

const projectCreateSchema = z.object({
  clientId: z.string().uuid('Invalid client ID'),
  name: z.string().min(1, 'Project name is required').max(120),
  description: z.string().max(1000).optional(),
  budgetMin: z.number().positive().optional(),
  budgetMax: z.number().positive().optional(),
  stylePreference: z.string().max(200).optional(),
  status: z.enum(['draft', 'active']).optional().default('draft'),
});

const projectUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(1000).nullable().optional(),
  budgetMin: z.number().positive().nullable().optional(),
  budgetMax: z.number().positive().nullable().optional(),
  stylePreference: z.string().max(200).nullable().optional(),
  status: z.enum(['draft', 'active', 'ordered', 'closed']).optional(),
  imageUrl: z.string().url().nullable().optional(),
});

const imageUploadSchema = z.object({
  imageData: z.string().min(1, 'Image data is required'),
  mimeType: z.enum(['image/jpeg', 'image/jpg', 'image/png'], { errorMap: () => ({ message: 'Only JPEG/JPG/PNG images are allowed' }) }),
});

const MAX_IMAGE_SIZE = 300 * 1024; // 300KB max (after compression on client)

const roomSchema = z.object({
  name: z.string().min(1, 'Room name is required').max(100),
  lengthFt: z.number().positive().optional(),
  widthFt: z.number().positive().optional(),
  heightFt: z.number().positive().optional(),
  budgetMin: z.number().positive().optional(),
  budgetMax: z.number().positive().optional(),
  categoryNeeds: z.array(z.string()).optional().default([]),
  clientRequirements: z.object({
    colorPalette: z.string().max(300).optional(),
    materialPreferences: z.string().max(300).optional(),
    seatingCapacity: z.number().int().positive().optional(),
    functionalConstraints: z.string().max(800).optional(),
    inspirationLinks: z.array(z.string().url('Invalid URL')).max(10).optional(),
  }).optional(),
  notes: z.string().max(1000).optional(),
});

/* ─── Helpers ───────────────────────────────────────── */

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function serializeRoom(r: any) {
  return {
    ...r,
    lengthFt: toNum(r.lengthFt),
    widthFt: toNum(r.widthFt),
    heightFt: toNum(r.heightFt),
    areaSqft: toNum(r.areaSqft),
    budgetMin: toNum(r.budgetMin),
    budgetMax: toNum(r.budgetMax),
  };
}

function serializeProject(p: any) {
  const { imageData, ...rest } = p;
  return {
    ...rest,
    budgetMin: toNum(p.budgetMin),
    budgetMax: toNum(p.budgetMax),
    rooms: p.rooms ? p.rooms.map(serializeRoom) : undefined,
    // Convert Bytes to base64 data URI for client consumption
    imageDataUri: imageData && p.imageMimeType
      ? `data:${p.imageMimeType};base64,${Buffer.from(imageData).toString('base64')}`
      : null,
  };
}

async function getOwnedProject(projectId: string, designerId: string) {
  return prisma.project.findFirst({ where: { id: projectId, designerId } });
}

/* ─── GET /api/projects/stats ───────────────────────── */

router.get('/stats', async (req: AuthRequest, res: Response) => {
  const designerId = req.user!.id;
  try {
    const [activeProjects, totalClients, totalShortlisted, totalOrders] = await Promise.all([
      prisma.project.count({ where: { designerId, status: { in: ['active', 'ordered'] } } }),
      prisma.client.count({ where: { designerId } }),
      prisma.shortlistItem.count({ where: { designerId } }),
      prisma.order.count({ where: { designerId } }),
    ]);
    res.json({ activeProjects, totalClients, totalShortlisted, totalOrders });
  } catch (err) {
    logger.error('projects route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── GET /api/projects ─────────────────────────────── */

router.get('/', async (req: AuthRequest, res: Response) => {
  const { status } = req.query;
  try {
    const where: Record<string, unknown> = { designerId: req.user!.id };
    if (status && typeof status === 'string') where.status = status;

    const projects = await prisma.project.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        portalToken: true,
        budgetMin: true,
        budgetMax: true,
        imageUrl: true,
        imageData: true,
        imageMimeType: true,
        createdAt: true,
        updatedAt: true,
        client: { select: { id: true, name: true, email: true } },
        _count: { select: { rooms: true, shortlistItems: true, orders: true } },
      },
    });

    res.json(projects.map(serializeProject));
  } catch (err) {
    logger.error('projects route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── POST /api/projects ────────────────────────────── */

router.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = projectCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { clientId, name, description, budgetMin, budgetMax, stylePreference, status } = parsed.data;

  try {
    const client = await prisma.client.findFirst({
      where: { id: clientId, designerId: req.user!.id },
    });
    if (!client) {
      res.status(404).json({ error: 'Client not found.' });
      return;
    }

    const project = await prisma.project.create({
      data: {
        designerId: req.user!.id,
        clientId,
        name,
        description: description || null,
        budgetMin: budgetMin ?? null,
        budgetMax: budgetMax ?? null,
        stylePreference: stylePreference || null,
        status: status ?? 'draft',
        portalToken: crypto.randomUUID(),
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        _count: { select: { rooms: true, shortlistItems: true, orders: true } },
      },
    });

    writeAuditLog({
      actorType: 'designer',
      actorId: req.user!.id,
      action: 'project_created',
      entityType: 'project',
      entityId: project.id,
      payload: { name: project.name, status: project.status, clientName: client.name },
    });

    res.status(201).json(serializeProject(project));
  } catch (err) {
    logger.error('projects route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── GET /api/projects/:id ─────────────────────────── */

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, designerId: req.user!.id },
      include: {
        client: {
          select: {
            id: true, name: true, email: true, phone: true,
            billingAddress: true, shippingAddress: true,
          },
        },
        rooms: {
          orderBy: { createdAt: 'asc' },
          include: { _count: { select: { shortlistItems: true } } },
        },
        _count: { select: { shortlistItems: true, cartItems: true, orders: true } },
      },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    res.json(serializeProject(project));
  } catch (err) {
    logger.error('projects route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── PUT /api/projects/:id ─────────────────────────── */

router.put('/:id', async (req: AuthRequest, res: Response) => {
  const parsed = projectUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const existing = await getOwnedProject(req.params.id, req.user!.id);
    if (!existing) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: parsed.data,
      include: {
        client: { select: { id: true, name: true, email: true } },
        rooms: {
          orderBy: { createdAt: 'asc' },
          include: { _count: { select: { shortlistItems: true } } },
        },
        _count: { select: { shortlistItems: true, cartItems: true, orders: true } },
      },
    });

    // Log status changes
    if (parsed.data.status && parsed.data.status !== existing.status) {
      writeAuditLog({
        actorType: 'designer',
        actorId: req.user!.id,
        action: 'project_status_changed',
        entityType: 'project',
        entityId: project.id,
        payload: { from: existing.status, to: parsed.data.status },
      });
    }

    res.json(serializeProject(project));
  } catch (err) {
    logger.error('projects route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── GET /api/projects/:id/activity ────────────────── */

router.get('/:id/activity', async (req: AuthRequest, res: Response) => {
  try {
    const project = await getOwnedProject(req.params.id, req.user!.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    const logs = await prisma.auditLog.findMany({
      where: { entityType: 'project', entityId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    res.json(logs);
  } catch (err) {
    logger.error('projects route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── POST /api/projects/:id/generate-token ─────────── */

router.post('/:id/generate-token', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await getOwnedProject(req.params.id, req.user!.id);
    if (!existing) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    if (existing.portalToken) {
      res.json({ portalToken: existing.portalToken });
      return;
    }

    const updated = await prisma.project.update({
      where: { id: req.params.id },
      data: { portalToken: crypto.randomUUID() },
      select: { id: true, portalToken: true },
    });

    res.json({ portalToken: updated.portalToken });
  } catch (err) {
    logger.error('projects route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── POST /api/projects/:id/rooms ──────────────────── */

router.post('/:id/rooms', async (req: AuthRequest, res: Response) => {
  const parsed = roomSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const project = await getOwnedProject(req.params.id, req.user!.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    const { name, lengthFt, widthFt, heightFt, budgetMin, budgetMax, categoryNeeds, clientRequirements, notes } = parsed.data;
    const areaSqft = lengthFt && widthFt ? lengthFt * widthFt : null;

    const room = await prisma.room.create({
      data: {
        projectId: req.params.id,
        name,
        lengthFt: lengthFt ?? null,
        widthFt: widthFt ?? null,
        heightFt: heightFt ?? null,
        areaSqft,
        budgetMin: budgetMin ?? null,
        budgetMax: budgetMax ?? null,
        categoryNeeds: categoryNeeds ?? [],
        clientRequirements: clientRequirements ?? undefined,
        notes: notes || null,
      },
      include: { _count: { select: { shortlistItems: true } } },
    });

    writeAuditLog({
      actorType: 'designer',
      actorId: req.user!.id,
      action: 'room_created',
      entityType: 'project',
      entityId: req.params.id,
      payload: { roomId: room.id, roomName: room.name },
    });

    res.status(201).json(serializeRoom(room));
  } catch (err) {
    logger.error('projects route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── PUT /api/projects/:id/rooms/:roomId ───────────── */

router.put('/:id/rooms/:roomId', async (req: AuthRequest, res: Response) => {
  const parsed = roomSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const project = await getOwnedProject(req.params.id, req.user!.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    const existingRoom = await prisma.room.findFirst({
      where: { id: req.params.roomId, projectId: req.params.id },
    });
    if (!existingRoom) {
      res.status(404).json({ error: 'Room not found.' });
      return;
    }

    const { name, lengthFt, widthFt, heightFt, budgetMin, budgetMax, categoryNeeds, clientRequirements, notes } = parsed.data;
    const areaSqft = lengthFt && widthFt ? lengthFt * widthFt : null;

    const room = await prisma.room.update({
      where: { id: req.params.roomId },
      data: {
        name,
        lengthFt: lengthFt ?? null,
        widthFt: widthFt ?? null,
        heightFt: heightFt ?? null,
        areaSqft,
        budgetMin: budgetMin ?? null,
        budgetMax: budgetMax ?? null,
        categoryNeeds: categoryNeeds ?? [],
        clientRequirements: clientRequirements ?? undefined,
        notes: notes || null,
      },
      include: { _count: { select: { shortlistItems: true } } },
    });

    res.json(serializeRoom(room));
  } catch (err) {
    logger.error('projects route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── DELETE /api/projects/:id/rooms/:roomId ────────── */

router.delete('/:id/rooms/:roomId', async (req: AuthRequest, res: Response) => {
  try {
    const project = await getOwnedProject(req.params.id, req.user!.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    const room = await prisma.room.findFirst({
      where: { id: req.params.roomId, projectId: req.params.id },
      include: { _count: { select: { shortlistItems: true } } },
    });
    if (!room) {
      res.status(404).json({ error: 'Room not found.' });
      return;
    }

    if (room._count.shortlistItems > 0) {
      res.status(400).json({
        error: `Cannot delete a room with ${room._count.shortlistItems} shortlisted item(s). Remove all items first.`,
      });
      return;
    }

    await prisma.room.delete({ where: { id: req.params.roomId } });

    writeAuditLog({
      actorType: 'designer',
      actorId: req.user!.id,
      action: 'room_deleted',
      entityType: 'project',
      entityId: req.params.id,
      payload: { roomId: room.id, roomName: room.name },
    });

    res.json({ message: 'Room deleted.' });
  } catch (err) {
    logger.error('projects route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── GET /api/projects/:id/messages ───────────────── */

const messageQuerySchema = z.object({
  after: z.string().datetime().optional(),
});

router.get('/:id/messages', async (req: AuthRequest, res: Response) => {
  try {
    const project = await getOwnedProject(req.params.id as string, req.user!.id);
    if (!project) { res.status(404).json({ error: 'Project not found.' }); return; }

    const parsed = messageQuerySchema.safeParse(req.query);
    const after = parsed.success ? parsed.data.after : undefined;
    const messages = await getMessages(project.id, after);
    res.json(messages);
  } catch (err) {
    logger.error('projects route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── POST /api/projects/:id/messages ──────────────── */

const sendMessageSchema = z.object({
  text: z.string().min(1, 'Message cannot be empty').max(5000),
});

router.post('/:id/messages', async (req: AuthRequest, res: Response) => {
  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  try {
    const project = await getOwnedProject(req.params.id as string, req.user!.id);
    if (!project) { res.status(404).json({ error: 'Project not found.' }); return; }

    const designer = await prisma.designer.findUnique({
      where: { id: req.user!.id },
      select: { fullName: true },
    });

    const message = await createMessage({
      projectId: project.id,
      senderType: 'designer',
      senderId: req.user!.id,
      senderName: designer?.fullName ?? 'Designer',
      text: parsed.data.text,
    });

    emitProjectEvent(project.id, 'new_message', {
      id: message.id,
      senderType: message.senderType,
      senderName: message.senderName,
      text: message.text,
      createdAt: message.createdAt.toISOString(),
    });

    res.status(201).json(message);
  } catch (err) {
    logger.error('projects route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── PUT /api/projects/:id/messages/read ──────────── */

router.put('/:id/messages/read', async (req: AuthRequest, res: Response) => {
  try {
    const project = await getOwnedProject(req.params.id as string, req.user!.id);
    if (!project) { res.status(404).json({ error: 'Project not found.' }); return; }

    const count = await markMessagesRead(project.id, 'designer');
    if (count > 0) {
      emitProjectEvent(project.id, 'messages_read', { readerType: 'designer', count });
    }
    res.json({ markedRead: count });
  } catch (err) {
    logger.error('projects route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── GET /api/projects/:id/messages/unread ────────── */

router.get('/:id/messages/unread', async (req: AuthRequest, res: Response) => {
  try {
    const project = await getOwnedProject(req.params.id as string, req.user!.id);
    if (!project) { res.status(404).json({ error: 'Project not found.' }); return; }

    const count = await getUnreadCount(project.id, 'designer');
    res.json({ unread: count });
  } catch (err) {
    logger.error('projects route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── GET /api/projects/:id/presence ───────────────── */

router.get('/:id/presence', async (req: AuthRequest, res: Response) => {
  try {
    const project = await getOwnedProject(req.params.id as string, req.user!.id);
    if (!project) { res.status(404).json({ error: 'Project not found.' }); return; }

    const presence = getProjectPresence(project.id);
    res.json(presence);
  } catch (err) {
    logger.error('projects route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── POST /api/projects/:id/image ───────────────── */

router.post('/:id/image', async (req: AuthRequest, res: Response) => {
  const parsed = imageUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const existing = await getOwnedProject(req.params.id, req.user!.id);
    if (!existing) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    const { imageData: base64Data, mimeType } = parsed.data;

    // Decode base64 and check size
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > MAX_IMAGE_SIZE) {
      res.status(400).json({ error: `Image too large (${Math.round(buffer.length / 1024)}KB). Max ${MAX_IMAGE_SIZE / 1024}KB after compression.` });
      return;
    }

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        imageData: buffer,
        imageMimeType: mimeType,
        imageUrl: null, // clear URL when uploading file
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        rooms: {
          orderBy: { createdAt: 'asc' },
          include: { _count: { select: { shortlistItems: true } } },
        },
        _count: { select: { shortlistItems: true, cartItems: true, orders: true } },
      },
    });

    res.json(serializeProject(project));
  } catch (err) {
    logger.error('projects route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── PUT /api/projects/:id/image-url ────────────── */

router.put('/:id/image-url', async (req: AuthRequest, res: Response) => {
  const schema = z.object({ imageUrl: z.string().url('Invalid image URL') });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const existing = await getOwnedProject(req.params.id, req.user!.id);
    if (!existing) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        imageUrl: parsed.data.imageUrl,
        imageData: null, // clear uploaded data when using URL
        imageMimeType: null,
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        rooms: {
          orderBy: { createdAt: 'asc' },
          include: { _count: { select: { shortlistItems: true } } },
        },
        _count: { select: { shortlistItems: true, cartItems: true, orders: true } },
      },
    });

    res.json(serializeProject(project));
  } catch (err) {
    logger.error('projects route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── DELETE /api/projects/:id/image ─────────────── */

router.delete('/:id/image', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await getOwnedProject(req.params.id, req.user!.id);
    if (!existing) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: { imageUrl: null, imageData: null, imageMimeType: null },
      include: {
        client: { select: { id: true, name: true, email: true } },
        rooms: {
          orderBy: { createdAt: 'asc' },
          include: { _count: { select: { shortlistItems: true } } },
        },
        _count: { select: { shortlistItems: true, cartItems: true, orders: true } },
      },
    });

    res.json(serializeProject(project));
  } catch (err) {
    logger.error('projects route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

export default router;
