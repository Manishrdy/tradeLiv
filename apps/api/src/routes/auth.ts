import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import dns from 'dns';
import { z } from 'zod';
import { prisma } from '@furnlo/db';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const disposableDomains: string[] = require('disposable-email-domains');
import { config, buildCookieOptions, clearCookieOptions } from '../config';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { writeAuditLog } from '../services/auditLog';
import { createAdminNotification } from '../services/adminNotificationService';
import { sendEmail } from '../services/emailService';
import {
  renderDesignerSignupEmail,
  renderAdminNewApplicationEmail,
  renderPasswordChangedEmail,
  renderPasswordChangeOtpEmail,
  renderEmailVerificationEmail,
} from '@furnlo/emails';
import logger from '../config/logger';
import { logRouteError, logError } from '../services/errorLogger';

const router = Router();

/* ─── In-memory OTP store for password change ──────────
   Keyed by designerId. Entries expire after 10 minutes.
   pendingPasswordHash is the bcrypt hash of the new password,
   computed at request time so the confirm step just applies it.
──────────────────────────────────────────────────────── */
interface PasswordOtpEntry {
  otpHash: string;
  pendingPasswordHash: string;
  expiresAt: Date;
  attempts: number;
}
const passwordOtpStore = new Map<string, PasswordOtpEntry>();

function cleanExpiredOtps() {
  const now = new Date();
  for (const [key, entry] of passwordOtpStore) {
    if (entry.expiresAt < now) passwordOtpStore.delete(key);
  }
}

/* ─── Email domain validation ──────────────────────── */

const DISPOSABLE_DOMAINS = new Set(disposableDomains.map((d) => d.toLowerCase()));

async function isEmailDomainAllowed(email: string): Promise<{ allowed: boolean; reason?: string }> {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return { allowed: false, reason: 'Invalid email address.' };

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { allowed: false, reason: 'Please use your work email address. Temporary email addresses are not accepted.' };
  }

  // MX record check catches new or unlisted temporary domains
  try {
    const records = await dns.promises.resolveMx(domain);
    if (!records || records.length === 0) {
      return { allowed: false, reason: 'This email domain does not appear to accept mail. Please use a valid work email.' };
    }
  } catch {
    return { allowed: false, reason: 'This email domain could not be verified. Please use a valid work email.' };
  }

  return { allowed: true };
}

/* ─── Constants ────────────────────────────────────── */

const ACCESS_COOKIE = 'session'; // short-lived access token
const REFRESH_COOKIE = 'refresh'; // long-lived refresh token

/** Without "remember me", refresh cookie TTL is shorter (browser-session style). */
const REFRESH_TTL_SHORT_MS = 2 * 24 * 60 * 60 * 1000; // 2 days
/** With "remember me", refresh cookie TTL is longer. */
const REFRESH_TTL_LONG_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/* ─── Helpers ──────────────────────────────────────── */

function accessCookieOptions() {
  return buildCookieOptions(config.accessTokenMaxAgeMs, '/');
}

function refreshCookieOptions(maxAgeMs: number) {
  return buildCookieOptions(maxAgeMs, '/api/auth');
}

function clearSessionCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, clearCookieOptions('/'));
  res.clearCookie(REFRESH_COOKIE, clearCookieOptions('/api/auth'));
}

function signAccessToken(payload: { id: string; role: string }) {
  const signOpts: SignOptions = {
    expiresIn: config.accessTokenExpiresIn as SignOptions['expiresIn'],
    algorithm: config.jwtAlgorithm,
  };
  return jwt.sign(payload, config.jwtSecret, signOpts);
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
  options: { family?: string; refreshTtlMs: number },
) {
  const accessToken = signAccessToken({ id: designer.id, role });
  const rawRefresh = generateRefreshToken();
  const tokenFamily = options.family ?? crypto.randomUUID();
  const refreshTtlMs = options.refreshTtlMs;

  await prisma.refreshToken.create({
    data: {
      designerId: designer.id,
      tokenHash: hashToken(rawRefresh),
      family: tokenFamily,
      expiresAt: new Date(Date.now() + refreshTtlMs),
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: req.ip ?? null,
    },
  });

  res.cookie(ACCESS_COOKIE, accessToken, accessCookieOptions());
  res.cookie(REFRESH_COOKIE, rawRefresh, refreshCookieOptions(refreshTtlMs));

  return tokenFamily;
}

