import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@furnlo/db';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { writeAuditLog } from '../services/auditLog';
import { logComparisonEvent } from '../services/comparisonEvents';
import { generateRecommendation, type RecommendationInput } from '../services/recommendationEngine';
import logger from '../config/logger';

const router = Router();
router.use(requireAuth, requireRole('designer'));

/* ─── Validation schemas ────────────────────────────── */

const createComparisonSchema = z.object({
  projectId: z.string().uuid(),
  roomId: z.string().uuid().optional(),
  pinnedProductId: z.string().uuid(),
  comparedProductIds: z.array(z.string().uuid()).min(1).max(5),
});

const updateComparisonSchema = z.object({
  pinnedProductId: z.string().uuid().optional(),
  comparedProductIds: z.array(z.string().uuid()).min(1).max(5).optional(),
  roomId: z.string().uuid().nullable().optional(),
});

/* ─── Helpers ───────────────────────────────────────── */

const PRODUCT_SELECT = {
  id: true,
  productName: true,
  brandName: true,
  category: true,
  currency: true,
  variantId: true,
  sku: true,
  activeVariant: true,
  images: true,
  pricing: true,
  availableOptions: true,
  features: true,
  materials: true,
  promotions: true,
  shipping: true,
  availability: true,
  price: true,
  imageUrl: true,
  sourceUrl: true,
  productUrl: true,
  dimensions: true,
  material: true,
  finishes: true,
  leadTime: true,
  metadata: true,
  isActive: true,
  createdAt: true,
};

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function serializeProduct(p: any) {
  return { ...p, price: toNum(p.price), imageUrl: p.imageUrl || p.images?.primary || null };
}

/* ─── GET /api/comparisons ─────────────────────────── */

