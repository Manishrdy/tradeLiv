import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@furnlo/db';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { writeAuditLog } from '../services/auditLog';
import {
  extractProductFromUrl,
  ExtractionResult,
  ExtractionError,
  batchLimiter,
} from '../services/catalogExtractor';
import logger from '../config/logger';
import { registerUuidValidation } from '../middleware/validateParams';

const router = Router();
router.use(requireAuth, requireRole('designer'));
registerUuidValidation(router);

/* ─── Validation schemas ────────────────────────────── */

const dimensionsSchema = z.object({
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  depth: z.number().positive().optional(),
  weight: z.number().positive().optional(),
  unit: z.enum(['cm', 'in', 'ft']).optional(),
  raw: z.string().max(500).optional(),
}).optional();

const productCreateSchema = z.object({
  productName: z.string().min(1, 'Product name is required').max(200),
  sourceUrl: z.string().url('Invalid URL').max(2000),
  brandName: z.string().max(200).optional(),
  category: z.string().max(200).optional(),
  currency: z.string().length(3).optional(),

  // New variant-aware fields
  variantId: z.string().max(200).optional(),
  sku: z.string().max(200).optional(),
  activeVariant: z.record(z.union([z.string(), z.number()])).optional(),
  images: z.object({
    primary: z.string().url().optional().or(z.literal('')),
    gallery: z.array(z.string().url()).optional(),
    note: z.string().max(500).optional(),
  }).optional(),
  pricing: z.array(z.record(z.union([z.string(), z.number()]))).optional(),
  availableOptions: z.array(z.object({
    type: z.string().max(100),
    values: z.array(z.string().max(200)).max(100),
  })).optional(),
  features: z.array(z.string().max(500)).max(50).optional().default([]),
  materials: z.record(z.union([z.string(), z.array(z.string())])).optional(),
  promotions: z.array(z.string().max(500)).max(20).optional().default([]),
  shipping: z.string().max(200).optional(),
  availability: z.string().max(200).optional(),

  // Legacy fields (kept for backward compat)
  price: z.number().positive().optional(),
  imageUrl: z.string().url('Invalid image URL').max(2000).optional().or(z.literal('')),
  productUrl: z.string().url('Invalid product URL').max(2000).optional().or(z.literal('')),
  dimensions: dimensionsSchema,
  material: z.string().max(200).optional(),
  finishes: z.array(z.string().max(100)).max(20).optional().default([]),
  leadTime: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const productUpdateSchema = z.object({
  productName: z.string().min(1).max(200).optional(),
  sourceUrl: z.string().url('Invalid URL').max(2000).optional(),
  brandName: z.string().max(200).nullable().optional(),
  category: z.string().max(200).nullable().optional(),
  currency: z.string().length(3).nullable().optional(),

  // New variant-aware fields
  variantId: z.string().max(200).nullable().optional(),
  sku: z.string().max(200).nullable().optional(),
  activeVariant: z.record(z.union([z.string(), z.number()])).nullable().optional(),
  images: z.object({
    primary: z.string().url().optional().or(z.literal('')),
    gallery: z.array(z.string().url()).optional(),
    note: z.string().max(500).optional(),
  }).nullable().optional(),
  pricing: z.array(z.record(z.union([z.string(), z.number()]))).nullable().optional(),
  availableOptions: z.array(z.object({
    type: z.string().max(100),
    values: z.array(z.string().max(200)).max(100),
  })).nullable().optional(),
  features: z.array(z.string().max(500)).max(50).optional(),
  materials: z.record(z.union([z.string(), z.array(z.string())])).nullable().optional(),
  promotions: z.array(z.string().max(500)).max(20).optional(),
  shipping: z.string().max(200).nullable().optional(),
  availability: z.string().max(200).nullable().optional(),

  // Legacy fields (kept for backward compat)
  price: z.number().positive().nullable().optional(),
  imageUrl: z.string().url('Invalid image URL').max(2000).nullable().optional().or(z.literal('')),
  productUrl: z.string().url('Invalid product URL').max(2000).nullable().optional().or(z.literal('')),
  dimensions: dimensionsSchema.nullable(),
  material: z.string().max(200).nullable().optional(),
  finishes: z.array(z.string().max(100)).max(20).optional(),
  leadTime: z.string().max(100).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

/* ─── Rate limiters (30s per designer, in-memory) ───── */

const extractRateLimit = new Map<string, number>();
const batchExtractRateLimit = new Map<string, number>();
const RATE_LIMIT_MS = 30_000;

// Periodic cleanup: evict expired entries every 2 minutes
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 2 * 60 * 1000;

function evictExpiredRateLimits(map: Map<string, number>) {
  const cutoff = Date.now() - RATE_LIMIT_MS;
  for (const [key, timestamp] of map) {
    if (timestamp < cutoff) {
      map.delete(key);
    }
  }
}

const rateLimitCleanupTimer = setInterval(() => {
  evictExpiredRateLimits(extractRateLimit);
  evictExpiredRateLimits(batchExtractRateLimit);
}, RATE_LIMIT_CLEANUP_INTERVAL_MS);
rateLimitCleanupTimer.unref(); // don't prevent process exit

function checkRateLimit(map: Map<string, number>, designerId: string): { allowed: boolean; retryAfter?: number } {
  const last = map.get(designerId);
  if (last != null) {
    const elapsed = Date.now() - last;
    if (elapsed < RATE_LIMIT_MS) {
      return { allowed: false, retryAfter: Math.ceil((RATE_LIMIT_MS - elapsed) / 1000) };
    }
    map.delete(designerId);
  }
  return { allowed: true };
}

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
    // Ensure legacy imageUrl is populated from images.primary if missing
    imageUrl: p.imageUrl || p.images?.primary || null,
  };
}

function isSafeUrl(input: string): boolean {
  try {
    const parsed = new URL(input);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) return false;
    
    // Check for private IPv4 subnets
    const parts = host.split('.');
    if (parts.length === 4 && parts.every(p => !isNaN(Number(p)))) {
      const [a, b] = parts.map(Number);
      if (
        (a === 10) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 169 && b === 254) ||
        (a === 127)
      ) {
        return false;
      }
    }
    
    // Check for unique local address IPv6 and loopback
    if (host.includes('fc00::') || host.includes('fd00::') || host === '[::1]') return false;
    
    return true;
  } catch {
    return false;
  }
}

