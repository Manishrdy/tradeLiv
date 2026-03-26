import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import logger from '../config/logger';
import { enqueueClaudeCall } from './claudeRateLimit';

/* ─── Types ──────────────────────────────────────────── */

export interface SearchResultItem {
  name: string;
  brand: string;
  price: string;           // "$1,200" or "From $800"
  url: string;             // Product page URL
  imageUrl?: string;       // Primary image if found
  category?: string;
  dimensions?: string;     // Raw dimension string
  material?: string;
  description?: string;    // 1-2 sentence summary
}

export interface SearchSession {
  id: string;
  query: string;
  allResults: SearchResultItem[];
  cursor: number;           // Next index to return from
  createdAt: number;
  designerId: string;
}

/* ─── In-memory cache ────────────────────────────────── */

const searchCache = new Map<string, SearchSession>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_CACHE_ENTRIES = 100;
const PAGE_SIZE = 3;

/* ─── Query-based cache (dedup same searches) ───────── */

const queryCache = new Map<string, { sessionId: string; createdAt: number }>();

function normalizeQuery(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, ' ');
}

function findCachedQuery(query: string, designerId: string): SearchSession | null {
  const key = `${designerId}:${normalizeQuery(query)}`;
  const entry = queryCache.get(key);
  if (!entry) return null;

  const session = searchCache.get(entry.sessionId);
  if (!session || Date.now() - session.createdAt > CACHE_TTL_MS) {
    queryCache.delete(key);
    return null;
  }
  return session;
}

/* ─── Claude API rate limiting is handled globally by claudeRateLimit.ts ── */

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of searchCache) {
    if (now - session.createdAt > CACHE_TTL_MS) {
      searchCache.delete(id);
    }
  }
  for (const [key, entry] of queryCache) {
    if (now - entry.createdAt > CACHE_TTL_MS) {
      queryCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

function generateSessionId(): string {
  return 'search_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
}

function evictIfNeeded() {
  if (searchCache.size >= MAX_CACHE_ENTRIES) {
    // Remove oldest
    let oldestId = '';
    let oldestTime = Infinity;
    for (const [id, session] of searchCache) {
      if (session.createdAt < oldestTime) {
        oldestTime = session.createdAt;
        oldestId = id;
      }
    }
    if (oldestId) searchCache.delete(oldestId);
  }
}

/* ─── Claude client ──────────────────────────────────── */

let _client: Anthropic | null = null;
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: config.claudeApiKey });
  return _client;
}

const MODEL = 'claude-sonnet-4-6';

/* ─── Search logic ───────────────────────────────────── */

const SYSTEM_PROMPT = `You are a furniture product research assistant for interior designers in the US market.

When given a product description, search the web to find real, currently available furniture products that match.

IMPORTANT RULES:
- Only return products from real US furniture retailers and brands (e.g., West Elm, CB2, Restoration Hardware, Pottery Barn, Article, Wayfair, AllModern, Lulu and Georgia, McGee & Co, Arhaus, Crate & Barrel, Room & Board, etc.)
- Each product MUST have a valid, working product page URL
- Prices must be in USD
- Return EXACTLY as many unique products as requested — no duplicates
- Focus on products that closely match the designer's specifications
- If specs are very specific, find the closest matches and note any differences

Return your results as a JSON array with this exact structure:
[
  {
    "name": "Product Name",
    "brand": "Brand Name",
    "price": "$1,200",
    "url": "https://...",
    "imageUrl": "https://...",
    "category": "Dining Table",
    "dimensions": "72\"W x 36\"D x 30\"H",
    "material": "Solid walnut",
    "description": "Brief 1-2 sentence description of the product and why it matches"
  }
]

Return ONLY the JSON array, no other text.`;

