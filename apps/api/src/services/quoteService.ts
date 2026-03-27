import { prisma, Prisma } from '@furnlo/db';
import { splitOrderByBrand } from './orderSplitter';
import { emitProjectEvent } from './projectEvents';
import { writeAuditLog } from './auditLog';
import { notifyProjectDesigner } from './notificationService';
import logger from '../config/logger';

/* ─── Types ────────────────────────────────────────────── */

export interface FeeConfig {
  taxRate?: number;
  commissionType?: 'percentage' | 'fixed';
  commissionValue?: number;
  platformFeeType?: 'percentage' | 'fixed';
  platformFeeValue?: number;
}

export interface CreateQuotePayload {
  projectId: string;
  designerId: string;
  title?: string;
  notes?: string;
  itemIds?: string[]; // specific shortlist item IDs; if empty, uses all approved/pinned
  feeConfig?: FeeConfig;
}

export interface UpdateQuotePayload {
  title?: string;
  notes?: string;
  taxRate?: number | null;
  commissionType?: 'percentage' | 'fixed' | null;
  commissionValue?: number | null;
  platformFeeType?: 'percentage' | 'fixed' | null;
  platformFeeValue?: number | null;
}

export interface LineItemUpdate {
  quantity?: number;
  adjustmentLabel?: string | null;
  adjustmentValue?: number | null;
}

/* ─── Helpers ──────────────────────────────────────────── */

function getProductPrice(product: any): number {
  if (product.activeVariant && typeof product.activeVariant === 'object' && 'price' in product.activeVariant) {
    return Number(product.activeVariant.price);
  }
  if (product.price != null) return Number(product.price);
  if (Array.isArray(product.pricing) && product.pricing.length > 0) {
    return Number(product.pricing[0].price ?? 0);
  }
  return 0;
}

function calcLineTotal(unitPrice: number, quantity: number, adjustmentValue?: number | null): number {
  return unitPrice * quantity + (adjustmentValue ?? 0);
}

/* ─── Create Quote from Shortlist ─────────────────────── */

