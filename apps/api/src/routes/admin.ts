import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@furnlo/db';
import { requireAuth, requireRole, requireSuperAdmin, AuthRequest } from '../middleware/auth';
import { writeAuditLog } from '../services/auditLog';
import { createNotification } from '../services/notificationService';
import {
  getAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  getAdminUnreadCount,
} from '../services/adminNotificationService';
import { addAdminListener } from '../services/adminEvents';
import logger from '../config/logger';

const router = Router();
router.use(requireAuth, requireRole('admin'));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ─── Simple TTL cache for expensive read-only endpoints ── */
const responseCache = new Map<string, { data: unknown; expiresAt: number }>();
function cachedResponse<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
  const cached = responseCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return Promise.resolve(cached.data as T);
  return compute().then((data) => {
    responseCache.set(key, { data, expiresAt: Date.now() + ttlMs });
    return data;
  });
}

const VALID_DESIGNER_STATUSES = new Set(['pending_review', 'approved', 'rejected', 'suspended']);
const VALID_ORDER_STATUSES = new Set(['draft', 'submitted', 'paid', 'split_to_brands', 'closed']);
const VALID_PAYMENT_STATUSES = new Set(['pending', 'paid', 'failed']);
const VALID_BRAND_PO_STATUSES = new Set(['sent', 'acknowledged', 'in_production', 'dispatched', 'delivered', 'cancelled']);

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
  const { status, search, page = '1', limit = '25' } = req.query;
  const take = Math.min(Number(limit) || 25, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  try {
    const where: Record<string, unknown> = {};
    if (status && typeof status === 'string') {
      if (!VALID_DESIGNER_STATUSES.has(status)) {
        res.status(400).json({ error: `Invalid status. Must be one of: ${[...VALID_DESIGNER_STATUSES].join(', ')}` });
        return;
      }
      where.status = status;
    }
    if (search && typeof search === 'string') {
      const term = search.slice(0, 100);
      if (term.length < 2) {
        res.status(400).json({ error: 'Search term must be at least 2 characters.' });
        return;
      }
      where.OR = [
        { fullName: { contains: term, mode: 'insensitive' } },
        { email: { startsWith: term, mode: 'insensitive' } },
        { businessName: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [designers, total] = await Promise.all([
      prisma.designer.findMany({
        where,
        select: {
          id: true, fullName: true, email: true, businessName: true,
          phone: true, status: true, isAdmin: true, createdAt: true,
          _count: { select: { clients: true, projects: true, orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.designer.count({ where }),
    ]);

    res.json({ designers, total, page: Math.floor(skip / take) + 1, totalPages: Math.ceil(total / take) });
  } catch (err) {
    logger.error('admin route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── GET /api/admin/designers/:id ─────────────────── */

router.get('/designers/:id', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) { res.status(400).json({ error: 'Invalid designer ID.' }); return; }
  try {
    const designer = await prisma.designer.findUnique({
      where: { id },
      select: {
        id: true, fullName: true, email: true, businessName: true,
        phone: true, city: true, state: true, yearsOfExperience: true,
        websiteUrl: true, linkedinUrl: true, instagramUrl: true, referralSource: true,
        rejectionReason: true,
        status: true, isAdmin: true, createdAt: true, updatedAt: true,
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
  rejectionReason: z.string().max(1000).optional(),
});

router.put('/designers/:id/status', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) { res.status(400).json({ error: 'Invalid designer ID.' }); return; }
  const parsed = statusUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { status: newStatus, rejectionReason } = parsed.data;

  try {
    const existing = await prisma.designer.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Designer not found.' });
      return;
    }

    const designer = await prisma.designer.update({
      where: { id },
      data: {
        status: newStatus,
        rejectionReason: newStatus === 'rejected' ? (rejectionReason ?? null) : null,
      },
      select: {
        id: true, fullName: true, email: true, businessName: true,
        phone: true, status: true, isAdmin: true, createdAt: true,
        rejectionReason: true,
        _count: { select: { clients: true, projects: true, orders: true } },
      },
    });

    writeAuditLog({
      actorType: 'admin',
      actorId: req.user!.id,
      action: 'designer_status_changed',
      entityType: 'designer',
      entityId: id,
      payload: { from: existing.status, to: newStatus, rejectionReason: rejectionReason ?? null },
    }).catch((err) => logger.error('audit log write failed', { err }));

    // Notify the designer about approval / rejection
    if (newStatus === 'approved') {
      createNotification({
        designerId: id,
        type: 'application_approved',
        title: 'Your application has been approved!',
        body: 'Welcome to tradeLiv. You can now sign in and start using the platform.',
      }).catch((err) => logger.error('Failed to notify designer on approval', { err }));
    } else if (newStatus === 'rejected') {
      createNotification({
        designerId: id,
        type: 'application_rejected',
        title: 'Application update',
        body: rejectionReason || 'Your application was not approved at this time. Please contact support for details.',
      }).catch((err) => logger.error('Failed to notify designer on rejection', { err }));
    }

    res.json(designer);
  } catch (err) {
    logger.error('admin route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── Admin Notifications ──────────────────────────── */

router.get('/notifications', async (_req: AuthRequest, res: Response) => {
  try {
    const notifications = await getAdminNotifications({ limit: 50 });
    res.json(notifications);
  } catch (err) {
    logger.error('admin route error', { err, path: '/notifications' });
    res.status(500).json({ error: 'An error occurred.' });
  }
});

router.get('/notifications/unread-count', async (_req: AuthRequest, res: Response) => {
  try {
    const count = await getAdminUnreadCount();
    res.json({ count });
  } catch (err) {
    logger.error('admin route error', { err, path: '/notifications/unread-count' });
    res.status(500).json({ error: 'An error occurred.' });
  }
});

router.put('/notifications/read-all', async (_req: AuthRequest, res: Response) => {
  try {
    await markAllAdminNotificationsRead();
    res.json({ success: true });
  } catch (err) {
    logger.error('admin route error', { err, path: '/notifications/read-all' });
    res.status(500).json({ error: 'An error occurred.' });
  }
});

router.put('/notifications/:id/read', async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) { res.status(400).json({ error: 'Invalid notification ID.' }); return; }
  try {
    await markAdminNotificationRead(id);
    res.json({ success: true });
  } catch (err) {
    logger.error('admin route error', { err, path: '/notifications/:id/read' });
    res.status(500).json({ error: 'An error occurred.' });
  }
});

/* ─── SSE /api/admin/notifications/stream ────────── */

router.get('/notifications/stream', async (_req: AuthRequest, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  // Send initial unread count so the badge is correct immediately
  try {
    const count = await getAdminUnreadCount();
    res.write(`event: admin_unread_count\ndata: ${JSON.stringify({ count })}\n\n`);
  } catch (err) {
    logger.error('SSE initial unread count error', { err });
  }

  addAdminListener(res);
});

/* ─── GET /api/admin/activity ───────────────────────── */

router.get('/activity', async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '50' } = req.query;
  const take = Math.min(Number(limit) || 50, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  try {
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.auditLog.count(),
    ]);
    res.json({ logs, total, page: Math.floor(skip / take) + 1, totalPages: Math.ceil(total / take) });
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
      }).catch((err) => logger.error('audit log write failed', { err }));

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
      }).catch((err) => logger.error('audit log write failed', { err }));

      res.status(201).json(admin);
    }
  } catch (err) {
    logger.error('admin route error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── DELETE /api/admin/admins/:id ────────────────── */

router.delete('/admins/:id', requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) { res.status(400).json({ error: 'Invalid admin ID.' }); return; }
  try {
    const target = await prisma.designer.findUnique({
      where: { id },
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
      where: { id },
      data: { isAdmin: false },
    });

    writeAuditLog({
      actorType: 'admin', actorId: req.user!.id,
      action: 'admin_revoked', entityType: 'designer', entityId: id,
    }).catch((err) => logger.error('audit log write failed', { err }));

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
    if (status && typeof status === 'string') {
      if (!VALID_ORDER_STATUSES.has(status)) {
        res.status(400).json({ error: `Invalid status. Must be one of: ${[...VALID_ORDER_STATUSES].join(', ')}` });
        return;
      }
      where.status = status;
    }
    if (designerId && typeof designerId === 'string') {
      if (!UUID_RE.test(designerId)) {
        res.status(400).json({ error: 'Invalid designer ID.' });
        return;
      }
      where.designerId = designerId;
    }
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
  const orderId = String(req.params.orderId);
  if (!UUID_RE.test(orderId)) { res.status(400).json({ error: 'Invalid order ID.' }); return; }
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
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
      where: { entityId: orderId, entityType: 'order' },
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

const VALID_ORDER_TRANSITIONS: Record<string, string[]> = {
  draft:           ['submitted'],
  submitted:       ['paid', 'draft'],
  paid:            ['split_to_brands'],
  split_to_brands: ['closed'],
  closed:          [],
};

router.put('/orders/:orderId/status', async (req: AuthRequest, res: Response) => {
  const orderId = String(req.params.orderId);
  if (!UUID_RE.test(orderId)) { res.status(400).json({ error: 'Invalid order ID.' }); return; }
  const parsed = orderStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const existing = await prisma.order.findUnique({ where: { id: orderId } });
    if (!existing) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const allowed = VALID_ORDER_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(parsed.data.status)) {
      res.status(400).json({
        error: `Cannot transition order from '${existing.status}' to '${parsed.data.status}'. Allowed: ${allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'}`,
      });
      return;
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status: parsed.data.status },
    });

    writeAuditLog({
      actorType: 'admin', actorId: req.user!.id,
      action: 'admin_order_status_changed', entityType: 'order', entityId: orderId,
      payload: { from: existing.status, to: parsed.data.status, reason: parsed.data.reason },
    }).catch((err) => logger.error('audit log write failed', { err }));

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
    if (status && typeof status === 'string') {
      if (!VALID_PAYMENT_STATUSES.has(status)) {
        res.status(400).json({ error: `Invalid status. Must be one of: ${[...VALID_PAYMENT_STATUSES].join(', ')}` });
        return;
      }
      where.status = status;
    }

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
  const paymentId = String(req.params.paymentId);
  if (!UUID_RE.test(paymentId)) { res.status(400).json({ error: 'Invalid payment ID.' }); return; }
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
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
    if (status && typeof status === 'string') {
      if (!VALID_BRAND_PO_STATUSES.has(status)) {
        res.status(400).json({ error: `Invalid status. Must be one of: ${[...VALID_BRAND_PO_STATUSES].join(', ')}` });
        return;
      }
      where.status = status;
    }
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

const VALID_BRAND_PO_TRANSITIONS: Record<string, string[]> = {
  sent:          ['acknowledged', 'cancelled'],
  acknowledged:  ['in_production', 'cancelled'],
  in_production: ['dispatched', 'cancelled'],
  dispatched:    ['delivered', 'cancelled'],
  delivered:     [],
  cancelled:     [],
};

router.put('/brand-pos/:poId/status', async (req: AuthRequest, res: Response) => {
  const poId = String(req.params.poId);
  if (!UUID_RE.test(poId)) { res.status(400).json({ error: 'Invalid brand PO ID.' }); return; }
  const parsed = brandPoStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const existing = await prisma.brandPurchaseOrder.findUnique({ where: { id: poId } });
    if (!existing) {
      res.status(404).json({ error: 'Brand PO not found.' });
      return;
    }

    const allowed = VALID_BRAND_PO_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(parsed.data.status)) {
      res.status(400).json({
        error: `Cannot transition PO from '${existing.status}' to '${parsed.data.status}'. Allowed: ${allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'}`,
      });
      return;
    }

    const po = await prisma.brandPurchaseOrder.update({
      where: { id: poId },
      data: { status: parsed.data.status },
    });

    writeAuditLog({
      actorType: 'admin', actorId: req.user!.id,
      action: 'admin_brand_po_status_changed', entityType: 'brand_po', entityId: poId,
      payload: { from: existing.status, to: parsed.data.status },
    }).catch((err) => logger.error('audit log write failed', { err }));

    res.json(po);
  } catch (err) {
    logger.error('admin route error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── Enhanced Admin Stats ────────────────────────── */

router.get('/enhanced-stats', async (req: AuthRequest, res: Response) => {
  try {
    const period = String(req.query.period || '');
    const cacheKey = `enhanced-stats:${period}`;
    const data = await cachedResponse(cacheKey, 30_000, async () => {
    // Compute cutoff date from period query param
    const now = new Date();
    let cutoff: Date | undefined;
    if (period === '7d') cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (period === '30d') cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (period === '90d') cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    else if (period === 'ytd') cutoff = new Date(now.getFullYear(), 0, 1);
    // No cutoff = all-time

    const dateFilter = cutoff ? { createdAt: { gte: cutoff } } : {};

    // Revenue trend: last 6 months of paid orders for the chart
    const trendCutoff = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      statusGroups,
      totalProjects,
      orderStatusGroups,
      revenueResult,
      monthlyRevenueResult,
      paymentStatusGroups,
      recentOrders,
      trendOrders,
    ] = await Promise.all([
      prisma.designer.groupBy({ by: ['status'], ...(cutoff ? { where: dateFilter } : {}), _count: { id: true } }),
      prisma.project.count({ where: dateFilter }),
      prisma.order.groupBy({ by: ['status'], where: dateFilter, _count: { id: true } }),
      prisma.order.aggregate({ where: { status: { in: ['paid', 'split_to_brands', 'closed'] }, ...dateFilter }, _sum: { totalAmount: true }, _count: { id: true } }),
      prisma.order.aggregate({
        where: {
          status: { in: ['paid', 'split_to_brands', 'closed'] },
          createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
        },
        _sum: { totalAmount: true },
      }),
      prisma.payment.groupBy({ by: ['status'], where: dateFilter, _count: { id: true } }),
      prisma.order.findMany({
        where: dateFilter,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          designer: { select: { fullName: true } },
          project: { select: { name: true, client: { select: { name: true } } } },
        },
      }),
      prisma.order.findMany({
        where: {
          status: { in: ['paid', 'split_to_brands', 'closed'] },
          createdAt: { gte: trendCutoff },
        },
        select: { totalAmount: true, createdAt: true },
      }),
    ]);

    // Build monthly trend buckets for the last 6 months
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTrends: Array<{ month: string; revenue: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyTrends.push({ month: MONTH_NAMES[d.getMonth()], revenue: 0 });
    }
    for (const o of trendOrders) {
      const key = `${MONTH_NAMES[o.createdAt.getMonth()]}`;
      const bucket = monthlyTrends.find((m) => m.month === key);
      if (bucket) bucket.revenue += Number(o.totalAmount ?? 0);
    }

    const designerByStatus = Object.fromEntries(statusGroups.map((g) => [g.status, g._count.id])) as Record<string, number>;
    const orderByStatus = Object.fromEntries(orderStatusGroups.map((g) => [g.status, g._count.id])) as Record<string, number>;
    const paymentByStatus = Object.fromEntries(paymentStatusGroups.map((g) => [g.status, g._count.id])) as Record<string, number>;

    const totalRevenue = Number(revenueResult._sum.totalAmount ?? 0);
    const paidOrderCount = revenueResult._count.id || 1;

    return {
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
      monthlyTrends,
    };
    });

    res.json(data);
  } catch (err) {
    logger.error('admin route error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── Platform Health ─────────────────────────────── */

router.get('/health', async (_req: AuthRequest, res: Response) => {
  try {
    const data = await cachedResponse('health', 15_000, async () => {
      // DB connectivity + latency
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const dbLatency = Date.now() - dbStart;

      // Active users (designers with sessions pinged in last 15 min / 24h)
      const now = new Date();
      const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const [active15, active24, errors1h, errors24h, designerCount, projectCount, orderCount, productCount] = await Promise.all([
        prisma.designerSession.groupBy({ by: ['designerId'], where: { lastPing: { gte: fifteenMinAgo }, endedAt: null } }).then((r) => r.length),
        prisma.designerSession.groupBy({ by: ['designerId'], where: { lastPing: { gte: twentyFourHoursAgo } } }).then((r) => r.length),
        prisma.auditLog.count({ where: { action: { contains: 'error' }, createdAt: { gte: oneHourAgo } } }),
        prisma.auditLog.count({ where: { action: { contains: 'error' }, createdAt: { gte: twentyFourHoursAgo } } }),
        prisma.designer.count(),
        prisma.project.count(),
        prisma.order.count(),
        prisma.product.count(),
      ]);

      const mem = process.memoryUsage();

      return {
        db: { connected: true, latencyMs: dbLatency },
        api: { uptimeSeconds: Math.floor(process.uptime()), memoryMB: Math.round(mem.rss / 1024 / 1024) },
        activeUsers: { last15min: active15, last24h: active24 },
        errors: { last1h: errors1h, last24h: errors24h },
        counts: { designers: designerCount, projects: projectCount, orders: orderCount, products: productCount },
      };
    });

    res.json(data);
  } catch (err) {
    logger.error('admin health error', { err });
    res.status(503).json({
      db: { connected: false, latencyMs: -1 },
      api: { uptimeSeconds: Math.floor(process.uptime()), memoryMB: 0 },
      activeUsers: { last15min: 0, last24h: 0 },
      errors: { last1h: 0, last24h: 0 },
      counts: { designers: 0, projects: 0, orders: 0, products: 0 },
    });
  }
});

/* ─── Platform Config ─────────────────────────────── */

router.get('/config', async (_req: AuthRequest, res: Response) => {
  try {
    const configs = await prisma.platformConfig.findMany({
      orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }],
    });
    res.json(configs);
  } catch (err) {
    logger.error('admin config error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

const configUpdateSchema = z.object({ value: z.string() });

router.put('/config/:key', requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  const key = String(req.params.key);
  const parsed = configUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const existing = await prisma.platformConfig.findUnique({ where: { key } });
    if (!existing) {
      res.status(404).json({ error: 'Config key not found.' });
      return;
    }

    const config = await prisma.platformConfig.update({
      where: { key },
      data: { value: parsed.data.value, updatedBy: req.user!.id },
    });

    writeAuditLog({
      actorType: 'admin', actorId: req.user!.id,
      action: 'config_updated', entityType: 'platform_config', entityId: key,
      payload: { from: existing.value, to: parsed.data.value },
    }).catch((err) => logger.error('audit log write failed', { err }));

    res.json(config);
  } catch (err) {
    logger.error('admin config error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

const configCreateSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'json']).default('string'),
  label: z.string().min(1),
  group: z.string().default('general'),
  sortOrder: z.number().int().default(0),
});

router.post('/config', requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  const parsed = configCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const existing = await prisma.platformConfig.findUnique({ where: { key: parsed.data.key } });
    if (existing) {
      res.status(409).json({ error: 'Config key already exists.' });
      return;
    }

    const config = await prisma.platformConfig.create({ data: parsed.data });

    writeAuditLog({
      actorType: 'admin', actorId: req.user!.id,
      action: 'config_created', entityType: 'platform_config', entityId: parsed.data.key,
    }).catch((err) => logger.error('audit log write failed', { err }));

    res.status(201).json(config);
  } catch (err) {
    logger.error('admin config error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── Analytics: Revenue ──────────────────────────── */

router.get('/analytics/revenue', async (req: AuthRequest, res: Response) => {
  const months = Math.min(Number(req.query.months) || 12, 24);

  try {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const paidStatuses = ['paid', 'split_to_brands', 'closed'] as const;
    const baseWhere = { status: { in: [...paidStatuses] }, createdAt: { gte: cutoff } };

    // All three aggregations in parallel — no findMany, no in-memory iteration
    const [monthlyTrends, designerGroups, totalsResult] = await Promise.all([
      // Monthly trends via raw SQL (Prisma groupBy can't group by date parts)
      prisma.$queryRaw<Array<{ period: string; revenue: number; order_count: bigint }>>`
        SELECT to_char("createdAt", 'YYYY-MM') AS period,
               COALESCE(SUM("totalAmount"), 0)::float AS revenue,
               COUNT(*)::bigint AS order_count
        FROM "Order"
        WHERE status IN ('paid', 'split_to_brands', 'closed')
          AND "createdAt" >= ${cutoff}
        GROUP BY period
        ORDER BY period
      `,

      // Designer-wise revenue via Prisma groupBy
      prisma.order.groupBy({
        by: ['designerId'],
        where: baseWhere,
        _sum: { totalAmount: true },
        _count: { id: true },
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 50,
      }),

      // Totals via aggregate
      prisma.order.aggregate({
        where: baseWhere,
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
    ]);

    const trends = monthlyTrends.map((r) => ({
      period: r.period,
      revenue: Number(r.revenue),
      orderCount: Number(r.order_count),
    }));

    // Fetch designer names for the grouped results
    const designerIds = designerGroups.map((g) => g.designerId);
    const designers = designerIds.length > 0
      ? await prisma.designer.findMany({
          where: { id: { in: designerIds } },
          select: { id: true, fullName: true },
        })
      : [];
    const nameMap = Object.fromEntries(designers.map((d) => [d.id, d.fullName]));

    const designerRevenue = designerGroups.map((g) => ({
      designerId: g.designerId,
      designerName: nameMap[g.designerId] ?? 'Unknown',
      revenue: Number(g._sum?.totalAmount ?? 0),
      orderCount: typeof g._count === 'number' ? g._count : (g._count as Record<string, number>)?.id ?? 0,
    }));

    const totalRevenue = Number(totalsResult._sum?.totalAmount ?? 0);
    const totalOrders = typeof totalsResult._count === 'number' ? totalsResult._count : (totalsResult._count as Record<string, number>)?.id ?? 0;

    res.json({
      trends,
      designerRevenue,
      totals: {
        totalRevenue,
        avgOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
        totalOrders,
      },
    });
  } catch (err) {
    logger.error('admin analytics error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── Analytics: Products ─────────────────────────── */

router.get('/analytics/products', async (_req: AuthRequest, res: Response) => {
  try {
    // Most shortlisted products
    const shortlistGroups = await prisma.shortlistItem.groupBy({
      by: ['productId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    });

    const productIds = shortlistGroups.map((g) => g.productId);
    const products = productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, productName: true, brandName: true },
        })
      : [];
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    const mostShortlisted = shortlistGroups.map((g) => ({
      productId: g.productId,
      productName: productMap[g.productId]?.productName ?? 'Unknown',
      brandName: productMap[g.productId]?.brandName ?? null,
      count: g._count.id,
    }));

    // Approval rates
    const statusGroups = await prisma.shortlistItem.groupBy({
      by: ['status'],
      _count: { id: true },
    });
    const totalShortlist = statusGroups.reduce((s, g) => s + g._count.id, 0);
    const approvalRates = statusGroups.map((g) => ({
      status: g.status,
      count: g._count.id,
      percentage: totalShortlist > 0 ? Math.round((g._count.id / totalShortlist) * 100) : 0,
    }));

    // Popular brands
    const brandGroups = await prisma.product.groupBy({
      by: ['brandName'],
      where: { brandName: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 15,
    });

    const popularBrands = brandGroups.map((g) => ({
      brandName: g.brandName ?? 'Unknown',
      productCount: g._count.id,
    }));

    res.json({ mostShortlisted, approvalRates, popularBrands });
  } catch (err) {
    logger.error('admin analytics error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── Analytics: Clients ──────────────────────────── */

router.get('/analytics/clients', async (_req: AuthRequest, res: Response) => {
  try {
    // Run all independent queries in parallel
    const [clientProjectGroups, topClientsRaw, totalClients, totalProjectsCount, orderTotals] = await Promise.all([
      // Projects per client (top 20)
      prisma.project.groupBy({
        by: ['clientId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      }),

      // Top clients by order value — DB-level aggregation via raw SQL
      prisma.$queryRaw<Array<{ client_id: string; client_name: string; total_order_value: number; order_count: bigint }>>`
        SELECT p."clientId" AS client_id,
               c."name" AS client_name,
               COALESCE(SUM(o."totalAmount"), 0)::float AS total_order_value,
               COUNT(o.id)::bigint AS order_count
        FROM "Order" o
        JOIN "Project" p ON o."projectId" = p.id
        JOIN "Client" c ON p."clientId" = c.id
        WHERE o.status IN ('paid', 'split_to_brands', 'closed')
        GROUP BY p."clientId", c."name"
        ORDER BY total_order_value DESC
        LIMIT 20
      `,

      prisma.client.count(),
      prisma.project.count(),

      // Total order aggregates for avg calculation
      prisma.order.aggregate({
        where: { status: { in: ['paid', 'split_to_brands', 'closed'] as const } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
    ]);

    // Fetch client names for project groups
    const clientIds = clientProjectGroups.map((g) => g.clientId);
    const clients = clientIds.length > 0
      ? await prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, name: true },
        })
      : [];
    const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]));

    const projectsPerClient = clientProjectGroups.map((g) => ({
      clientId: g.clientId,
      clientName: clientMap[g.clientId] ?? 'Unknown',
      projectCount: g._count.id,
    }));

    const topClients = topClientsRaw.map((r) => ({
      clientId: r.client_id,
      clientName: r.client_name,
      totalOrderValue: Number(r.total_order_value),
      orderCount: Number(r.order_count),
      avgOrderValue: Number(r.order_count) > 0 ? Math.round(Number(r.total_order_value) / Number(r.order_count)) : 0,
    }));

    const totalOrderValue = Number(orderTotals._sum?.totalAmount ?? 0);
    const totalOrderCount = orderTotals._count ?? 0;

    res.json({
      projectsPerClient,
      topClients,
      overview: {
        totalClients,
        avgProjectsPerClient: totalClients > 0 ? Math.round((totalProjectsCount / totalClients) * 10) / 10 : 0,
        avgOrderValue: typeof totalOrderCount === 'number' && totalOrderCount > 0 ? Math.round(totalOrderValue / totalOrderCount) : 0,
      },
    });
  } catch (err) {
    logger.error('admin analytics error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── Time Tracking ───────────────────────────────── */

/* POST /api/admin/time-tracking/cleanup — close stale sessions & backfill durations */
router.post('/time-tracking/cleanup', async (_req: AuthRequest, res: Response) => {
  try {
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);

    // Auto-close stale sessions (no ping for 5+ min, still open)
    const closed = await prisma.designerSession.updateMany({
      where: { endedAt: null, lastPing: { lt: staleThreshold } },
      data: { endedAt: staleThreshold },
    });

    // Backfill durations for sessions missing them
    const nodurations = await prisma.designerSession.findMany({
      where: { endedAt: { not: null }, durationMs: null },
      select: { id: true, startedAt: true, endedAt: true },
    });
    if (nodurations.length > 0) {
      await Promise.all(
        nodurations.map((s) =>
          prisma.designerSession.update({
            where: { id: s.id },
            data: { durationMs: s.endedAt!.getTime() - s.startedAt.getTime() },
          }),
        ),
      );
    }

    res.json({ closedSessions: closed.count, backfilledDurations: nodurations.length });
  } catch (err) {
    logger.error('admin time-tracking cleanup error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* GET /api/admin/time-tracking — read-only aggregation */
router.get('/time-tracking', async (req: AuthRequest, res: Response) => {
  const { from, to, designerId } = req.query;

  try {
    const where: Record<string, unknown> = {};
    const startedAtFilter: Record<string, Date> = {};
    if (from && typeof from === 'string') {
      const d = new Date(from);
      if (!isNaN(d.getTime())) startedAtFilter.gte = d;
    }
    if (to && typeof to === 'string') {
      const d = new Date(to);
      if (!isNaN(d.getTime())) startedAtFilter.lte = d;
    }
    if (Object.keys(startedAtFilter).length > 0) where.startedAt = startedAtFilter;
    if (designerId && typeof designerId === 'string') {
      if (!UUID_RE.test(designerId)) {
        res.status(400).json({ error: 'Invalid designer ID.' });
        return;
      }
      where.designerId = designerId;
    }

    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);

    // DB-level aggregation instead of loading all sessions into memory
    const [groupedSessions, activeSessions] = await Promise.all([
      prisma.designerSession.groupBy({
        by: ['designerId'],
        where,
        _sum: { durationMs: true },
        _count: { id: true },
        _max: { lastPing: true },
      }),
      prisma.designerSession.count({ where: { endedAt: null, lastPing: { gte: staleThreshold } } }),
    ]);

    const dIds = groupedSessions.map((g) => g.designerId);
    const dNames = dIds.length > 0
      ? await prisma.designer.findMany({ where: { id: { in: dIds } }, select: { id: true, fullName: true } })
      : [];
    const dNameMap = Object.fromEntries(dNames.map((d) => [d.id, d.fullName]));

    const designers = groupedSessions
      .map((g) => {
        const totalTimeMs = Number(g._sum?.durationMs ?? 0);
        const sessionCount = typeof g._count === 'number' ? g._count : (g._count as Record<string, number>)?.id ?? 0;
        return {
          designerId: g.designerId,
          designerName: dNameMap[g.designerId] ?? 'Unknown',
          totalTimeMs,
          sessionCount,
          avgSessionMs: sessionCount > 0 ? Math.round(totalTimeMs / sessionCount) : 0,
          lastActive: g._max?.lastPing?.toISOString() ?? null,
        };
      })
      .sort((a, b) => b.totalTimeMs - a.totalTimeMs);

    res.json({
      designers,
      activeSessions,
      totalTimeAllMs: designers.reduce((s, d) => s + d.totalTimeMs, 0),
    });
  } catch (err) {
    logger.error('admin time-tracking error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

router.get('/time-tracking/:designerId', async (req: AuthRequest, res: Response) => {
  const designerId = String(req.params.designerId);
  if (!UUID_RE.test(designerId)) { res.status(400).json({ error: 'Invalid designer ID.' }); return; }
  try {
    const sessions = await prisma.designerSession.findMany({
      where: { designerId },
      orderBy: { startedAt: 'desc' },
      take: 50,
      select: { id: true, startedAt: true, endedAt: true, durationMs: true, lastPing: true },
    });
    res.json(sessions);
  } catch (err) {
    logger.error('admin time-tracking error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

export default router;
