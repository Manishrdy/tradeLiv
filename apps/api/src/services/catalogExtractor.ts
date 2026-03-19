import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import logger from '../config/logger';

const client = new Anthropic({ apiKey: config.claudeApiKey });

/* ─── Models ─────────────────────────────────────────── */

const MODEL_FAST = 'claude-haiku-4-5-20251001';   // Direct extraction (no tools)
const MODEL_SEARCH = 'claude-sonnet-4-6';          // Web search fallback

/* ─── Constants ─────────────────────────────────────── */

const HTML_HEAD_LIMIT = 150_000;   // Meta + JSON-LD (always in <head>)
const HTML_BODY_LIMIT = 500_000;   // Full body for microdata + text extraction

/* ─── Error codes ───────────────────────────────────── */

export type ExtractionErrorCode =
  | 'BOT_BLOCKED'
  | 'NOT_PRODUCT_PAGE'
  | 'PARSE_FAILED'
  | 'NETWORK_ERROR'
  | 'RATE_LIMITED'
  | 'NO_PRODUCTS'
  | 'UNKNOWN';

export class ExtractionError extends Error {
  code: ExtractionErrorCode;
  constructor(message: string, code: ExtractionErrorCode) {
    super(message);
    this.code = code;
  }
}

/* ─── Types ──────────────────────────────────────────── */

export interface ExtractedProductData {
  productName: string;
  brandName?: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  productUrl?: string;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    depth?: number;
    weight?: number;
    unit?: 'in' | 'cm' | 'ft';
    raw?: string;  // Original dimension string from page
  };
  material?: string;
  finishes?: string[];
  leadTime?: string;
  category?: string;
  metadata?: {
    description?: string;
    keyFeatures?: string[];
    assembly?: string;
    careInstructions?: string;
    warranty?: string;
    weightCapacity?: string;
    style?: string;
    collection?: string;
    sku?: string;
    availableColors?: string[];
    seatHeight?: string;
    armHeight?: string;
    seatDepth?: string;
    legMaterial?: string;
    cushionType?: string;
    fabricType?: string;
    [key: string]: unknown;  // Allow additional fields
  };
}

export interface ExtractionResult {
  type: 'single' | 'multiple';
  product?: ExtractedProductData;
  products?: ExtractedProductData[];
  totalFound?: number;
}

/* ─── Extraction cache (10 min TTL) ─────────────────── */

interface CacheEntry {
  result: ExtractionResult;
  ts: number;
}

const extractionCache = new Map<string, CacheEntry>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function getCachedResult(url: string): ExtractionResult | null {
  const entry = extractionCache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    extractionCache.delete(url);
    return null;
  }
  return entry.result;
}

function setCachedResult(url: string, result: ExtractionResult): void {
  // Evict stale entries if cache grows beyond 200
  if (extractionCache.size > 200) {
    const now = Date.now();
    for (const [key, val] of extractionCache) {
      if (now - val.ts > CACHE_TTL) extractionCache.delete(key);
    }
  }
  extractionCache.set(url, { result, ts: Date.now() });
}

/* ─── Concurrency limiter ───────────────────────────── */

function pLimit(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  function next() {
    if (queue.length > 0 && active < concurrency) {
      active++;
      queue.shift()!();
    }
  }

  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        fn()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            active--;
            next();
          });
      };
      queue.push(run);
      next();
    });
}

export const batchLimiter = pLimit(2);

/* ─── Category keyword matcher ──────────────────────── */

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Sofa: ['sofa', 'couch', 'sectional', 'loveseat', 'settee', 'sleeper sofa', 'futon'],
  'Dining Table': ['dining table', 'dining set', 'dinner table', 'kitchen table'],
  Bed: ['bed', 'bedframe', 'bed frame', 'headboard', 'platform bed', 'canopy bed', 'bunk bed'],
  Desk: ['desk', 'writing desk', 'standing desk', 'computer desk', 'work table'],
  Storage: ['storage', 'cabinet', 'credenza', 'sideboard', 'buffet', 'hutch', 'shelf unit'],
  Lighting: ['lamp', 'chandelier', 'pendant', 'sconce', 'floor lamp', 'table lamp', 'light fixture'],
  Armchair: ['armchair', 'arm chair', 'accent chair', 'lounge chair', 'club chair', 'wingback'],
  'Side Table': ['side table', 'end table', 'accent table', 'occasional table'],
  Bookshelf: ['bookshelf', 'bookcase', 'book shelf', 'book case', 'étagère', 'etagere'],
  Mirror: ['mirror', 'wall mirror', 'floor mirror', 'vanity mirror'],
  Rug: ['rug', 'carpet', 'area rug', 'runner'],
  Wardrobe: ['wardrobe', 'armoire', 'closet'],
  'TV Unit': ['tv unit', 'tv stand', 'media console', 'entertainment center', 'tv cabinet'],
  'Coffee Table': ['coffee table', 'cocktail table'],
  'Console Table': ['console table', 'entry table', 'entryway table', 'hall table', 'sofa table'],
  'Bar Stool': ['bar stool', 'barstool', 'counter stool', 'bar chair'],
  Ottoman: ['ottoman', 'pouf', 'pouffe', 'footstool', 'footrest'],
  Bench: ['bench', 'entryway bench', 'storage bench', 'dining bench'],
  Dresser: ['dresser', 'chest of drawers', 'tallboy'],
  Nightstand: ['nightstand', 'night stand', 'bedside table', 'night table'],
  Chair: ['chair', 'dining chair', 'side chair', 'folding chair', 'stacking chair'],
  Table: ['table'],
  Outdoor: ['outdoor', 'patio', 'garden furniture', 'adirondack'],
  Accessories: ['accessory', 'vase', 'throw', 'pillow', 'blanket', 'planter', 'basket'],
};