export async function createQuoteFromShortlist(payload: CreateQuotePayload) {
  const { projectId, designerId, title, notes, itemIds, feeConfig } = payload;

  // Fetch designer fee defaults
  const designer = await prisma.designer.findUnique({
    where: { id: designerId },
    select: { feeDefaults: true },
  });
  const defaults = (designer?.feeDefaults as FeeConfig) ?? {};
  const fees: FeeConfig = { ...defaults, ...feeConfig };

  // Fetch shortlist items
  const where: any = { projectId, designerId };
  if (itemIds && itemIds.length > 0) {
    where.id = { in: itemIds };
  } else {
    where.status = { in: ['approved', 'added_to_cart'] };
  }

  const shortlistItems = await prisma.shortlistItem.findMany({
    where,
    include: {
      product: { select: { id: true, productName: true, brandName: true, price: true, activeVariant: true, pricing: true } },
      room: { select: { id: true, name: true } },
    },
    orderBy: [{ roomId: 'asc' }, { priorityRank: 'asc' }],
  });

  if (shortlistItems.length === 0) {
    throw new Error('No eligible shortlist items found for this quote.');
  }

  // Build line items
  const lineItems = shortlistItems.map((si, idx) => {
    const unitPrice = getProductPrice(si.product);
    return {
      productId: si.productId,
      roomId: si.roomId,
      selectedVariant: si.selectedVariant ?? Prisma.JsonNull,
      quantity: si.quantity,
      unitPrice,
      lineTotal: calcLineTotal(unitPrice, si.quantity),
      sortOrder: idx,
    };
  });

  const subtotal = lineItems.reduce((sum, li) => sum + li.lineTotal, 0);
  const totals = calculateTotals(subtotal, fees);

  const quote = await prisma.quote.create({
    data: {
      projectId,
      designerId,
      title: title || null,
      notes: notes || null,
      taxRate: fees.taxRate ?? null,
      commissionType: fees.commissionType ?? null,
      commissionValue: fees.commissionValue ?? null,
      platformFeeType: fees.platformFeeType ?? null,
      platformFeeValue: fees.platformFeeValue ?? null,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      commissionAmount: totals.commissionAmount,
      platformFeeAmount: totals.platformFeeAmount,
      grandTotal: totals.grandTotal,
      lineItems: {
        create: lineItems,
      },
    },
    include: {
      lineItems: {
        include: {
          product: { select: { id: true, productName: true, brandName: true, price: true, imageUrl: true, category: true, activeVariant: true, images: true } },
          room: { select: { id: true, name: true } },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  writeAuditLog({
    actorType: 'designer', actorId: designerId,
    action: 'quote_created', entityType: 'quote', entityId: quote.id,
    payload: { projectId, lineItemCount: lineItems.length, grandTotal: totals.grandTotal },
  });

  emitProjectEvent(projectId, 'quote_created', { quoteId: quote.id });

  return quote;
}

/* ─── Recalculate Totals ──────────────────────────────── */

export function calculateTotals(subtotal: number, fees: FeeConfig) {
  const taxAmount = fees.taxRate ? subtotal * (fees.taxRate / 100) : 0;

  const commissionAmount =
    fees.commissionType === 'percentage' && fees.commissionValue
      ? subtotal * (fees.commissionValue / 100)
      : fees.commissionType === 'fixed' && fees.commissionValue
        ? fees.commissionValue
        : 0;

  const platformFeeAmount =
    fees.platformFeeType === 'percentage' && fees.platformFeeValue
      ? subtotal * (fees.platformFeeValue / 100)
      : fees.platformFeeType === 'fixed' && fees.platformFeeValue
        ? fees.platformFeeValue
        : 0;

  const grandTotal = subtotal + taxAmount + commissionAmount + platformFeeAmount;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    commissionAmount: Math.round(commissionAmount * 100) / 100,
    platformFeeAmount: Math.round(platformFeeAmount * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100,
  };
}

export async function recalculateQuoteTotals(quoteId: string) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { lineItems: true },
  });
  if (!quote) throw new Error('Quote not found');

  const subtotal = quote.lineItems.reduce((sum, li) => sum + Number(li.lineTotal), 0);
  const fees: FeeConfig = {
    taxRate: quote.taxRate ? Number(quote.taxRate) : undefined,
    commissionType: quote.commissionType as FeeConfig['commissionType'] ?? undefined,
    commissionValue: quote.commissionValue ? Number(quote.commissionValue) : undefined,
    platformFeeType: quote.platformFeeType as FeeConfig['platformFeeType'] ?? undefined,
    platformFeeValue: quote.platformFeeValue ? Number(quote.platformFeeValue) : undefined,
  };

  const totals = calculateTotals(subtotal, fees);

  return prisma.quote.update({
    where: { id: quoteId },
    data: totals,
  });
}

/* ─── Update Quote ────────────────────────────────────── */

export async function updateQuote(quoteId: string, designerId: string, payload: UpdateQuotePayload) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, designerId, status: { in: ['draft', 'revision_requested'] } },
  });
  if (!quote) throw new Error('Quote not found or not editable.');

  await prisma.quote.update({
    where: { id: quoteId },
    data: {
      title: payload.title !== undefined ? payload.title : undefined,
      notes: payload.notes !== undefined ? payload.notes : undefined,
      taxRate: payload.taxRate !== undefined ? payload.taxRate : undefined,
      commissionType: payload.commissionType !== undefined ? payload.commissionType : undefined,
      commissionValue: payload.commissionValue !== undefined ? payload.commissionValue : undefined,
      platformFeeType: payload.platformFeeType !== undefined ? payload.platformFeeType : undefined,
      platformFeeValue: payload.platformFeeValue !== undefined ? payload.platformFeeValue : undefined,
    },
  });

  await recalculateQuoteTotals(quoteId);

  const updated = await getQuoteDetail(quoteId);

  emitProjectEvent(quote.projectId, 'quote_updated', { quoteId, version: updated!.version });

  return updated;
}

/* ─── Line Item CRUD ──────────────────────────────────── */

