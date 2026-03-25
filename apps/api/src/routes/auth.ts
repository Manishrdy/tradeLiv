import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@furnlo/db';
import { config } from '../config';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { writeAuditLog } from '../services/auditLog';
import logger from '../config/logger';

const router = Router();

/* ─── Constants ────────────────────────────────────── */

const ACCESS_COOKIE = 'session';            // short-lived access token
const REFRESH_COOKIE = 'refresh';           // long-lived refresh token
const ACCESS_TOKEN_EXPIRY = '15m';          // 15 minutes
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/* ─── Helpers ──────────────────────────────────────── */

function accessCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 15 * 60 * 1000, // 15 min
    path: '/',
  };
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: REFRESH_TOKEN_EXPIRY_MS,
    path: '/api/auth', // only sent to auth endpoints
  };
}

function signAccessToken(payload: { id: string; role: string }) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Issue both access + refresh cookies. Returns the refresh token family for auditing. */
async function issueTokenPair(
  res: Response,
  designer: { id: string },
  role: string,
  req: Request,
  family?: string,
) {
  const accessToken = signAccessToken({ id: designer.id, role });
  const rawRefresh = generateRefreshToken();
  const tokenFamily = family ?? crypto.randomUUID();

  await prisma.refreshToken.create({
    data: {
      designerId: designer.id,
      tokenHash: hashToken(rawRefresh),
      family: tokenFamily,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: req.ip ?? null,
    },
  });

  res.cookie(ACCESS_COOKIE, accessToken, accessCookieOptions());
  res.cookie(REFRESH_COOKIE, rawRefresh, refreshCookieOptions());

  return tokenFamily;
}