function inferCategoryFromText(text: string): string | null {
  const lower = text.toLowerCase();
  // Check more specific (multi-word) categories first by sorting by keyword length desc
  const entries = Object.entries(CATEGORY_KEYWORDS).sort(
    (a, b) => Math.max(...b[1].map((k) => k.length)) - Math.max(...a[1].map((k) => k.length)),
  );
  for (const [category, keywords] of entries) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return category;
    }
  }
  return null;
}

/* ─── System prompt ──────────────────────────────────── */

const SYSTEM_PROMPT = `You are a furniture product data extractor for an interior design trade platform.

You receive structured signals extracted from a product page (meta tags, JSON-LD, breadcrumbs, dimensions, body text, etc.).
Respond with ONLY a valid JSON object. No markdown, no explanation, no extra text.

REQUIRED — always include these four fields:
- productName: the product name. Use og:title or JSON-LD name. Strip " | Brand" or " - Site Name" suffixes from titles.
- price: number only (e.g. 1299.00). Use the current/sale price if shown. null if no price found anywhere.
- imageUrl: the main product image as a full https:// URL. Prefer og:image, then JSON-LD image, then twitter:image. CDN URLs with query params (e.g. ?w=800&fmt=webp) are valid — include them exactly. null only if truly no image signal exists.
- category: ALWAYS infer the furniture category, even if not explicit. Use the product name and breadcrumbs. Must be exactly one of: Sofa, Dining Table, Bed, Desk, Storage, Lighting, Armchair, Side Table, Bookshelf, Mirror, Rug, Wardrobe, TV Unit, Coffee Table, Console Table, Bar Stool, Ottoman, Bench, Dresser, Nightstand, Chair, Table, Outdoor, Accessories

OPTIONAL — include only when clearly present in the signals:
- brandName: manufacturer or brand name
- currency: three-letter ISO code (e.g. "USD", "GBP", "EUR"). Infer from site domain, currency symbol, or priceCurrency.
- dimensions: { length, width, height, depth, weight, unit, raw } — unit must be "in", "cm", or "ft". "raw" is the original dimension text from page.
- material: primary material (e.g. "Solid Walnut", "Bouclé Fabric")
- finishes: array of finish/color option strings
- leadTime: delivery lead time string (e.g. "4–6 weeks")
- productUrl: canonical product page URL

IMPORTANT — metadata: Extract ALL useful product details from the page text into a "metadata" object:
- description: product description (2-3 sentences max)
- keyFeatures: array of key feature strings
- assembly: assembly requirements (e.g. "Minimal assembly required", "No assembly")
- careInstructions: care/maintenance info
- warranty: warranty details
- weightCapacity: weight capacity if mentioned
- style: design style (e.g. "Mid-Century Modern", "Scandinavian")
- collection: product collection name
- sku: SKU or product code
- availableColors: array of color options
- seatHeight: seat height measurement
- armHeight: arm height measurement
- seatDepth: seat depth measurement
- legMaterial: leg material if different from main
- cushionType: cushion fill/type
- fabricType: fabric/upholstery type
Include any other relevant product details as additional key-value pairs.

For a SINGLE PRODUCT page respond:
{
  "type": "single",
  "product": {
    "productName": "Sven Charme Tan Sofa",
    "price": 1895.00,
    "currency": "USD",
    "imageUrl": "https://cdn.example.com/sven-sofa.jpg?w=800",
    "category": "Sofa",
    "brandName": "Article",
    "productUrl": "https://example.com/products/sven-sofa",
    "dimensions": { "width": 84, "depth": 38, "height": 34, "unit": "in", "raw": "84\\"W x 38\\"D x 34\\"H" },
    "metadata": {
      "description": "Mid-century modern sofa with Italian tanned leather and solid wood frame.",
      "keyFeatures": ["Kiln-dried hardwood frame", "High-resilience foam cushions", "Italian tanned leather"],
      "assembly": "Legs only — 5 minutes",
      "style": "Mid-Century Modern",
      "weightCapacity": "750 lbs",
      "seatHeight": "17 in",
      "seatDepth": "22 in"
    }
  }
}

For a COLLECTION/CATEGORY page (multiple products visible) respond:
{
  "type": "multiple",
  "totalFound": 24,
  "products": [
    { "productName": "...", "price": 999.00, "currency": "USD", "imageUrl": "https://...", "category": "Chair", "productUrl": "https://..." }
  ]
}

Rules:
- price: numeric only, no currency symbols or commas. Use sale/current price. null if absent.
- currency: infer from domain (.co.uk → GBP, .de → EUR) or currency symbols ($ → USD, £ → GBP, € → EUR). Default "USD" if US site.
- imageUrl: must start with https://. Include CDN query params as-is. Never fabricate a URL.
- category: always infer from product name or breadcrumbs. Never leave this null.
- dimensions: AGGRESSIVELY extract ALL dimension data. Check body text for patterns like 84"W x 38"D x 34"H, seat height, arm height, etc. Always include "raw" with the original text.
- metadata: extract ALL useful details. This data helps interior designers make informed decisions. Be thorough.
- Output ONLY the JSON object.`;