export async function addLineItem(quoteId: string, designerId: string, shortlistItemId: string) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, designerId, status: { in: ['draft', 'revision_requested'] } },
  });
  if (!quote) throw new Error('Quote not found or not editable.');

  const si = await prisma.shortlistItem.findFirst({
    where: { id: shortlistItemId, projectId: quote.projectId },
    include: { product: { select: { id: true, price: true, activeVariant: true, pricing: true } } },
  });
  if (!si) throw new Error('Shortlist item not found.');

  const maxSort = await prisma.quoteLineItem.aggregate({ where: { quoteId }, _max: { sortOrder: true } });
  const unitPrice = getProductPrice(si.product);

  const lineItem = await prisma.quoteLineItem.create({
    data: {
      quoteId,
      productId: si.productId,
      roomId: si.roomId,
      selectedVariant: si.selectedVariant ?? Prisma.JsonNull,
      quantity: si.quantity,
      unitPrice,
      lineTotal: calcLineTotal(unitPrice, si.quantity),
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
    include: {
      product: { select: { id: true, productName: true, brandName: true, price: true, imageUrl: true, category: true, activeVariant: true, images: true } },
      room: { select: { id: true, name: true } },
    },
  });

  await recalculateQuoteTotals(quoteId);
  emitProjectEvent(quote.projectId, 'quote_updated', { quoteId, version: quote.version });

  return lineItem;
}

export async function updateLineItem(quoteId: string, lineItemId: string, designerId: string, payload: LineItemUpdate) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, designerId, status: { in: ['draft', 'revision_requested'] } },
  });
  if (!quote) throw new Error('Quote not found or not editable.');

  const li = await prisma.quoteLineItem.findFirst({ where: { id: lineItemId, quoteId } });
  if (!li) throw new Error('Line item not found.');

  const quantity = payload.quantity ?? li.quantity;
  const adjustmentValue = payload.adjustmentValue !== undefined ? payload.adjustmentValue : Number(li.adjustmentValue ?? 0);
  const lineTotal = calcLineTotal(Number(li.unitPrice), quantity, adjustmentValue);

  const updated = await prisma.quoteLineItem.update({
    where: { id: lineItemId },
    data: {
      quantity,
      adjustmentLabel: payload.adjustmentLabel !== undefined ? payload.adjustmentLabel : undefined,
      adjustmentValue: payload.adjustmentValue !== undefined ? payload.adjustmentValue : undefined,
      lineTotal,
    },
    include: {
      product: { select: { id: true, productName: true, brandName: true, price: true, imageUrl: true, category: true, activeVariant: true, images: true } },
      room: { select: { id: true, name: true } },
    },
  });

  await recalculateQuoteTotals(quoteId);
  emitProjectEvent(quote.projectId, 'quote_updated', { quoteId, version: quote.version });

  return updated;
}

export async function removeLineItem(quoteId: string, lineItemId: string, designerId: string) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, designerId, status: { in: ['draft', 'revision_requested'] } },
  });
  if (!quote) throw new Error('Quote not found or not editable.');

  await prisma.quoteLineItem.delete({ where: { id: lineItemId } });
  await recalculateQuoteTotals(quoteId);

  emitProjectEvent(quote.projectId, 'quote_updated', { quoteId, version: quote.version });
}

/* ─── Send Quote ──────────────────────────────────────── */

export async function sendQuote(quoteId: string, designerId: string) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, designerId, status: { in: ['draft', 'revision_requested'] } },
    include: { _count: { select: { lineItems: true } } },
  });
  if (!quote) throw new Error('Quote not found or not in a sendable state.');
  if (quote._count.lineItems === 0) throw new Error('Cannot send an empty quote.');

  const updated = await prisma.quote.update({
    where: { id: quoteId },
    data: { status: 'sent', sentAt: new Date() },
  });

  writeAuditLog({
    actorType: 'designer', actorId: designerId,
    action: 'quote_sent', entityType: 'quote', entityId: quoteId,
    payload: { projectId: quote.projectId },
  });

  emitProjectEvent(quote.projectId, 'quote_sent', { quoteId });

  return updated;
}

/* ─── Client Actions ──────────────────────────────────── */

export async function approveQuote(quoteId: string, projectId: string) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, projectId, status: 'sent' },
  });
  if (!quote) throw new Error('Quote not found or not in approvable state.');

  const updated = await prisma.quote.update({
    where: { id: quoteId },
    data: { status: 'approved', approvedAt: new Date() },
  });

  writeAuditLog({
    actorType: 'client',
    action: 'quote_approved', entityType: 'quote', entityId: quoteId,
    payload: { projectId },
  });

  emitProjectEvent(projectId, 'quote_approved', { quoteId });

  notifyProjectDesigner(
    projectId, 'quote_approved',
    'Client approved your quote',
    undefined, 'quote', quoteId,
  ).catch(() => {});

  return updated;
}

