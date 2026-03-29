import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@furnlo/db';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import logger from '../config/logger';
import { logRouteError } from '../services/errorLogger';
import { registerUuidValidation } from '../middleware/validateParams';

const router = Router();
registerUuidValidation(router);

/* ─── GET /api/furniture-categories ─────────────────── */
/* Returns active categories for designers (authenticated) */

router.get('/', requireAuth, requireRole('designer'), async (_req: AuthRequest, res: Response) => {
  try {
    const categories = await prisma.furnitureCategory.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json(categories);
  } catch (err) {
    logger.error('furniture-categories route error', { err });
    logRouteError('routes/furnitureCategories.ts', err, _req);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── Admin routes ─────────────────────────────────── */

const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('admin'));
registerUuidValidation(adminRouter);

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(80),
  group: z.string().max(80).optional().nullable(),
  icon: z.string().max(10).optional().nullable(),
  sortOrder: z.number().int().min(0).optional().default(0),
  active: z.boolean().optional().default(true),
});

/* ─── GET /api/admin/furniture-categories (all, including inactive) */

adminRouter.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const categories = await prisma.furnitureCategory.findMany({
      orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json(categories);
  } catch (err) {
    logger.error('admin furniture-categories error', { err });
    logRouteError('routes/furnitureCategories.ts', err, _req);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── POST /api/admin/furniture-categories */

adminRouter.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const category = await prisma.furnitureCategory.create({
      data: {
        name: parsed.data.name,
        group: parsed.data.group ?? null,
        icon: parsed.data.icon ?? null,
        sortOrder: parsed.data.sortOrder ?? 0,
        active: parsed.data.active ?? true,
      },
    });
    res.status(201).json(category);
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'A category with this name already exists.' });
      return;
    }
    logger.error('admin furniture-categories error', { err });
    logRouteError('routes/furnitureCategories.ts', err, req);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── PUT /api/admin/furniture-categories/:id */

adminRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const existing = await prisma.furnitureCategory.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }

    const category = await prisma.furnitureCategory.update({
      where: { id: req.params.id },
      data: {
        name: parsed.data.name,
        group: parsed.data.group ?? null,
        icon: parsed.data.icon ?? null,
        sortOrder: parsed.data.sortOrder ?? 0,
        active: parsed.data.active ?? true,
      },
    });
    res.json(category);
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'A category with this name already exists.' });
      return;
    }
    logger.error('admin furniture-categories error', { err });
    logRouteError('routes/furnitureCategories.ts', err, req);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

/* ─── DELETE /api/admin/furniture-categories/:id */

adminRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.furnitureCategory.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }

    await prisma.furnitureCategory.delete({ where: { id: req.params.id } });
    res.json({ message: 'Category deleted.' });
  } catch (err) {
    logger.error('admin furniture-categories error', { err });
    logRouteError('routes/furnitureCategories.ts', err, req);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

export { router as furnitureCategoriesRouter, adminRouter as adminFurnitureCategoriesRouter };
