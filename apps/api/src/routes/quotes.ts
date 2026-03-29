import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@furnlo/db';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import {
  createQuoteFromShortlist,
  QuoteDraftExistsError,
  updateQuote,
  sendQuote,
  convertQuoteToOrder,
  addLineItem,
  updateLineItem,
  removeLineItem,
  getQuoteDetail,
  listQuotesForProject,
} from '../services/quoteService';
import { createMessage, getMessages, markMessagesRead } from '../services/messageService';
import { emitProjectEvent } from '../services/projectEvents';
import logger from '../config/logger';
import { registerUuidValidation } from '../middleware/validateParams';

const router = Router();
router.use(requireAuth, requireRole('designer'));
registerUuidValidation(router);

/* ─── Helpers ───────────────────────────────────────── */

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function serializeQuote(quote: any) {
  if (!quote) return null;
  return {
    ...quote,
    subtotal: toNum(quote.subtotal),
    taxRate: toNum(quote.taxRate),
    taxAmount: toNum(quote.taxAmount),
    commissionValue: toNum(quote.commissionValue),
    commissionAmount: toNum(quote.commissionAmount),
    platformFeeValue: toNum(quote.platformFeeValue),
    platformFeeAmount: toNum(quote.platformFeeAmount),
    grandTotal: toNum(quote.grandTotal),
    lineItems: quote.lineItems?.map((li: any) => ({
      ...li,
      unitPrice: toNum(li.unitPrice),
      lineTotal: toNum(li.lineTotal),
      adjustmentValue: toNum(li.adjustmentValue),
      product: li.product ? { ...li.product, price: toNum(li.product.price) } : undefined,
    })),
  };
}

function serializeQuoteSummary(quote: any) {
  return {
    ...quote,
    subtotal: toNum(quote.subtotal),
    grandTotal: toNum(quote.grandTotal),
    taxAmount: toNum(quote.taxAmount),
    commissionAmount: toNum(quote.commissionAmount),
    platformFeeAmount: toNum(quote.platformFeeAmount),
  };
}

async function getOwnedProject(projectId: string, designerId: string) {
  return prisma.project.findFirst({ where: { id: projectId, designerId } });
}

/* ─── Validation Schemas ────────────────────────────── */

const createQuoteSchema = z.object({
  title: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  itemIds: z.array(z.string().uuid()).optional(),
  feeConfig: z.object({
    taxRate: z.number().min(0).max(100).optional(),
    commissionType: z.enum(['percentage', 'fixed']).optional(),
    commissionValue: z.number().min(0).optional(),
    platformFeeType: z.enum(['percentage', 'fixed']).optional(),
    platformFeeValue: z.number().min(0).optional(),
  }).optional(),
});

const updateQuoteSchema = z.object({
  title: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  taxRate: z.number().min(0).max(100).nullable().optional(),
  commissionType: z.enum(['percentage', 'fixed']).nullable().optional(),
  commissionValue: z.number().min(0).nullable().optional(),
  platformFeeType: z.enum(['percentage', 'fixed']).nullable().optional(),
  platformFeeValue: z.number().min(0).nullable().optional(),
});

const lineItemUpdateSchema = z.object({
  quantity: z.number().int().positive().optional(),
  adjustmentLabel: z.string().max(200).nullable().optional(),
  adjustmentValue: z.number().nullable().optional(),
});

const addLineItemSchema = z.object({
  shortlistItemId: z.string().uuid(),
});

const commentSchema = z.object({
  text: z.string().min(1).max(5000),
  lineItemId: z.string().uuid().optional(),
});

/* ─── POST /api/quotes/projects/:projectId ──────────── */

