import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '@furnlo/db';
import { writeAuditLog } from '../services/auditLog';
import { emitProjectEvent } from '../services/projectEvents';
import { createMessage, getMessages, markMessagesRead, getUnreadCount, getProjectPresence } from '../services/messageService';
import { approveQuote, requestRevision, getQuoteDetail } from '../services/quoteService';
import { notifyProjectDesigner } from '../services/notificationService';
import { sendEmail } from '../services/emailService';
import { renderQuoteCommentEmail } from '@furnlo/emails';
import { config } from '../config';
import logger from '../config/logger';
import { logRouteError, logError } from '../services/errorLogger';
import { registerUuidValidation } from '../middleware/validateParams';

const router = Router();
registerUuidValidation(router);

const portalWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,                   // 50 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many actions performed. Please try again later.' },
});

const portalMessageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,                   // 30 messages per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages sent. Please wait before sending more.' },
});

// Prevent portal tokens from leaking via Referer header
router.use((_req, res, next) => {
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// Explicit CSRF mitigation for state-changing portal endpoints
// Match app.ts: require a non-simple header; value may be `fetch` (web client) or `XMLHttpRequest` (tests).
router.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    if (!req.headers['x-requested-with']) {
      res.status(403).json({ error: 'Missing required X-Requested-With header.' });
      return;
    }
  }
  next();
});

/* ─── Helpers ───────────────────────────────────────── */