/**
 * Preserve refresh lifetime on rotation: same TTL class as the token being rotated.
 * Unknown / invalid rows fall back to short TTL.
 */
function refreshTtlMsFromStoredToken(stored: { createdAt: Date; expiresAt: Date }): number {
  const issuedTtl = stored.expiresAt.getTime() - stored.createdAt.getTime();
  if (!Number.isFinite(issuedTtl) || issuedTtl <= 0) return REFRESH_TTL_SHORT_MS;
  return Math.min(Math.max(issuedTtl, 60 * 60 * 1000), REFRESH_TTL_LONG_MS);
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

/** Reset failed attempts on successful login and record last login time. */
async function resetFailedLogin(designerId: string) {
  await prisma.designer.update({
    where: { id: designerId },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
}

/* ─── Validation schemas ───────────────────────────── */

const designerSignupSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .refine((v) => v.trim().split(/\s+/).length >= 2, 'Please enter your first and last name'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  businessName: z.string().min(1, 'Business name is required').max(100),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .regex(
      /^(\+1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/,
      'Enter a valid US phone number, e.g. (555) 555-5555',
    ),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().min(1, 'State is required').max(100),
  yearsOfExperience: z.enum(['<2', '2-5', '5-10', '10+'], { required_error: 'Years of experience is required' }),
  websiteUrl: z.string().url('Invalid URL').max(500).optional().or(z.literal('')),
  linkedinUrl: z.string().url('Invalid URL').max(500).optional().or(z.literal('')),
  instagramUrl: z.string().max(100).optional().or(z.literal('')),
  referralSource: z.string().max(100).optional().or(z.literal('')),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().optional(),
});

const profileUpdateSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').optional(),
  businessName: z.string().max(100).nullable().optional(),
  phone: z
    .string()
    .regex(
      /^(\+1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/,
      'Enter a valid US phone number, e.g. (555) 555-5555',
    )
    .nullable()
    .optional(),
});

const newPasswordRules = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

const requestPasswordChangeOtpSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: newPasswordRules,
});

const confirmPasswordChangeSchema = z.object({
  otp: z.string().length(6, 'Verification code must be 6 digits').regex(/^\d{6}$/, 'Invalid code'),
});

/* ─── Routes ───────────────────────────────────────── */

// POST /api/auth/signup/designer
router.post('/signup/designer', async (req: Request, res: Response) => {
  const parsed = designerSignupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const {
    fullName, email, password, businessName, phone,
    city, state, yearsOfExperience, websiteUrl, linkedinUrl, instagramUrl, referralSource,
  } = parsed.data;

  try {
    const domainCheck = await isEmailDomainAllowed(email);
    if (!domainCheck.allowed) {
      res.status(400).json({ error: domainCheck.reason });
      return;
    }

    const existing = await prisma.designer.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Generate email verification token (raw stored client-side in the link, hashed in DB)
    const rawVerifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenHash = hashToken(rawVerifyToken);
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const designer = await prisma.designer.create({
      data: {
        fullName, email, passwordHash, businessName, phone,
        city, state, yearsOfExperience,
        websiteUrl: websiteUrl || null,
        linkedinUrl: linkedinUrl || null,
        instagramUrl: instagramUrl || null,
        referralSource: referralSource || null,
        status: 'email_pending',
        emailVerificationToken: verifyTokenHash,
        emailVerificationExpiry: verifyExpiry,
      },
    });

    writeAuditLog({
      actorType: 'system',
      actorId: designer.id,
      action: 'designer_signup',
      entityType: 'designer',
      entityId: designer.id,
    });

    // Send verification email — admin is notified only after email is verified
    const verificationUrl = `${config.frontendUrl}/verify-email?token=${rawVerifyToken}`;
    renderEmailVerificationEmail({ fullName: designer.fullName, verificationUrl })
      .then((mail) => sendEmail({ to: designer.email, ...mail }))
      .catch((err) => {
        logger.error('[email] verification email failed', { err });
        logError({ fileName: 'routes/auth.ts', routePath: '/signup/designer', httpMethod: 'POST', errorMessage: err instanceof Error ? err.message : String(err), errorStack: err instanceof Error ? err.stack : undefined, severity: 'warn' });
      });

    // No tokens issued — designer must verify email then wait for admin approval
    res.status(201).json({
      role: 'designer',
      user: { id: designer.id, fullName: designer.fullName, email: designer.email, status: designer.status },
    });
  } catch (err) {
    logger.error('auth route error', { err, path: req.path, method: req.method });
    logRouteError('routes/auth.ts', err, req);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

// GET /api/auth/check-email-domain?email=<address>
router.get('/check-email-domain', async (req: Request, res: Response) => {
  const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ allowed: false, reason: 'Invalid email address.' });
    return;
  }
  try {
    const result = await isEmailDomainAllowed(email);
    res.json(result);
  } catch {
    // Fail open — server-side signup validation is the hard gate
    res.json({ allowed: true });
  }
});