router.post('/projects/:projectId', async (req: AuthRequest, res: Response) => {
  try {
    const project = await getOwnedProject(req.params.projectId, req.user!.id);
    if (!project) { res.status(404).json({ error: 'Project not found.' }); return; }

    const parsed = createQuoteSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

    const quote = await createQuoteFromShortlist({
      projectId: req.params.projectId,
      designerId: req.user!.id,
      title: parsed.data.title,
      notes: parsed.data.notes,
      itemIds: parsed.data.itemIds,
      feeConfig: parsed.data.feeConfig,
    });

    res.status(201).json(serializeQuote(quote));
  } catch (err: any) {
    if (err instanceof QuoteDraftExistsError) {
      res.status(409).json({
        error: err.message,
        existingQuoteId: err.existingQuoteId,
        existingTitle: err.existingTitle,
      });
      return;
    }
    if (err.message?.includes('No eligible')) {
      res.status(400).json({ error: err.message }); return;
    }
    logger.error('quotes route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── GET /api/quotes/projects/:projectId ───────────── */

router.get('/projects/:projectId', async (req: AuthRequest, res: Response) => {
  try {
    const project = await getOwnedProject(req.params.projectId, req.user!.id);
    if (!project) { res.status(404).json({ error: 'Project not found.' }); return; }

    const quotes = await listQuotesForProject(req.params.projectId);
    res.json(quotes.map(serializeQuoteSummary));
  } catch (err) {
    logger.error('quotes route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── GET /api/quotes/:quoteId ──────────────────────── */

router.get('/:quoteId', async (req: AuthRequest, res: Response) => {
  try {
    const quote = await getQuoteDetail(req.params.quoteId);
    if (!quote || quote.designerId !== req.user!.id) {
      res.status(404).json({ error: 'Quote not found.' }); return;
    }
    res.json(serializeQuote(quote));
  } catch (err) {
    logger.error('quotes route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── PUT /api/quotes/:quoteId ──────────────────────── */

router.put('/:quoteId', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = updateQuoteSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

    const updated = await updateQuote(req.params.quoteId, req.user!.id, parsed.data);
    res.json(serializeQuote(updated));
  } catch (err: any) {
    if (err.message?.includes('not found') || err.message?.includes('not editable')) {
      res.status(400).json({ error: err.message }); return;
    }
    logger.error('quotes route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── POST /api/quotes/:quoteId/line-items ──────────── */

router.post('/:quoteId/line-items', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = addLineItemSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

    const lineItem = await addLineItem(req.params.quoteId, req.user!.id, parsed.data.shortlistItemId);
    res.status(201).json({
      ...lineItem,
      unitPrice: toNum(lineItem.unitPrice),
      lineTotal: toNum(lineItem.lineTotal),
      adjustmentValue: toNum(lineItem.adjustmentValue),
    });
  } catch (err: any) {
    if (err.message?.includes('not found') || err.message?.includes('not editable')) {
      res.status(400).json({ error: err.message }); return;
    }
    logger.error('quotes route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── PUT /api/quotes/:quoteId/line-items/:lineItemId ─ */

router.put('/:quoteId/line-items/:lineItemId', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = lineItemUpdateSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

    const updated = await updateLineItem(req.params.quoteId, req.params.lineItemId, req.user!.id, parsed.data);
    res.json({
      ...updated,
      unitPrice: toNum(updated.unitPrice),
      lineTotal: toNum(updated.lineTotal),
      adjustmentValue: toNum(updated.adjustmentValue),
    });
  } catch (err: any) {
    if (err.message?.includes('not found') || err.message?.includes('not editable')) {
      res.status(400).json({ error: err.message }); return;
    }
    logger.error('quotes route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── DELETE /api/quotes/:quoteId/line-items/:lineItemId */

router.delete('/:quoteId/line-items/:lineItemId', async (req: AuthRequest, res: Response) => {
  try {
    await removeLineItem(req.params.quoteId, req.params.lineItemId, req.user!.id);
    res.json({ success: true });
  } catch (err: any) {
    if (err.message?.includes('not found') || err.message?.includes('not editable')) {
      res.status(400).json({ error: err.message }); return;
    }
    logger.error('quotes route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── POST /api/quotes/:quoteId/send ────────────────── */

router.post('/:quoteId/send', async (req: AuthRequest, res: Response) => {
  try {
    const updated = await sendQuote(req.params.quoteId, req.user!.id);
    res.json(serializeQuoteSummary(updated));
  } catch (err: any) {
    if (err.message?.includes('not found') || err.message?.includes('not in a sendable') || err.message?.includes('empty quote')) {
      res.status(400).json({ error: err.message }); return;
    }
    logger.error('quotes route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── POST /api/quotes/:quoteId/convert ─────────────── */

router.post('/:quoteId/convert', async (req: AuthRequest, res: Response) => {
  try {
    const order = await convertQuoteToOrder(req.params.quoteId, req.user!.id);
    res.status(201).json(order);
  } catch (err: any) {
    if (err.message?.includes('not found') || err.message?.includes('not approved')) {
      res.status(400).json({ error: err.message }); return;
    }
    logger.error('quotes route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── GET /api/quotes/:quoteId/comments ─────────────── */
/* Now reads from unified Message table with contextType=quote */

router.get('/:quoteId/comments', async (req: AuthRequest, res: Response) => {
  try {
    const quote = await prisma.quote.findFirst({ where: { id: req.params.quoteId, designerId: req.user!.id } });
    if (!quote) { res.status(404).json({ error: 'Quote not found.' }); return; }

    const after = typeof req.query.after === 'string' ? req.query.after : undefined;
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;
    const result = await getMessages(quote.projectId, {
      after,
      before,
      contextType: 'quote',
      contextId: req.params.quoteId,
    });
    // Map to legacy QuoteComment shape for backward compat
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
    logger.error('quotes route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── POST /api/quotes/:quoteId/comments ────────────── */
/* Now writes to unified Message table with contextType=quote */

router.post('/:quoteId/comments', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = commentSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

    const quote = await prisma.quote.findFirst({
      where: { id: req.params.quoteId, designerId: req.user!.id },
      include: { designer: { select: { fullName: true } } },
    });
    if (!quote) { res.status(404).json({ error: 'Quote not found.' }); return; }

    const message = await createMessage({
      projectId: quote.projectId,
      senderType: 'designer',
      senderId: req.user!.id,
      senderName: quote.designer.fullName,
      text: parsed.data.text,
      contextType: 'quote',
      contextId: req.params.quoteId,
      metadata: parsed.data.lineItemId ? { lineItemId: parsed.data.lineItemId } : undefined,
    });

    emitProjectEvent(quote.projectId, 'new_message', {
      id: message.id,
      senderType: message.senderType,
      senderName: message.senderName,
      text: message.text,
      contextType: message.contextType,
      contextId: message.contextId,
      metadata: message.metadata,
      createdAt: message.createdAt.toISOString(),
    });

    // Also emit legacy event for any still-connected old clients
    emitProjectEvent(quote.projectId, 'quote_comment', {
      quoteId: req.params.quoteId,
      commentId: message.id,
      senderType: message.senderType,
      senderName: message.senderName,
      text: message.text,
      lineItemId: (message.metadata as any)?.lineItemId ?? null,
      createdAt: message.createdAt.toISOString(),
    });

    // Return in legacy QuoteComment shape
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
    logger.error('quotes route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── PUT /api/quotes/:quoteId/comments/read ────────── */

router.put('/:quoteId/comments/read', async (req: AuthRequest, res: Response) => {
  try {
    const quote = await prisma.quote.findFirst({ where: { id: req.params.quoteId, designerId: req.user!.id } });
    if (!quote) { res.status(404).json({ error: 'Quote not found.' }); return; }

    const count = await markMessagesRead(quote.projectId, 'designer', {
      contextType: 'quote',
      contextId: req.params.quoteId,
    });
    if (count > 0) {
      emitProjectEvent(quote.projectId, 'messages_read', {
        readerType: 'designer',
        count,
        contextType: 'quote',
        contextId: req.params.quoteId,
      });
    }
    res.json({ markedRead: count });
  } catch (err) {
    logger.error('quotes route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

export default router;
