import logger from '../config/logger';

/**
 * Hybrid Claude API rate limiter: token budget tracking + exponential backoff.
 *
 * Org limit: 30,000 input tokens per minute on claude-sonnet-4-6.
 * Strategy:
 *   1. Estimate input tokens before each call (~4 chars = 1 token)
 *   2. Track usage in a rolling 60s window
 *   3. If budget insufficient, wait until enough tokens free up
 *   4. If Claude still returns 429, retry with exponential backoff
 */

const TOKEN_LIMIT = 30_000;        // org limit per minute
const WINDOW_MS = 60_000;          // 1 minute rolling window
const SAFETY_MARGIN = 0.85;        // only use 85% of budget to avoid edge cases
const EFFECTIVE_LIMIT = Math.floor(TOKEN_LIMIT * SAFETY_MARGIN); // 25,500

/* ─── Rolling window of token usage ──────────────────── */

interface UsageEntry {
  tokens: number;
  timestamp: number;
}

const usageLog: UsageEntry[] = [];

function pruneOldEntries() {
  const cutoff = Date.now() - WINDOW_MS;
  while (usageLog.length > 0 && usageLog[0].timestamp < cutoff) {
    usageLog.shift();
  }
}

function currentUsage(): number {
  pruneOldEntries();
  return usageLog.reduce((sum, e) => sum + e.tokens, 0);
}

function recordUsage(tokens: number) {
  usageLog.push({ tokens, timestamp: Date.now() });
}

/** When will enough tokens free up for a call of `needed` tokens? */
function msUntilBudgetAvailable(needed: number): number {
  pruneOldEntries();
  const used = currentUsage();
  const available = EFFECTIVE_LIMIT - used;

  if (available >= needed) return 0;

  // Find oldest entries that need to expire to free up enough budget
  let freed = 0;
  for (const entry of usageLog) {
    freed += entry.tokens;
    if (available + freed >= needed) {
      // This entry expires at entry.timestamp + WINDOW_MS
      return Math.max(0, (entry.timestamp + WINDOW_MS) - Date.now() + 500); // +500ms buffer
    }
  }

  // Not enough even if all entries expire — wait full window
  return WINDOW_MS;
}

/* ─── Token estimation ───────────────────────────────── */

/** Rough estimate: ~4 chars per token for English text + JSON */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/* ─── Queue with backoff ─────────────────────────────── */

interface QueueItem {
  execute: () => Promise<any>;
  estimatedTokens: number;
  resolve: (v: any) => void;
  reject: (e: any) => void;
  label: string;
}

const queue: QueueItem[] = [];
let processing = false;

// Track the reset time from the last 429 for the status endpoint
let rateLimitResetAt = 0;

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;

  while (queue.length > 0) {
    const item = queue[0];

    // Wait for budget
    const waitMs = msUntilBudgetAvailable(item.estimatedTokens);
    if (waitMs > 0) {
      logger.info('Claude rate limiter: waiting for token budget', {
        label: item.label,
        waitMs,
        estimatedTokens: item.estimatedTokens,
        currentUsage: currentUsage(),
        queueLength: queue.length,
      });
      await new Promise((r) => setTimeout(r, waitMs));
    }

    queue.shift();

    // Record estimated usage upfront (will be consumed from window)
    recordUsage(item.estimatedTokens);

    // Execute with exponential backoff on 429
    const MAX_RETRIES = 3;
    let lastErr: any = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        logger.info('Claude rate limiter: executing', {
          label: item.label,
          attempt,
          estimatedTokens: item.estimatedTokens,
        });
        const result = await item.execute();
        item.resolve(result);
        lastErr = null;
        break;
      } catch (err: any) {
        lastErr = err;
        const is429 = err?.status === 429 || err?.message?.includes('429') || err?.error?.type === 'rate_limit_error';
        if (!is429 || attempt === MAX_RETRIES) {
          // Not a rate limit error, or exhausted retries
          break;
        }

        // Parse retry-after from error if available, else exponential backoff
        let backoffMs: number;
        const retryAfterMatch = err?.message?.match(/try again later/i);
        if (retryAfterMatch) {
          // Default backoff: 15s, 30s, 60s
          backoffMs = Math.min(15_000 * Math.pow(2, attempt), 60_000);
        } else {
          backoffMs = Math.min(15_000 * Math.pow(2, attempt), 60_000);
        }

        rateLimitResetAt = Date.now() + backoffMs;

        logger.warn('Claude rate limiter: 429, backing off', {
          label: item.label,
          attempt,
          backoffMs,
        });

        // Also record extra usage to prevent other calls from firing
        recordUsage(item.estimatedTokens);

        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }

    if (lastErr) {
      item.reject(lastErr);
    }
  }

  processing = false;
}

/**
 * Enqueue a Claude API call with token estimation.
 * The call will wait for budget availability and retry on 429 with backoff.
 */
export function enqueueClaudeCall<T>(
  label: string,
  execute: () => Promise<T>,
  inputText?: string,
): Promise<T> {
  // Estimate tokens from input text, or use a conservative default
  const estimatedTokens = inputText ? estimateTokens(inputText) : 5_000;

  return new Promise<T>((resolve, reject) => {
    queue.push({ execute, resolve, reject, label, estimatedTokens });
    processQueue();
  });
}

/**
 * Get rate limit status for the frontend.
 * Returns seconds until the limiter is ready for a new call.
 */
export function getRateLimitStatus(): { available: boolean; retryAfter: number } {
  // Check 429-based reset first
  const now = Date.now();
  if (rateLimitResetAt > now) {
    return { available: false, retryAfter: Math.ceil((rateLimitResetAt - now) / 1000) };
  }

  // Check token budget (estimate a typical search call ~3k tokens)
  const waitMs = msUntilBudgetAvailable(3_000);
  if (waitMs > 0) {
    return { available: false, retryAfter: Math.ceil(waitMs / 1000) };
  }

  return { available: true, retryAfter: 0 };
}