// GET /api/auth/verify-email?token=<raw>
router.get('/verify-email', async (req: Request, res: Response) => {
  const rawToken = typeof req.query.token === 'string' ? req.query.token : null;
  if (!rawToken) {
    res.status(400).json({ error: 'Missing verification token.' });
    return;
  }

  try {
    const tokenHash = hashToken(rawToken);
    const designer = await prisma.designer.findFirst({
      where: { emailVerificationToken: tokenHash },
    });

    if (!designer) {
      res.status(400).json({ error: 'This verification link is invalid or has already been used.' });
      return;
    }

    if (designer.emailVerificationExpiry && designer.emailVerificationExpiry < new Date()) {
      res.status(400).json({ error: 'This verification link has expired. Please request a new one.', code: 'TOKEN_EXPIRED' });
      return;
    }

    if (designer.status !== 'email_pending') {
      // Already verified — idempotent success
      res.json({ verified: true });
      return;
    }

    await prisma.designer.update({
      where: { id: designer.id },
      data: {
        status: 'pending_review',
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
    });

    writeAuditLog({
      actorType: 'system',
      actorId: designer.id,
      action: 'email_verified',
      entityType: 'designer',
      entityId: designer.id,
    });

    // Now that email is verified, notify admin of the new application
    createAdminNotification({
      type: 'new_application',
      title: `New application from ${designer.fullName}`,
      body: designer.businessName ? `${designer.businessName} — ${designer.city ?? ''}, ${designer.state ?? ''}` : `${designer.city ?? ''}, ${designer.state ?? ''}`,
      designerId: designer.id,
    }).catch((err) => logger.error('Failed to create admin notification', { err }));

    renderDesignerSignupEmail({ fullName: designer.fullName })
      .then((mail) => sendEmail({ to: designer.email, ...mail }))
      .catch((err) => logger.error('[email] designer signup email failed', { err }));

    renderAdminNewApplicationEmail({
      fullName: designer.fullName,
      email: designer.email,
      businessName: designer.businessName,
      city: designer.city ?? '',
      state: designer.state ?? '',
      adminUrl: `${config.frontendUrl}/admin/designers`,
    })
      .then((mail) => sendEmail({ to: config.email.adminEmail, ...mail }))
      .catch((err) => logger.error('[email] admin new application email failed', { err }));

    res.json({ verified: true });
  } catch (err) {
    logger.error('verify-email error', { err });
    logRouteError('routes/auth.ts', err, req);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});


// POST /api/auth/login
// Failed attempts are tracked per account (not per unknown email) to limit user enumeration.
router.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { email, password, remember } = parsed.data;

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

    if (designer.isAdmin) {
      res.status(403).json({
        error: 'Admin accounts must sign in through the admin portal.',
        code: 'USE_ADMIN_LOGIN',
      });
      return;
    }

    // Designer status checks
    if (designer.status === 'email_pending') {
      res.status(403).json({
        error: 'Please verify your email address first. Check your inbox for a verification link.',
        code: 'EMAIL_NOT_VERIFIED',
      });
      return;
    }

    if (designer.status === 'pending_review') {
      res.status(403).json({
        error: 'Your application is still under review. You\'ll receive an email once approved.',
        code: 'PENDING_REVIEW',
      });
      return;
    }

    if (designer.status === 'rejected') {
      res.status(403).json({
        error: designer.rejectionReason
          ? `Your application was not approved: ${designer.rejectionReason}`
          : 'Your application was not approved. Please contact support for details.',
        code: 'REJECTED',
        rejectionReason: designer.rejectionReason ?? null,
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

    const refreshTtlMs = remember ? REFRESH_TTL_LONG_MS : REFRESH_TTL_SHORT_MS;
    await issueTokenPair(res, designer, 'designer', req, { refreshTtlMs });
    res.json({
      role: 'designer',
      user: { id: designer.id, fullName: designer.fullName, email: designer.email, status: designer.status },
    });
  } catch (err) {
    logger.error('auth route error', { err, path: req.path, method: req.method });
    logRouteError('routes/auth.ts', err, req);
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

  const { email, password, remember } = parsed.data;

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

    const refreshTtlMs = remember ? REFRESH_TTL_LONG_MS : REFRESH_TTL_SHORT_MS;
    await issueTokenPair(res, designer, 'admin', req, { refreshTtlMs });
    res.json({
      role: 'admin',
      user: { id: designer.id, fullName: designer.fullName, email: designer.email, isSuperAdmin: designer.isSuperAdmin },
    });
  } catch (err) {
    logger.error('auth route error', { err, path: req.path, method: req.method });
    logRouteError('routes/auth.ts', err, req);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

// POST /api/auth/refresh — rotate refresh token (single-use; concurrent refresh loses race safely)
router.post('/refresh', async (req: Request, res: Response) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE];
  if (!rawToken) {
    res.status(401).json({ error: 'No refresh token provided.' });
    return;
  }

  try {
    const tokenHash = hashToken(rawToken);
    const storedToken = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!storedToken) {
      clearSessionCookies(res);
      res.status(401).json({ error: 'Invalid refresh token. Please log in again.' });
      return;
    }

    if (storedToken.revokedAt) {
      // Benign concurrent-refresh race: if the token was revoked within the last
      // 30s, another request from the same session (e.g. a second tab) just rotated
      // it. Don't nuke the family or clear cookies — the browser already holds the
      // winning request's fresh tokens. Tell the caller to retry with those.
      const REUSE_GRACE_MS = 30_000;
      const revokedAgeMs = Date.now() - storedToken.revokedAt.getTime();
      if (revokedAgeMs < REUSE_GRACE_MS) {
        res.status(401).json({
          error: 'Session was just refreshed by another tab. Retrying.',
          code: 'REFRESH_CONFLICT',
        });
        return;
      }
      await prisma.refreshToken.updateMany({
        where: { family: storedToken.family, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      logger.warn('refresh token reuse detected — revoked family', {
        family: storedToken.family,
        designerId: storedToken.designerId,
      });
      clearSessionCookies(res);
      res.status(401).json({ error: 'Invalid refresh token. Please log in again.' });
      return;
    }

    if (storedToken.expiresAt < new Date()) {
      clearSessionCookies(res);
      res.status(401).json({ error: 'Refresh token expired. Please log in again.' });
      return;
    }

    const newRawRefresh = generateRefreshToken();
    const newHash = hashToken(newRawRefresh);
    const refreshTtlMs = refreshTtlMsFromStoredToken(storedToken);
    const newExpiresAt = new Date(Date.now() + refreshTtlMs);

    const outcome = await prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshToken.updateMany({
        where: { id: storedToken.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (revoked.count !== 1) {
        return { kind: 'concurrent' as const };
      }

      const designer = await tx.designer.findUnique({
        where: { id: storedToken.designerId },
        select: { id: true, isAdmin: true, status: true },
      });

      if (!designer) {
        return { kind: 'no_user' as const };
      }

      if (!designer.isAdmin && (designer.status === 'suspended' || designer.status === 'rejected' || designer.status === 'email_pending')) {
        await tx.refreshToken.updateMany({
          where: { designerId: designer.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return { kind: 'revoked_account' as const };
      }

      const role = designer.isAdmin ? 'admin' : 'designer';

      await tx.refreshToken.create({
        data: {
          designerId: designer.id,
          tokenHash: newHash,
          family: storedToken.family,
          expiresAt: newExpiresAt,
          userAgent: req.headers['user-agent'] ?? null,
          ipAddress: req.ip ?? null,
        },
      });

      return { kind: 'ok' as const, designer, role };
    });

    if (outcome.kind === 'concurrent') {
      // Another concurrent request (typically a second tab) won the rotation.
      // Browser already has the winner's fresh cookies — don't clear them.
      res.status(401).json({
        error: 'Session was just refreshed by another tab. Retrying.',
        code: 'REFRESH_CONFLICT',
      });
      return;
    }

    if (outcome.kind === 'no_user') {
      clearSessionCookies(res);
      res.status(401).json({ error: 'Account not found.' });
      return;
    }

    if (outcome.kind === 'revoked_account') {
      clearSessionCookies(res);
      res.status(403).json({ error: 'Account access revoked.' });
      return;
    }

    const accessToken = signAccessToken({ id: outcome.designer.id, role: outcome.role });
    res.cookie(ACCESS_COOKIE, accessToken, accessCookieOptions());
    res.cookie(REFRESH_COOKIE, newRawRefresh, refreshCookieOptions(refreshTtlMs));

    res.json({ message: 'Token refreshed.' });
  } catch (err) {
    logger.error('refresh token error', { err });
    logRouteError('routes/auth.ts', err, req);
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
      logRouteError('routes/auth.ts', err, req);
    }
  }

  clearSessionCookies(res);
  res.json({ message: 'Logged out successfully.' });
});

// POST /api/auth/logout-all — revoke ALL refresh tokens for current user
router.post('/logout-all', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.refreshToken.updateMany({
      where: { designerId: req.user!.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    clearSessionCookies(res);
    res.json({ message: 'All sessions revoked.' });
  } catch (err) {
    logger.error('logout-all error', { err });
    logRouteError('routes/auth.ts', err, req);
    res.status(500).json({ error: 'An error occurred.' });
  }
});

// POST /api/auth/impersonate-session
// Validates an admin-issued impersonation JWT and sets a short-lived session cookie
router.post('/impersonate-session', async (req: Request, res: Response) => {
  const { token } = req.body ?? {};
  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'Token is required.' });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret, {
      algorithms: [config.jwtAlgorithm],
    }) as { id: string; role: string; impersonatedBy?: string };

    if (!payload.impersonatedBy) {
      res.status(400).json({ error: 'Not a valid impersonation token.' });
      return;
    }

    const designer = await prisma.designer.findUnique({
      where: { id: payload.id },
      select: { id: true, fullName: true, email: true, status: true, isAdmin: true },
    });

    if (!designer || designer.status !== 'approved') {
      res.status(403).json({ error: 'Designer is not accessible.' });
      return;
    }

    // Issue a short-lived access cookie (no refresh token — session ends when tab is closed)
    const accessToken = signAccessToken({ id: designer.id, role: 'designer' });
    // Do NOT set a cookie — impersonation sessions must be tab-isolated.
    // The token is returned in the body and stored in sessionStorage by the client,
    // then passed as Authorization: Bearer on every request from that tab.

    logger.info('admin impersonation session started', { adminId: payload.impersonatedBy, designerId: designer.id });

    res.json({
      accessToken,
      user: { id: designer.id, fullName: designer.fullName, email: designer.email, status: designer.status },
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired impersonation token.' });
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
    logRouteError('routes/auth.ts', err, req);
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
    logRouteError('routes/auth.ts', err, req);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

// POST /api/auth/password-change-otp — step 1: validate credentials, send OTP
router.post('/password-change-otp', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = requestPasswordChangeOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;

  try {
    cleanExpiredOtps();

    const designer = await prisma.designer.findUnique({
      where: { id: req.user!.id },
      select: { id: true, passwordHash: true, fullName: true, email: true },
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

    // Generate 6-digit OTP and pre-hash the new password
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const [otpHash, pendingPasswordHash] = await Promise.all([
      bcrypt.hash(otp, 10),
      bcrypt.hash(newPassword, 12),
    ]);

    passwordOtpStore.set(designer.id, {
      otpHash,
      pendingPasswordHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      attempts: 0,
    });

    renderPasswordChangeOtpEmail({ fullName: designer.fullName, otp })
      .then((email) => sendEmail({ to: designer.email, ...email }))
      .catch((err) => {
        logger.error('[email] password change OTP email failed', { err });
        logError({ fileName: 'routes/auth.ts', routePath: '/password-change-otp', httpMethod: 'POST', errorMessage: err instanceof Error ? err.message : String(err), errorStack: err instanceof Error ? err.stack : undefined, severity: 'warn' });
      });

    res.json({ message: 'Verification code sent to your email.' });
  } catch (err) {
    logger.error('password-change-otp error', { err });
    logRouteError('routes/auth.ts', err, req);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

// PUT /api/auth/change-password — step 2: verify OTP and apply new password
router.put('/change-password', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = confirmPasswordChangeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { otp } = parsed.data;

  try {
    cleanExpiredOtps();

    const entry = passwordOtpStore.get(req.user!.id);
    if (!entry) {
      res.status(400).json({ error: 'No pending password change. Please start over.' });
      return;
    }

    if (entry.expiresAt < new Date()) {
      passwordOtpStore.delete(req.user!.id);
      res.status(400).json({ error: 'Verification code has expired. Please start over.' });
      return;
    }

    entry.attempts += 1;
    if (entry.attempts > 5) {
      passwordOtpStore.delete(req.user!.id);
      res.status(429).json({ error: 'Too many incorrect attempts. Please start over.' });
      return;
    }

    const otpValid = await bcrypt.compare(otp, entry.otpHash);
    if (!otpValid) {
      const remaining = 5 - entry.attempts;
      res.status(401).json({ error: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` });
      return;
    }

    // OTP verified — apply the pre-computed password hash
    passwordOtpStore.delete(req.user!.id);

    const designer = await prisma.designer.findUnique({
      where: { id: req.user!.id },
      select: { id: true, fullName: true, email: true },
    });

    if (!designer) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    await prisma.designer.update({
      where: { id: designer.id },
      data: { passwordHash: entry.pendingPasswordHash },
    });

    // Revoke all refresh tokens to force re-login on other devices
    await prisma.refreshToken.updateMany({
      where: { designerId: designer.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Re-issue tokens for the current session
    await issueTokenPair(res, designer, req.user!.role, req, { refreshTtlMs: REFRESH_TTL_LONG_MS });

    writeAuditLog({
      actorType: req.user!.role === 'admin' ? 'admin' : 'designer',
      actorId: designer.id,
      action: 'password_changed',
      entityType: 'designer',
      entityId: designer.id,
    });

    renderPasswordChangedEmail({ fullName: designer.fullName })
      .then((email) => sendEmail({ to: designer.email, ...email }))
      .catch((err) => {
        logger.error('[email] password changed email failed', { err });
        logError({ fileName: 'routes/auth.ts', routePath: '/change-password', httpMethod: 'PUT', errorMessage: err instanceof Error ? err.message : String(err), errorStack: err instanceof Error ? err.stack : undefined, severity: 'warn' });
      });

    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    logger.error('change-password error', { err });
    logRouteError('routes/auth.ts', err, req);
    res.status(500).json({ error: 'An error occurred. Please try again.' });
  }
});

export default router;
