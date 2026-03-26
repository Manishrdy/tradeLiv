import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { searchProducts, getMoreResults } from '../services/productSearch';
import { extractProductFromUrl, ExtractionError, ExtractionResult } from '../services/catalogExtractor';
import logger from '../config/logger';

const router = Router();
router.use(requireAuth, requireRole('designer'));

/* ─── Rate limiter (1 search per 10s per designer) ──── */

const searchRateLimit = new Map<string, number>();
const RATE_LIMIT_MS = 10_000;

/* ─── POST /api/catalog/search ──────────────────────── */

const searchSchema = z.object({
  query: z.string().min(10, 'Please describe the product in more detail (at least 10 characters).').max(2000),
});

router.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = searchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const designerId = req.user!.id;

  // Rate limit
  const last = searchRateLimit.get(designerId);
  if (last != null) {
    const elapsed = Date.now() - last;
    if (elapsed < RATE_LIMIT_MS) {
      const retryAfter = Math.ceil((RATE_LIMIT_MS - elapsed) / 1000);
      res.status(429).json({
        error: `Please wait ${retryAfter}s before searching again.`,
        errorCode: 'RATE_LIMITED',
        retryAfter,
      });
      return;
    }
  }
  searchRateLimit.set(designerId, Date.now());

  try {
    const result = await searchProducts(parsed.data.query, designerId);
    res.json(result);
  } catch (err: any) {
    logger.error('Product search error', { err: err?.message, query: parsed.data.query.slice(0, 100) });
    res.status(500).json({ error: 'Search failed. Please try again.' });
  }
});

/* ─── GET /api/catalog/search/:sessionId/more ───────── */

router.get('/:sessionId/more', async (req: AuthRequest, res: Response) => {
  const designerId = req.user!.id;
  const sessionId = req.params.sessionId as string;

  const result = getMoreResults(sessionId, designerId);
  if (!result) {
    res.status(404).json({ error: 'Search session expired or not found. Please search again.' });
    return;
  }

  res.json(result);
});

/* ─── POST /api/catalog/search/extract ──────────────── */

const extractSelectedSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(5, 'Maximum 5 products at a time'),
});

router.post('/extract', async (req: AuthRequest, res: Response) => {
  const parsed = extractSelectedSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const results = await Promise.allSettled(
      parsed.data.urls.map(async (url) => {
        const result: ExtractionResult = await extractProductFromUrl(url);
        return { url, ...result };
      }),
    );

    res.json({
      results: results.map((r, i) => {
        if (r.status === 'fulfilled') return r.value;
        const err = r.reason;
        return {
          url: parsed.data.urls[i],
          type: 'error' as const,
          error: err instanceof ExtractionError ? err.message : 'Failed to extract product data.',
          errorCode: err instanceof ExtractionError ? err.code : 'UNKNOWN',
        };
      }),
    });
  } catch (err: any) {
    logger.error('Search extract error', { err: err?.message });
    res.status(500).json({ error: 'Extraction failed. Please try again.' });
  }
});

export default router;
