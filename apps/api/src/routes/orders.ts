import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma, Prisma } from '@furnlo/db';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { writeAuditLog } from '../services/auditLog';
import { emitProjectEvent } from '../services/projectEvents';
import { splitOrderByBrand } from '../services/orderSplitter';
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

const cartAddSchema = z.object({
  shortlistItemId: z.string().uuid('Invalid shortlist item ID'),
  quantity: z.number().int().positive().optional(),
});

const cartUpdateSchema = z.object({
  quantity: z.number().int().positive('Quantity must be at least 1'),
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

function serializeCartItem(item: any) {
  return {
    ...item,
    unitPrice: toNum(item.unitPrice),
    product: item.product
      ? { ...item.product, price: toNum(item.product.price) }
      : undefined,
  };
}

function serializeOrder(order: any) {
  return {
    ...order,
    totalAmount: toNum(order.totalAmount),
    taxAmount: toNum(order.taxAmount),
    lineItems: order.lineItems?.map((li: any) => ({
      ...li,
      unitPrice: toNum(li.unitPrice),
      lineTotal: toNum(li.lineTotal),
      product: li.product ? { ...li.product, price: toNum(li.product.price) } : undefined,
    })),
    brandPOs: order.brandPOs?.map((po: any) => ({
      ...po,
      subtotal: toNum(po.subtotal),
      lineItems: po.lineItems?.map((li: any) => ({
        ...li,
        unitPrice: toNum(li.unitPrice),
        lineTotal: toNum(li.lineTotal),
      })),
    })),
  };
}

const productSelect = {
  id: true, productName: true, brandName: true, price: true,
  imageUrl: true, category: true, material: true, dimensions: true,
  finishes: true, leadTime: true, productUrl: true, metadata: true,
};

async function getOwnedProject(projectId: string, designerId: string) {
  return prisma.project.findFirst({ where: { id: projectId, designerId } });
}

/* ─── GET /api/orders (global — all orders for designer) ─ */

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const where: any = { designerId: req.user!.id };
    if (status) where.status = status;

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        project: {
          select: { id: true, name: true, client: { select: { name: true } } },
        },
        _count: { select: { lineItems: true, brandPOs: true } },
      },
    });

    res.json(orders.map((o) => ({
      ...o,
      totalAmount: toNum(o.totalAmount),
      taxAmount: toNum(o.taxAmount),
    })));
  } catch (err) {
    logger.error('orders route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── PUT /api/orders/:orderId/brand-pos/:poId/status ── */

const brandPoStatusSchema = z.object({
  status: z.enum(['sent', 'acknowledged', 'in_production', 'dispatched', 'delivered', 'cancelled']),
});

router.put('/:orderId/brand-pos/:poId/status', async (req: AuthRequest, res: Response) => {
  const parsed = brandPoStatusSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.orderId, designerId: req.user!.id },
    });
    if (!order) { res.status(404).json({ error: 'Order not found.' }); return; }

    const po = await prisma.brandPurchaseOrder.findFirst({
      where: { id: req.params.poId, orderId: req.params.orderId },
    });
    if (!po) { res.status(404).json({ error: 'Brand PO not found.' }); return; }

    const updated = await prisma.brandPurchaseOrder.update({
      where: { id: req.params.poId },
      data: { status: parsed.data.status },
    });

    writeAuditLog({
      actorType: 'designer', actorId: req.user!.id,
      action: 'brand_po_status_changed', entityType: 'project', entityId: order.projectId,
      payload: { orderId: order.id, poId: po.id, brandName: po.brandName, oldStatus: po.status, newStatus: parsed.data.status },
    });

    emitProjectEvent(order.projectId, 'order_updated', { orderId: order.id, poId: po.id });

    res.json({ ...updated, subtotal: toNum(updated.subtotal) });
  } catch (err) {
    logger.error('orders route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

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

    // Check if product already shortlisted in this room (skip ordered items — allow re-adding for new orders)
    try {
      const item = await prisma.$transaction(async (tx) => {
        const existing = await tx.shortlistItem.findFirst({
          where: { projectId: req.params.projectId, roomId, productId, status: { not: 'ordered' } },
        });
        if (existing) {
          throw new Error('DUPLICATE_SHORTLIST');
        }

        // Get next priority rank
        const maxRank = await tx.shortlistItem.aggregate({
          where: { projectId: req.params.projectId, roomId },
          _max: { priorityRank: true },
        });
        const nextRank = (maxRank._max.priorityRank ?? 0) + 1;

        return await tx.shortlistItem.create({
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
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      writeAuditLog({
        actorType: 'designer',
        actorId: req.user!.id,
        action: 'shortlist_item_added',
        entityType: 'project',
        entityId: req.params.projectId,
        payload: { roomId, productId, productName: product.productName, roomName: room.name },
      });

      res.status(201).json(serializeShortlistItem(item));
    } catch (txErr: any) {
      if (txErr.message === 'DUPLICATE_SHORTLIST') {
        res.status(400).json({ error: 'Product is already shortlisted in this room.' });
        return;
      }
      throw txErr;
    }
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

    if (existing.status === 'ordered') {
      res.status(400).json({ error: 'This item is part of an active order and cannot be modified.' });
      return;
    }

    // Sync isPinned ↔ status ↔ cart
    const updateData = { ...parsed.data };
    if (updateData.isPinned === true && updateData.status === undefined) {
      updateData.status = 'added_to_cart';
    } else if (updateData.isPinned === false && updateData.status === undefined) {
      updateData.status = 'suggested';
    }
    if (updateData.status === 'approved' && updateData.isPinned === undefined) {
      updateData.isPinned = true;
      updateData.status = 'added_to_cart';
    } else if ((updateData.status === 'rejected' || updateData.status === 'suggested') && updateData.isPinned === undefined) {
      updateData.isPinned = false;
    }

    // Auto-add to cart when pinning
    const pinning = updateData.isPinned === true && !existing.isPinned;
    const unpinning = updateData.isPinned === false && existing.isPinned;

    if (pinning) {
      // Check no duplicate in cart
      const alreadyInCart = await prisma.cartItem.findFirst({
        where: { projectId: req.params.projectId, productId: existing.productId, roomId: existing.roomId },
      });
      if (!alreadyInCart) {
        const product = await prisma.product.findUnique({ where: { id: existing.productId }, select: { price: true } });
        await prisma.cartItem.create({
          data: {
            projectId: req.params.projectId,
            productId: existing.productId,
            roomId: existing.roomId,
            selectedVariant: existing.selectedVariant ?? undefined,
            quantity: existing.quantity,
            unitPrice: product?.price ?? null,
          },
        });
      }
    } else if (unpinning) {
      // Remove from cart
      await prisma.cartItem.deleteMany({
        where: { projectId: req.params.projectId, productId: existing.productId, roomId: existing.roomId },
      });
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
    if (pinning || unpinning) {
      emitProjectEvent(req.params.projectId, 'cart_updated', { action: pinning ? 'added' : 'removed' });
    }

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

    if (existing.status === 'ordered') {
      res.status(400).json({ error: 'This item is part of an active order and cannot be deleted.' });
      return;
    }

    await prisma.$transaction([
      prisma.cartItem.deleteMany({
        where: { projectId: req.params.projectId, productId: existing.productId, roomId: existing.roomId },
      }),
      prisma.shortlistItem.delete({ where: { id: req.params.itemId } }),
    ]);

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

/* ─── GET /api/orders/projects/:projectId/cart ──────── */

router.get('/projects/:projectId/cart', async (req: AuthRequest, res: Response) => {
  try {
    const project = await getOwnedProject(req.params.projectId, req.user!.id);
    if (!project) { res.status(404).json({ error: 'Project not found.' }); return; }

    const [items, activeOrders] = await Promise.all([
      prisma.cartItem.findMany({
        where: { projectId: req.params.projectId },
        orderBy: { createdAt: 'asc' },
        include: {
          product: { select: productSelect },
          room: { select: { id: true, name: true } },
        },
      }),
      prisma.order.findMany({
        where: {
          projectId: req.params.projectId,
          status: { in: ['draft', 'submitted', 'paid', 'split_to_brands'] },
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          totalAmount: true,
          _count: { select: { lineItems: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      items: items.map(serializeCartItem),
      activeOrders: activeOrders.map((o) => ({
        ...o,
        totalAmount: o.totalAmount ? Number(o.totalAmount) : null,
      })),
    });
  } catch (err) {
    logger.error('orders route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── POST /api/orders/projects/:projectId/cart ─────── */

router.post('/projects/:projectId/cart', async (req: AuthRequest, res: Response) => {
  const parsed = cartAddSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  const { shortlistItemId, quantity } = parsed.data;

  try {
    const project = await getOwnedProject(req.params.projectId, req.user!.id);
    if (!project) { res.status(404).json({ error: 'Project not found.' }); return; }

    const shortlistItem = await prisma.shortlistItem.findFirst({
      where: { id: shortlistItemId, projectId: req.params.projectId },
      include: { product: { select: { id: true, productName: true, brandName: true, price: true } }, room: { select: { id: true, name: true } } },
    });
    if (!shortlistItem) { res.status(404).json({ error: 'Shortlist item not found.' }); return; }

    if (shortlistItem.status === 'added_to_cart') {
      res.status(400).json({ error: 'Item is already in cart.' }); return;
    }
    if (shortlistItem.status === 'rejected') {
      res.status(400).json({ error: 'Cannot add a rejected item to cart.' }); return;
    }

    // Check for duplicate in cart in a serializable transaction
    try {
      const cartItem = await prisma.$transaction(async (tx) => {
        const existingCartItem = await tx.cartItem.findFirst({
          where: { projectId: req.params.projectId, productId: shortlistItem.productId, roomId: shortlistItem.roomId },
        });
        if (existingCartItem) {
          throw new Error('DUPLICATE_CART');
        }

        const newCartItem = await tx.cartItem.create({
          data: {
            projectId: req.params.projectId,
            productId: shortlistItem.productId,
            roomId: shortlistItem.roomId,
            selectedVariant: shortlistItem.selectedVariant ?? undefined,
            quantity: quantity ?? shortlistItem.quantity,
            unitPrice: shortlistItem.product.price,
          },
          include: {
            product: { select: productSelect },
            room: { select: { id: true, name: true } },
          },
        });

        await tx.shortlistItem.update({
          where: { id: shortlistItemId },
          data: { status: 'added_to_cart' },
        });

        return newCartItem;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      writeAuditLog({
        actorType: 'designer', actorId: req.user!.id,
        action: 'cart_item_added', entityType: 'project', entityId: req.params.projectId,
        payload: { productId: shortlistItem.productId, productName: shortlistItem.product.productName, roomId: shortlistItem.roomId, roomName: shortlistItem.room.name },
      });

      emitProjectEvent(req.params.projectId, 'cart_updated', { action: 'added' });

      res.status(201).json(serializeCartItem(cartItem));
    } catch (txErr: any) {
      if (txErr.message === 'DUPLICATE_CART') {
        res.status(400).json({ error: 'This product is already in the cart for this room.' });
        return;
      }
      throw txErr;
    }

    writeAuditLog({
      actorType: 'designer', actorId: req.user!.id,
      action: 'cart_item_added', entityType: 'project', entityId: req.params.projectId,
      payload: { productId: shortlistItem.productId, productName: shortlistItem.product.productName, roomId: shortlistItem.roomId, roomName: shortlistItem.room.name },
    });

    emitProjectEvent(req.params.projectId, 'cart_updated', { action: 'added' });

    res.status(201).json(serializeCartItem(cartItem));
  } catch (err) {
    logger.error('orders route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── PUT /api/orders/projects/:projectId/cart/:itemId ─ */

router.put('/projects/:projectId/cart/:itemId', async (req: AuthRequest, res: Response) => {
  const parsed = cartUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  try {
    const project = await getOwnedProject(req.params.projectId, req.user!.id);
    if (!project) { res.status(404).json({ error: 'Project not found.' }); return; }

    const existing = await prisma.cartItem.findFirst({
      where: { id: req.params.itemId, projectId: req.params.projectId },
    });
    if (!existing) { res.status(404).json({ error: 'Cart item not found.' }); return; }

    const item = await prisma.cartItem.update({
      where: { id: req.params.itemId },
      data: { quantity: parsed.data.quantity },
      include: {
        product: { select: productSelect },
        room: { select: { id: true, name: true } },
      },
    });

    writeAuditLog({
      actorType: 'designer', actorId: req.user!.id,
      action: 'cart_item_updated', entityType: 'project', entityId: req.params.projectId,
      payload: { cartItemId: item.id, oldQty: existing.quantity, newQty: parsed.data.quantity },
    });

    res.json(serializeCartItem(item));
  } catch (err) {
    logger.error('orders route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── DELETE /api/orders/projects/:projectId/cart/:itemId */

router.delete('/projects/:projectId/cart/:itemId', async (req: AuthRequest, res: Response) => {
  try {
    const project = await getOwnedProject(req.params.projectId, req.user!.id);
    if (!project) { res.status(404).json({ error: 'Project not found.' }); return; }

    const existing = await prisma.cartItem.findFirst({
      where: { id: req.params.itemId, projectId: req.params.projectId },
      include: { product: { select: { productName: true } } },
    });
    if (!existing) { res.status(404).json({ error: 'Cart item not found.' }); return; }

    await prisma.$transaction([
      prisma.cartItem.delete({ where: { id: req.params.itemId } }),
      // Reset corresponding shortlist item status back to approved
      prisma.shortlistItem.updateMany({
        where: { projectId: req.params.projectId, productId: existing.productId, roomId: existing.roomId, status: 'added_to_cart' },
        data: { status: 'approved' },
      }),
    ]);

    writeAuditLog({
      actorType: 'designer', actorId: req.user!.id,
      action: 'cart_item_removed', entityType: 'project', entityId: req.params.projectId,
      payload: { cartItemId: existing.id, productName: existing.product.productName, roomId: existing.roomId },
    });

    emitProjectEvent(req.params.projectId, 'cart_updated', { action: 'removed' });

    res.json({ message: 'Item removed from cart.' });
  } catch (err) {
    logger.error('orders route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── POST /api/orders/projects/:projectId/orders ──── */

router.post('/projects/:projectId/orders', async (req: AuthRequest, res: Response) => {
  try {
    const project = await getOwnedProject(req.params.projectId, req.user!.id);
    if (!project) { res.status(404).json({ error: 'Project not found.' }); return; }

    const cartItems = await prisma.cartItem.findMany({
      where: { projectId: req.params.projectId },
      include: { product: { select: { id: true, productName: true, brandName: true, price: true } } },
    });

    if (cartItems.length === 0) {
      res.status(400).json({ error: 'Cart is empty. Add items before submitting an order.' }); return;
    }

    // Calculate line totals
    const lineItemsData = [];
    for (const ci of cartItems) {
      const unitPrice = ci.unitPrice ?? ci.product.price;
      const up = Number(unitPrice ?? 0);
      if (up <= 0) {
        res.status(400).json({ error: `Product "${ci.product.productName}" must have a valid price greater than $0 before creating an order.` });
        return;
      }
      const lt = up * ci.quantity;
      lineItemsData.push({
        productId: ci.productId,
        roomId: ci.roomId,
        selectedVariant: ci.selectedVariant ?? undefined,
        quantity: ci.quantity,
        unitPrice: up,
        lineTotal: lt,
        brandName: ci.product.brandName || 'Unknown',
      });
    }

    const totalAmount = lineItemsData.reduce((sum, li) => sum + li.lineTotal, 0);

    // Build brand PO groups
    const brandGroups = splitOrderByBrand(
      lineItemsData.map((li, i) => ({ id: String(i), brandName: li.brandName, lineTotal: li.lineTotal }))
    );

    // Execute everything in a transaction
    const order = await prisma.$transaction(async (tx) => {
      // 1. Create order
      const newOrder = await tx.order.create({
        data: {
          projectId: req.params.projectId,
          designerId: req.user!.id,
          status: 'draft',
          totalAmount,
          taxAmount: null,
        },
      });

      // 2. Create brand POs
      const brandPoMap = new Map<string, string>(); // brandName → poId
      for (const group of brandGroups) {
        const po = await tx.brandPurchaseOrder.create({
          data: {
            orderId: newOrder.id,
            brandName: group.brandName,
            status: 'sent',
            subtotal: group.subtotal,
          },
        });
        brandPoMap.set(group.brandName, po.id);
      }

      // 3. Create order line items linked to brand POs
      for (const li of lineItemsData) {
        await tx.orderLineItem.create({
          data: {
            orderId: newOrder.id,
            productId: li.productId,
            roomId: li.roomId,
            selectedVariant: li.selectedVariant,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            lineTotal: li.lineTotal,
            brandPoId: brandPoMap.get(li.brandName) ?? null,
          },
        });
      }

      // 4. Clear cart
      await tx.cartItem.deleteMany({ where: { projectId: req.params.projectId } });

      // 5. Lock shortlist items — mark as "ordered"
      for (const li of lineItemsData) {
        await tx.shortlistItem.updateMany({
          where: {
            projectId: req.params.projectId,
            productId: li.productId,
            roomId: li.roomId,
            status: 'added_to_cart',
          },
          data: { status: 'ordered' },
        });
      }

      // 6. Fetch the complete order
      return tx.order.findUnique({
        where: { id: newOrder.id },
        include: {
          lineItems: {
            include: {
              product: { select: productSelect },
              room: { select: { id: true, name: true } },
            },
          },
          brandPOs: {
            include: {
              lineItems: {
                include: {
                  product: { select: { id: true, productName: true, brandName: true, price: true, imageUrl: true, category: true } },
                  room: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      });
    });

    writeAuditLog({
      actorType: 'designer', actorId: req.user!.id,
      action: 'order_created', entityType: 'project', entityId: req.params.projectId,
      payload: { orderId: order!.id, lineItemCount: lineItemsData.length, totalAmount, brandCount: brandGroups.length },
    });

    emitProjectEvent(req.params.projectId, 'order_created', { orderId: order!.id });

    res.status(201).json(serializeOrder(order));
  } catch (err) {
    logger.error('orders route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── GET /api/orders/projects/:projectId/orders ───── */

router.get('/projects/:projectId/orders', async (req: AuthRequest, res: Response) => {
  try {
    const project = await getOwnedProject(req.params.projectId, req.user!.id);
    if (!project) { res.status(404).json({ error: 'Project not found.' }); return; }

    const orders = await prisma.order.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { lineItems: true, brandPOs: true } },
      },
    });

    res.json(orders.map((o) => ({
      ...o,
      totalAmount: toNum(o.totalAmount),
      taxAmount: toNum(o.taxAmount),
    })));
  } catch (err) {
    logger.error('orders route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── GET /api/orders/projects/:projectId/orders/:orderId */

router.get('/projects/:projectId/orders/:orderId', async (req: AuthRequest, res: Response) => {
  try {
    const project = await getOwnedProject(req.params.projectId, req.user!.id);
    if (!project) { res.status(404).json({ error: 'Project not found.' }); return; }

    const order = await prisma.order.findFirst({
      where: { id: req.params.orderId, projectId: req.params.projectId },
      include: {
        lineItems: {
          include: {
            product: { select: productSelect },
            room: { select: { id: true, name: true } },
          },
        },
        brandPOs: {
          include: {
            lineItems: {
              include: {
                product: { select: { id: true, productName: true, brandName: true, price: true, imageUrl: true, category: true } },
                room: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!order) { res.status(404).json({ error: 'Order not found.' }); return; }

    res.json(serializeOrder(order));
  } catch (err) {
    logger.error('orders route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

export default router;
