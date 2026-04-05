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
  // Default to 'lax' — provides CSRF protection while allowing same-site navigation.
  // For cross-origin API/frontend, set AUTH_COOKIE_SAME_SITE=none + HTTPS,
  // and ensure the frontend sends a custom header (X-Requested-With) to mitigate CSRF.
  return 'lax';
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
  get useAi(): 'claude' | 'gemini' | 'agent-router' {
    const v = (process.env.USE_AI || 'claude').toLowerCase().trim();
    if (v === 'gemini' || v === 'agent-router') return v;
    return 'claude';
  },
  get claudeApiKey() {
    return process.env.CLAUDE_API_KEY!;
  },
  get agentRouterApiKey() {
    return process.env.AGENT_ROUTER_API_KEY!;
  },
  get geminiApiKey() {
    return process.env.GEMINI_API_KEY!;
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
  github: {
    get issuesEnabled() {
      return process.env.GITHUB_ISSUES_ENABLED === 'true';
    },
    get owner() {
      return process.env.GITHUB_OWNER || '';
    },
    get repo() {
      return process.env.GITHUB_REPO || '';
    },
    get token() {
      return process.env.GITHUB_TOKEN || '';
    },
    get issueLabel() {
      return process.env.GITHUB_ISSUE_LABEL || 'auto-error';
    },
    get webhookSecret() {
      return process.env.GITHUB_WEBHOOK_SECRET || '';
    },
  },
  email: {
    get smtpHost() {
      return process.env.SMTP_HOST || 'smtp.zoho.com';
    },
    get smtpPort() {
      return Number(process.env.SMTP_PORT) || 465;
    },
    get smtpSecure() {
      return process.env.SMTP_SECURE !== 'false';
    },
    get smtpUser() {
      return process.env.SMTP_USER!;
    },
    get smtpPass() {
      return process.env.SMTP_PASS!;
    },
    get fromName() {
      return process.env.EMAIL_FROM_NAME || 'tradeLiv';
    },
    get fromAddress() {
      return process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER!;
    },
    get imapHost() {
      return process.env.IMAP_HOST || 'imap.zoho.com';
    },
    get imapPort() {
      return Number(process.env.IMAP_PORT) || 993;
    },
    get imapSecure() {
      return process.env.IMAP_SECURE !== 'false';
    },
    get imapUser() {
      return process.env.IMAP_USER!;
    },
    get imapPass() {
      return process.env.IMAP_PASS!;
    },
    get adminEmail() {
      return process.env.ADMIN_EMAIL || process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER!;
    },
  },
};