/** Check and handle account lockout. Returns true if locked. */
async function isAccountLocked(designer: { id: string; failedLoginAttempts: number; lockedUntil: Date | null }, res: Response): Promise<boolean> {
  if (designer.lockedUntil && designer.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((designer.lockedUntil.getTime() - Date.now()) / 60000);
    res.status(423).json({
      error: `Account temporarily locked. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
      code: 'ACCOUNT_LOCKED',
    });
    return true;
  }

  // If lock expired, reset
  if (designer.lockedUntil && designer.lockedUntil <= new Date()) {
    await prisma.designer.update({
      where: { id: designer.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }
  return false;
}

/** Record a failed login attempt; lock if threshold exceeded. */
async function recordFailedLogin(designerId: string) {
  const updated = await prisma.designer.update({
    where: { id: designerId },
    data: { failedLoginAttempts: { increment: 1 } },
    select: { failedLoginAttempts: true },
  });

  if (updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    await prisma.designer.update({
      where: { id: designerId },
      data: { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) },
    });
  }
}

/** Reset failed attempts on successful login. */
async function resetFailedLogin(designerId: string) {
  await prisma.designer.update({
    where: { id: designerId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
}

/* ─── Validation schemas ───────────────────────────── */

const designerSignupSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
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

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

/* ─── Routes ───────────────────────────────────────── */

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

    await issueTokenPair(res, designer, 'designer', req);

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

    // Account lockout check
    if (await isAccountLocked(designer, res)) return;

    const valid = await bcrypt.compare(password, designer.passwordHash);
    if (!valid) {
      await recordFailedLogin(designer.id);
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Reset failed attempts on success
    await resetFailedLogin(designer.id);

    // Admin accounts go through admin flow
    if (designer.isAdmin) {
      await issueTokenPair(res, designer, 'admin', req);
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

    await issueTokenPair(res, designer, 'designer', req);
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

    if (await isAccountLocked(designer, res)) return;

    const valid = await bcrypt.compare(password, designer.passwordHash);
    if (!valid) {
      await recordFailedLogin(designer.id);
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    await resetFailedLogin(designer.id);

    if (!designer.isAdmin) {
      res.status(403).json({ error: 'Access denied. This account does not have admin privileges.' });
      return;
    }

    await issueTokenPair(res, designer, 'admin', req);
    res.json({
      role: 'admin',
      user: { id: designer.id, fullName: designer.fullName, email: designer.email, isSuperAdmin: designer.isSuperAdmin },
    });
  } catch (err) {
    logger.error('auth route error', { err, path: req.path, method: req.method });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

// POST /api/auth/refresh — rotate refresh token
router.post('/refresh', async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE];
  if (!rawToken) {
    res.status(401).json({ error: 'No refresh token provided.' });
    return;
  }

  try {
    const tokenHash = hashToken(rawToken);
    const storedToken = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!storedToken || storedToken.revokedAt) {
      // Possible token reuse attack — revoke the entire family
      if (storedToken?.family) {
        await prisma.refreshToken.updateMany({
          where: { family: storedToken.family, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        logger.warn('refresh token reuse detected — revoked family', { family: storedToken.family, designerId: storedToken.designerId });
      }

      res.clearCookie(ACCESS_COOKIE, { path: '/' });
      res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
      res.status(401).json({ error: 'Invalid refresh token. Please log in again.' });
      return;
    }

    if (storedToken.expiresAt < new Date()) {
      res.clearCookie(ACCESS_COOKIE, { path: '/' });
      res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
      res.status(401).json({ error: 'Refresh token expired. Please log in again.' });
      return;
    }

    // Revoke current token (rotation)
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Look up user to get current role
    const designer = await prisma.designer.findUnique({
      where: { id: storedToken.designerId },
      select: { id: true, isAdmin: true, status: true },
    });

    if (!designer) {
      res.status(401).json({ error: 'Account not found.' });
      return;
    }

    // Check if account is suspended/rejected
    if (!designer.isAdmin && (designer.status === 'suspended' || designer.status === 'rejected')) {
      await prisma.refreshToken.updateMany({
        where: { designerId: designer.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      res.clearCookie(ACCESS_COOKIE, { path: '/' });
      res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
      res.status(403).json({ error: 'Account access revoked.' });
      return;
    }

    const role = designer.isAdmin ? 'admin' : 'designer';

    // Issue new pair with same family
    await issueTokenPair(res, designer, role, req, storedToken.family);

    res.json({ message: 'Token refreshed.' });
  } catch (err) {
    logger.error('refresh token error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

// POST /api/auth/logout — revoke refresh token + clear cookies
router.post('/logout', async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE];

  if (rawToken) {
    try {
      const tokenHash = hashToken(rawToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch (err) {
      logger.error('logout revoke error', { err });
    }
  }

  res.clearCookie(ACCESS_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.json({ message: 'Logged out successfully.' });
});

// POST /api/auth/logout-all — revoke ALL refresh tokens for current user
router.post('/logout-all', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.refreshToken.updateMany({
      where: { designerId: req.user!.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    res.json({ message: 'All sessions revoked.' });
  } catch (err) {
    logger.error('logout-all error', { err });
    res.status(500).json({ error: 'An error occurred.' });
  }
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

// PUT /api/auth/change-password — authenticated users only (designer or admin)
router.put('/change-password', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;

  try {
    const designer = await prisma.designer.findUnique({
      where: { id: req.user!.id },
      select: { id: true, passwordHash: true },
    });

    if (!designer) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, designer.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }

    const isSamePassword = await bcrypt.compare(newPassword, designer.passwordHash);
    if (isSamePassword) {
      res.status(400).json({ error: 'New password must be different from your current password.' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.designer.update({
      where: { id: designer.id },
      data: { passwordHash: newHash },
    });

    // Revoke all refresh tokens to force re-login on other devices
    await prisma.refreshToken.updateMany({
      where: { designerId: designer.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Re-issue tokens for the current session
    await issueTokenPair(res, designer, req.user!.role, req);

    writeAuditLog({
      actorType: req.user!.role === 'admin' ? 'admin' : 'designer',
      actorId: designer.id,
      action: 'password_changed',
      entityType: 'designer',
      entityId: designer.id,
    });

    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    logger.error('change-password error', { err });
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

export default router;
