import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@furnlo/db';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { writeAuditLog } from '../services/auditLog';
import { emitProjectEvent } from '../services/projectEvents';
import logger from '../config/logger';

const router = Router();
router.use(requireAuth, requireRole('designer'));

/* ─── Validation schemas ────────────────────────────── */

const shortlistAddSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  roomId: z.string().uuid('Invalid room ID'),
  quantity: z.number().int().positive().optional().default(1),
  selectedVariant: z.record(z.string()).optional(),
  designerNotes: z.string().max(1000).optional(),
  sharedNotes: z.string().max(1000).optional(),
  fitAssessment: z.string().max(500).optional(),
});

const shortlistUpdateSchema = z.object({
  quantity: z.number().int().positive().optional(),
  selectedVariant: z.record(z.string()).nullable().optional(),
  designerNotes: z.string().max(1000).nullable().optional(),
  sharedNotes: z.string().max(1000).nullable().optional(),
  fitAssessment: z.string().max(500).nullable().optional(),
  priorityRank: z.number().int().min(0).nullable().optional(),
  isPinned: z.boolean().optional(),
  status: z.enum(['suggested', 'approved', 'rejected', 'added_to_cart']).optional(),
});

/* ─── Helpers ───────────────────────────────────────── */

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function serializeShortlistItem(item: any) {
  return {
    ...item,
    product: item.product
      ? { ...item.product, price: toNum(item.product.price) }
      : undefined,
  };
}

async function getOwnedProject(projectId: string, designerId: string) {
  return prisma.project.findFirst({ where: { id: projectId, designerId } });
}

/* ─── POST /api/orders/projects/:projectId/shortlist ── */