/** Strip HTML tags to prevent stored XSS via user-supplied text */
function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

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
            // phone and email intentionally omitted — PII not needed in public portal
          },
        },
        client: {
          select: {
            name: true,
            // shippingAddress intentionally omitted — not needed in portal view
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
                    metadata: true,
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
    logRouteError('routes/portal.ts', err, req);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── PUT /api/portal/:portalToken/shortlist/:itemId ── */

const reviewSchema = z.object({
  clientNotes: z.string().max(5000).transform(stripHtml).optional(),
  status: z.enum(['suggested', 'approved', 'rejected']).optional(),
});

// Public — client updates their own notes or approves/rejects an item.
router.put('/:portalToken/shortlist/:itemId', portalWriteLimiter, async (req: Request, res: Response) => {
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

    // Items past the review stage cannot have their status changed
    if (status && ['added_to_cart', 'ordered'].includes(item.status)) {
      res.status(400).json({ error: 'This item can no longer be reviewed.' });
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

    // Notify designer of client shortlist feedback
    if (status && status !== item.status) {
      const action = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'updated';
      notifyProjectDesigner(
        item.projectId, 'shortlist_change',
        `Client ${action} "${item.product.productName}"`,
        undefined, 'shortlist', item.id,
      ).catch(() => {});
    }

    res.json(updated);
  } catch (err) {
    logger.error('portal route error', { err, path: req.path, method: req.method });
    logRouteError('routes/portal.ts', err, req);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── Helpers: resolve portalToken → project ───────── */

async function getProjectByPortalToken(portalToken: string) {
  return prisma.project.findUnique({
    where: { portalToken },
    select: {
      id: true,
      name: true,
      designerId: true,
      client: { select: { name: true } },
    },
  });
}

/* ─── GET /api/portal/:portalToken/messages ────────── */

router.get('/:portalToken/messages', async (req: Request, res: Response) => {
  try {
    const project = await getProjectByPortalToken(req.params.portalToken);
    if (!project) { res.status(404).json({ error: 'Not found' }); return; }

    const after = typeof req.query.after === 'string' ? req.query.after : undefined;
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;
    const contextType = typeof req.query.contextType === 'string' ? req.query.contextType : undefined;
    const contextId = typeof req.query.contextId === 'string' ? req.query.contextId : undefined;
    const result = await getMessages(project.id, { after, before, limit, contextType, contextId });
    res.json(result);
  } catch (err) {
    logger.error('portal route error', { err, path: req.path, method: req.method });
    logRouteError('routes/portal.ts', err, req);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── POST /api/portal/:portalToken/messages ───────── */

const portalMessageSchema = z.object({
  text: z.string().min(1, 'Message cannot be empty').max(5000).transform(stripHtml),
  senderName: z.string().max(120).transform(stripHtml).optional(),
  contextType: z.string().optional(),
  contextId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

router.post('/:portalToken/messages', portalMessageLimiter, async (req: Request, res: Response) => {
  const parsed = portalMessageSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  try {
    const project = await getProjectByPortalToken(req.params.portalToken);
    if (!project) { res.status(404).json({ error: 'Not found' }); return; }

    const message = await createMessage({
      projectId: project.id,
      senderType: 'client',
      senderName: project.client?.name || 'Client',
      text: parsed.data.text,
      contextType: parsed.data.contextType,
      contextId: parsed.data.contextId,
      metadata: parsed.data.metadata,
    });

    emitProjectEvent(project.id, 'new_message', {
      id: message.id,
      senderType: message.senderType,
      senderName: message.senderName,
      text: message.text,
      contextType: message.contextType,
      contextId: message.contextId,
      metadata: message.metadata,
      createdAt: message.createdAt.toISOString(),
    });

    // Notify designer
    notifyProjectDesigner(
      project.id, 'message',
      `New message from ${parsed.data.senderName}`,
      parsed.data.text.length > 120 ? parsed.data.text.slice(0, 117) + '...' : parsed.data.text,
      'message', message.id,
    ).catch(() => {});

    res.status(201).json(message);
  } catch (err) {
    logger.error('portal route error', { err, path: req.path, method: req.method });
    logRouteError('routes/portal.ts', err, req);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── PUT /api/portal/:portalToken/messages/read ───── */

router.put('/:portalToken/messages/read', async (req: Request, res: Response) => {
  try {
    const project = await getProjectByPortalToken(req.params.portalToken);
    if (!project) { res.status(404).json({ error: 'Not found' }); return; }

    const count = await markMessagesRead(project.id, 'client');
    if (count > 0) {
      emitProjectEvent(project.id, 'messages_read', { readerType: 'client', count });
    }
    res.json({ markedRead: count });
  } catch (err) {
    logger.error('portal route error', { err, path: req.path, method: req.method });
    logRouteError('routes/portal.ts', err, req);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── GET /api/portal/:portalToken/messages/unread ─── */

router.get('/:portalToken/messages/unread', async (req: Request, res: Response) => {
  try {
    const project = await getProjectByPortalToken(req.params.portalToken);
    if (!project) { res.status(404).json({ error: 'Not found' }); return; }

    const count = await getUnreadCount(project.id, 'client');
    res.json({ unread: count });
  } catch (err) {
    logger.error('portal route error', { err, path: req.path, method: req.method });
    logRouteError('routes/portal.ts', err, req);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── GET /api/portal/:portalToken/presence ────────── */

router.get('/:portalToken/presence', async (req: Request, res: Response) => {
  try {
    const project = await getProjectByPortalToken(req.params.portalToken);
    if (!project) { res.status(404).json({ error: 'Not found' }); return; }

    const presence = getProjectPresence(project.id);
    res.json(presence);
  } catch (err) {
    logger.error('portal route error', { err, path: req.path, method: req.method });
    logRouteError('routes/portal.ts', err, req);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── GET /api/portal/:portalToken/quotes ───────────── */

router.get('/:portalToken/quotes', async (req: Request, res: Response) => {
  try {
    const project = await getProjectByPortalToken(req.params.portalToken);
    if (!project) { res.status(404).json({ error: 'Not found' }); return; }

    const quotes = await prisma.quote.findMany({
      where: { projectId: project.id, status: { in: ['sent', 'approved', 'revision_requested', 'converted'] } },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { lineItems: true, comments: true } },
        designer: { select: { fullName: true, businessName: true } },
      },
    });

    res.json(quotes.map((q) => ({
      id: q.id,
      projectId: q.projectId,
      designerId: q.designerId,
      version: q.version,
      status: q.status,
      title: q.title,
      subtotal: toNum(q.subtotal),
      grandTotal: toNum(q.grandTotal),
      taxAmount: toNum(q.taxAmount),
      // Expose as display-friendly amounts only; strip internal fee config
      designFee: toNum(q.commissionAmount),
      serviceFee: toNum(q.platformFeeAmount),
      sentAt: q.sentAt,
      approvedAt: q.approvedAt,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
      _count: q._count,
      designer: q.designer,
    })));
  } catch (err) {
    logger.error('portal route error', { err, path: req.path, method: req.method });
    logRouteError('routes/portal.ts', err, req);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── GET /api/portal/:portalToken/quotes/:quoteId ──── */

router.get('/:portalToken/quotes/:quoteId', async (req: Request, res: Response) => {
  try {
    const project = await getProjectByPortalToken(req.params.portalToken);
    if (!project) { res.status(404).json({ error: 'Not found' }); return; }

    const quote = await getQuoteDetail(req.params.quoteId);
    if (!quote || quote.projectId !== project.id || quote.status === 'draft') {
      res.status(404).json({ error: 'Quote not found.' }); return;
    }

    // Serialize with client-friendly labels — strip internal fee config
    res.json({
      id: quote.id,
      projectId: quote.projectId,
      designerId: quote.designerId,
      version: quote.version,
      status: quote.status,
      title: quote.title,
      notes: quote.notes,
      subtotal: toNum(quote.subtotal),
      taxRate: toNum(quote.taxRate),
      taxAmount: toNum(quote.taxAmount),
      // Expose amounts with display-friendly keys; hide commission/fee structure
      designFee: toNum(quote.commissionAmount),
      serviceFee: toNum(quote.platformFeeAmount),
      grandTotal: toNum(quote.grandTotal),
      sentAt: quote.sentAt,
      approvedAt: quote.approvedAt,
      expiresAt: quote.expiresAt,
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
      lineItems: quote.lineItems.map((li: any) => ({
        id: li.id,
        quoteId: li.quoteId,
        productId: li.productId,
        roomId: li.roomId,
        selectedVariant: li.selectedVariant,
        quantity: li.quantity,
        unitPrice: toNum(li.unitPrice),
        lineTotal: toNum(li.lineTotal),
        adjustmentLabel: li.adjustmentLabel,
        adjustmentValue: toNum(li.adjustmentValue),
        sortOrder: li.sortOrder,
        product: li.product ? { ...li.product, price: toNum(li.product.price) } : undefined,
        room: li.room,
      })),
      designer: quote.designer,
      project: quote.project,
    });
  } catch (err) {
    logger.error('portal route error', { err, path: req.path, method: req.method });
    logRouteError('routes/portal.ts', err, req);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── PUT /api/portal/:portalToken/quotes/:quoteId ──── */

const quoteReviewSchema = z.object({
  action: z.enum(['approve', 'request_revision']),
});

router.put('/:portalToken/quotes/:quoteId', portalWriteLimiter, async (req: Request, res: Response) => {
  const parsed = quoteReviewSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  try {
    const project = await getProjectByPortalToken(req.params.portalToken);
    if (!project) { res.status(404).json({ error: 'Not found' }); return; }

    // Pre-check quote status for client-friendly error messages
    const quote = await prisma.quote.findFirst({
      where: { id: req.params.quoteId, projectId: project.id },
      select: { status: true },
    });
    if (!quote) { res.status(404).json({ error: 'Quote not found.' }); return; }
    if (quote.status === 'draft') { res.status(404).json({ error: 'Quote not found.' }); return; }
    if (quote.status === 'approved') {
      res.status(400).json({ error: 'This quote has already been approved.' }); return;
    }
    if (quote.status === 'revision_requested') {
      res.status(400).json({ error: 'A revision has already been requested for this quote.' }); return;
    }
    if (quote.status !== 'sent') {
      res.status(400).json({ error: 'This quote can no longer be modified.' }); return;
    }

    if (parsed.data.action === 'approve') {
      const updated = await approveQuote(req.params.quoteId, project.id);
      res.json({ ...updated, grandTotal: toNum(updated.grandTotal) });
    } else {
      const updated = await requestRevision(req.params.quoteId, project.id);
      res.json({ ...updated, grandTotal: toNum(updated.grandTotal) });
    }
  } catch (err: any) {
    if (err.message?.includes('not found') || err.message?.includes('not in')) {
      res.status(400).json({ error: err.message }); return;
    }
    logger.error('portal route error', { err, path: req.path, method: req.method });
    logRouteError('routes/portal.ts', err, req);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── GET /api/portal/:portalToken/quotes/:quoteId/comments */
/* Now reads from unified Message table with contextType=quote */

router.get('/:portalToken/quotes/:quoteId/comments', async (req: Request, res: Response) => {
  try {
    const project = await getProjectByPortalToken(req.params.portalToken);
    if (!project) { res.status(404).json({ error: 'Not found' }); return; }

    const quote = await prisma.quote.findFirst({ where: { id: req.params.quoteId, projectId: project.id } });
    if (!quote || quote.status === 'draft') { res.status(404).json({ error: 'Quote not found.' }); return; }

    const after = typeof req.query.after === 'string' ? req.query.after : undefined;
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;
    const result = await getMessages(project.id, {
      after,
      before,
      contextType: 'quote',
      contextId: req.params.quoteId,
    });
    const comments = result.messages.map((m) => ({
      id: m.id,
      quoteId: req.params.quoteId,
      senderType: m.senderType,
      senderId: m.senderId,
      senderName: m.senderName,
      text: m.text,
      lineItemId: (m.metadata as any)?.lineItemId ?? null,
      readAt: m.readAt,
      createdAt: m.createdAt,
    }));
    res.json({ comments, hasMore: result.hasMore });
  } catch (err) {
    logger.error('portal route error', { err, path: req.path, method: req.method });
    logRouteError('routes/portal.ts', err, req);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── POST /api/portal/:portalToken/quotes/:quoteId/comments */

const portalQuoteCommentSchema = z.object({
  text: z.string().min(1).max(5000).transform(stripHtml),
  senderName: z.string().max(120).transform(stripHtml).optional(),
  lineItemId: z.string().uuid().optional(),
});

router.post('/:portalToken/quotes/:quoteId/comments', portalMessageLimiter, async (req: Request, res: Response) => {
  const parsed = portalQuoteCommentSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  try {
    const project = await getProjectByPortalToken(req.params.portalToken);
    if (!project) { res.status(404).json({ error: 'Not found' }); return; }

    const quote = await prisma.quote.findFirst({ where: { id: req.params.quoteId, projectId: project.id } });
    if (!quote || quote.status === 'draft') { res.status(404).json({ error: 'Quote not found.' }); return; }

    const message = await createMessage({
      projectId: project.id,
      senderType: 'client',
      senderName: project.client?.name || 'Client',
      text: parsed.data.text,
      contextType: 'quote',
      contextId: req.params.quoteId,
      metadata: parsed.data.lineItemId ? { lineItemId: parsed.data.lineItemId } : undefined,
    });

    emitProjectEvent(project.id, 'new_message', {
      id: message.id,
      senderType: message.senderType,
      senderName: message.senderName,
      text: message.text,
      contextType: message.contextType,
      contextId: message.contextId,
      metadata: message.metadata,
      createdAt: message.createdAt.toISOString(),
    });

    // Legacy event for backward compat
    emitProjectEvent(project.id, 'quote_comment', {
      quoteId: req.params.quoteId,
      commentId: message.id,
      senderType: message.senderType,
      senderName: message.senderName,
      text: message.text,
      lineItemId: (message.metadata as any)?.lineItemId ?? null,
      createdAt: message.createdAt.toISOString(),
    });

    // Notify designer (in-app)
    notifyProjectDesigner(
      project.id, 'quote_comment',
      `${parsed.data.senderName} commented on a quote`,
      parsed.data.text.length > 120 ? parsed.data.text.slice(0, 117) + '...' : parsed.data.text,
      'quote', req.params.quoteId,
    ).catch(() => {});

    // Email designer (fire-and-forget)
    void (async () => {
      try {
        const designer = await prisma.designer.findUnique({
          where: { id: project.designerId },
          select: { fullName: true, email: true },
        });
        if (!designer?.email) return;
        const rendered = await renderQuoteCommentEmail({
          recipientName: designer.fullName,
          senderName: project.client?.name ?? 'Your client',
          projectName: project.name,
          commentText: message.text,
          actionUrl: `${config.frontendUrl}/projects/${project.id}`,
        });
        await sendEmail({ to: designer.email, ...rendered });
      } catch (err) {
        logger.error('[email] portal quote comment email failed', { err });
        logError({ fileName: 'routes/portal.ts', routePath: '/:portalToken/quotes/:quoteId/comments', httpMethod: 'POST', errorMessage: err instanceof Error ? err.message : String(err), errorStack: err instanceof Error ? err.stack : undefined, severity: 'warn' });
      }
    })();

    res.status(201).json({
      id: message.id,
      quoteId: req.params.quoteId,
      senderType: message.senderType,
      senderId: message.senderId,
      senderName: message.senderName,
      text: message.text,
      lineItemId: (message.metadata as any)?.lineItemId ?? null,
      readAt: message.readAt,
      createdAt: message.createdAt,
    });
  } catch (err) {
    logger.error('portal route error', { err, path: req.path, method: req.method });
    logRouteError('routes/portal.ts', err, req);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── PUT /api/portal/:portalToken/quotes/:quoteId/comments/read */

router.put('/:portalToken/quotes/:quoteId/comments/read', async (req: Request, res: Response) => {
  try {
    const project = await getProjectByPortalToken(req.params.portalToken);
    if (!project) { res.status(404).json({ error: 'Not found' }); return; }

    const count = await markMessagesRead(project.id, 'client', {
      contextType: 'quote',
      contextId: req.params.quoteId,
    });
    if (count > 0) {
      emitProjectEvent(project.id, 'messages_read', {
        readerType: 'client',
        count,
        contextType: 'quote',
        contextId: req.params.quoteId,
      });
    }
    res.json({ markedRead: count });
  } catch (err) {
    logger.error('portal route error', { err, path: req.path, method: req.method });
    logRouteError('routes/portal.ts', err, req);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

export default router;
