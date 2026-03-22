import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@furnlo/db';
import { requireAuth, requireRole, requireSuperAdmin, AuthRequest } from '../middleware/auth';
import { writeAuditLog } from '../services/auditLog';
import logger from '../config/logger';

const router = Router();
router.use(requireAuth, requireRole('admin'));

/* ─── GET /api/admin/me ─────────────────────────────── */

router.get('/me', async (req: AuthRequest, res: Response) => {
  try {
    const designer = await prisma.designer.findUnique({
      where: { id: req.user!.id },
      select: { id: true, fullName: true, email: true, businessName: true, isAdmin: true, isSuperAdmin: true },
    });
    if (!designer) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    res.json(designer);
  } catch (err) {
    logger.error('admin route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── GET /api/admin/stats ──────────────────────────── */

router.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const [statusGroups, totalProjects, totalOrders] = await Promise.all([
      prisma.designer.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.project.count(),
      prisma.order.count(),
    ]);

    const byStatus = Object.fromEntries(
      statusGroups.map((g) => [g.status, g._count.id]),
    ) as Record<string, number>;

    res.json({
      designers: {
        total: statusGroups.reduce((acc, g) => acc + g._count.id, 0),
        pending_review: byStatus.pending_review ?? 0,
        approved: byStatus.approved ?? 0,
        rejected: byStatus.rejected ?? 0,
        suspended: byStatus.suspended ?? 0,
      },
      totalProjects,
      totalOrders,
    });
  } catch (err) {
    logger.error('admin route error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── GET /api/admin/designers ──────────────────────── */

router.get('/designers', async (req: AuthRequest, res: Response) => {
  const { status, search } = req.query;

  try {
    const designers = await prisma.designer.findMany({
      where: {
        ...(status && typeof status === 'string' ? { status: status as never } : {}),
        ...(search && typeof search === 'string' ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { businessName: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
      },
      select: {
        id: true, fullName: true, email: true, businessName: true,
        phone: true, status: true, isAdmin: true, createdAt: true,
        _count: { select: { clients: true, projects: true, orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(designers);
  } catch (err) {
    logger.error('admin route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── GET /api/admin/designers/:id ─────────────────── */

router.get('/designers/:id', async (req: AuthRequest, res: Response) => {
  try {
    const designer = await prisma.designer.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, fullName: true, email: true, businessName: true,
        phone: true, status: true, isAdmin: true, createdAt: true, updatedAt: true,
        _count: { select: { clients: true, projects: true, orders: true } },
        projects: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, name: true, status: true, createdAt: true,
            client: { select: { name: true } },
            _count: { select: { rooms: true, shortlistItems: true } },
          },
        },
      },
    });

    if (!designer) {
      res.status(404).json({ error: 'Designer not found.' });
      return;
    }

    res.json(designer);
  } catch (err) {
    logger.error('admin route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── PUT /api/admin/designers/:id/status ───────────── */

const statusUpdateSchema = z.object({
  status: z.enum(['pending_review', 'approved', 'rejected', 'suspended']),
});

router.put('/designers/:id/status', async (req: AuthRequest, res: Response) => {
  const parsed = statusUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const existing = await prisma.designer.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Designer not found.' });
      return;
    }

    const designer = await prisma.designer.update({
      where: { id: req.params.id },
      data: { status: parsed.data.status },
      select: {
        id: true, fullName: true, email: true, businessName: true,
        phone: true, status: true, isAdmin: true, createdAt: true,
        _count: { select: { clients: true, projects: true, orders: true } },
      },
    });

    writeAuditLog({
      actorType: 'admin',
      actorId: req.user!.id,
      action: 'designer_status_changed',
      entityType: 'designer',
      entityId: req.params.id,
      payload: { from: existing.status, to: parsed.data.status },
    });

    res.json(designer);
  } catch (err) {
    logger.error('admin route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── GET /api/admin/activity ───────────────────────── */

router.get('/activity', async (_req: AuthRequest, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(logs);
  } catch (err) {
    logger.error('admin route error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── GET /api/admin/admins ────────────────────────── */

router.get('/admins', async (_req: AuthRequest, res: Response) => {
  try {
    const admins = await prisma.designer.findMany({
      where: { isAdmin: true },
      select: {
        id: true, fullName: true, email: true, businessName: true,
        isAdmin: true, isSuperAdmin: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(admins);
  } catch (err) {
    logger.error('admin route error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── POST /api/admin/admins ──────────────────────── */

const createAdminSchema = z.object({
  designerId: z.string().uuid().optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  fullName: z.string().min(2).optional(),
}).refine(
  (d) => d.designerId || (d.email && d.password && d.fullName),
  { message: 'Provide designerId to promote, or email+password+fullName to create new admin.' },
);

router.post('/admins', requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  const parsed = createAdminSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const { designerId, email, password, fullName } = parsed.data;

    if (designerId) {
      // Promote existing designer
      const existing = await prisma.designer.findUnique({ where: { id: designerId } });
      if (!existing) {
        res.status(404).json({ error: 'Designer not found.' });
        return;
      }
      if (existing.isAdmin) {
        res.status(409).json({ error: 'This designer is already an admin.' });
        return;
      }
      const admin = await prisma.designer.update({
        where: { id: designerId },
        data: { isAdmin: true },
        select: { id: true, fullName: true, email: true, businessName: true, isAdmin: true, isSuperAdmin: true, createdAt: true },
      });

      writeAuditLog({
        actorType: 'admin', actorId: req.user!.id,
        action: 'admin_promoted', entityType: 'designer', entityId: designerId,
      });

      res.status(200).json(admin);
    } else {
      // Create new admin account
      const existingByEmail = await prisma.designer.findUnique({ where: { email: email! } });
      if (existingByEmail) {
        res.status(409).json({ error: 'An account with this email already exists.' });
        return;
      }

      const passwordHash = await bcrypt.hash(password!, 12);
      const admin = await prisma.designer.create({
        data: {
          email: email!,
          passwordHash,
          fullName: fullName!,
          isAdmin: true,
          status: 'approved',
        },
        select: { id: true, fullName: true, email: true, businessName: true, isAdmin: true, isSuperAdmin: true, createdAt: true },
      });

      writeAuditLog({
        actorType: 'admin', actorId: req.user!.id,
        action: 'admin_created', entityType: 'designer', entityId: admin.id,
      });

      res.status(201).json(admin);
    }
  } catch (err) {
    logger.error('admin route error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── DELETE /api/admin/admins/:id ────────────────── */

router.delete('/admins/:id', requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const target = await prisma.designer.findUnique({
      where: { id: req.params.id },
      select: { id: true, isAdmin: true, isSuperAdmin: true },
    });

    if (!target) {
      res.status(404).json({ error: 'Designer not found.' });
      return;
    }
    if (!target.isAdmin) {
      res.status(400).json({ error: 'This designer is not an admin.' });
      return;
    }
    if (target.isSuperAdmin) {
      res.status(403).json({ error: 'Cannot revoke super admin privileges.' });
      return;
    }
    if (target.id === req.user!.id) {
      res.status(400).json({ error: 'Cannot revoke your own admin privileges.' });
      return;
    }

    await prisma.designer.update({
      where: { id: req.params.id },
      data: { isAdmin: false },
    });

    writeAuditLog({
      actorType: 'admin', actorId: req.user!.id,
      action: 'admin_revoked', entityType: 'designer', entityId: req.params.id,
    });

    res.json({ message: 'Admin privileges revoked.' });
  } catch (err) {
    logger.error('admin route error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── Admin Orders ────────────────────────────────── */

/* GET /api/admin/orders */
router.get('/orders', async (req: AuthRequest, res: Response) => {
  const { status, search, designerId, page = '1', limit = '25' } = req.query;
  const take = Math.min(Number(limit) || 25, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  try {
    const where: Record<string, unknown> = {};
    if (status && typeof status === 'string') where.status = status;
    if (designerId && typeof designerId === 'string') where.designerId = designerId;
    if (search && typeof search === 'string') {
      where.OR = [
        { project: { name: { contains: search, mode: 'insensitive' } } },
        { project: { client: { name: { contains: search, mode: 'insensitive' } } } },
        { designer: { fullName: { contains: search, mode: 'insensitive' } } },
        { id: { startsWith: search } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          designer: { select: { id: true, fullName: true, email: true } },
          project: { select: { id: true, name: true, client: { select: { name: true } } } },
          _count: { select: { lineItems: true, brandPOs: true, payments: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ orders, total, page: Math.floor(skip / take) + 1, totalPages: Math.ceil(total / take) });
  } catch (err) {
    logger.error('admin route error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* GET /api/admin/orders/:orderId */
router.get('/orders/:orderId', async (req: AuthRequest, res: Response) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      include: {
        designer: { select: { id: true, fullName: true, email: true } },
        project: { select: { id: true, name: true, client: { select: { name: true } } } },
        lineItems: {
          include: {
            product: { select: { id: true, productName: true, brandName: true, imageUrl: true, price: true } },
            room: { select: { id: true, name: true } },
          },
        },
        brandPOs: {
          include: { lineItems: true },
          orderBy: { brandName: 'asc' },
        },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    // Fetch related audit logs
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityId: req.params.orderId, entityType: 'order' },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    res.json({ ...order, auditLogs });
  } catch (err) {
    logger.error('admin route error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* PUT /api/admin/orders/:orderId/status */
const orderStatusSchema = z.object({
  status: z.enum(['draft', 'submitted', 'paid', 'split_to_brands', 'closed']),
  reason: z.string().optional(),
});

router.put('/orders/:orderId/status', async (req: AuthRequest, res: Response) => {
  const parsed = orderStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const existing = await prisma.order.findUnique({ where: { id: req.params.orderId } });
    if (!existing) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const order = await prisma.order.update({
      where: { id: req.params.orderId },
      data: { status: parsed.data.status },
    });

    writeAuditLog({
      actorType: 'admin', actorId: req.user!.id,
      action: 'admin_order_status_changed', entityType: 'order', entityId: req.params.orderId,
      payload: { from: existing.status, to: parsed.data.status, reason: parsed.data.reason },
    });

    res.json(order);
  } catch (err) {
    logger.error('admin route error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── Admin Payments ──────────────────────────────── */

/* GET /api/admin/payments */
router.get('/payments', async (req: AuthRequest, res: Response) => {
  const { status, page = '1', limit = '25' } = req.query;
  const take = Math.min(Number(limit) || 25, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  try {
    const where: Record<string, unknown> = {};
    if (status && typeof status === 'string') where.status = status;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          order: {
            select: {
              id: true, status: true,
              designer: { select: { fullName: true } },
              project: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({ payments, total, page: Math.floor(skip / take) + 1, totalPages: Math.ceil(total / take) });
  } catch (err) {
    logger.error('admin route error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* GET /api/admin/payments/:paymentId */
router.get('/payments/:paymentId', async (req: AuthRequest, res: Response) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.paymentId },
      include: {
        order: {
          select: {
            id: true, status: true,
            designer: { select: { fullName: true, email: true } },
            project: { select: { name: true } },
          },
        },
      },
    });

    if (!payment) {
      res.status(404).json({ error: 'Payment not found.' });
      return;
    }

    res.json(payment);
  } catch (err) {
    logger.error('admin route error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── Admin Brand POs ─────────────────────────────── */

/* GET /api/admin/brand-pos */
router.get('/brand-pos', async (req: AuthRequest, res: Response) => {
  const { status, brandName, page = '1', limit = '25' } = req.query;
  const take = Math.min(Number(limit) || 25, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  try {
    const where: Record<string, unknown> = {};
    if (status && typeof status === 'string') where.status = status;
    if (brandName && typeof brandName === 'string') {
      where.brandName = { contains: brandName, mode: 'insensitive' };
    }

    const [brandPOs, total] = await Promise.all([
      prisma.brandPurchaseOrder.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              designer: { select: { fullName: true } },
              project: { select: { name: true } },
            },
          },
          _count: { select: { lineItems: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.brandPurchaseOrder.count({ where }),
    ]);

    res.json({ brandPOs, total, page: Math.floor(skip / take) + 1, totalPages: Math.ceil(total / take) });
  } catch (err) {
    logger.error('admin route error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* PUT /api/admin/brand-pos/:poId/status */
const brandPoStatusSchema = z.object({
  status: z.enum(['sent', 'acknowledged', 'in_production', 'dispatched', 'delivered', 'cancelled']),
});

router.put('/brand-pos/:poId/status', async (req: AuthRequest, res: Response) => {
  const parsed = brandPoStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const existing = await prisma.brandPurchaseOrder.findUnique({ where: { id: req.params.poId } });
    if (!existing) {
      res.status(404).json({ error: 'Brand PO not found.' });
      return;
    }

    const po = await prisma.brandPurchaseOrder.update({
      where: { id: req.params.poId },
      data: { status: parsed.data.status },
    });

    writeAuditLog({
      actorType: 'admin', actorId: req.user!.id,
      action: 'admin_brand_po_status_changed', entityType: 'brand_po', entityId: req.params.poId,
      payload: { from: existing.status, to: parsed.data.status },
    });

    res.json(po);
  } catch (err) {
    logger.error('admin route error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── Enhanced Admin Stats ────────────────────────── */

router.get('/enhanced-stats', async (_req: AuthRequest, res: Response) => {
  try {
    const [
      statusGroups,
      totalProjects,
      orderStatusGroups,
      revenueResult,
      monthlyRevenueResult,
      paymentStatusGroups,
      recentOrders,
    ] = await Promise.all([
      prisma.designer.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.project.count(),
      prisma.order.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.order.aggregate({ where: { status: { in: ['paid', 'split_to_brands', 'closed'] } }, _sum: { totalAmount: true }, _count: { id: true } }),
      prisma.order.aggregate({
        where: {
          status: { in: ['paid', 'split_to_brands', 'closed'] },
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
        _sum: { totalAmount: true },
      }),
      prisma.payment.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          designer: { select: { fullName: true } },
          project: { select: { name: true, client: { select: { name: true } } } },
        },
      }),
    ]);

    const designerByStatus = Object.fromEntries(statusGroups.map((g) => [g.status, g._count.id])) as Record<string, number>;
    const orderByStatus = Object.fromEntries(orderStatusGroups.map((g) => [g.status, g._count.id])) as Record<string, number>;
    const paymentByStatus = Object.fromEntries(paymentStatusGroups.map((g) => [g.status, g._count.id])) as Record<string, number>;

    const totalRevenue = Number(revenueResult._sum.totalAmount ?? 0);
    const paidOrderCount = revenueResult._count.id || 1;

    res.json({
      designers: {
        total: statusGroups.reduce((acc, g) => acc + g._count.id, 0),
        pending_review: designerByStatus.pending_review ?? 0,
        approved: designerByStatus.approved ?? 0,
        rejected: designerByStatus.rejected ?? 0,
        suspended: designerByStatus.suspended ?? 0,
      },
      totalProjects,
      orders: {
        total: orderStatusGroups.reduce((acc, g) => acc + g._count.id, 0),
        draft: (orderByStatus.draft ?? 0) + (orderByStatus.submitted ?? 0),
        paid: orderByStatus.paid ?? 0,
        processing: orderByStatus.split_to_brands ?? 0,
        closed: orderByStatus.closed ?? 0,
      },
      revenue: {
        total: totalRevenue,
        thisMonth: Number(monthlyRevenueResult._sum.totalAmount ?? 0),
        averageOrderValue: Math.round(totalRevenue / paidOrderCount),
      },
      payments: {
        total: paymentStatusGroups.reduce((acc, g) => acc + g._count.id, 0),
        pending: paymentByStatus.pending ?? 0,
        paid: paymentByStatus.paid ?? 0,
        failed: paymentByStatus.failed ?? 0,
      },
      recentOrders,
    });
  } catch (err) {
    logger.error('admin route error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

export default router;