async function validateImageUrl(url: string): Promise<boolean> {
  if (!isSafeUrl(url)) return false;

  try {
    const headCtrl = new AbortController();
    const headTimeout = setTimeout(() => headCtrl.abort(), 5_000);
    const headRes = await fetch(url, { method: 'HEAD', signal: headCtrl.signal });
    clearTimeout(headTimeout);

    if (headRes.status === 404 || headRes.status === 410) return false;
    if (headRes.ok) return true;

    if (headRes.status === 403) {
      try {
        const getCtrl = new AbortController();
        const getTimeout = setTimeout(() => getCtrl.abort(), 5_000);
        const getRes = await fetch(url, {
          method: 'GET',
          headers: { Range: 'bytes=0-0' },
          signal: getCtrl.signal,
        });
        clearTimeout(getTimeout);
        return getRes.status !== 404 && getRes.status !== 410;
      } catch {
        return true;
      }
    }

    return true;
  } catch {
    return true;
  }
}

/* ─── Error code mapping for extraction errors ──────── */

function extractionErrorResponse(err: any, sourceUrl: string) {
  if (err instanceof ExtractionError) {
    const statusMap: Record<string, number> = {
      BOT_BLOCKED: 422,
      NOT_PRODUCT_PAGE: 422,
      PARSE_FAILED: 422,
      NETWORK_ERROR: 502,
      NO_PRODUCTS: 422,
      UNKNOWN: 500,
    };

    const hintMap: Record<string, string> = {
      BOT_BLOCKED: 'This site blocked our request. Try a different URL or add the product manually.',
      NOT_PRODUCT_PAGE: 'This doesn\'t appear to be a product page. Navigate to the specific product and try again.',
      PARSE_FAILED: 'Failed to extract product details. Try a different URL or add the product manually.',
      NETWORK_ERROR: 'Could not reach this website. Check the URL and try again.',
      NO_PRODUCTS: 'No products found on this page. Make sure the URL points to a product page.',
      UNKNOWN: 'An unexpected error occurred. Please try again.',
    };

    return {
      status: statusMap[err.code] ?? 422,
      body: {
        error: err.message,
        errorCode: err.code,
        hint: hintMap[err.code],
      },
    };
  }

  const message = err?.message?.includes('parse')
    || err?.message?.includes('extract')
    || err?.message?.includes('No products')
    ? err.message
    : 'Failed to extract product details. Please try a different URL or add the product manually.';

  return {
    status: 422,
    body: { error: message, errorCode: 'UNKNOWN' as const },
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
          // Legacy fields
          price: true,
          imageUrl: true,
          isActive: true,
          sourceUrl: true,
          material: true,
          finishes: true,
          leadTime: true,
          metadata: true,
          dimensions: true,
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
        category: data.category || null,
        currency: data.currency || 'USD',

        // New variant-aware fields
        variantId: data.variantId || null,
        sku: data.sku || null,
        activeVariant: data.activeVariant ?? undefined,
        images: data.images ?? undefined,
        pricing: data.pricing ?? undefined,
        availableOptions: data.availableOptions ?? undefined,
        features: data.features ?? [],
        materials: data.materials ?? undefined,
        promotions: data.promotions ?? [],
        shipping: data.shipping || null,
        availability: data.availability || null,

        // Legacy fields
        price: data.price ?? null,
        imageUrl: data.imageUrl || null,
        productUrl: data.productUrl || null,
        dimensions: data.dimensions ?? undefined,
        material: data.material || null,
        finishes: data.finishes ?? [],
        leadTime: data.leadTime || null,
        metadata: data.metadata ? (data.metadata as any) : undefined,
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

    // Validate imageUrl — clear it if clearly invalid (404/403/410), warn the client
    let imageUrlWarning = false;
    if (product.imageUrl) {
      const imageValid = await validateImageUrl(product.imageUrl);
      if (!imageValid) {
        await prisma.product.update({ where: { id: product.id }, data: { imageUrl: null } });
        imageUrlWarning = true;
        res.status(201).json({ ...serializeProduct({ ...product, imageUrl: null }), imageUrlWarning });
        return;
      }
    }

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

    const { dimensions, metadata, ...rest } = parsed.data;
    const updateData: any = { ...rest };
    if (dimensions !== undefined) {
      updateData.dimensions = dimensions === null ? null : dimensions;
    }
    if (metadata !== undefined) {
      updateData.metadata = metadata === null ? null : metadata;
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

/* ─── DELETE /api/catalog/products/:id ──────────────── */

router.delete('/products/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, designerId: req.user!.id },
    });

    if (!existing) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const [shortlistCount, cartCount] = await Promise.all([
      prisma.shortlistItem.count({ where: { productId: req.params.id } }),
      prisma.cartItem.count({ where: { productId: req.params.id } }),
    ]);
    const inUse = shortlistCount + cartCount;
    if (inUse > 0) {
      res.status(409).json({
        error: `This product is used in ${inUse} shortlist/cart item${inUse !== 1 ? 's' : ''} and cannot be deleted. Deactivate it instead to hide it from your catalog.`,
      });
      return;
    }

    await prisma.product.delete({ where: { id: req.params.id } });

    writeAuditLog({
      actorType: 'designer',
      actorId: req.user!.id,
      action: 'product_deleted',
      entityType: 'product',
      entityId: req.params.id,
      payload: { productName: existing.productName },
    });

    res.json({ message: 'Product deleted.' });
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

/* ─── POST /api/catalog/extract ─────────────────────── */

const extractSchema = z.object({
  sourceUrl: z.string().url('Invalid URL'),
  reextract: z.boolean().optional(),
});

router.post('/extract', async (req: AuthRequest, res: Response) => {
  const parsed = extractSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  // Rate limit: 30s per designer
  const designerId = req.user!.id;
  const rateCheck = checkRateLimit(extractRateLimit, designerId);
  if (!rateCheck.allowed) {
    res.status(429).json({
      error: `Please wait ${rateCheck.retryAfter}s before extracting again.`,
      errorCode: 'RATE_LIMITED',
      retryAfter: rateCheck.retryAfter,
    });
    return;
  }

  // URL duplicate check — skip when re-extracting an existing product
  if (!parsed.data.reextract) {
    try {
      const duplicate = await prisma.product.findFirst({
        where: { designerId, sourceUrl: parsed.data.sourceUrl },
        select: { id: true, productName: true, brandName: true, imageUrl: true, images: true, isActive: true },
      });

      if (duplicate) {
        res.json({ type: 'duplicate', duplicateProduct: duplicate });
        return;
      }
    } catch (err) {
      logger.error('catalog extract duplicate check error', { err });
    }
  }

  // Stamp rate limit before calling Claude (prevents hammering on slow responses)
  extractRateLimit.set(designerId, Date.now());

  try {
    const result: ExtractionResult = await extractProductFromUrl(parsed.data.sourceUrl);
    res.json(result);
  } catch (err: any) {
    logger.error('catalog extract error', { err, sourceUrl: parsed.data.sourceUrl });
    const errRes = extractionErrorResponse(err, parsed.data.sourceUrl);
    res.status(errRes.status).json(errRes.body);
  }
});

/* ─── POST /api/catalog/extract/batch ───────────────── */

const batchExtractSchema = z.object({
  urls: z.array(z.string().url('Invalid URL')).min(1).max(5, 'Maximum 5 URLs per batch'),
});

router.post('/extract/batch', async (req: AuthRequest, res: Response) => {
  const parsed = batchExtractSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  // Separate rate limit from single extract so collection → batch flow isn't blocked
  const designerId = req.user!.id;
  const rateCheck = checkRateLimit(batchExtractRateLimit, designerId);
  if (!rateCheck.allowed) {
    res.status(429).json({
      error: `Please wait ${rateCheck.retryAfter}s before extracting again.`,
      errorCode: 'RATE_LIMITED',
      retryAfter: rateCheck.retryAfter,
    });
    return;
  }
  batchExtractRateLimit.set(designerId, Date.now());

  // Use concurrency limiter (max 2 parallel extractions) to avoid API rate limits
  const results = await Promise.allSettled(
    parsed.data.urls.map((url) =>
      batchLimiter(async () => {
        // Duplicate check per URL
        const duplicate = await prisma.product.findFirst({
          where: { designerId, sourceUrl: url },
          select: { id: true, productName: true, brandName: true, imageUrl: true, images: true, isActive: true },
        });
        if (duplicate) {
          return { url, type: 'duplicate' as const, duplicateProduct: duplicate };
        }
        const result = await extractProductFromUrl(url);
        return { url, ...result };
      }),
    ),
  );

  res.json({
    results: results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      const err = r.reason;
      const errRes = extractionErrorResponse(err, parsed.data.urls[i]);
      return {
        url: parsed.data.urls[i],
        type: 'error' as const,
        error: errRes.body.error,
        errorCode: errRes.body.errorCode,
      };
    }),
  });
});

export default router;
