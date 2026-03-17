import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@furnlo/db';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { writeAuditLog } from '../services/auditLog';
import logger from '../config/logger';

const router = Router();
router.use(requireAuth, requireRole('designer'));

/* ─── Validation schemas ────────────────────────────── */

const dimensionsSchema = z.object({
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  depth: z.number().positive().optional(),
  weight: z.number().positive().optional(),
  unit: z.enum(['cm', 'in', 'ft']).optional(),
}).optional();

const productCreateSchema = z.object({
  productName: z.string().min(1, 'Product name is required').max(200),
  sourceUrl: z.string().url('Invalid URL').max(2000),
  brandName: z.string().max(200).optional(),
  price: z.number().positive().optional(),
  imageUrl: z.string().url('Invalid image URL').max(2000).optional().or(z.literal('')),
  productUrl: z.string().url('Invalid product URL').max(2000).optional().or(z.literal('')),
  dimensions: dimensionsSchema,
  material: z.string().max(200).optional(),
  finishes: z.array(z.string().max(100)).max(20).optional().default([]),
  leadTime: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
});

const productUpdateSchema = z.object({
  productName: z.string().min(1).max(200).optional(),
  sourceUrl: z.string().url('Invalid URL').max(2000).optional(),
  brandName: z.string().max(200).nullable().optional(),
  price: z.number().positive().nullable().optional(),
  imageUrl: z.string().url('Invalid image URL').max(2000).nullable().optional().or(z.literal('')),
  productUrl: z.string().url('Invalid product URL').max(2000).nullable().optional().or(z.literal('')),
  dimensions: dimensionsSchema.nullable(),
  material: z.string().max(200).nullable().optional(),
  finishes: z.array(z.string().max(100)).max(20).optional(),
  leadTime: z.string().max(100).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
});

/* ─── Helpers ───────────────────────────────────────── */

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function serializeProduct(p: any) {
  return {
    ...p,
    price: toNum(p.price),
  };
}

/* ─── GET /api/catalog/products ─────────────────────── */

router.get('/products', async (req: AuthRequest, res: Response) => {
  const search = req.query.search as string | undefined;
  const category = req.query.category as string | undefined;
  const page = (req.query.page as string) || '1';
  const limit = (req.query.limit as string) || '20';
  const includeInactive = req.query.includeInactive as string | undefined;

  try {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { designerId: req.user!.id };

    if (includeInactive !== 'true') {
      where.isActive = true;
    }

    if (search) {
      where.OR = [
        { productName: { contains: search, mode: 'insensitive' } },
        { brandName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true,
          productName: true,
          brandName: true,
          price: true,
          imageUrl: true,
          category: true,
          isActive: true,
          sourceUrl: true,
          material: true,
          finishes: true,
          leadTime: true,
          createdAt: true,
          _count: { select: { shortlistItems: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      products: products.map(serializeProduct),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    logger.error('catalog route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── GET /api/catalog/products/categories ──────────── */

router.get('/products/categories', async (req: AuthRequest, res: Response) => {
  try {
    const categories = await prisma.product.findMany({
      where: { designerId: req.user!.id, isActive: true, category: { not: null } },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });

    res.json(categories.map((c) => c.category).filter(Boolean));
  } catch (err) {
    logger.error('catalog route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── GET /api/catalog/products/:id ─────────────────── */

router.get('/products/:id', async (req: AuthRequest, res: Response) => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, designerId: req.user!.id },
      include: {
        _count: { select: { shortlistItems: true, cartItems: true } },
      },
    });

    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    res.json(serializeProduct(product));
  } catch (err) {
    logger.error('catalog route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── POST /api/catalog/products ────────────────────── */

router.post('/products', async (req: AuthRequest, res: Response) => {
  const parsed = productCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const data = parsed.data;

    const product = await prisma.product.create({
      data: {
        designerId: req.user!.id,
        productName: data.productName,
        sourceUrl: data.sourceUrl,
        brandName: data.brandName || null,
        price: data.price ?? null,
        imageUrl: data.imageUrl || null,
        productUrl: data.productUrl || null,
        dimensions: data.dimensions ?? undefined,
        material: data.material || null,
        finishes: data.finishes ?? [],
        leadTime: data.leadTime || null,
        category: data.category || null,
      },
    });

    writeAuditLog({
      actorType: 'designer',
      actorId: req.user!.id,
      action: 'product_created',
      entityType: 'product',
      entityId: product.id,
      payload: { productName: product.productName, brandName: product.brandName },
    });

    res.status(201).json(serializeProduct(product));
  } catch (err) {
    logger.error('catalog route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── PUT /api/catalog/products/:id ─────────────────── */

router.put('/products/:id', async (req: AuthRequest, res: Response) => {
  const parsed = productUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, designerId: req.user!.id },
    });
    if (!existing) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const { dimensions, ...rest } = parsed.data;
    const updateData: any = { ...rest };
    if (dimensions !== undefined) {
      updateData.dimensions = dimensions === null ? null : dimensions;
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: updateData,
    });

    writeAuditLog({
      actorType: 'designer',
      actorId: req.user!.id,
      action: 'product_updated',
      entityType: 'product',
      entityId: product.id,
      payload: { productName: product.productName },
    });

    res.json(serializeProduct(product));
  } catch (err) {
    logger.error('catalog route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── PUT /api/catalog/products/:id/deactivate ──────── */

router.put('/products/:id/deactivate', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, designerId: req.user!.id },
    });
    if (!existing) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    writeAuditLog({
      actorType: 'designer',
      actorId: req.user!.id,
      action: 'product_deactivated',
      entityType: 'product',
      entityId: product.id,
      payload: { productName: product.productName },
    });

    res.json(serializeProduct(product));
  } catch (err) {
    logger.error('catalog route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── PUT /api/catalog/products/:id/reactivate ──────── */

router.put('/products/:id/reactivate', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, designerId: req.user!.id },
    });
    if (!existing) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { isActive: true },
    });

    res.json(serializeProduct(product));
  } catch (err) {
    logger.error('catalog route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

export default router;