router.get('/', async (req: AuthRequest, res: Response) => {
  const projectId = req.query.projectId as string | undefined;

  try {
    const where: any = { designerId: req.user!.id };
    if (projectId) where.projectId = projectId;

    const comparisons = await prisma.pinnedComparison.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { room: { select: { id: true, name: true } } },
    });

    res.json(comparisons);
  } catch (err) {
    logger.error('comparisons route error', { err, path: req.path });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── GET /api/comparisons/:id ─────────────────────── */

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const comparison = await prisma.pinnedComparison.findFirst({
      where: { id: req.params.id, designerId: req.user!.id },
      include: { room: { select: { id: true, name: true, lengthFt: true, widthFt: true, heightFt: true, areaSqft: true, categoryNeeds: true, clientRequirements: true } } },
    });

    if (!comparison) {
      res.status(404).json({ error: 'Comparison not found.' });
      return;
    }

    // Fetch all products (pinned + compared)
    const allProductIds = [comparison.pinnedProductId, ...comparison.comparedProductIds];
    const products = await prisma.product.findMany({
      where: { id: { in: allProductIds }, designerId: req.user!.id },
      select: PRODUCT_SELECT,
    });

    res.json({
      ...comparison,
      products: products.map(serializeProduct),
    });
  } catch (err) {
    logger.error('comparisons route error', { err, path: req.path });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── POST /api/comparisons ────────────────────────── */

router.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = createComparisonSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const { projectId, roomId, pinnedProductId, comparedProductIds } = parsed.data;

    // Verify project belongs to designer
    const project = await prisma.project.findFirst({
      where: { id: projectId, designerId: req.user!.id },
      select: { id: true },
    });
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    // Verify all product IDs belong to designer
    const productCount = await prisma.product.count({
      where: { id: { in: [pinnedProductId, ...comparedProductIds] }, designerId: req.user!.id },
    });
    if (productCount !== new Set([pinnedProductId, ...comparedProductIds]).size) {
      res.status(400).json({ error: 'One or more products not found.' });
      return;
    }

    const comparison = await prisma.pinnedComparison.create({
      data: {
        projectId,
        roomId: roomId || null,
        designerId: req.user!.id,
        pinnedProductId,
        comparedProductIds,
      },
    });

    writeAuditLog({
      actorType: 'designer',
      actorId: req.user!.id,
      action: 'comparison_created',
      entityType: 'comparison',
      entityId: comparison.id,
      payload: { projectId, pinnedProductId, comparedProductIds },
    });

    res.status(201).json(comparison);
  } catch (err) {
    logger.error('comparisons route error', { err, path: req.path });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── PUT /api/comparisons/:id ─────────────────────── */

router.put('/:id', async (req: AuthRequest, res: Response) => {
  const parsed = updateComparisonSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const existing = await prisma.pinnedComparison.findFirst({
      where: { id: req.params.id, designerId: req.user!.id },
    });
    if (!existing) {
      res.status(404).json({ error: 'Comparison not found.' });
      return;
    }

    const data: any = {};
    if (parsed.data.pinnedProductId) data.pinnedProductId = parsed.data.pinnedProductId;
    if (parsed.data.comparedProductIds) data.comparedProductIds = parsed.data.comparedProductIds;
    if (parsed.data.roomId !== undefined) data.roomId = parsed.data.roomId;

    const updated = await prisma.pinnedComparison.update({
      where: { id: req.params.id },
      data,
    });

    writeAuditLog({
      actorType: 'designer',
      actorId: req.user!.id,
      action: 'comparison_updated',
      entityType: 'comparison',
      entityId: updated.id,
      payload: data,
    });

    res.json(updated);
  } catch (err) {
    logger.error('comparisons route error', { err, path: req.path });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── DELETE /api/comparisons/:id ──────────────────── */

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.pinnedComparison.findFirst({
      where: { id: req.params.id, designerId: req.user!.id },
    });
    if (!existing) {
      res.status(404).json({ error: 'Comparison not found.' });
      return;
    }

    await prisma.pinnedComparison.delete({ where: { id: req.params.id } });

    writeAuditLog({
      actorType: 'designer',
      actorId: req.user!.id,
      action: 'comparison_deleted',
      entityType: 'comparison',
      entityId: req.params.id,
    });

    res.json({ message: 'Comparison deleted.' });
  } catch (err) {
    logger.error('comparisons route error', { err, path: req.path });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── POST /api/comparisons/quick ──────────────────── */
// Quick compare: fetch full product details for a list of product IDs without persisting

const quickCompareSchema = z.object({
  productIds: z.array(z.string().uuid()).min(2).max(6),
});

router.post('/quick', async (req: AuthRequest, res: Response) => {
  const parsed = quickCompareSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const products = await prisma.product.findMany({
      where: { id: { in: parsed.data.productIds }, designerId: req.user!.id },
      select: PRODUCT_SELECT,
    });

    res.json({ products: products.map(serializeProduct) });
  } catch (err) {
    logger.error('comparisons route error', { err, path: req.path });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── POST /api/comparisons/recommend ──────────────── */
// Generate AI-powered recommendation summary

const recommendSchema = z.object({
  productIds: z.array(z.string().uuid()).min(2).max(6),
  projectId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  designerNotes: z.string().max(2000).optional(),
});

router.post('/recommend', async (req: AuthRequest, res: Response) => {
  const parsed = recommendSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const { productIds, projectId, roomId, designerNotes } = parsed.data;

    // Fetch products
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, designerId: req.user!.id },
      select: PRODUCT_SELECT,
    });

    if (products.length < 2) {
      res.status(400).json({ error: 'At least 2 valid products required.' });
      return;
    }

    // Fetch room context if provided
    let roomData: RecommendationInput['room'] = null;
    let clientReqs: RecommendationInput['clientRequirements'] = null;

    if (projectId && roomId) {
      const room = await prisma.room.findFirst({
        where: { id: roomId, projectId, project: { designerId: req.user!.id } },
      });
      if (room) {
        const w = room.widthFt ? Number(room.widthFt) : null;
        const l = room.lengthFt ? Number(room.lengthFt) : null;
        const area = w && l ? Math.round(w * l) : null;

        roomData = {
          name: room.name,
          dimensions: w && l ? `${w}ft × ${l}ft${area ? ` (${area} sqft)` : ''}` : null,
          categoryNeeds: room.categoryNeeds || [],
          budgetRange: room.budgetMin || room.budgetMax
            ? `$${room.budgetMin ? Number(room.budgetMin).toLocaleString() : '0'} – $${room.budgetMax ? Number(room.budgetMax).toLocaleString() : '∞'}`
            : null,
        };

        if (room.clientRequirements && typeof room.clientRequirements === 'object') {
          const cr = room.clientRequirements as Record<string, unknown>;
          clientReqs = {
            colorPalette: cr.colorPalette as string | undefined,
            materialPreferences: cr.materialPreferences as string | undefined,
            seatingCapacity: cr.seatingCapacity as number | undefined,
            functionalConstraints: cr.functionalConstraints as string | undefined,
            budgetPriority: cr.budgetPriority as string | undefined,
          };
        }
      }
    }

    // Format products for the recommendation engine
    const formattedProducts = products.map((p: any) => {
      const pricing = p.pricing as Array<Record<string, unknown>> | null;
      const dims = p.dimensions as { width?: number; depth?: number; height?: number; unit?: string } | null;

      let priceStr = '—';
      if (pricing && pricing.length > 0) {
        const prices = pricing.map((v: any) => Number(v.price)).filter((n: number) => !isNaN(n) && n > 0);
        if (prices.length > 1) {
          priceStr = `$${Math.min(...prices).toLocaleString()} – $${Math.max(...prices).toLocaleString()}`;
        } else if (prices.length === 1) {
          priceStr = `$${prices[0].toLocaleString()}`;
        }
      } else if (p.price) {
        priceStr = `$${Number(p.price).toLocaleString()}`;
      }

      let dimStr: string | null = null;
      if (dims) {
        const parts: string[] = [];
        if (dims.width) parts.push(`${dims.width}W`);
        if (dims.depth) parts.push(`${dims.depth}D`);
        if (dims.height) parts.push(`${dims.height}H`);
        if (parts.length) dimStr = `${parts.join(' × ')} ${dims.unit || 'in'}`;
      }

      return {
        name: p.productName,
        brand: p.brandName,
        price: priceStr,
        dimensions: dimStr,
        material: p.material || (p.materials ? formatMaterials(p.materials) : null),
        leadTime: p.leadTime,
        finishes: p.finishes || [],
        features: p.features || [],
        availability: p.availability,
      };
    });

    const result = await generateRecommendation({
      room: roomData,
      clientRequirements: clientReqs,
      comparedProducts: formattedProducts,
      designerNotes,
    });

    // Log the recommendation event
    logComparisonEvent('recommendation_generated', req.user!.id, {
      productIds,
      projectId,
      roomId,
      recommendedProduct: result.recommendedProduct,
    });

    res.json(result);
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    logger.error('recommendation error', { message: errMsg, status: err?.status, name: err?.name });
    res.status(500).json({ error: errMsg });
  }
});

/* ─── POST /api/comparisons/events ─────────────────── */
// Log comparison events from the frontend

const eventSchema = z.object({
  event: z.enum([
    'comparison_started',
    'comparison_product_added',
    'comparison_product_removed',
    'comparison_pin_changed',
    'recommendation_accepted',
    'recommendation_edited',
    'recommendation_discarded',
    'product_shortlisted_from_comparison',
    'product_rejected_from_comparison',
  ]),
  payload: z.record(z.unknown()),
});

router.post('/events', async (req: AuthRequest, res: Response) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  logComparisonEvent(parsed.data.event, req.user!.id, parsed.data.payload as Record<string, unknown>);
  res.json({ ok: true });
});

/* ─── Helpers ───────────────────────────────────────── */

function formatMaterials(materials: unknown): string | null {
  if (!materials || typeof materials !== 'object') return null;
  const m = materials as Record<string, unknown>;
  const parts: string[] = [];
  if (m.primary) parts.push(String(m.primary));
  if (m.frame) parts.push(`${m.frame} frame`);
  return parts.length > 0 ? parts.join(', ') : null;
}

export default router;