export async function searchProducts(
  query: string,
  designerId: string,
): Promise<{ sessionId: string; results: SearchResultItem[]; hasMore: boolean; total: number; cached?: boolean }> {

  // Check query cache first — return cached results if same query within TTL
  const cached = findCachedQuery(query, designerId);
  if (cached) {
    logger.info('Product search served from cache', { query: query.slice(0, 100), sessionId: cached.id });
    return {
      sessionId: cached.id,
      results: cached.allResults.slice(0, PAGE_SIZE),
      hasMore: cached.allResults.length > PAGE_SIZE,
      total: cached.allResults.length,
      cached: true,
    };
  }

  const sessionId = generateSessionId();
  evictIfNeeded();

  logger.info('Product search started', { query: query.slice(0, 100), designerId });

  // Ask Claude to find 3 best-matching products
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Find exactly 3 furniture products that best match this description from US retailers. Search thoroughly and pick the top 3 best matches.\n\nDesigner's requirements:\n${query}`,
    },
  ];

  // Use a single Claude call — web_search tool handles search internally.
  // Multi-turn was accumulating massive token counts (web search results inject
  // 5-10k tokens per turn), blowing past the 30k input token/min org rate limit.
  const inputText = SYSTEM_PROMPT + '\n' + (messages[0].content as string);
  const response = await enqueueClaudeCall(
    'search:' + query.slice(0, 50),
    () => getClient().messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages,
      tools: [{ type: 'web_search_20250305' as any, name: 'web_search' }] as any,
    }),
    inputText,
  );

  let allResults: SearchResultItem[] = [];

  const textBlocks = response.content.filter((b: any) => b.type === 'text') as any[];
  for (const block of textBlocks) {
    const parsed = tryParseJsonArray(block.text);
    if (parsed && parsed.length > 0) {
      allResults = parsed;
      break;
    }
  }

  if (allResults.length === 0) {
    logger.warn('Product search returned no results', { query: query.slice(0, 100) });
    return { sessionId, results: [], hasMore: false, total: 0 };
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  allResults = allResults.filter((r) => {
    if (!r.url || seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  // Store in cache
  const session: SearchSession = {
    id: sessionId,
    query,
    allResults,
    cursor: PAGE_SIZE,
    createdAt: Date.now(),
    designerId,
  };
  searchCache.set(sessionId, session);

  // Also cache by query for dedup
  const queryKey = `${designerId}:${normalizeQuery(query)}`;
  queryCache.set(queryKey, { sessionId, createdAt: Date.now() });

  logger.info('Product search completed', { query: query.slice(0, 100), totalResults: allResults.length });

  return {
    sessionId,
    results: allResults.slice(0, PAGE_SIZE),
    hasMore: allResults.length > PAGE_SIZE,
    total: allResults.length,
  };
}

export function getMoreResults(
  sessionId: string,
  designerId: string,
): { results: SearchResultItem[]; hasMore: boolean; total: number } | null {
  const session = searchCache.get(sessionId);
  if (!session || session.designerId !== designerId) return null;

  // Check expiry
  if (Date.now() - session.createdAt > CACHE_TTL_MS) {
    searchCache.delete(sessionId);
    return null;
  }

  const start = session.cursor;
  const end = start + PAGE_SIZE;
  const results = session.allResults.slice(start, end);
  session.cursor = end;

  return {
    results,
    hasMore: end < session.allResults.length,
    total: session.allResults.length,
  };
}

export function getSearchSession(sessionId: string, designerId: string): SearchSession | null {
  const session = searchCache.get(sessionId);
  if (!session || session.designerId !== designerId) return null;
  if (Date.now() - session.createdAt > CACHE_TTL_MS) {
    searchCache.delete(sessionId);
    return null;
  }
  return session;
}

/* ─── Helpers ────────────────────────────────────────── */

function tryParseJsonArray(text: string): SearchResultItem[] | null {
  try {
    // Try direct parse
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return validateResults(parsed);
  } catch {
    // Try extracting from markdown code fences
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenceMatch) {
      try {
        const parsed = JSON.parse(fenceMatch[1]);
        if (Array.isArray(parsed)) return validateResults(parsed);
      } catch { /* ignore */ }
    }

    // Try finding array in text
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed)) return validateResults(parsed);
      } catch { /* ignore */ }
    }
  }
  return null;
}

function validateResults(arr: any[]): SearchResultItem[] {
  return arr
    .filter((item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof item.name === 'string' &&
      typeof item.url === 'string' &&
      item.name.length > 0 &&
      item.url.length > 0,
    )
    .map((item) => ({
      name: String(item.name),
      brand: String(item.brand || ''),
      price: String(item.price || ''),
      url: String(item.url),
      imageUrl: item.imageUrl ? String(item.imageUrl) : undefined,
      category: item.category ? String(item.category) : undefined,
      dimensions: item.dimensions ? String(item.dimensions) : undefined,
      material: item.material ? String(item.material) : undefined,
      description: item.description ? String(item.description) : undefined,
    }));
}
