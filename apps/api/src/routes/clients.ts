import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@furnlo/db';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import logger from '../config/logger';
import { registerUuidValidation } from '../middleware/validateParams';

const router = Router();
router.use(requireAuth, requireRole('designer'));
registerUuidValidation(router);

const addressSchema = z.object({
  line1: z.string().optional(),
  line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  country: z.string().optional(),
}).optional();

const clientSchema = z.object({
  name: z.string().min(1, 'Client name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  billingAddress: addressSchema,
  shippingAddress: addressSchema,
});

// GET /api/clients
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const clients = await prisma.client.findMany({
      where: { designerId: req.user!.id },
      include: { _count: { select: { projects: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(clients);
  } catch (err) {
    logger.error('clients route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

// POST /api/clients
router.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = clientSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { name, email, phone, billingAddress, shippingAddress } = parsed.data;

  try {
    const client = await prisma.client.create({
      data: {
        designerId: req.user!.id,
        name,
        email: email || null,
        phone: phone || null,
        billingAddress: billingAddress ?? undefined,
        shippingAddress: shippingAddress ?? undefined,
      },
    });
    res.status(201).json(client);
  } catch (err) {
    logger.error('clients route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

// GET /api/clients/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const client = await prisma.client.findFirst({
      where: { id: req.params.id, designerId: req.user!.id },
      include: {
        projects: {
          select: { id: true, name: true, status: true, portalToken: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { projects: true } },
      },
    });
    if (!client) {
      res.status(404).json({ error: 'Client not found.' });
      return;
    }
    res.json(client);
  } catch (err) {
    logger.error('clients route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

// PUT /api/clients/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const parsed = clientSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { name, email, phone, billingAddress, shippingAddress } = parsed.data;

  try {
    const existing = await prisma.client.findFirst({
      where: { id: req.params.id, designerId: req.user!.id },
    });
    if (!existing) {
      res.status(404).json({ error: 'Client not found.' });
      return;
    }

    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: {
        name,
        email: email || null,
        phone: phone || null,
        billingAddress: billingAddress ?? undefined,
        shippingAddress: shippingAddress ?? undefined,
      },
    });
    res.json(client);
  } catch (err) {
    logger.error('clients route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

// DELETE /api/clients/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const client = await prisma.client.findFirst({
      where: { id: req.params.id, designerId: req.user!.id },
      include: { _count: { select: { projects: true } } },
    });
    if (!client) {
      logger.warn('DELETE /api/clients/:id — not found', { clientId: req.params.id, designerId: req.user!.id });
      res.status(404).json({ error: 'Client not found.' });
      return;
    }
    if (client._count.projects > 0) {
      res.status(400).json({
        error: `Cannot delete this client — they have ${client._count.projects} project${client._count.projects > 1 ? 's' : ''}. Delete all projects first.`,
      });
      return;
    }
    await prisma.client.delete({ where: { id: req.params.id } });
    res.json({ message: 'Client deleted.' });
  } catch (err) {
    logger.error('clients route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

export default router;