/* ─── HTML fetch ─────────────────────────────────────── */

async function fetchPageHtml(url: string): Promise<string | null> {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return null;
  }

  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Referer: origin + '/',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Dest': 'document',
    'Sec-Ch-Ua': '"Chromium";v="125", "Google Chrome";v="125", "Not=A?Brand";v="24"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"macOS"',
    'Upgrade-Insecure-Requests': '1',
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    try {
      const res = await fetch(url, { headers, signal: controller.signal, redirect: 'follow' });
      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        return text.length > HTML_BODY_LIMIT ? text.slice(0, HTML_BODY_LIMIT) : text;
      }

      if (res.status === 403 || res.status === 429) {
        logger.warn('fetchPageHtml bot-blocked', { url, status: res.status });
        return null; // Signal bot-block to caller
      }

      // 4xx errors are definitive — no point retrying
      if (res.status < 500) {
        logger.warn('fetchPageHtml client error', { url, status: res.status });
        return null;
      }

      // 5xx — transient, retry once after a short pause
      if (attempt === 1) {
        logger.warn('fetchPageHtml server error, retrying', { url, status: res.status });
        await new Promise((r) => setTimeout(r, 1_000));
        continue;
      }

      logger.warn('fetchPageHtml server error on retry', { url, status: res.status });
      return null;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (attempt === 1) {
        logger.warn('fetchPageHtml network error, retrying', { url, err: err?.message });
        await new Promise((r) => setTimeout(r, 1_000));
        continue;
      }
      logger.warn('fetchPageHtml failed after retry', { url, err: err?.message });
      return null;
    }
  }

  return null;
}

/* ─── Signal extraction from HTML ───────────────────── */

function findJsonLdNode(data: any, type: string | string[]): any {
  if (!data) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findJsonLdNode(item, type);
      if (found) return found;
    }
    return null;
  }
  if (typeof data !== 'object') return null;

  const nodeType = data['@type'];
  const types = Array.isArray(type) ? type : [type];
  const nodeTypes = Array.isArray(nodeType) ? nodeType : [nodeType];
  if (types.some((t) => nodeTypes.includes(t))) return data;

  if (data['@graph']) return findJsonLdNode(data['@graph'], type);
  return null;
}

function resolveImage(raw: any): string | undefined {
  if (!raw) return undefined;
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (typeof first === 'string') return first;
  if (typeof first === 'object') {
    return first.contentUrl ?? first.url ?? first['@id'] ?? undefined;
  }
  return undefined;
}

function resolveOfferPrice(
  offers: any,
  graphNodes?: any[],
): { price: number | undefined; currency: string | undefined } {
  if (!offers) return { price: undefined, currency: undefined };

  const getPrice = (o: any): number | undefined => {
    if (!o) return undefined;
    if (typeof o === 'string' && graphNodes) {
      const node = graphNodes.find((n) => n['@id'] === o);
      return node ? getPrice(node) : undefined;
    }
    const raw = o.price ?? o.lowPrice;
    if (raw == null) return undefined;
    const n = typeof raw === 'string' ? parseFloat(raw.replace(/[^0-9.]/g, '')) : Number(raw);
    return isNaN(n) || n <= 0 ? undefined : n;
  };

  const getCurrency = (o: any): string | undefined => {
    if (typeof o === 'string') return undefined;
    return o?.priceCurrency ?? undefined;
  };

  if (Array.isArray(offers)) {
    const first = offers[0];
    return { price: getPrice(first), currency: getCurrency(first) };
  }
  return { price: getPrice(offers), currency: getCurrency(offers) };
}