router.post('/projects/:projectId/shortlist', async (req: AuthRequest, res: Response) => {
  const parsed = shortlistAddSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { productId, roomId, quantity, selectedVariant, designerNotes, sharedNotes, fitAssessment } = parsed.data;

  try {
    const project = await getOwnedProject(req.params.projectId, req.user!.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    // Verify room belongs to project
    const room = await prisma.room.findFirst({
      where: { id: roomId, projectId: req.params.projectId },
    });
    if (!room) {
      res.status(404).json({ error: 'Room not found in this project.' });
      return;
    }

    // Verify product exists and belongs to designer
    const product = await prisma.product.findFirst({
      where: { id: productId, designerId: req.user!.id, isActive: true },
    });
    if (!product) {
      res.status(404).json({ error: 'Product not found or inactive.' });
      return;
    }

    // Check if product already shortlisted in this room
    const existing = await prisma.shortlistItem.findFirst({
      where: { projectId: req.params.projectId, roomId, productId },
    });
    if (existing) {
      res.status(400).json({ error: 'Product is already shortlisted in this room.' });
      return;
    }

    // Get next priority rank
    const maxRank = await prisma.shortlistItem.aggregate({
      where: { projectId: req.params.projectId, roomId },
      _max: { priorityRank: true },
    });
    const nextRank = (maxRank._max.priorityRank ?? 0) + 1;

    const item = await prisma.shortlistItem.create({
      data: {
        projectId: req.params.projectId,
        roomId,
        productId,
        designerId: req.user!.id,
        quantity,
        selectedVariant: selectedVariant ?? undefined,
        designerNotes: designerNotes || null,
        sharedNotes: sharedNotes || null,
        fitAssessment: fitAssessment || null,
        priorityRank: nextRank,
      },
      include: {
        product: {
          select: {
            id: true,
            productName: true,
            brandName: true,
            price: true,
            imageUrl: true,
            category: true,
            material: true,
            dimensions: true,
            finishes: true,
            leadTime: true,
            productUrl: true,
            metadata: true,
          },
        },
      },
    });

    writeAuditLog({
      actorType: 'designer',
      actorId: req.user!.id,
      action: 'shortlist_item_added',
      entityType: 'project',
      entityId: req.params.projectId,
      payload: { roomId, productId, productName: product.productName, roomName: room.name },
    });

    res.status(201).json(serializeShortlistItem(item));
  } catch (err) {
    logger.error('orders route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── GET /api/orders/projects/:projectId/shortlist ─── */

router.get('/projects/:projectId/shortlist', async (req: AuthRequest, res: Response) => {
  const roomId = req.query.roomId as string | undefined;

  try {
    const project = await getOwnedProject(req.params.projectId, req.user!.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    const where: any = { projectId: req.params.projectId };
    if (roomId) {
      where.roomId = roomId;
    }

    const items = await prisma.shortlistItem.findMany({
      where,
      orderBy: [{ roomId: 'asc' }, { priorityRank: 'asc' }, { createdAt: 'asc' }],
      include: {
        product: {
          select: {
            id: true,
            productName: true,
            brandName: true,
            price: true,
            imageUrl: true,
            category: true,
            material: true,
            dimensions: true,
            finishes: true,
            leadTime: true,
            isActive: true,
            productUrl: true,
            metadata: true,
          },
        },
        room: {
          select: { id: true, name: true },
        },
      },
    });

    res.json(items.map(serializeShortlistItem));
  } catch (err) {
    logger.error('orders route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── PUT /api/orders/projects/:projectId/shortlist/:itemId ─ */

router.put('/projects/:projectId/shortlist/:itemId', async (req: AuthRequest, res: Response) => {
  const parsed = shortlistUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const project = await getOwnedProject(req.params.projectId, req.user!.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    const existing = await prisma.shortlistItem.findFirst({
      where: { id: req.params.itemId, projectId: req.params.projectId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Shortlist item not found.' });
      return;
    }

    // Sync isPinned ↔ status: starring = approved, unstarring = suggested
    const updateData = { ...parsed.data };
    if (updateData.isPinned === true && updateData.status === undefined) {
      updateData.status = 'approved';
    } else if (updateData.isPinned === false && updateData.status === undefined) {
      updateData.status = 'suggested';
    }
    // If status is set explicitly, sync isPinned accordingly
    if (updateData.status === 'approved' && updateData.isPinned === undefined) {
      updateData.isPinned = true;
    } else if ((updateData.status === 'rejected' || updateData.status === 'suggested') && updateData.isPinned === undefined) {
      updateData.isPinned = false;
    }

    const item = await prisma.shortlistItem.update({
      where: { id: req.params.itemId },
      data: updateData,
      include: {
        product: {
          select: {
            id: true,
            productName: true,
            brandName: true,
            price: true,
            imageUrl: true,
            category: true,
            material: true,
            dimensions: true,
            finishes: true,
            leadTime: true,
            productUrl: true,
            metadata: true,
          },
        },
        room: {
          select: { id: true, name: true },
        },
      },
    });

    writeAuditLog({
      actorType: 'designer',
      actorId: req.user!.id,
      action: 'shortlist_item_updated',
      entityType: 'project',
      entityId: req.params.projectId,
      payload: { itemId: item.id, changes: Object.keys(parsed.data) },
    });

    emitProjectEvent(req.params.projectId, 'shortlist_updated', { itemId: item.id });

    res.json(serializeShortlistItem(item));
  } catch (err) {
    logger.error('orders route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── DELETE /api/orders/projects/:projectId/shortlist/:itemId ─ */

router.delete('/projects/:projectId/shortlist/:itemId', async (req: AuthRequest, res: Response) => {
  try {
    const project = await getOwnedProject(req.params.projectId, req.user!.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    const existing = await prisma.shortlistItem.findFirst({
      where: { id: req.params.itemId, projectId: req.params.projectId },
      include: { product: { select: { productName: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Shortlist item not found.' });
      return;
    }

    await prisma.shortlistItem.delete({ where: { id: req.params.itemId } });

    writeAuditLog({
      actorType: 'designer',
      actorId: req.user!.id,
      action: 'shortlist_item_removed',
      entityType: 'project',
      entityId: req.params.projectId,
      payload: {
        itemId: existing.id,
        productName: existing.product.productName,
        roomId: existing.roomId,
      },
    });

    res.json({ message: 'Item removed from shortlist.' });
  } catch (err) {
    logger.error('orders route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── Cart (stub — Module 5) ───────────────────────── */

router.get('/projects/:projectId/cart', (_req, res) => res.status(501).json({ message: 'Not implemented' }));
router.post('/projects/:projectId/cart', (_req, res) => res.status(501).json({ message: 'Not implemented' }));
router.put('/projects/:projectId/cart/:itemId', (_req, res) => res.status(501).json({ message: 'Not implemented' }));
router.delete('/projects/:projectId/cart/:itemId', (_req, res) => res.status(501).json({ message: 'Not implemented' }));

/* ─── Orders (stub — Module 5) ─────────────────────── */

router.post('/projects/:projectId/orders', (_req, res) => res.status(501).json({ message: 'Not implemented' }));
router.get('/projects/:projectId/orders/:orderId', (_req, res) => res.status(501).json({ message: 'Not implemented' }));

export default router;
