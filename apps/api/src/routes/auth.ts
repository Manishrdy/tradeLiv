import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '@furnlo/db';
import { config } from '../config';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { writeAuditLog } from '../services/auditLog';
import logger from '../config/logger';

const router = Router();

const SESSION_COOKIE = 'session';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  };
}

function signToken(payload: { id: string; role: string }) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn as string });
}

const designerSignupSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  businessName: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const profileUpdateSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').optional(),
  businessName: z.string().max(100).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
});

// POST /api/auth/signup/designer
router.post('/signup/designer', async (req: Request, res: Response) => {
  const parsed = designerSignupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { fullName, email, password, businessName, phone } = parsed.data;

  try {
    const existing = await prisma.designer.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const designer = await prisma.designer.create({
      data: { fullName, email, passwordHash, businessName, phone, status: 'approved' },
    });

    writeAuditLog({
      actorType: 'system',
      actorId: designer.id,
      action: 'designer_signup',
      entityType: 'designer',
      entityId: designer.id,
    });

    const token = signToken({ id: designer.id, role: 'designer' });
    res.cookie(SESSION_COOKIE, token, cookieOptions());
    res.status(201).json({
      role: 'designer',
      user: { id: designer.id, fullName: designer.fullName, email: designer.email, status: designer.status },
    });
  } catch (err) {
    logger.error('auth route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const designer = await prisma.designer.findUnique({ where: { email } });
    if (!designer) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const valid = await bcrypt.compare(password, designer.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Admin accounts go through admin flow
    if (designer.isAdmin) {
      const token = signToken({ id: designer.id, role: 'admin' });
      res.cookie(SESSION_COOKIE, token, cookieOptions());
      res.json({
        role: 'admin',
        user: { id: designer.id, fullName: designer.fullName, email: designer.email, isSuperAdmin: designer.isSuperAdmin },
      });
      return;
    }

    // Designer status checks
    if (designer.status === 'rejected') {
      res.status(403).json({
        error: 'Your application was not approved. Please contact support.',
        code: 'REJECTED',
      });
      return;
    }

    if (designer.status === 'suspended') {
      res.status(403).json({
        error: 'Your account has been suspended. Please contact support.',
        code: 'SUSPENDED',
      });
      return;
    }

    const token = signToken({ id: designer.id, role: 'designer' });
    res.cookie(SESSION_COOKIE, token, cookieOptions());
    res.json({
      role: 'designer',
      user: { id: designer.id, fullName: designer.fullName, email: designer.email, status: designer.status },
    });
  } catch (err) {
    logger.error('auth route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

// POST /api/auth/admin/login
router.post('/admin/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const designer = await prisma.designer.findUnique({ where: { email } });
    if (!designer) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const valid = await bcrypt.compare(password, designer.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (!designer.isAdmin) {
      res.status(403).json({ error: 'Access denied. This account does not have admin privileges.' });
      return;
    }

    const token = signToken({ id: designer.id, role: 'admin' });
    res.cookie(SESSION_COOKIE, token, cookieOptions());
    res.json({
      role: 'admin',
      user: { id: designer.id, fullName: designer.fullName, email: designer.email, isSuperAdmin: designer.isSuperAdmin },
    });
  } catch (err) {
    logger.error('auth route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ message: 'Logged out successfully.' });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const designer = await prisma.designer.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true, fullName: true, email: true,
        businessName: true, phone: true, status: true,
        isAdmin: true, isSuperAdmin: true, createdAt: true,
      },
    });
    if (!designer) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    res.json(designer);
  } catch (err) {
    logger.error('auth route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

// PUT /api/auth/me
router.put('/me', requireAuth, requireRole('designer'), async (req: AuthRequest, res: Response) => {
  const parsed = profileUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const designer = await prisma.designer.update({
      where: { id: req.user!.id },
      data: parsed.data,
      select: {
        id: true, fullName: true, email: true,
        businessName: true, phone: true, status: true,
        isAdmin: true, createdAt: true,
      },
    });
    res.json(designer);
  } catch (err) {
    logger.error('auth route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

export default router;
