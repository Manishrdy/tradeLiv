import type { CookieOptions } from 'express';

const JWT_ALGORITHM = 'HS256' as const;

/** Fail fast so the API never starts with a weak or missing signing secret. */
export function assertAuthEnv(): void {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET must be set and at least 32 characters. Generate a strong random string for production.',
    );
  }
}

function parseSameSite(v: string | undefined): 'strict' | 'lax' | 'none' {
  const s = (v || '').toLowerCase();
  if (s === 'lax' || s === 'strict' || s === 'none') return s;
  // Local dev: lax works across localhost ports. Production split origins: set AUTH_COOKIE_SAME_SITE=none + HTTPS.
  return process.env.NODE_ENV === 'production' ? 'none' : 'lax';
}

function parseDurationToMs(s: string): number {
  const m = /^(\d+)(s|m|h|d)$/i.exec(s.trim());
  if (!m) return 15 * 60 * 1000;
  const n = parseInt(m[1], 10);
  switch (m[2].toLowerCase()) {
    case 's':
      return n * 1000;
    case 'm':
      return n * 60 * 1000;
    case 'h':
      return n * 60 * 60 * 1000;
    case 'd':
      return n * 24 * 60 * 60 * 1000;
    default:
      return 15 * 60 * 1000;
  }
}

function cookieDomain(): string | undefined {
  const d = process.env.AUTH_COOKIE_DOMAIN?.trim();
  return d || undefined;
}

function cookieSecure(sameSite: 'strict' | 'lax' | 'none'): boolean {
  if (sameSite === 'none') return true;
  if (process.env.AUTH_COOKIE_SECURE === 'true') return true;
  if (process.env.AUTH_COOKIE_SECURE === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

export function buildCookieOptions(maxAgeMs: number, path: string): CookieOptions {
  const sameSite = parseSameSite(process.env.AUTH_COOKIE_SAME_SITE);
  const secure = cookieSecure(sameSite);
  const domain = cookieDomain();
  return {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: maxAgeMs,
    path,
    ...(domain ? { domain } : {}),
  };
}

/** Options for clearing cookies (must match path/domain used when setting). */
export function clearCookieOptions(path: string): Pick<CookieOptions, 'path' | 'domain'> {
  const domain = cookieDomain();
  return {
    path,
    ...(domain ? { domain } : {}),
  };
}

export const config = {
  get port() {
    return Number(process.env.API_PORT) || 4000;
  },
  get jwtSecret() {
    return process.env.JWT_SECRET!;
  },
  get jwtAlgorithm() {
    return JWT_ALGORITHM;
  },
  /** Access (session) JWT lifetime, e.g. 15m, 1h */
  get accessTokenExpiresIn() {
    return process.env.JWT_ACCESS_EXPIRES_IN || '15m';
  },
  get accessTokenMaxAgeMs() {
    return parseDurationToMs(process.env.JWT_ACCESS_EXPIRES_IN || '15m');
  },
  get frontendUrl() {
    return process.env.FRONTEND_URL || 'http://localhost:3000';
  },
  get claudeApiKey() {
    return process.env.CLAUDE_API_KEY!;
  },
  get stripeSecretKey() {
    return process.env.STRIPE_SECRET_KEY!;
  },
  get stripeWebhookSecret() {
    return process.env.STRIPE_WEBHOOK_SECRET!;
  },
  get browserWsEndpoint() {
    return process.env.BROWSER_WS_ENDPOINT || '';
  },
  get messageTtlDays() {
    return Number(process.env.MESSAGE_TTL_DAYS) || 30;
  },
};