/* ─── Aggressive dimension extraction ───────────────── */

function extractDimensionsFromText(text: string): string[] {
  const lines: string[] = [];

  // Pattern 1: W x D x H with unit markers — e.g. 84"W x 38"D x 34"H
  const wdhQuote =
    /(\d+(?:\.\d+)?)\s*["″'']\s*[Ww]\s*[x×X]\s*(\d+(?:\.\d+)?)\s*["″'']\s*[Dd]\s*[x×X]\s*(\d+(?:\.\d+)?)\s*["″'']\s*[Hh]/g;
  for (const m of text.matchAll(wdhQuote)) {
    lines.push(`dim_WxDxH: ${m[1]}W x ${m[2]}D x ${m[3]}H in`);
  }

  // Pattern 2: W x D x H with letter markers — e.g. 84W x 38D x 34H
  const wdhLetter =
    /(\d+(?:\.\d+)?)\s*[Ww]\s*[x×X]\s*(\d+(?:\.\d+)?)\s*[Dd]\s*[x×X]\s*(\d+(?:\.\d+)?)\s*[Hh]/g;
  for (const m of text.matchAll(wdhLetter)) {
    if (!lines.some((l) => l.includes(`${m[1]}W`))) {
      lines.push(`dim_WxDxH: ${m[1]}W x ${m[2]}D x ${m[3]}H`);
    }
  }

  // Pattern 3: L x W x H plain — e.g. 84 x 38 x 34 in / 84 x 38 x 34 inches / 84 x 38 x 34"
  const lwhPlain =
    /(\d+(?:\.\d+)?)\s*[x×X]\s*(\d+(?:\.\d+)?)\s*[x×X]\s*(\d+(?:\.\d+)?)\s*(?:["″]|in(?:ches)?|cm|mm|ft)?/g;
  for (const m of text.matchAll(lwhPlain)) {
    const key = `${m[1]}x${m[2]}x${m[3]}`;
    if (!lines.some((l) => l.includes(key) || l.includes(`${m[1]}W`))) {
      lines.push(`dim_LxWxH: ${m[1]} x ${m[2]} x ${m[3]}`);
    }
  }

  // Pattern 4: Individual dimension labels — e.g. Width: 84", Height: 34 inches
  const labelPattern =
    /(?:overall\s+)?(?:width|length|height|depth|seat\s*height|seat\s*depth|arm\s*height|diameter)\s*[:=]\s*(\d+(?:\.\d+)?)\s*(?:["″]|in(?:ches)?|cm|mm|ft)?/gi;
  for (const m of text.matchAll(labelPattern)) {
    lines.push(`dim_label: ${m[0].trim()}`);
  }

  // Pattern 5: Weight — e.g. 85 lbs, Weight: 120 pounds
  const weightPattern = /(?:weight|wt)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|kg)/gi;
  for (const m of text.matchAll(weightPattern)) {
    lines.push(`dim_weight: ${m[0].trim()}`);
  }

  // Pattern 6: Diameter — e.g. 48" diameter, Dia. 36"
  const diaPattern = /(?:dia(?:meter)?\.?)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*["″]?/gi;
  for (const m of text.matchAll(diaPattern)) {
    lines.push(`dim_diameter: ${m[0].trim()}`);
  }

  // Pattern 7: dimension with units separated — e.g. "84 in W x 38 in D"
  const unitSep =
    /(\d+(?:\.\d+)?)\s*(?:in|cm|mm)\s*[Ww]\s*[x×X]\s*(\d+(?:\.\d+)?)\s*(?:in|cm|mm)\s*[Dd]/g;
  for (const m of text.matchAll(unitSep)) {
    lines.push(`dim_WxD: ${m[1]}W x ${m[2]}D`);
  }

  return lines;
}

/* ─── Body text extraction for AI analysis ──────────── */

function extractBodyText(html: string): string {
  // Remove scripts, styles, SVGs, and nav/footer
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')   // Strip remaining HTML tags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Cap at 8000 chars to keep token usage reasonable
  if (text.length > 8000) text = text.slice(0, 8000);
  return text;
}

/* ─── Full signal extraction ────────────────────────── */

function extractSignals(html: string, url: string): string {
  const lines: string[] = [`url: ${url}`];

  // ── <title> ───────────────────────────────────────────
  const titleMatch = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i);
  if (titleMatch) lines.push(`page_title: ${titleMatch[1].trim()}`);

  // ── <link rel="canonical"> ────────────────────────────
  const canonicalMatch =
    html.match(/<link\b[^>]+rel=["']canonical["'][^>]+href=["']([^"']{1,2000})["']/i) ??
    html.match(/<link\b[^>]+href=["']([^"']{1,2000})["'][^>]+rel=["']canonical["']/i);
  if (canonicalMatch) lines.push(`canonical_url: ${canonicalMatch[1]}`);

  // ── <meta> tags ───────────────────────────────────────
  const metaRegex = /<meta\b[^>]+>/gi;
  let m: RegExpExecArray | null;
  while ((m = metaRegex.exec(html)) !== null) {
    const tag = m[0];
    const propMatch = tag.match(/(?:property|name|itemprop)=["']([^"']{1,100})["']/i);
    const contentMatch = tag.match(/content=["']([^"']{1,800})["']/i);
    if (!propMatch || !contentMatch) continue;
    const prop = propMatch[1].toLowerCase();
    if (
      prop.startsWith('og:') ||
      prop.startsWith('product:') ||
      prop === 'twitter:title' ||
      prop === 'twitter:image' ||
      prop === 'twitter:description' ||
      prop === 'description'
    ) {
      lines.push(`${prop}: ${contentMatch[1]}`);
    }
  }

  // ── JSON-LD ──────────────────────────────────────────
  const jsonLdRegex = /<script\b[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let foundProduct = false;
  let foundBreadcrumbs = false;

  while ((m = jsonLdRegex.exec(html)) !== null) {
    let parsed: any;
    try {
      parsed = JSON.parse(m[1]);
    } catch {
      continue;
    }

    // Collect all graph nodes for cross-reference resolution
    const graphNodes: any[] = [];
    if (parsed?.['@graph']) {
      const g = parsed['@graph'];
      if (Array.isArray(g)) graphNodes.push(...g);
    }

    // Product node
    if (!foundProduct) {
      const product = findJsonLdNode(parsed, ['Product', 'ProductGroup']);
      if (product) {
        foundProduct = true;
        const { price, currency } = resolveOfferPrice(product.offers, graphNodes);
        const slim: Record<string, unknown> = {
          name: product.name,
          image: resolveImage(product.image),
          price,
          priceCurrency: currency,
          brand: typeof product.brand === 'object' ? product.brand?.name : product.brand,
          material: product.material,
          category: product.category,
          color: product.color,
          weight: product.weight,
          width: product.width,
          height: product.height,
          depth: product.depth,
          sku: product.sku ?? product.mpn,
          description:
            typeof product.description === 'string' ? product.description.slice(0, 500) : undefined,
        };
        Object.keys(slim).forEach((k) => slim[k] === undefined && delete slim[k]);
        lines.push(`json_ld_product: ${JSON.stringify(slim)}`);
      }
    }

    // BreadcrumbList node — strong category signal
    if (!foundBreadcrumbs) {
      const crumbList = findJsonLdNode(parsed, 'BreadcrumbList');
      if (crumbList && Array.isArray(crumbList.itemListElement)) {
        const crumbs = crumbList.itemListElement
          .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
          .map((item: any) => item.name ?? item.item?.name)
          .filter(Boolean);
        if (crumbs.length > 0) {
          foundBreadcrumbs = true;
          lines.push(`breadcrumbs: ${crumbs.join(' > ')}`);
        }
      }
    }

    if (foundProduct && foundBreadcrumbs) break;
  }

  // ── Microdata (itemprop) fallbacks (now from full body) ──
  const itempropPrice =
    html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/itemprop=["']price["'][^>]*>\s*([0-9][0-9,. ]*)/i);
  if (itempropPrice) lines.push(`itemprop_price: ${itempropPrice[1].trim()}`);

  const itempropCurrency = html.match(
    /itemprop=["']priceCurrency["'][^>]*content=["']([^"']+)["']/i,
  );
  if (itempropCurrency) lines.push(`itemprop_currency: ${itempropCurrency[1]}`);

  const itempropName = html.match(/itemprop=["']name["'][^>]*content=["']([^"']+)["']/i);
  if (itempropName) lines.push(`itemprop_name: ${itempropName[1]}`);

  const itempropImage =
    html.match(/itemprop=["']image["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/itemprop=["']image["'][^>]*src=["']([^"']+)["']/i);
  if (itempropImage) lines.push(`itemprop_image: ${itempropImage[1]}`);

  const itempropBrand = html.match(/itemprop=["']brand["'][^>]*content=["']([^"']+)["']/i);
  if (itempropBrand) lines.push(`itemprop_brand: ${itempropBrand[1]}`);

  const itempropDesc = html.match(/itemprop=["']description["'][^>]*content=["']([^"']{1,500})["']/i);
  if (itempropDesc) lines.push(`itemprop_description: ${itempropDesc[1]}`);

  const itempropSku = html.match(/itemprop=["']sku["'][^>]*content=["']([^"']+)["']/i);
  if (itempropSku) lines.push(`itemprop_sku: ${itempropSku[1]}`);

  // ── data-* attribute fallbacks ────────────────────────
  const dataPrice = html.match(/\bdata-price=["']([0-9]+(?:\.[0-9]{1,2})?)["']/);
  if (dataPrice) lines.push(`data_price: ${dataPrice[1]}`);

  const dataProductName = html.match(/\bdata-product-name=["']([^"']{1,200})["']/i);
  if (dataProductName) lines.push(`data_product_name: ${dataProductName[1]}`);

  const dataProductBrand = html.match(/\bdata-(?:product-)?brand=["']([^"']{1,200})["']/i);
  if (dataProductBrand) lines.push(`data_product_brand: ${dataProductBrand[1]}`);

  const dataProductId = html.match(/\bdata-product-id=["']([^"']{1,100})["']/i);
  if (dataProductId) lines.push(`data_product_id: ${dataProductId[1]}`);

  const dataCurrency = html.match(/\bdata-currency=["']([A-Z]{3})["']/i);
  if (dataCurrency) lines.push(`data_currency: ${dataCurrency[1].toUpperCase()}`);

  // ── Aggressive dimension extraction from full page ────
  const dimLines = extractDimensionsFromText(html);
  lines.push(...dimLines);

  // ── Body text for AI analysis ─────────────────────────
  const bodyText = extractBodyText(html);
  if (bodyText.length > 200) {
    lines.push(`\nbody_text:\n${bodyText}`);
  }

  return lines.join('\n');
}

/* ─── Main extractor ─────────────────────────────────── */

export async function extractProductFromUrl(sourceUrl: string): Promise<ExtractionResult> {
  // Check cache first
  const cached = getCachedResult(sourceUrl);
  if (cached) {
    logger.info('Returning cached extraction', { url: sourceUrl });
    return cached;
  }

  // Stage 1: Direct fetch → signal extraction → Claude (no tools)
  const html = await fetchPageHtml(sourceUrl);

  if (html && html.length > 500) {
    const signals = extractSignals(html, sourceUrl);

    // Pre-infer category from signals for the deterministic fast path
    const preCategory = inferCategoryFromText(signals);

    logger.info('Page signals extracted', {
      url: sourceUrl,
      signalCount: signals.split('\n').length,
      htmlBytes: html.length,
      preCategory,
    });

    try {
      const response = await client.messages.create({
        model: MODEL_FAST,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Extract product data from these page signals. Be THOROUGH with dimensions and metadata — extract every detail useful for interior designers.\n\n${signals}`,
          },
        ],
      });

      const textBlock = response.content.find((b) => b.type === 'text') as any;
      if (textBlock?.text) {
        const parsed = tryParseJson(textBlock.text);
        if (parsed) {
          logger.info('Direct extraction succeeded', { url: sourceUrl });
          const result = buildResult(parsed, sourceUrl, preCategory);
          setCachedResult(sourceUrl, result);
          return result;
        }
      }
      logger.warn('Direct extraction returned no JSON', { url: sourceUrl });
    } catch (err: any) {
      logger.error('Direct extraction Claude call failed', { url: sourceUrl, err: err?.message });
    }
  } else {
    logger.info('HTML fetch returned empty/short content — likely bot-blocked or JS-only', {
      url: sourceUrl,
      bytes: html?.length ?? 0,
    });
  }

  // Stage 2: Fallback — web search (JS-rendered pages, anti-bot protected sites)
  logger.info('Falling back to web search', { url: sourceUrl });
  const result = await extractWithWebSearch(sourceUrl);
  setCachedResult(sourceUrl, result);
  return result;
}

/* ─── Web search fallback ────────────────────────────── */

async function extractWithWebSearch(sourceUrl: string): Promise<ExtractionResult> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Search for the product at this URL and extract its full details:\n${sourceUrl}\n\nI need: name, price, currency, main image URL, furniture category, dimensions (be aggressive — find ALL measurements), and metadata (description, key features, materials, assembly, care instructions, warranty, style, etc.).\n\nReturn ONLY the JSON object as specified.`,
    },
  ];

  const MAX_TURNS = 4;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.messages.create({
      model: MODEL_SEARCH,
      max_tokens: 3072,
      system: SYSTEM_PROMPT,
      messages,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }] as any,
    });

    const { stop_reason, content } = response;

    // Always try to parse JSON from any text blocks first
    const textBlocks = content.filter((b) => b.type === 'text');
    if (textBlocks.length > 0) {
      const parsed = tryParseJsonFromBlocks(textBlocks);
      if (parsed) {
        logger.info('Web search extraction succeeded', { url: sourceUrl, turn });
        return buildResult(parsed, sourceUrl);
      }
    }

    if (stop_reason === 'max_tokens') break;

    if (stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: content as any });
      const toolUseBlocks = content.filter((b) => b.type === 'tool_use') as any[];
      messages.push({
        role: 'user',
        content: toolUseBlocks.map((b) => ({
          type: 'tool_result' as const,
          tool_use_id: b.id,
          content: '',
        })) as any,
      });
      continue;
    }

    if (stop_reason === 'end_turn') {
      if (turn < MAX_TURNS - 1) {
        messages.push({ role: 'assistant', content: content as any });
        messages.push({
          role: 'user',
          content:
            'Output ONLY the JSON object with the product data including dimensions and metadata. No explanation, no markdown fences.',
        });
        continue;
      }
    }

    break;
  }

  const lastText = (messages as any[])
    .filter((m) => m.role === 'assistant')
    .flatMap((m) => (Array.isArray(m.content) ? m.content : [m.content]))
    .filter((b: any) => b?.type === 'text')
    .map((b: any) => b.text)
    .join('\n')
    .slice(0, 200);

  logger.warn('Web search extraction failed', { url: sourceUrl, lastText });
  throw new ExtractionError(
    'Failed to extract product data from this page. Try a different URL or add the product manually.',
    'PARSE_FAILED',
  );
}

/* ─── JSON helpers ───────────────────────────────────── */

function tryParseJson(text: string): any | null {
  let t = text.trim();
  // Strip markdown fences
  t = t.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  const match = t.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function tryParseJsonFromBlocks(blocks: any[]): any | null {
  for (const block of blocks) {
    if (block.type !== 'text' || !block.text) continue;
    const parsed = tryParseJson(block.text);
    if (parsed) return parsed;
  }
  return null;
}

/* ─── Result normalisation ───────────────────────────── */

function buildResult(parsed: any, sourceUrl: string, preCategory?: string | null): ExtractionResult {
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) throw new ExtractionError('No products found on this page.', 'NO_PRODUCTS');
    if (parsed.length === 1)
      return { type: 'single', product: normalizeProduct(parsed[0], sourceUrl, preCategory) };
    return {
      type: 'multiple',
      totalFound: parsed.length,
      products: parsed.map((p) => normalizeProduct(p, sourceUrl, preCategory)),
    };
  }

  if (parsed.type === 'multiple' && Array.isArray(parsed.products)) {
    if (parsed.products.length === 0)
      throw new ExtractionError('No products found on this page.', 'NO_PRODUCTS');
    return {
      type: 'multiple',
      totalFound: parsed.totalFound ?? parsed.products.length,
      products: parsed.products.map((p: any) => normalizeProduct(p, sourceUrl, preCategory)),
    };
  }

  const productData = parsed.product ?? parsed;
  if (!productData.productName || typeof productData.productName !== 'string') {
    throw new ExtractionError('Could not extract product name from this page.', 'PARSE_FAILED');
  }
  return { type: 'single', product: normalizeProduct(productData, sourceUrl, preCategory) };
}

function normalizeProduct(
  raw: any,
  sourceUrl: string,
  preCategory?: string | null,
): ExtractedProductData {
  const result: ExtractedProductData = {
    productName: String(raw.productName || raw.product_name || raw.name || 'Unknown Product').trim(),
  };

  if (raw.brandName && typeof raw.brandName === 'string') {
    result.brandName = raw.brandName.trim();
  }

  if (raw.price != null) {
    const p =
      typeof raw.price === 'string'
        ? parseFloat(raw.price.replace(/[^0-9.]/g, ''))
        : Number(raw.price);
    if (!isNaN(p) && p > 0) result.price = p;
  }

  // Currency
  if (raw.currency && typeof raw.currency === 'string') {
    const c = raw.currency.trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(c)) result.currency = c;
  }
  if (!result.currency) {
    // Infer from URL domain
    try {
      const hostname = new URL(sourceUrl).hostname;
      if (hostname.endsWith('.co.uk') || hostname.endsWith('.uk')) result.currency = 'GBP';
      else if (hostname.endsWith('.de') || hostname.endsWith('.fr') || hostname.endsWith('.it') || hostname.endsWith('.eu'))
        result.currency = 'EUR';
      else if (hostname.endsWith('.ca')) result.currency = 'CAD';
      else if (hostname.endsWith('.au') || hostname.endsWith('.com.au')) result.currency = 'AUD';
      else result.currency = 'USD';
    } catch {
      result.currency = 'USD';
    }
  }

  if (raw.imageUrl && typeof raw.imageUrl === 'string' && raw.imageUrl.startsWith('https://')) {
    result.imageUrl = raw.imageUrl;
  } else if (raw.imageUrl && typeof raw.imageUrl === 'string' && raw.imageUrl.startsWith('http://')) {
    result.imageUrl = raw.imageUrl;
  }

  const pUrl = raw.productUrl ?? raw.product_url;
  if (pUrl && typeof pUrl === 'string' && pUrl.startsWith('http')) {
    result.productUrl = pUrl;
  } else {
    result.productUrl = sourceUrl;
  }

  // Dimensions — aggressive normalization
  if (raw.dimensions && typeof raw.dimensions === 'object') {
    const d = raw.dimensions;
    const dims: ExtractedProductData['dimensions'] = {};
    if (d.length != null && !isNaN(Number(d.length))) dims.length = Number(d.length);
    if (d.width != null && !isNaN(Number(d.width))) dims.width = Number(d.width);
    if (d.height != null && !isNaN(Number(d.height))) dims.height = Number(d.height);
    if (d.depth != null && !isNaN(Number(d.depth))) dims.depth = Number(d.depth);
    if (d.weight != null && !isNaN(Number(d.weight))) dims.weight = Number(d.weight);
    if (['in', 'cm', 'ft'].includes(d.unit)) dims.unit = d.unit;
    if (d.raw && typeof d.raw === 'string') dims.raw = d.raw;
    if (Object.keys(dims).length > 0) result.dimensions = dims;
  }

  if (raw.material && typeof raw.material === 'string') result.material = raw.material.trim();

  if (Array.isArray(raw.finishes) && raw.finishes.length > 0) {
    result.finishes = raw.finishes.filter((f: unknown) => typeof f === 'string' && f.length > 0);
  }

  if (raw.leadTime && typeof raw.leadTime === 'string') result.leadTime = raw.leadTime.trim();

  // Category: use AI result, fall back to deterministic pre-match
  if (raw.category && typeof raw.category === 'string') {
    result.category = raw.category.trim();
  } else if (preCategory) {
    result.category = preCategory;
  }

  // Metadata — AI-analyzed product summary
  if (raw.metadata && typeof raw.metadata === 'object') {
    const md = raw.metadata;
    const metadata: ExtractedProductData['metadata'] = {};

    if (md.description && typeof md.description === 'string') metadata.description = md.description.trim();
    if (Array.isArray(md.keyFeatures) && md.keyFeatures.length > 0) {
      metadata.keyFeatures = md.keyFeatures.filter((f: unknown) => typeof f === 'string');
    }
    if (md.assembly && typeof md.assembly === 'string') metadata.assembly = md.assembly.trim();
    if (md.careInstructions && typeof md.careInstructions === 'string')
      metadata.careInstructions = md.careInstructions.trim();
    if (md.warranty && typeof md.warranty === 'string') metadata.warranty = md.warranty.trim();
    if (md.weightCapacity && typeof md.weightCapacity === 'string')
      metadata.weightCapacity = md.weightCapacity.trim();
    if (md.style && typeof md.style === 'string') metadata.style = md.style.trim();
    if (md.collection && typeof md.collection === 'string') metadata.collection = md.collection.trim();
    if (md.sku && typeof md.sku === 'string') metadata.sku = md.sku.trim();
    if (Array.isArray(md.availableColors) && md.availableColors.length > 0) {
      metadata.availableColors = md.availableColors.filter((c: unknown) => typeof c === 'string');
    }
    if (md.seatHeight && typeof md.seatHeight === 'string') metadata.seatHeight = md.seatHeight.trim();
    if (md.armHeight && typeof md.armHeight === 'string') metadata.armHeight = md.armHeight.trim();
    if (md.seatDepth && typeof md.seatDepth === 'string') metadata.seatDepth = md.seatDepth.trim();
    if (md.legMaterial && typeof md.legMaterial === 'string') metadata.legMaterial = md.legMaterial.trim();
    if (md.cushionType && typeof md.cushionType === 'string') metadata.cushionType = md.cushionType.trim();
    if (md.fabricType && typeof md.fabricType === 'string') metadata.fabricType = md.fabricType.trim();

    // Copy any additional fields from AI
    for (const [key, val] of Object.entries(md)) {
      if (!(key in metadata) && val != null && val !== '') {
        if (typeof val === 'string') metadata[key] = val.trim();
        else if (Array.isArray(val)) metadata[key] = val;
        else metadata[key] = val;
      }
    }

    if (Object.keys(metadata).length > 0) result.metadata = metadata;
  }

  return result;
}