export async function requestRevision(quoteId: string, projectId: string) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, projectId, status: 'sent' },
  });
  if (!quote) throw new Error('Quote not found or not in revisable state.');

  const updated = await prisma.quote.update({
    where: { id: quoteId },
    data: { status: 'revision_requested', version: { increment: 1 } },
  });

  writeAuditLog({
    actorType: 'client',
    action: 'quote_revision_requested', entityType: 'quote', entityId: quoteId,
    payload: { projectId, newVersion: updated.version },
  });

  emitProjectEvent(projectId, 'quote_revision_requested', { quoteId });

  notifyProjectDesigner(
    projectId, 'quote_revision',
    'Client requested a revision on your quote',
    undefined, 'quote', quoteId,
  ).catch(() => {});

  return updated;
}

/* ─── Convert to Order ────────────────────────────────── */

export async function convertQuoteToOrder(quoteId: string, designerId: string) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, designerId, status: 'approved' },
    include: {
      lineItems: {
        include: {
          product: { select: { id: true, productName: true, brandName: true } },
        },
      },
    },
  });
  if (!quote) throw new Error('Quote not found or not approved.');

  const lineItemsData = quote.lineItems.map((li) => ({
    productId: li.productId,
    roomId: li.roomId,
    selectedVariant: li.selectedVariant ?? undefined,
    quantity: li.quantity,
    unitPrice: Number(li.unitPrice),
    lineTotal: Number(li.lineTotal),
    brandName: li.product.brandName || 'Unknown',
  }));

  const brandGroups = splitOrderByBrand(
    lineItemsData.map((li, i) => ({ id: String(i), brandName: li.brandName, lineTotal: li.lineTotal }))
  );

  const order = await prisma.$transaction(async (tx) => {
    // 1. Create order with quote grand total
    const newOrder = await tx.order.create({
      data: {
        projectId: quote.projectId,
        designerId,
        status: 'draft',
        totalAmount: Number(quote.grandTotal),
        taxAmount: Number(quote.taxAmount),
      },
    });

    // 2. Create brand POs
    const brandPoMap = new Map<string, string>();
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

    // 3. Create order line items
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

    // 4. Mark shortlist items as ordered
    for (const li of lineItemsData) {
      await tx.shortlistItem.updateMany({
        where: {
          projectId: quote.projectId,
          productId: li.productId,
          roomId: li.roomId,
          status: { in: ['approved', 'added_to_cart', 'suggested'] },
        },
        data: { status: 'ordered' },
      });
    }

    // 5. Mark quote as converted
    await tx.quote.update({
      where: { id: quoteId },
      data: { status: 'converted', convertedOrderId: newOrder.id },
    });

    return tx.order.findUnique({
      where: { id: newOrder.id },
      include: {
        lineItems: { include: { product: { select: { id: true, productName: true, brandName: true, price: true } } } },
        brandPOs: true,
      },
    });
  });

  writeAuditLog({
    actorType: 'designer', actorId: designerId,
    action: 'quote_converted_to_order', entityType: 'quote', entityId: quoteId,
    payload: { orderId: order!.id, projectId: quote.projectId },
  });

  emitProjectEvent(quote.projectId, 'quote_converted', { quoteId, orderId: order!.id });
  emitProjectEvent(quote.projectId, 'order_created', { orderId: order!.id });

  return order;
}

/* ─── Read Helpers ────────────────────────────────────── */

export async function getQuoteDetail(quoteId: string) {
  return prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      lineItems: {
        include: {
          product: { select: { id: true, productName: true, brandName: true, price: true, imageUrl: true, category: true, activeVariant: true, images: true, dimensions: true, material: true } },
          room: { select: { id: true, name: true } },
        },
        orderBy: { sortOrder: 'asc' },
      },
      comments: { orderBy: { createdAt: 'asc' } },
      designer: { select: { id: true, fullName: true, businessName: true } },
      project: { select: { id: true, name: true, client: { select: { name: true, email: true } } } },
    },
  });
}

export async function listQuotesForProject(projectId: string) {
  return prisma.quote.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { lineItems: true, comments: true } },
      designer: { select: { fullName: true } },
    },
  });
}
