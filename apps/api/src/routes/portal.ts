import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@furnlo/db';
import { writeAuditLog } from '../services/auditLog';
import { emitProjectEvent } from '../services/projectEvents';
import logger from '../config/logger';

const router = Router();

/* ─── Helpers ───────────────────────────────────────── */

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function serializePortalProject(project: any) {
  return {
    ...project,
    rooms: project.rooms.map((room: any) => ({
      ...room,
      areaSqft: toNum(room.areaSqft),
      lengthFt: toNum(room.lengthFt),
      widthFt: toNum(room.widthFt),
      shortlistItems: room.shortlistItems.map((item: any) => ({
        ...item,
        product: {
          ...item.product,
          price: toNum(item.product.price),
        },
      })),
    })),
    orders: project.orders.map((order: any) => ({
      ...order,
      totalAmount: toNum(order.totalAmount),
    })),
  };
}

/* ─── GET /api/portal/:portalToken ──────────────────── */

// Public — no auth. Returns full project data safe for client view.
// designerNotes is NEVER included (enforced via explicit select).
router.get('/:portalToken', async (req: Request, res: Response) => {
  try {
    const project = await prisma.project.findUnique({
      where: { portalToken: req.params.portalToken },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        designer: {
          select: {
            fullName: true,
            businessName: true,
            phone: true,
            email: true,
          },
        },
        client: {
          select: {
            name: true,
            shippingAddress: true,
          },
        },
        rooms: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            areaSqft: true,
            lengthFt: true,
            widthFt: true,
            shortlistItems: {
              orderBy: [{ priorityRank: 'asc' }, { createdAt: 'asc' }],
              select: {
                id: true,
                status: true,
                quantity: true,
                selectedVariant: true,
                sharedNotes: true,
                clientNotes: true,
                fitAssessment: true,
                isPinned: true,
                // designerNotes intentionally omitted
                product: {
                  select: {
                    id: true,
                    productName: true,
                    brandName: true,
                    price: true,
                    imageUrl: true,
                    productUrl: true,
                    dimensions: true,
                    material: true,
                    finishes: true,
                    leadTime: true,
                    category: true,
                  },
                },
              },
            },
          },
        },
        orders: {
          where: {
            status: { in: ['submitted', 'paid', 'split_to_brands', 'closed'] },
          },
          select: {
            id: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!project) {
      res.status(404).json({ error: 'Portal link not found or has been removed.' });
      return;
    }

    res.json(serializePortalProject(project));
  } catch (err) {
    logger.error('portal route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── PUT /api/portal/:portalToken/shortlist/:itemId ── */

const reviewSchema = z.object({
  clientNotes: z.string().optional(),
  status: z.enum(['suggested', 'approved', 'rejected']).optional(),
});

// Public — client updates their own notes or approves/rejects an item.
router.put('/:portalToken/shortlist/:itemId', async (req: Request, res: Response) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { clientNotes, status } = parsed.data;

  if (clientNotes === undefined && status === undefined) {
    res.status(400).json({ error: 'Nothing to update.' });
    return;
  }

  try {
    // Verify the item belongs to the project identified by this portalToken
    const item = await prisma.shortlistItem.findFirst({
      where: {
        id: req.params.itemId,
        project: { portalToken: req.params.portalToken },
      },
      select: { id: true, projectId: true, status: true, product: { select: { productName: true } } },
    });

    if (!item) {
      res.status(404).json({ error: 'Item not found.' });
      return;
    }

    // Sync status ↔ isPinned: client approve = pin, reject = unpin
    const isPinnedSync = status === 'approved' ? true
      : status === 'rejected' ? false
      : undefined;

    const updated = await prisma.shortlistItem.update({
      where: { id: req.params.itemId },
      data: {
        ...(clientNotes !== undefined && { clientNotes }),
        ...(status !== undefined && { status }),
        ...(isPinnedSync !== undefined && { isPinned: isPinnedSync }),
      },
      select: {
        id: true,
        status: true,
        quantity: true,
        clientNotes: true,
        sharedNotes: true,
        fitAssessment: true,
        isPinned: true,
        selectedVariant: true,
      },
    });

    // Audit log for status changes
    if (status && status !== item.status) {
      writeAuditLog({
        actorType: 'client',
        action: status === 'approved' ? 'shortlist_item_approved' : status === 'rejected' ? 'shortlist_item_rejected' : 'shortlist_item_status_changed',
        entityType: 'project',
        entityId: item.projectId,
        payload: { itemId: item.id, productName: item.product.productName, from: item.status, to: status },
      });
    }

    emitProjectEvent(item.projectId, 'shortlist_updated', { itemId: item.id });

    res.json(updated);
  } catch (err) {
    logger.error('portal route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

export default router;
