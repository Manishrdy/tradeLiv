import puppeteer from 'puppeteer-core';
import { config } from '../config';
import logger from '../config/logger';
import { generateText, generateWithTools } from './aiProvider';

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
  category?: string;          // Hierarchical: "Dining > Dining Tables" or flat: "Sofa"
  currency?: string;

  // Variant-aware fields
  variantId?: string;         // Platform variant ID (e.g. Shopify variant ID)
  sku?: string;               // ERP-level SKU
  activeVariant?: Record<string, string | number>;  // { finish: "X", size: "Y", price: 6200 }
  images?: {
    primary?: string;
    gallery?: string[];
    note?: string;
  };
  pricing?: Array<Record<string, string | number>>;  // [{ finish: "X", size: "Y", price: N }]
  availableOptions?: Array<{ type: string; values: string[] }>;
  features?: string[];
  materials?: Record<string, string | string[]>;     // { primary: "", frame: "", certifications: [] }
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    depth?: number;
    weight?: number;
    unit?: 'in' | 'cm' | 'ft';
    raw?: string;
  };
  secondaryDimensions?: {
    seatHeight?: number;
    seatDepth?: number;
    seatWidth?: number;
    armHeight?: number;
    clearance?: number;
    diameter?: number;
    unit?: 'in' | 'cm' | 'ft';
    [key: string]: number | string | undefined;
  };
  promotions?: string[];
  shipping?: string;
  availability?: string;
  leadTime?: string;
  productUrl?: string;

  // Legacy fields — kept for backward compat during migration
  price?: number;
  imageUrl?: string;
  material?: string;
  finishes?: string[];
  options?: Array<{
    name: string;
    values: string[];
  }>;
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
    seatHeight?: string;
    armHeight?: string;
    seatDepth?: string;
    legMaterial?: string;
    cushionType?: string;
    fabricType?: string;
    [key: string]: unknown;
  };
}

export interface ExtractionMeta {
  method: 'direct' | 'browser' | 'search';
  completenessScore: number;
  shopifyOverlay: boolean;    // true if Shopify structured data was used
  browserReExtracted: boolean; // true if browser re-extraction improved result
  missingFields: string[];     // fields that couldn't be extracted
}

export interface ExtractionResult {
  type: 'single' | 'multiple';
  product?: ExtractedProductData;
  products?: ExtractedProductData[];
  totalFound?: number;
  extractionMeta?: ExtractionMeta;
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
  // Log the final normalized extraction result
  logger.info('Final extraction result', {
    url,
    type: result.type,
    json: JSON.stringify(result, null, 2),
  });

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

/* ─── Canonical category taxonomy ──────────────────── */

// Hierarchical taxonomy: parent > child.
// Each leaf maps keywords used for inference AND normalization of LLM output.
const CATEGORY_TAXONOMY: Array<{
  canonical: string;       // "Living Room > Sofas"
  leaf: string;            // "Sofas" — used for flat display when parent is unknown
  keywords: string[];      // Match against, sorted longest-first internally
}> = [
  // Living Room
  { canonical: 'Living Room > Sofas', leaf: 'Sofas', keywords: ['sofa', 'couch', 'sectional', 'loveseat', 'settee', 'sleeper sofa', 'futon'] },
  { canonical: 'Living Room > Armchairs', leaf: 'Armchairs', keywords: ['armchair', 'arm chair', 'accent chair', 'lounge chair', 'club chair', 'wingback'] },
  { canonical: 'Living Room > Coffee Tables', leaf: 'Coffee Tables', keywords: ['coffee table', 'cocktail table'] },
  { canonical: 'Living Room > Side Tables', leaf: 'Side Tables', keywords: ['side table', 'end table', 'accent table', 'occasional table'] },
  { canonical: 'Living Room > Console Tables', leaf: 'Console Tables', keywords: ['console table', 'entry table', 'entryway table', 'hall table', 'sofa table'] },
  { canonical: 'Living Room > TV Units', leaf: 'TV Units', keywords: ['tv unit', 'tv stand', 'media console', 'entertainment center', 'tv cabinet'] },
  { canonical: 'Living Room > Ottomans', leaf: 'Ottomans', keywords: ['ottoman', 'pouf', 'pouffe', 'footstool', 'footrest'] },
  // Dining
  { canonical: 'Dining > Dining Tables', leaf: 'Dining Tables', keywords: ['dining table', 'dining set', 'dinner table', 'kitchen table'] },
  { canonical: 'Dining > Dining Chairs', leaf: 'Dining Chairs', keywords: ['dining chair', 'side chair'] },
  { canonical: 'Dining > Bar Stools', leaf: 'Bar Stools', keywords: ['bar stool', 'barstool', 'counter stool', 'bar chair'] },
  { canonical: 'Dining > Benches', leaf: 'Benches', keywords: ['dining bench', 'bench'] },
  { canonical: 'Dining > Buffets & Sideboards', leaf: 'Buffets & Sideboards', keywords: ['credenza', 'sideboard', 'buffet', 'hutch'] },
  // Bedroom
  { canonical: 'Bedroom > Beds', leaf: 'Beds', keywords: ['bed', 'bedframe', 'bed frame', 'headboard', 'platform bed', 'canopy bed', 'bunk bed'] },
  { canonical: 'Bedroom > Nightstands', leaf: 'Nightstands', keywords: ['nightstand', 'night stand', 'bedside table', 'night table'] },
  { canonical: 'Bedroom > Dressers', leaf: 'Dressers', keywords: ['dresser', 'chest of drawers', 'tallboy'] },
  { canonical: 'Bedroom > Wardrobes', leaf: 'Wardrobes', keywords: ['wardrobe', 'armoire', 'closet'] },
  // Office
  { canonical: 'Office > Desks', leaf: 'Desks', keywords: ['desk', 'writing desk', 'standing desk', 'computer desk', 'work table'] },
  { canonical: 'Office > Office Chairs', leaf: 'Office Chairs', keywords: ['office chair', 'task chair', 'desk chair', 'executive chair'] },
  // Storage
  { canonical: 'Storage > Shelving', leaf: 'Shelving', keywords: ['bookshelf', 'bookcase', 'book shelf', 'book case', 'étagère', 'etagere', 'shelf unit'] },
  { canonical: 'Storage > Cabinets', leaf: 'Cabinets', keywords: ['storage', 'cabinet', 'storage cabinet'] },
  // Lighting
  { canonical: 'Lighting > Table Lamps', leaf: 'Table Lamps', keywords: ['table lamp', 'desk lamp'] },
  { canonical: 'Lighting > Floor Lamps', leaf: 'Floor Lamps', keywords: ['floor lamp', 'standing lamp'] },
  { canonical: 'Lighting > Chandeliers', leaf: 'Chandeliers', keywords: ['chandelier'] },
  { canonical: 'Lighting > Pendants', leaf: 'Pendants', keywords: ['pendant', 'pendant light'] },
  { canonical: 'Lighting > Sconces', leaf: 'Sconces', keywords: ['sconce', 'wall sconce', 'wall lamp'] },
  { canonical: 'Lighting > Lighting', leaf: 'Lighting', keywords: ['lamp', 'light fixture'] },
  // Decor & Accessories
  { canonical: 'Decor > Mirrors', leaf: 'Mirrors', keywords: ['mirror', 'wall mirror', 'floor mirror', 'vanity mirror'] },
  { canonical: 'Decor > Rugs', leaf: 'Rugs', keywords: ['rug', 'carpet', 'area rug', 'runner'] },
  { canonical: 'Decor > Accessories', leaf: 'Accessories', keywords: ['accessory', 'vase', 'throw', 'pillow', 'blanket', 'planter', 'basket'] },
  // Outdoor
  { canonical: 'Outdoor > Outdoor Furniture', leaf: 'Outdoor Furniture', keywords: ['outdoor', 'patio', 'garden furniture', 'adirondack'] },
  // Generic fallbacks (must be LAST — short keywords match broadly)
  { canonical: 'Chairs', leaf: 'Chairs', keywords: ['chair', 'folding chair', 'stacking chair'] },
  { canonical: 'Tables', leaf: 'Tables', keywords: ['table'] },
];

// Build a flat lookup sorted by keyword length descending for inference
const _sortedTaxonomyEntries = CATEGORY_TAXONOMY.flatMap(entry =>
  entry.keywords.map(kw => ({ keyword: kw, canonical: entry.canonical, leaf: entry.leaf }))
).sort((a, b) => b.keyword.length - a.keyword.length);

function inferCategoryFromText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const { keyword, canonical } of _sortedTaxonomyEntries) {
    if (lower.includes(keyword)) return canonical;
  }
  return null;
}

// Normalize a free-text category (from LLM) to canonical taxonomy.
// If the LLM already returned a hierarchical format like "Bedroom > Beds", validate it.
// Otherwise, match against keywords to find the canonical form.
function normalizeCategoryToTaxonomy(raw: string): string {
  const trimmed = raw.trim();

  // If it already matches a canonical form exactly, keep it
  if (CATEGORY_TAXONOMY.some(e => e.canonical === trimmed)) return trimmed;

  // If it's hierarchical (contains ">"), check if the leaf matches
  if (trimmed.includes('>')) {
    const leaf = trimmed.split('>').pop()?.trim().toLowerCase() ?? '';
    for (const entry of CATEGORY_TAXONOMY) {
      if (entry.leaf.toLowerCase() === leaf || entry.canonical.toLowerCase() === trimmed.toLowerCase()) {
        return entry.canonical;
      }
    }
    // Hierarchical but not in taxonomy — try matching the leaf against keywords
    for (const { keyword, canonical } of _sortedTaxonomyEntries) {
      if (leaf.includes(keyword)) return canonical;
    }
    // Unknown hierarchy — keep as-is (the LLM might know something we don't)
    return trimmed;
  }

  // Flat category — match against keywords
  const lower = trimmed.toLowerCase();
  for (const { keyword, canonical } of _sortedTaxonomyEntries) {
    if (lower.includes(keyword)) return canonical;
  }

  // No match — return as-is
  return trimmed;
}

/* ─── System prompt ──────────────────────────────────── */

const SYSTEM_PROMPT = `You are a furniture product data extractor for an interior design trade platform.

You receive structured signals extracted from a product page (meta tags, JSON-LD, breadcrumbs, dimensions, body text, etc.).
Respond with ONLY a valid JSON object. No markdown, no explanation, no extra text.

REQUIRED — always include these fields:
- productName: the product name. Use og:title or JSON-LD name. Strip " | Brand" or " - Site Name" suffixes from titles.
- category: furniture category. Use breadcrumbs for hierarchical format (e.g. "Dining > Dining Tables", "Bedroom > Beds"). If no breadcrumbs, use one of: Sofa, Dining Table, Bed, Desk, Storage, Lighting, Armchair, Side Table, Bookshelf, Mirror, Rug, Wardrobe, TV Unit, Coffee Table, Console Table, Bar Stool, Ottoman, Bench, Dresser, Nightstand, Chair, Table, Outdoor, Accessories
- currency: three-letter ISO code (e.g. "USD"). Infer from site domain or currency symbols. Default "USD".

CRITICAL — activeVariant: The selected variant for the URL being scraped.
Extract finish/fabric/color + size + price for the currently selected variant.
  - PRICE PRIORITY ORDER:
    1. selected_variant_price (if present — EXACT price for the URL's variant)
    2. JSON-LD price or itemprop_price
    3. og:price or product:price:amount meta tags
  Example: { "finish": "ANTIQUE BLONDE", "size": "78\\"", "price": 6200.00 }

CRITICAL — pricing: Full pricing matrix of ALL variants with their prices.
If shopify_pricing_matrix is present, use it DIRECTLY as the pricing array — it is the authoritative, pre-built matrix.
Otherwise, extract every combination of options and its price from the page.
Each pricing entry should use the SAME option keys as availableOptions types (lowercased).
If only one variant/price is available, return a single-entry array.
Example:
"pricing": [
  { "finish": "Walnut", "size": "Queen", "configuration": "Headboard", "price": 1995.00 },
  { "finish": "Natural", "size": "Queen", "configuration": "Headboard", "price": 1995.00 },
  { "finish": "Walnut", "size": "King", "configuration": "Headboard", "price": 2195.00 }
]

CRITICAL — images: Extract product image URLs.
  - primary: main product image (prefer og:image, then JSON-LD image, then twitter:image). Must start with https://. CDN query params are valid.
  - gallery: array of additional image URLs if available
  - note: any relevant note about image availability (e.g. "Full gallery requires headless browser")
  null only if truly no image signal exists.

CRITICAL — availableOptions: ALL customizable product options/variants as an array.
Each option has a "type" (the category label) and "values" (array of available choices).
IMPORTANT: Use the option label EXACTLY as it appears on the page or in shopify_options. Do NOT merge or rename option types.
For example, if the page has separate "Finish" and "Color" selectors, keep them as two separate entries — do NOT merge them.
If shopify_options is present, use it as the authoritative source for option types and values.
Only include options with 2+ values.
IMPORTANT: Furniture products commonly have these option axes — scan for ALL of them:
  - Configuration (e.g. "Headboard", "Frame", "With Storage")
  - Size (e.g. "Queen", "King", "Full")
  - Finish / Color (e.g. "Walnut", "Natural", "Espresso", "Grey") — look for color swatches, finish selectors, wood tone options
  - Fabric / Upholstery (e.g. "Linen", "Velvet", "Leather")
  - Material — ONLY if the user can SELECT between different materials (e.g. "Wood" vs "Metal" vs "Marble" as a chooser).
    Do NOT add Material as an availableOption when the page simply DESCRIBES what the product is made of (e.g. "hardwood frame, polyester fabric, oak legs").
    Component materials belong in the "materials" object, not in availableOptions.
Do NOT miss finish/color options — these are among the most common product variants for furniture.
If the body_text or page mentions multiple finishes/colors (even as text like "Available in Walnut, Natural, Espresso, and Grey"), extract them as an availableOptions entry.
Example: [{ "type": "Finish", "values": ["Walnut", "Natural", "Espresso", "Grey"] }, { "type": "Size", "values": ["Queen", "King"] }, { "type": "Configuration", "values": ["Headboard", "Frame"] }]

CRITICAL — features: Array of product feature bullet points. Extract from product description, feature lists, or specification sections.
Do NOT include availability info (colors, sizes, "Available in...") here.
Example: ["Handcrafted by Italian artisans from solid poplar wood", "Includes two 20\\" leaves"]

CRITICAL — materials: Structured object describing product materials. Use specific keys:
  - primary: main material (e.g. "Solid poplar wood")
  - frame: frame material if different
  - upholstery: upholstery/fabric material
  - hardware: hardware material (e.g. "Antiqued brass")
  - finish_coating: finish or coating type
  - certifications: array of certifications (e.g. ["Sustainably certified", "Crypton® Home"])
Include only the keys that are relevant to the product.

CRITICAL — dimensions are essential for interior design. Extract them aggressively:
- ALWAYS scan the full page text for "Dimensions" or "Overall Dimensions" first.
- dimensions: { length, width, height, depth, weight, unit, raw }
  - unit must be "in", "cm", or "ft"
  - "raw" is the original dimension text from the page
  - DIMENSION SIGNAL PRIORITY ORDER:
    0. explicit_dimensions_label — most authoritative
    1. dim_labelled signals — pre-parsed from page
    2. dim_label signals — individual labelled measurements
    3. dim_WxDxH / dim_overall — structured patterns
    4. shopify_body_text or spec_sections
    5. dim_LxWxH — plain triplet patterns (less reliable)
  - Do NOT confuse variant/size names with physical dimensions.
  - NEVER skip dimensions if any dim_* signal exists.

OPTIONAL — include only when clearly present:
- variantId: platform variant ID (e.g. Shopify variant ID from URL query param)
- sku: SKU or product code
- brandName: manufacturer or brand name
- promotions: array of active promotions (e.g. ["30% off orders of $2,500 or more"])
- shipping: shipping info (e.g. "Free shipping")
- availability: stock status (e.g. "In stock", "Made to order")
- leadTime: delivery lead time string (e.g. "4–6 weeks")
- productUrl: canonical product page URL

IMPORTANT — metadata: Extract ALL useful product details into a "metadata" object:
- description: product description (2-3 sentences max)
- assembly: assembly requirements
- careInstructions: care/maintenance info
- warranty: warranty details
- weightCapacity: weight capacity if mentioned
- style: design style (e.g. "Mid-Century Modern")
- collection: product collection name
- seatHeight, armHeight, seatDepth, legMaterial, cushionType, fabricType
Include any other relevant product details as additional key-value pairs.

For a SINGLE PRODUCT page respond:
{
  "type": "single",
  "product": {
    "productName": "Tuscany Extension Dining Table",
    "brandName": "Arhaus",
    "category": "Dining > Dining Tables",
    "currency": "USD",
    "variantId": "45442855010475",
    "sku": "30T7839EBDKT",
    "activeVariant": { "finish": "ANTIQUE BLONDE", "size": "78\\"", "price": 6200.00 },
    "images": { "primary": "https://cdn.example.com/table.jpg?w=800" },
    "pricing": [
      { "finish": "ANTIQUE BLONDE", "size": "78\\"", "price": 6200.00 },
      { "finish": "ANTIQUE BLONDE", "size": "86\\"", "price": 6700.00 },
      { "finish": "CANALETTO", "size": "78\\"", "price": 6200.00 }
    ],
    "availableOptions": [
      { "type": "Finish", "values": ["ANTIQUE BLONDE", "CANALETTO"] },
      { "type": "Size", "values": ["78\\"", "86\\"", "94\\"", "118\\""] }
    ],
    "features": [
      "Handcrafted by Italian artisans from solid poplar wood",
      "Finished surfaces coated with multiple layers of lacquer"
    ],
    "materials": { "primary": "Solid poplar wood", "hardware": "Antiqued brass", "finish_coating": "Multi-layer lacquer" },
    "dimensions": { "width": 78, "depth": 40, "height": 30, "unit": "in", "raw": "78\\"W x 40\\"D x 30\\"H" },
    "promotions": ["30% off orders of $2,500 or more"],
    "shipping": "Free shipping",
    "availability": "In stock",
    "productUrl": "https://www.arhaus.com/products/tuscany-extension-dining-table",
    "metadata": {
      "description": "Extension dining table handcrafted from solid poplar wood by Italian artisans.",
      "style": "Traditional",
      "assembly": "Legs require attachment"
    }
  }
}

For a COLLECTION/CATEGORY page (multiple products visible) respond:
{
  "type": "multiple",
  "totalFound": 24,
  "products": [
    { "productName": "...", "activeVariant": { "price": 999.00 }, "currency": "USD", "images": { "primary": "https://..." }, "category": "Chair", "productUrl": "https://..." }
  ]
}

Rules:
- activeVariant.price: numeric only, no currency symbols. ALWAYS prefer selected_variant_price. null if absent.
- pricing: if shopify_pricing_matrix is present, use it as-is. Otherwise build the full matrix from variant data. If only one price exists, return [{ "price": N }].
- images.primary: must start with https://. Include CDN query params as-is. Never fabricate a URL.
- category: always infer. Prefer hierarchical (breadcrumb-based) when possible.
- dimensions: THIS IS THE MOST IMPORTANT OPTIONAL FIELD. Use dim_labelled and dim_label first. Always include "raw".
- features: extract ALL feature bullet points. Do NOT include availability info.
- materials: extract structured material breakdown, not just the primary material string.
- availableOptions: ONLY include actual product variant/customization options (Size, Color, Finish, Fabric, Material, Configuration, Leg, etc.).
  Do NOT include website UI elements, navigation controls, or page actions such as:
  "Selection Summary", "Location Menu", "Add to Cart", "Save for Later", "Zip Code", "Close Menu", "Quantity", "Share", "Wishlist".
  If an option's values contain the product name itself or action labels (e.g. "Save for Later", "Add to Bag"), it is NOT a product option — exclude it entirely.
  Also exclude option values like "N options available", "and N other options", "View all", "See more" — these are UI hints, not selectable variants.
  If you can only see a subset of values (e.g. "Natural" + "and 3 other options"), only include the actual values you can see, not the placeholder text.
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

/* ─── Headless browser fetch (browserless sidecar) ──── */

interface BrowserExtraction {
  productText: string;     // Text from the product content area
  dimensionText: string;   // Text specifically near dimension/spec sections
  fullBodyText: string;    // Full page innerText (stripped of nav/footer)
}

async function fetchRenderedContent(url: string): Promise<BrowserExtraction | null> {
  const wsEndpoint = config.browserWsEndpoint;
  if (!wsEndpoint) {
    logger.info('Browser WS endpoint not configured — skipping rendered fetch');
    return null;
  }

  let browser: Awaited<ReturnType<typeof puppeteer.connect>> | null = null;
  try {
    browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    );

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 20_000 });

    // Click all buttons/tabs that might reveal dimension content
    try {
      await page.evaluate(`(() => {
        try {
          var kw = /dimension|specification|spec|measurement|detail|size/i;
          document.querySelectorAll('button, [role="tab"], summary, a[data-tab]').forEach(function(el) {
            try { if (kw.test(el.innerText || '')) el.click(); } catch(e) {}
          });
        } catch(e) {}
      })()`);
      await new Promise((r) => setTimeout(r, 2000));
    } catch {
      // Best-effort — continue regardless
    }

    // Extract clean text content from the rendered page
    const extraction: BrowserExtraction = await page.evaluate(`(() => {
      try {
        // Remove noise elements
        var noiseSelectors = 'nav, header, footer, [role="navigation"], [role="banner"], script, style, noscript, svg, iframe';
        document.querySelectorAll(noiseSelectors).forEach(function(el) { try { el.remove(); } catch(e) {} });

        // Get full cleaned body text
        var bodyText = (document.body.innerText || '').slice(0, 50000);

        // Find dimension-specific text by searching for headings/labels containing keywords
        var dimParts = [];
        var kw = /dimension|specification|measurement|overall.size/i;
        document.querySelectorAll('h1, h2, h3, h4, h5, h6, dt, th, label, summary, button, span, p, div').forEach(function(el) {
          try {
            var t = (el.innerText || '').trim();
            if (t.length > 3 && t.length < 200 && kw.test(t)) {
              var parent = el.closest('section, div, table, dl, details, article');
              if (parent) {
                var pt = (parent.innerText || '').trim();
                if (pt.length > 10 && pt.length < 5000) dimParts.push(pt);
              }
            }
          } catch(e) {}
        });

        // Get main product area text
        var productText = '';
        var pSels = ['main', '[role="main"]', 'article', '#product', '#main-content'];
        for (var i = 0; i < pSels.length; i++) {
          var el = document.querySelector(pSels[i]);
          if (el && (el.innerText || '').length > 100) {
            productText = (el.innerText || '').slice(0, 30000);
            break;
          }
        }

        var unique = dimParts.filter(function(v, i, a) { return a.indexOf(v) === i; });
        return {
          productText: productText,
          dimensionText: unique.join('\\n---\\n').slice(0, 10000),
          fullBodyText: bodyText
        };
      } catch(e) {
        return { productText: '', dimensionText: '', fullBodyText: (document.body.innerText || '').slice(0, 50000) };
      }
    })()`) as BrowserExtraction;

    await page.close();
    browser.disconnect();

    logger.info('Rendered content extracted via headless browser', {
      url,
      productTextLen: extraction.productText.length,
      dimensionTextLen: extraction.dimensionText.length,
      fullBodyTextLen: extraction.fullBodyText.length,
    });

    return extraction;
  } catch (err: any) {
    logger.warn('fetchRenderedContent failed', { url, err: err?.message });
    if (browser) {
      try { browser.disconnect(); } catch {}
    }
    return null;
  }
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

type DimensionUnitRaw = 'in' | 'cm' | 'ft' | 'mm' | 'm';

function parseNumberToken(raw: string): number | null {
  if (!raw) return null;
  const t = raw.trim().replace(/,/g, '').toLowerCase();

  // 68-1/2 or 68 1/2
  const mixed = t.match(/^(\d+)(?:\s+|-)(\d+)\/(\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const num = Number(mixed[2]);
    const den = Number(mixed[3]);
    if (den !== 0) return whole + num / den;
  }

  // 1/2
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    const num = Number(frac[1]);
    const den = Number(frac[2]);
    if (den !== 0) return num / den;
  }

  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function detectUnit(text: string): DimensionUnitRaw {
  const t = text.toLowerCase();
  // Check mm before m to avoid false "m" matches on "mm"
  if (/\bmm\b|millimeters?/.test(t)) return 'mm';
  if (/\bcm\b|centimeters?/.test(t)) return 'cm';
  if (/\bft\b|feet|foot/.test(t)) return 'ft';
  if (/\bm\b|meters?/.test(t)) return 'm';
  return 'in';
}

function normalizeDimensionsObject(
  dims: ExtractedProductData['dimensions'] | null | undefined,
): ExtractedProductData['dimensions'] | null {
  if (!dims) return null;

  const out: ExtractedProductData['dimensions'] = { ...dims };
  const rawUnit = (dims.unit as DimensionUnitRaw | undefined) ?? (dims.raw ? detectUnit(dims.raw) : undefined);

  if (rawUnit === 'mm') {
    if (out.length != null) out.length = out.length / 10;
    if (out.width != null) out.width = out.width / 10;
    if (out.height != null) out.height = out.height / 10;
    if (out.depth != null) out.depth = out.depth / 10;
    out.unit = 'cm';
  } else if (rawUnit === 'm') {
    if (out.length != null) out.length = out.length * 100;
    if (out.width != null) out.width = out.width * 100;
    if (out.height != null) out.height = out.height * 100;
    if (out.depth != null) out.depth = out.depth * 100;
    out.unit = 'cm';
  } else if (rawUnit === 'in' || rawUnit === 'cm' || rawUnit === 'ft') {
    out.unit = rawUnit;
  }

  return Object.keys(out).length > 0 ? out : null;
}

function hasPrimaryDimensions(dims?: ExtractedProductData['dimensions'] | null): boolean {
  if (!dims) return false;
  return Boolean(dims.width || dims.height || dims.depth || dims.length);
}

function extractDimensionContextBlocks(html: string): string[] {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:p|li|tr|td|th|dt|dd|h[1-6]|section|article|div|table|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#\d+;/g, ' ')
    .replace(/\r/g, '');

  const lines = cleaned
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const headingRx = /\b(?:overall\s+)?(?:dimensions?|measurements?|specifications?|specs)\b/i;
  const measurementRx =
    /(\d+(?:\.\d+)?(?:\s+|-)\d+\/\d+|\d+(?:\.\d+)?(?:\s*["″']|\s*(?:in(?:ches)?|cm|mm|ft|m))|\d+(?:\.\d+)?\s*[x×X]\s*\d+(?:\.\d+)?(?:\s*[x×X]\s*\d+(?:\.\d+)?)?)/i;

  const blocks: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!headingRx.test(line)) continue;

    const block = [line, lines[i + 1] ?? '', lines[i + 2] ?? '']
      .filter(Boolean)
      .join(' | ')
      .slice(0, 500);

    if (!measurementRx.test(block)) continue;
    const key = block.slice(0, 120).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    blocks.push(block);
    if (blocks.length >= 30) break;
  }

  return blocks;
}

/* ─── Aggressive dimension extraction ───────────────── */

function extractDimensionsFromText(text: string): string[] {
  const lines: string[] = [];

  const isLikelyPhysicalDimension = (value: number, context: string): boolean => {
    if (!Number.isFinite(value) || value <= 0) return false;
    const unit = detectUnit(context);
    if (unit === 'in') return value <= 240;
    if (unit === 'ft') return value <= 25;
    if (unit === 'cm') return value <= 700;
    if (unit === 'mm') return value <= 7000;
    if (unit === 'm') return value <= 7;
    // No clear unit: be conservative to avoid pixel values.
    return value <= 130;
  };

  // Pattern 1: W x D x H with unit markers — e.g. 84"W x 38"D x 34"H
  const wdhQuote =
    /(\d+(?:[.\-\/]\d+)?)\s*["″'']\s*[Ww]\s*[x×X]\s*(\d+(?:[.\-\/]\d+)?)\s*["″'']\s*[Dd]\s*[x×X]\s*(\d+(?:[.\-\/]\d+)?)\s*["″'']\s*[Hh]/g;
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
  // Require at least one number to be > 1 and a unit marker or quote to avoid false positives
  const lwhPlain =
    /(\d+(?:\.\d+)?)\s*["″]?\s*[x×X]\s*(\d+(?:\.\d+)?)\s*["″]?\s*[x×X]\s*(\d+(?:\.\d+)?)\s*(?:["″]|in(?:ches)?|cm|mm|ft)/g;
  for (const m of text.matchAll(lwhPlain)) {
    const key = `${m[1]}x${m[2]}x${m[3]}`;
    if (!lines.some((l) => l.includes(key) || l.includes(`${m[1]}W`))) {
      lines.push(`dim_LxWxH: ${m[1]} x ${m[2]} x ${m[3]}`);
    }
  }

  // Pattern 4: Individual dimension labels — e.g. Width: 84", Height: 34 inches, Width 22"
  const labelPattern =
    /(?:overall\s+)?(?:width|length|height|depth|seat\s*height|seat\s*depth|arm\s*height|diameter)\s*(?::|\b)\s*(\d+(?:\.\d+)?)\s*(?:["″]|in(?:ches)?|cm|mm|ft|m)?/gi;
  for (const m of text.matchAll(labelPattern)) {
    const val = Number(m[1]);
    if (!isLikelyPhysicalDimension(val, m[0])) continue;
    lines.push(`dim_label: ${m[0].trim()}`);
  }

  // Pattern 4b: Labelled dimensions with " prefix — e.g. 22" Width x 5" Depth x 22" Height
  const labelAfterNum =
    /(\d+(?:\.\d+)?)\s*["″]?\s*(?:width|length|height|depth|diameter)\s*[x×X]\s*(\d+(?:\.\d+)?)\s*["″]?\s*(?:width|length|height|depth|diameter)(?:\s*[x×X]\s*(\d+(?:\.\d+)?)\s*["″]?\s*(?:width|length|height|depth|diameter))?/gi;
  for (const m of text.matchAll(labelAfterNum)) {
    lines.push(`dim_labelled: ${m[0].trim()}`);
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

  // Pattern 8: Dimensions with "Overall" prefix — e.g. "Overall 68.5"w x 85"d x 54"h"
  const overallPattern =
    /overall\s*(?:dimensions?\s*)?[:=]?\s*(\d+(?:\.\d+)?)\s*["″]?\s*[Ww]?\s*[x×X]\s*(\d+(?:\.\d+)?)\s*["″]?\s*[Dd]?\s*[x×X]\s*(\d+(?:\.\d+)?)\s*["″]?\s*[Hh]?/gi;
  for (const m of text.matchAll(overallPattern)) {
    if (!lines.some((l) => l.includes(`${m[1]}`) && l.includes(`${m[2]}`))) {
      lines.push(`dim_overall: ${m[1]}W x ${m[2]}D x ${m[3]}H`);
    }
  }

  // Pattern 9: Two-value dimensions — e.g. "68.5 x 85" (common for tables, rugs)
  // Only match when followed by a unit indicator to avoid matching variant names
  const twoDim =
    /(\d+(?:\.\d+)?)\s*["″]\s*[x×X]\s*(\d+(?:\.\d+)?)\s*["″]\s*(?:in(?:ches)?|cm|ft)?/g;
  for (const m of text.matchAll(twoDim)) {
    const n1 = m[1], n2 = m[2];
    // Skip if both numbers are the same (likely a size name like "22 x 22") unless they have unit markers
    if (n1 === n2 && !m[0].includes('in') && !m[0].includes('cm')) continue;
    if (!lines.some((l) => l.includes(n1) && l.includes(n2))) {
      lines.push(`dim_2d: ${n1} x ${n2}`);
    }
  }

  // Pattern 10: Fraction dimensions — e.g. 68-1/2" or 68 1/2"
  const fractionDim =
    /(\d+)[\s-](\d+\/\d+)\s*["″]?\s*[x×X]\s*(\d+)(?:[\s-](\d+\/\d+))?\s*["″]?\s*(?:[x×X]\s*(\d+)(?:[\s-](\d+\/\d+))?\s*["″]?)?/g;
  for (const m of text.matchAll(fractionDim)) {
    lines.push(`dim_fraction: ${m[0].trim()}`);
  }

  return lines;
}

/* ─── Extract variant ID from URL ────────────────────── */

function extractVariantId(url: string): string | null {
  try {
    const u = new URL(url);
    return u.searchParams.get('variant');
  } catch {
    return null;
  }
}

/* ─── Extract embedded product JSON from script tags ── */

function extractEmbeddedProductJson(html: string, url: string): string[] {
  const lines: string[] = [];
  const variantId = extractVariantId(url);

  // ── Shopify-style embedded product data ───────────────
  // Sites embed product JSON in many patterns — try them all
  const shopifyPatterns: Array<{ re: RegExp; extract: (m: RegExpMatchArray) => any }> = [
    // var meta = {"product": {...}}
    { re: /var\s+meta\s*=\s*(\{[\s\S]*?"product"[\s\S]*?\});/, extract: (m) => { const d = JSON.parse(m[1]); return d.product ?? d; } },
    // window.customerHub.activeProduct = {...}  (Arhaus, etc.)
    { re: /customerHub\.activeProduct\s*=\s*(\{[\s\S]*?"variants"[\s\S]*?\});/, extract: (m) => JSON.parse(m[1]) },
    // window.customerHub = {..., activeProduct: {...}}
    { re: /window\.customerHub\s*=\s*(\{[\s\S]*?"activeProduct"[\s\S]*?\});/, extract: (m) => { const d = JSON.parse(m[1]); return d.activeProduct ?? d; } },
    // "product": {..., "variants": [...]}  (generic Shopify)
    { re: /"product"\s*:\s*(\{[\s\S]*?"variants"\s*:\s*\[[\s\S]*?\][\s\S]*?\})\s*[,;}\]]/, extract: (m) => JSON.parse(m[1]) },
    // productView or productData assignments
    { re: /(?:productView|productData|__product)\s*=\s*(\{[\s\S]*?"variants"[\s\S]*?\});/, extract: (m) => JSON.parse(m[1]) },
  ];

  let foundProduct = false;

  for (const { re, extract } of shopifyPatterns) {
    if (foundProduct) break;
    const match = html.match(re);
    if (!match) continue;

    try {
      const product = extract(match);
      if (!product) continue;
      foundProduct = true;

      // Extract dimensions from product body_html / description
      const bodyHtml = product.body_html ?? product.description_html ?? product.descriptionHtml ?? '';
      if (bodyHtml) {
        const dimFromBody = extractDimensionsFromText(bodyHtml);
        lines.push(...dimFromBody.map((d) => `shopify_${d}`));
        // Also extract clean text from body for dimension labels
        const bodyText = bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (bodyText.length > 20 && bodyText.length < 3000) {
          lines.push(`shopify_body_text: ${bodyText.slice(0, 1500)}`);
        }
      }

      // ── Extract product.options (option axes: Configuration, Size, Finish, etc.) ──
      const optionNames: string[] = [];
      if (product.options && Array.isArray(product.options)) {
        const structuredOptions: Array<{ name: string; values: string[] }> = [];
        for (const opt of product.options) {
          const name = opt.name ?? opt.label ?? '';
          const values: string[] = Array.isArray(opt.values)
            ? opt.values.map((v: any) => typeof v === 'string' ? v : (v?.label ?? v?.value ?? String(v))).filter(Boolean)
            : [];
          if (name && values.length > 0) {
            optionNames.push(name);
            structuredOptions.push({ name, values });
          }
        }
        if (structuredOptions.length > 0) {
          lines.push(`shopify_options: ${JSON.stringify(structuredOptions)}`);
        }
      }

      // ── Extract variant-specific data + build full pricing matrix ──
      if (product.variants && Array.isArray(product.variants)) {
        // If URL has a variant ID, find the matching variant for accurate price
        if (variantId) {
          const selectedVariant = product.variants.find(
            (v: any) => String(v.id) === variantId || String(v.id).endsWith(variantId),
          );
          if (selectedVariant) {
            const vPrice = selectedVariant.price ?? selectedVariant.priceV2?.amount;
            const vTitle = selectedVariant.title ?? selectedVariant.name ?? '';
            // Shopify sometimes stores price in cents
            const priceNum = typeof vPrice === 'string' ? parseFloat(vPrice) : Number(vPrice);
            const normalizedPrice = priceNum > 10000 ? priceNum / 100 : priceNum; // cents → dollars
            lines.push(`selected_variant_price: ${normalizedPrice}`);
            lines.push(`selected_variant_title: ${vTitle}`);
            if (selectedVariant.sku) lines.push(`selected_variant_sku: ${selectedVariant.sku}`);
          }
        }

        // Build full pricing matrix from ALL variants using option names
        // Shopify variants have option1, option2, option3 that map to product.options[0], [1], [2]
        const pricingMatrix: Array<Record<string, string | number>> = [];
        for (const v of product.variants) {
          const vPrice = v.price ?? v.priceV2?.amount;
          const priceNum = typeof vPrice === 'string' ? parseFloat(vPrice) : Number(vPrice);
          const normalizedPrice = priceNum > 10000 ? priceNum / 100 : priceNum;
          if (isNaN(normalizedPrice) || normalizedPrice <= 0) continue;

          const entry: Record<string, string | number> = {};
          // Map option1/option2/option3 to their named axes
          for (let i = 0; i < optionNames.length; i++) {
            const val = v[`option${i + 1}`];
            if (val != null) {
              entry[optionNames[i].toLowerCase()] = String(val);
            }
          }
          entry.price = normalizedPrice;
          pricingMatrix.push(entry);
        }

        if (pricingMatrix.length > 0) {
          lines.push(`shopify_pricing_matrix: ${JSON.stringify(pricingMatrix)}`);
        }

        // Log first few variant titles for AI context (fallback if no options)
        if (optionNames.length === 0) {
          for (const v of product.variants.slice(0, 8)) {
            const vPrice = v.price ?? v.priceV2?.amount;
            const priceNum = typeof vPrice === 'string' ? parseFloat(vPrice) : Number(vPrice);
            const normalizedPrice = priceNum > 10000 ? priceNum / 100 : priceNum;
            const title = v.title ?? v.name ?? v.option1 ?? '';
            lines.push(`variant: ${title} | $${normalizedPrice}`);
            if (v.weight) lines.push(`variant_weight: ${v.weight}${v.weight_unit ?? 'g'}`);
          }
        }
      }

      // Extract product-level dimensions/specs if present
      if (product.dimensions) {
        lines.push(`shopify_dimensions: ${typeof product.dimensions === 'object' ? JSON.stringify(product.dimensions) : product.dimensions}`);
      }
      if (product.metafields && Array.isArray(product.metafields)) {
        for (const mf of product.metafields) {
          const key = mf.key ?? mf.namespace ?? '';
          if (/dimension|spec|size|weight|width|height|depth/i.test(key)) {
            lines.push(`shopify_metafield_${key}: ${mf.value}`);
          }
        }
      }
    } catch { /* ignore parse failures */ }
  }

  // ── Next.js / React hydration data ────────────────────
  const hydrationPatterns = [
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
    /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/,
    /window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});/,
  ];

  for (const pattern of hydrationPatterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        const dimText = extractDimensionFieldsFromJson(data);
        if (dimText) lines.push(`embedded_dimensions: ${dimText}`);

        // Also extract options/variants from hydration data (Next.js, etc.)
        if (!foundProduct) {
          const hydrationOptions = extractOptionsFromHydrationData(data);
          if (hydrationOptions.length > 0) {
            lines.push(`shopify_options: ${JSON.stringify(hydrationOptions)}`);
          }
          const hydrationPricing = extractPricingFromHydrationData(data, variantId);
          lines.push(...hydrationPricing);
        }
      } catch { /* ignore parse failures */ }
    }
  }

  // ── HTML DOM option selectors (ALWAYS supplementary — never replaces LLM/Shopify options) ──
  const domOptions = extractOptionsFromHtmlDom(html);
  if (domOptions.length > 0) {
    lines.push(`dom_options: ${JSON.stringify(domOptions)}`);
  }

  return lines;
}

/* ─── Extract product options from HTML DOM selectors ── */

function extractOptionsFromHtmlDom(html: string): Array<{ name: string; values: string[] }> {
  const options: Array<{ name: string; values: string[] }> = [];
  const seen = new Set<string>();

  // Filter out instruction-like labels ("Select a color", "Choose your size", etc.)
  // and clean them to extract the actual option name.
  const cleanOptionName = (raw: string): string => {
    let name = raw.trim();
    // Remove instruction prefixes: "Select a color or finish" → "color or finish" → "Finish"
    name = name.replace(/^(?:select|choose|pick|change)\s+(?:a|an|your|the)?\s*/i, '');
    // "color or finish" → take the last word as the canonical name
    if (/\bor\b/i.test(name)) {
      const parts = name.split(/\s+or\s+/i);
      name = parts[parts.length - 1].trim();
    }
    // Remove trailing colons, question marks
    name = name.replace(/[:\?]+$/, '').trim();
    // If what's left is too short or still looks like an instruction, reject it
    if (name.length < 2 || /^(select|choose|pick|option|variant)\s*$/i.test(name)) return '';
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  // Pattern 1: <select> elements with option-related names/labels
  // e.g. <select name="finish"><option>Walnut</option><option>Natural</option>...</select>
  const selectRegex = /<(?:label[^>]*>([^<]{1,60})<\/label>\s*)?<select[^>]*(?:name|id|data-option|aria-label)=["']([^"']{1,100})["'][^>]*>([\s\S]*?)<\/select>/gi;
  let m: RegExpExecArray | null;
  while ((m = selectRegex.exec(html)) !== null) {
    const rawName = m[1]?.trim() || m[2]?.trim() || '';
    const name = cleanOptionName(rawName);
    if (!name || seen.has(name.toLowerCase())) continue;
    const optionValues: string[] = [];
    const optRegex = /<option[^>]*(?:value=["']([^"']{1,100})["'])?[^>]*>([^<]{1,100})<\/option>/gi;
    let optMatch: RegExpExecArray | null;
    while ((optMatch = optRegex.exec(m[3])) !== null) {
      const val = (optMatch[2] || optMatch[1] || '').trim();
      if (val && val !== '' && !/select|choose|pick/i.test(val)) {
        optionValues.push(val);
      }
    }
    if (optionValues.length > 0) {
      seen.add(name.toLowerCase());
      options.push({ name, values: optionValues });
    }
  }

  // Pattern 2: Swatch/button groups with data-option-type or data-option-name
  // e.g. <div data-option-name="Finish"><button data-value="Walnut">...
  const swatchGroupRegex =
    /<(?:div|fieldset|ul)[^>]*(?:data-option-(?:name|type|index)|data-product-option|aria-label)=["']([^"']{1,100})["'][^>]*>([\s\S]*?)<\/(?:div|fieldset|ul)>/gi;
  while ((m = swatchGroupRegex.exec(html)) !== null) {
    const name = cleanOptionName(m[1]);
    if (!name || seen.has(name.toLowerCase()) || /^\d+$/.test(name)) continue;
    const values: string[] = [];
    // Look for value in data-value, data-option-value, aria-label, or button text
    const valRegex = /(?:data-value|data-option-value|data-swatch-value|aria-label)=["']([^"']{1,100})["']/gi;
    let valMatch: RegExpExecArray | null;
    while ((valMatch = valRegex.exec(m[2])) !== null) {
      const val = valMatch[1].trim();
      if (val && !values.includes(val)) values.push(val);
    }
    if (values.length > 0) {
      seen.add(name.toLowerCase());
      options.push({ name, values });
    }
  }

  // Pattern 3: Radio button groups with name containing option keywords
  // e.g. <input type="radio" name="option-finish" value="Walnut">
  const radioGroups = new Map<string, string[]>();
  const radioRegex = /<input[^>]*type=["']radio["'][^>]*name=["']([^"']{1,100})["'][^>]*value=["']([^"']{1,100})["'][^>]*>/gi;
  while ((m = radioRegex.exec(html)) !== null) {
    const name = m[1].trim();
    const val = m[2].trim();
    if (!name || !val) continue;
    if (!radioGroups.has(name)) radioGroups.set(name, []);
    const vals = radioGroups.get(name)!;
    if (!vals.includes(val)) vals.push(val);
  }
  for (const [rawName, values] of radioGroups) {
    if (values.length < 2 || seen.has(rawName.toLowerCase())) continue;
    // Clean up name: "option-finish" → "Finish", "option[Finish]" → "Finish"
    const stripped = rawName.replace(/^option[-_\[]*/i, '').replace(/\]$/, '').trim();
    const cleaned = cleanOptionName(stripped) || stripped;
    if (cleaned) {
      seen.add(cleaned.toLowerCase());
      options.push({ name: cleaned, values });
    }
  }

  // Pattern 4: Button groups where buttons have explicit option labels
  // e.g. <div class="option-group"><span class="option-label">Finish</span><button>Walnut</button>...
  const labeledGroupRegex =
    /<(?:div|fieldset)[^>]*class=["'][^"']*(?:option|variant|selector|swatch)[^"']*["'][^>]*>[\s\S]*?<(?:span|label|div|p|h\d)[^>]*(?:class=["'][^"']*(?:option-label|option-name|variant-label|swatch-label)[^"']*["'])?[^>]*>([^<]{1,60})<\/(?:span|label|div|p|h\d)>([\s\S]*?)<\/(?:div|fieldset)>/gi;
  while ((m = labeledGroupRegex.exec(html)) !== null) {
    const label = cleanOptionName(m[1].replace(/:$/, ''));
    if (!label || seen.has(label.toLowerCase())) continue;
    const btnValues: string[] = [];
    const btnRegex = /<(?:button|a|span)[^>]*>([^<]{1,60})<\/(?:button|a|span)>/gi;
    let btnMatch: RegExpExecArray | null;
    while ((btnMatch = btnRegex.exec(m[2])) !== null) {
      const val = btnMatch[1].trim();
      if (val && val.length > 0 && val.length < 50 && !/select|choose|pick|add|remove/i.test(val)) {
        btnValues.push(val);
      }
    }
    if (btnValues.length >= 2) {
      seen.add(label.toLowerCase());
      options.push({ name: label, values: btnValues });
    }
  }

  return options;
}

/* ─── Extract options from Next.js / React hydration data ── */

function extractOptionsFromHydrationData(data: any, depth = 0): Array<{ name: string; values: string[] }> {
  if (depth > 10 || !data) return [];

  // Look for arrays that look like product options
  if (Array.isArray(data)) {
    // Check if this IS an options array (each item has name + values)
    if (data.length > 0 && data.every((item: any) =>
      item && typeof item === 'object' &&
      (item.name || item.label || item.type || item.title) &&
      (Array.isArray(item.values) || Array.isArray(item.options) || Array.isArray(item.choices))
    )) {
      return data.map((item: any) => ({
        name: String(item.name ?? item.label ?? item.type ?? item.title ?? ''),
        values: (item.values ?? item.options ?? item.choices ?? [])
          .map((v: any) => typeof v === 'string' ? v : (v?.label ?? v?.value ?? v?.name ?? String(v)))
          .filter((v: any) => typeof v === 'string' && v.length > 0),
      })).filter((o: any) => o.name && o.values.length > 0);
    }

    // Recurse into array items
    for (const item of data.slice(0, 20)) {
      const result = extractOptionsFromHydrationData(item, depth + 1);
      if (result.length > 0) return result;
    }
    return [];
  }

  if (typeof data === 'object') {
    // Check keys that commonly hold product options
    const optionKeys = ['options', 'productOptions', 'product_options', 'variantOptions',
      'variant_options', 'configOptions', 'availableOptions'];
    for (const key of optionKeys) {
      if (data[key] && Array.isArray(data[key])) {
        const result = extractOptionsFromHydrationData(data[key], depth + 1);
        if (result.length > 0) return result;
      }
    }

    // Check if this is a product object with options
    if (data.product && typeof data.product === 'object') {
      const result = extractOptionsFromHydrationData(data.product, depth + 1);
      if (result.length > 0) return result;
    }

    // Check pageProps (Next.js pattern)
    if (data.props?.pageProps) {
      const result = extractOptionsFromHydrationData(data.props.pageProps, depth + 1);
      if (result.length > 0) return result;
    }

    // Recurse into all object values
    for (const val of Object.values(data)) {
      if (typeof val === 'object' && val !== null) {
        const result = extractOptionsFromHydrationData(val, depth + 1);
        if (result.length > 0) return result;
      }
    }
  }

  return [];
}

function extractPricingFromHydrationData(data: any, variantId: string | null): string[] {
  const lines: string[] = [];

  // Recursively find a "variants" array
  const findVariants = (obj: any, depth: number): any[] | null => {
    if (depth > 10 || !obj) return null;
    if (Array.isArray(obj)) {
      // Check if this IS a variants array
      if (obj.length > 0 && obj.every((v: any) => v && typeof v === 'object' && (v.price != null || v.priceV2 != null))) {
        return obj;
      }
      for (const item of obj.slice(0, 20)) {
        const r = findVariants(item, depth + 1);
        if (r) return r;
      }
      return null;
    }
    if (typeof obj === 'object') {
      if (obj.variants && Array.isArray(obj.variants)) return obj.variants;
      for (const val of Object.values(obj)) {
        if (typeof val === 'object' && val !== null) {
          const r = findVariants(val, depth + 1);
          if (r) return r;
        }
      }
    }
    return null;
  };

  const variants = findVariants(data, 0);
  if (!variants || variants.length === 0) return lines;

  // Find selected variant
  if (variantId) {
    const selected = variants.find((v: any) => String(v.id) === variantId || String(v.id).endsWith(variantId));
    if (selected) {
      const price = selected.price ?? selected.priceV2?.amount;
      const priceNum = typeof price === 'string' ? parseFloat(price) : Number(price);
      const normalizedPrice = priceNum > 10000 ? priceNum / 100 : priceNum;
      if (!isNaN(normalizedPrice) && normalizedPrice > 0) {
        lines.push(`selected_variant_price: ${normalizedPrice}`);
      }
      const title = selected.title ?? selected.name ?? '';
      if (title) lines.push(`selected_variant_title: ${title}`);
    }
  }

  return lines;
}

/** Recursively search JSON for dimension-related fields */
function extractDimensionFieldsFromJson(obj: any, depth = 0): string {
  if (depth > 8 || !obj) return '';
  const results: string[] = [];
  const dimKeys = /dimension|width|height|depth|length|weight|size|spec|measurement/i;

  if (typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [key, val] of Object.entries(obj)) {
      if (dimKeys.test(key)) {
        if (typeof val === 'string' || typeof val === 'number') {
          results.push(`${key}: ${val}`);
        } else if (typeof val === 'object' && val !== null) {
          results.push(`${key}: ${JSON.stringify(val).slice(0, 300)}`);
        }
      } else if (typeof val === 'object' && val !== null) {
        const nested = extractDimensionFieldsFromJson(val, depth + 1);
        if (nested) results.push(nested);
      }
    }
  } else if (Array.isArray(obj)) {
    for (const item of obj.slice(0, 10)) {
      const nested = extractDimensionFieldsFromJson(item, depth + 1);
      if (nested) results.push(nested);
    }
  }

  return results.join('; ').slice(0, 1000);
}

/* ─── Extract dimension/spec sections from HTML ─────── */

function extractSpecSections(html: string): string {
  const sections: string[] = [];

  // Look for sections with dimension/spec-related class names or IDs
  const sectionPattern =
    /<(?:div|section|table|dl|details)[^>]*(?:class|id|data-[\w-]*)=["'][^"']*(?:dimension|specification|spec|detail|measurement|product-info|product-detail|product-description|product-details-content|tab-content|accordion-content|accordion|pdp-details|product-specs|product-features)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section|table|dl|details)>/gi;

  let match: RegExpExecArray | null;
  while ((match = sectionPattern.exec(html)) !== null) {
    // Strip HTML tags but preserve structure
    const text = match[1]
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&#\d+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > 20 && text.length < 2000) {
      sections.push(text);
    }
  }

  // Also look for table rows with dimension labels
  const rowPattern =
    /<t[dh][^>]*>[^<]*(?:width|height|depth|length|dimension|weight|diameter|overall)[^<]*<\/t[dh]>\s*<t[dh][^>]*>([^<]*)<\/t[dh]>/gi;
  while ((match = rowPattern.exec(html)) !== null) {
    sections.push(`spec_row: ${match[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`);
  }

  // Look for definition list patterns (dt/dd)
  const dlPattern =
    /<dt[^>]*>[^<]*(?:width|height|depth|length|dimension|weight|diameter|overall)[^<]*<\/dt>\s*<dd[^>]*>([^<]*)<\/dd>/gi;
  while ((match = dlPattern.exec(html)) !== null) {
    sections.push(`spec_def: ${match[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`);
  }

  return sections.join('\n').slice(0, 3000);
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

  // Cap at 20000 chars to capture dimension/spec data further down the page
  // (furniture sites often place dimensions in accordion tabs well below the fold)
  if (text.length > 20000) text = text.slice(0, 20000);
  return text;
}

/* ─── Full signal extraction ────────────────────────── */

/* ─── Deterministic Shopify data overlay ─────────────── */
// Parses shopify_options and shopify_pricing_matrix from signal text
// and returns structured data that should override LLM output.

interface ShopifyStructuredData {
  availableOptions: Array<{ type: string; values: string[] }>;
  pricing: Array<Record<string, string | number>>;
}

function extractShopifyStructuredData(signals: string): ShopifyStructuredData | null {
  let options: Array<{ type: string; values: string[] }> | null = null;
  let pricing: Array<Record<string, string | number>> | null = null;

  // Extract shopify_options
  const optionsMatch = signals.match(/^shopify_options:\s*(\[.+\])$/m);
  if (optionsMatch) {
    try {
      const parsed = JSON.parse(optionsMatch[1]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        options = parsed
          .filter((o: any) => o.name && Array.isArray(o.values) && o.values.length > 0)
          .map((o: any) => ({
            type: String(o.name).charAt(0).toUpperCase() + String(o.name).slice(1),
            values: o.values.map((v: any) => String(v)),
          }));
      }
    } catch { /* ignore parse failure */ }
  }

  // Extract shopify_pricing_matrix
  const pricingMatch = signals.match(/^shopify_pricing_matrix:\s*(\[.+\])$/m);
  if (pricingMatch) {
    try {
      const parsed = JSON.parse(pricingMatch[1]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        pricing = parsed.filter(
          (entry: any) => entry && typeof entry === 'object' && typeof entry.price === 'number' && entry.price > 0,
        );
      }
    } catch { /* ignore parse failure */ }
  }

  if (!options && !pricing) return null;
  return {
    availableOptions: options ?? [],
    pricing: pricing ?? [],
  };
}

// Merges deterministic Shopify data into an extraction result, overriding
// LLM-generated availableOptions and pricing when structured data is available.
function applyShopifyOverlay(product: ExtractedProductData, shopify: ShopifyStructuredData): void {
  // Override availableOptions with Shopify source (authoritative)
  if (shopify.availableOptions.length > 0) {
    product.availableOptions = shopify.availableOptions;
    // Re-derive legacy fields
    product.options = shopify.availableOptions.map(o => ({ name: o.type, values: o.values }));
    const finishOpt = shopify.availableOptions.find(o => ['Finish', 'Color', 'Fabric'].includes(o.type));
    if (finishOpt) product.finishes = finishOpt.values;
  }

  // Override pricing with Shopify source (authoritative)
  if (shopify.pricing.length > 0) {
    product.pricing = shopify.pricing;

    // Ensure activeVariant is consistent with pricing
    if (product.activeVariant) {
      // Find a pricing entry that matches activeVariant's non-price keys
      const avKeys = Object.keys(product.activeVariant).filter(k => k !== 'price');
      const match = shopify.pricing.find(entry =>
        avKeys.every(k => {
          const av = String(product.activeVariant![k]).toLowerCase();
          const ev = String(entry[k] ?? '').toLowerCase();
          return av === ev;
        }),
      );
      if (match) {
        product.activeVariant = { ...match };
      }
    }

    // Derive legacy price from activeVariant
    if (product.activeVariant?.price != null) {
      product.price = Number(product.activeVariant.price);
    }
  }
}

/* ─── Extraction completeness scoring ─────────────────── */

interface CompletenessResult {
  score: number;          // 0-100
  missingCritical: string[];  // Fields worth retrying for
}

function computeCompleteness(product: ExtractedProductData | undefined): CompletenessResult {
  if (!product) return { score: 0, missingCritical: ['product'] };

  const missing: string[] = [];
  let score = 0;
  const total = 100;

  // Required (30 pts)
  if (product.productName && product.productName !== 'Unknown Product') score += 10;
  else missing.push('productName');
  if (product.category) score += 10;
  else missing.push('category');
  if (product.currency) score += 10;

  // Critical (40 pts) — these are worth retrying for
  if (product.activeVariant?.price != null && Number(product.activeVariant.price) > 0) score += 10;
  else missing.push('pricing');
  if (product.images?.primary) score += 5;
  else missing.push('images');
  if (hasPrimaryDimensions(product.dimensions)) score += 10;
  else missing.push('dimensions');
  if (product.materials && Object.keys(product.materials).length > 0) score += 5;
  else missing.push('materials');
  if (product.availableOptions && product.availableOptions.length > 0) score += 5;
  if (product.features && product.features.length > 0) score += 5;
  else missing.push('features');

  // Optional (30 pts)
  if (product.brandName) score += 5;
  if (product.shipping) score += 5;
  if (product.availability) score += 5;
  if (product.metadata?.description) score += 5;
  if (product.pricing && product.pricing.length > 1) score += 5;
  if (product.promotions && product.promotions.length > 0) score += 5;

  return { score: Math.min(score, total), missingCritical: missing };
}

/* ─── Product image gallery extraction from HTML ─────── */

function extractProductGalleryImages(html: string): string[] {
  const urls = new Set<string>();

  // 1. data-zoom-image, data-large, data-src on product images
  const dataImgRegex = /(?:data-zoom-image|data-large|data-full|data-srcset|data-src)\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = dataImgRegex.exec(html)) !== null) {
    const url = match[1].split(',')[0].trim().split(/\s+/)[0]; // handle srcset format
    if (url.startsWith('http') && /\.(jpg|jpeg|png|webp|avif)/i.test(url)) {
      urls.add(url);
    }
  }

  // 2. Images inside product gallery/carousel containers
  const galleryContainerRegex =
    /<(?:div|ul|section)[^>]*(?:class|id|data-[\w-]*)=["'][^"']*(?:product-gallery|product-images|product-photos|product-media|gallery|carousel|slider|swiper|pdp-image|product-image-container)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|ul|section)>/gi;
  while ((match = galleryContainerRegex.exec(html)) !== null) {
    const containerHtml = match[1];
    const imgRegex = /(?:src|data-src|data-lazy-src)\s*=\s*["']([^"']+)["']/gi;
    let imgMatch: RegExpExecArray | null;
    while ((imgMatch = imgRegex.exec(containerHtml)) !== null) {
      const imgUrl = imgMatch[1].trim();
      if (imgUrl.startsWith('http') && /\.(jpg|jpeg|png|webp|avif)/i.test(imgUrl)) {
        urls.add(imgUrl);
      }
    }
  }

  // 3. srcset on <source> or <img> tags within <picture> elements
  const pictureRegex = /<picture[^>]*>([\s\S]*?)<\/picture>/gi;
  while ((match = pictureRegex.exec(html)) !== null) {
    const srcsetRegex = /srcset\s*=\s*["']([^"']+)["']/gi;
    let srcMatch: RegExpExecArray | null;
    while ((srcMatch = srcsetRegex.exec(match[1])) !== null) {
      // srcset: "url 800w, url 1200w" — take the largest
      const entries = srcMatch[1].split(',').map(s => s.trim().split(/\s+/)[0]);
      for (const entry of entries) {
        if (entry.startsWith('http') && /\.(jpg|jpeg|png|webp|avif)/i.test(entry)) {
          urls.add(entry);
        }
      }
    }
  }

  // Deduplicate and limit
  return Array.from(urls).slice(0, 20);
}

/* ─── Post-extraction validation ─────────────────────── */
// Category-aware sanity checks for dimensions and prices.
// Invalid values are nullified rather than kept, since bad data is worse than no data.

interface DimensionRange { min: number; max: number }
interface CategoryValidation {
  // Dimension ranges in inches
  width?: DimensionRange;
  height?: DimensionRange;
  depth?: DimensionRange;
  priceRange?: DimensionRange;  // min/max USD price
}

const CATEGORY_VALIDATION: Record<string, CategoryValidation> = {
  Sofas:          { width: { min: 50, max: 150 }, height: { min: 25, max: 48 }, depth: { min: 25, max: 55 }, priceRange: { min: 200, max: 30000 } },
  Armchairs:      { width: { min: 20, max: 50 },  height: { min: 25, max: 48 }, depth: { min: 20, max: 45 }, priceRange: { min: 100, max: 15000 } },
  Beds:           { width: { min: 38, max: 90 },  height: { min: 10, max: 70 }, depth: { min: 74, max: 90 }, priceRange: { min: 100, max: 20000 } },
  'Dining Tables': { width: { min: 24, max: 180 }, height: { min: 26, max: 36 }, depth: { min: 20, max: 60 }, priceRange: { min: 100, max: 25000 } },
  'Coffee Tables': { width: { min: 24, max: 72 },  height: { min: 12, max: 24 }, depth: { min: 14, max: 42 }, priceRange: { min: 50, max: 10000 } },
  Desks:          { width: { min: 30, max: 84 },  height: { min: 26, max: 52 }, depth: { min: 16, max: 40 }, priceRange: { min: 50, max: 10000 } },
  'Dining Chairs': { width: { min: 14, max: 28 },  height: { min: 28, max: 48 }, depth: { min: 16, max: 28 }, priceRange: { min: 30, max: 5000 } },
  'Bar Stools':   { width: { min: 14, max: 24 },  height: { min: 24, max: 48 }, depth: { min: 14, max: 24 }, priceRange: { min: 30, max: 3000 } },
  Nightstands:    { width: { min: 14, max: 34 },  height: { min: 18, max: 36 }, depth: { min: 12, max: 26 }, priceRange: { min: 30, max: 5000 } },
  Dressers:       { width: { min: 30, max: 80 },  height: { min: 28, max: 48 }, depth: { min: 14, max: 26 }, priceRange: { min: 100, max: 10000 } },
  Shelving:       { width: { min: 16, max: 80 },  height: { min: 24, max: 96 }, depth: { min: 8, max: 24 },  priceRange: { min: 30, max: 8000 } },
};

function validateExtraction(product: ExtractedProductData): void {
  if (!product.category) return;

  // Extract the leaf category for matching
  const leaf = product.category.includes('>')
    ? product.category.split('>').pop()?.trim() ?? ''
    : product.category.trim();

  const rules = CATEGORY_VALIDATION[leaf];
  if (!rules) return; // No validation rules for this category

  // Validate dimensions
  if (product.dimensions) {
    const dims = product.dimensions;
    const unit = dims.unit ?? 'in';

    // Convert to inches for comparison
    const toInches = (val: number): number => {
      if (unit === 'cm') return val / 2.54;
      if (unit === 'ft') return val * 12;
      return val;
    };

    let invalidated = false;

    if (dims.width != null && rules.width) {
      const inchesVal = toInches(dims.width);
      if (inchesVal < rules.width.min * 0.5 || inchesVal > rules.width.max * 2) {
        logger.warn('Dimension validation: width out of range', {
          category: leaf, width: dims.width, unit, expected: rules.width,
        });
        invalidated = true;
      }
    }
    if (dims.height != null && rules.height) {
      const inchesVal = toInches(dims.height);
      if (inchesVal < rules.height.min * 0.5 || inchesVal > rules.height.max * 2) {
        logger.warn('Dimension validation: height out of range', {
          category: leaf, height: dims.height, unit, expected: rules.height,
        });
        invalidated = true;
      }
    }
    if (dims.depth != null && rules.depth) {
      const inchesVal = toInches(dims.depth);
      if (inchesVal < rules.depth.min * 0.5 || inchesVal > rules.depth.max * 2) {
        logger.warn('Dimension validation: depth out of range', {
          category: leaf, depth: dims.depth, unit, expected: rules.depth,
        });
        invalidated = true;
      }
    }

    // If dimensions are wildly out of range (using 0.5x / 2x tolerance), nullify them
    if (invalidated) {
      product.dimensions = { raw: dims.raw, unit: dims.unit };
    }
  }

  // Validate price (warn only, don't nullify — prices vary too much)
  if (rules.priceRange && product.activeVariant?.price != null) {
    const price = Number(product.activeVariant.price);
    if (price > 0 && (price < rules.priceRange.min * 0.1 || price > rules.priceRange.max * 5)) {
      logger.warn('Price validation: price out of expected range', {
        category: leaf, price, expected: rules.priceRange,
      });
    }
  }
}

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

    // Product node — send as structured JSON to preserve hierarchy
    if (!foundProduct) {
      const product = findJsonLdNode(parsed, ['Product', 'ProductGroup']);
      if (product) {
        foundProduct = true;
        const { price, currency } = resolveOfferPrice(product.offers, graphNodes);

        // Build rich structured object instead of flat key-value
        const structured: Record<string, unknown> = {
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

        // Preserve full offers array for variant pricing
        if (product.offers) {
          const offers = Array.isArray(product.offers) ? product.offers : [product.offers];
          const offerData = offers.slice(0, 50).map((o: any) => ({
            price: o.price ?? o.lowPrice,
            priceCurrency: o.priceCurrency,
            availability: o.availability,
            sku: o.sku,
            name: o.name,
            url: o.url,
          })).filter((o: any) => o.price != null);
          if (offerData.length > 0) structured.offers = offerData;
        }

        // Preserve image array for gallery
        if (product.image) {
          const images = Array.isArray(product.image) ? product.image : [product.image];
          const imageUrls = images
            .map((img: any) => typeof img === 'string' ? img : (img?.contentUrl ?? img?.url ?? img?.['@id']))
            .filter((u: any) => typeof u === 'string' && u.startsWith('http'))
            .slice(0, 20);
          if (imageUrls.length > 1) structured.gallery = imageUrls;
        }

        Object.keys(structured).forEach((k) => structured[k] === undefined && delete structured[k]);
        lines.push(`json_ld_product: ${JSON.stringify(structured)}`);
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

  // ── Product image gallery extraction ────────────────
  const galleryImages = extractProductGalleryImages(html);
  if (galleryImages.length > 0) {
    lines.push(`product_gallery_images: ${JSON.stringify(galleryImages)}`);
  }

  // Extract likely specs once and reuse for regex scanning + context lines.
  const specSections = extractSpecSections(html);
  const bodyText = extractBodyText(html);
  const dimensionScanText = [specSections, bodyText].filter(Boolean).join('\n');

  // ── Aggressive dimension extraction from product-focused text ────
  const dimLines = extractDimensionsFromText(dimensionScanText || html);
  lines.push(...dimLines);

  // ── High-confidence dimension blocks near headings ───────────────
  for (const block of extractDimensionContextBlocks(html)) {
    lines.push(`explicit_dimensions_label: ${block}`);
  }

  // ── Embedded product JSON (Shopify, Next.js, etc.) ────
  const embeddedLines = extractEmbeddedProductJson(html, url);
  if (embeddedLines.length > 0) {
    lines.push(...embeddedLines);
  }

  // ── Dimension/spec sections from HTML structure ───────
  if (specSections.length > 0) {
    lines.push(`\nspec_sections:\n${specSections}`);
  }

  // ── Body text for AI analysis ─────────────────────────
  if (bodyText.length > 200) {
    lines.push(`\nbody_text:\n${bodyText}`);
  }

  return lines.join('\n');
}

/* ─── Parse structured dimensions from raw text via regex ── */

function parseDimensionsFromText(text: string): ExtractedProductData['dimensions'] | null {
  // Normalize unicode quotes and whitespace
  const t = text
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/\s+/g, ' ');

  const finalize = (dims: NonNullable<ExtractedProductData['dimensions']>): ExtractedProductData['dimensions'] | null => {
    if (!dims.raw) return null;
    if (!dims.unit) {
      const detected = detectUnit(dims.raw);
      if (detected === 'in' || detected === 'cm' || detected === 'ft') dims.unit = detected;
    }
    return normalizeDimensionsObject(dims);
  };

  // Pattern 1: n" Width/W x n" Depth/D x n" Height/H  (labeled with quotes)
  // e.g. 90" Width x 100" Depth x 42" Height
  const labeledQuote =
    /(\d+(?:\.\d+)?)\s*["″']\s*(?:width|w)\s*x\s*(\d+(?:\.\d+)?)\s*["″']\s*(?:depth|d)\s*x\s*(\d+(?:\.\d+)?)\s*["″']\s*(?:height|h)/i;
  let m = t.match(labeledQuote);
  if (m) {
    return finalize({
      width: Number(m[1]), depth: Number(m[2]), height: Number(m[3]),
      unit: 'in', raw: m[0].trim(),
    });
  }

  // Pattern 1b: Width x Depth x Height with labels AFTER numbers but no quotes
  // e.g. 90 Width x 100 Depth x 42 Height
  const labeledNoQuote =
    /(\d+(?:\.\d+)?)\s*(?:width|w)\s*x\s*(\d+(?:\.\d+)?)\s*(?:depth|d)\s*x\s*(\d+(?:\.\d+)?)\s*(?:height|h)/i;
  m = t.match(labeledNoQuote);
  if (m) {
    return finalize({
      width: Number(m[1]), depth: Number(m[2]), height: Number(m[3]),
      unit: 'in', raw: m[0].trim(),
    });
  }

  // Pattern 2: n"W x n"D x n"H  (short labels)
  // e.g. 90"W x 100"D x 42"H
  const shortLabel =
    /(\d+(?:\.\d+)?)\s*["″']?\s*[Ww]\s*[x×X]\s*(\d+(?:\.\d+)?)\s*["″']?\s*[Dd]\s*[x×X]\s*(\d+(?:\.\d+)?)\s*["″']?\s*[Hh]/;
  m = t.match(shortLabel);
  if (m) {
    return finalize({
      width: Number(m[1]), depth: Number(m[2]), height: Number(m[3]),
      unit: 'in', raw: m[0].trim(),
    });
  }

  // Pattern 3: Individual labeled lines — Width: n", Depth: n", Height: n"
  // PROMOTED: These are the most reliable after explicit W/D/H labels because each
  // axis is unambiguously named, unlike positional triples that guess W/D/H from order.
  const wMatch = t.match(/\bwidth\s*[:=]\s*(\d+(?:\.\d+)?)\s*["″]?/i);
  const dMatch = t.match(/\bdepth\s*[:=]\s*(\d+(?:\.\d+)?)\s*["″]?/i);
  const hMatch = t.match(/\bheight\s*[:=]\s*(\d+(?:\.\d+)?)\s*["″]?/i);
  if (wMatch && hMatch) {
    const dims: ExtractedProductData['dimensions'] = {
      width: Number(wMatch[1]),
      height: Number(hMatch[1]),
      unit: 'in',
      raw: [wMatch[0], dMatch?.[0], hMatch[0]].filter(Boolean).join(', '),
    };
    if (dMatch) dims.depth = Number(dMatch[1]);
    return finalize(dims);
  }

  // Pattern 4: Overall/Dimensions: n x n x n (with unit after)
  // e.g. "Dimensions: 90 x 100 x 42 in" or "Overall: 90 x 100 x 42 inches"
  const overallTriple =
    /(?:overall|dimensions?)\s*[:.]?\s*(\d+(?:\.\d+)?)\s*["″]?\s*[x×X]\s*(\d+(?:\.\d+)?)\s*["″]?\s*[x×X]\s*(\d+(?:\.\d+)?)\s*["″]?\s*(?:in(?:ches)?|cm|ft)?/i;
  m = t.match(overallTriple);
  if (m) {
    const detectedUnit = detectUnit(m[0]);
    const unit = detectedUnit === 'in' || detectedUnit === 'cm' || detectedUnit === 'ft'
      ? detectedUnit
      : undefined;
    return finalize({
      width: Number(m[1]), depth: Number(m[2]), height: Number(m[3]),
      unit, raw: m[0].trim(),
    });
  }

  // Pattern 5: Plain n" x n" x n" (3 numbers with quotes separated by x)
  // e.g. 90" x 100" x 42"
  const plainQuoteTriple =
    /(\d+(?:\.\d+)?)\s*["″]\s*[x×X]\s*(\d+(?:\.\d+)?)\s*["″]\s*[x×X]\s*(\d+(?:\.\d+)?)\s*["″]/;
  m = t.match(plainQuoteTriple);
  if (m) {
    return finalize({
      width: Number(m[1]), depth: Number(m[2]), height: Number(m[3]),
      unit: 'in', raw: m[0].trim(),
    });
  }

  // Pattern 6: Plain n x n x n followed by unit (no quotes)
  // e.g. 90 x 100 x 42 in   or   90 x 100 x 42 inches
  // Require unit to avoid false positives on random "a x b x c" text
  const plainTripleWithUnit =
    /(\d{2,3}(?:\.\d+)?)\s*[x×X]\s*(\d{2,3}(?:\.\d+)?)\s*[x×X]\s*(\d{2,3}(?:\.\d+)?)\s*(?:in(?:ches)?|cm|ft|mm)/i;
  m = t.match(plainTripleWithUnit);
  if (m) {
    const detectedUnit = detectUnit(m[0]);
    const unit = detectedUnit === 'in' || detectedUnit === 'cm' || detectedUnit === 'ft'
      ? detectedUnit
      : undefined;
    return finalize({
      width: Number(m[1]), depth: Number(m[2]), height: Number(m[3]),
      unit, raw: m[0].trim(),
    });
  }

  // Pattern 7: Handle mixed fractions in labeled forms, e.g. 68-1/2" W x 85" D x 54" H
  const mixedTriplet =
    /(\d+(?:[\s-]\d+\/\d+)?|\d+\/\d+)\s*["″']?\s*[Ww]\s*[x×X]\s*(\d+(?:[\s-]\d+\/\d+)?|\d+\/\d+)\s*["″']?\s*[Dd]\s*[x×X]\s*(\d+(?:[\s-]\d+\/\d+)?|\d+\/\d+)\s*["″']?\s*[Hh]/;
  m = t.match(mixedTriplet);
  if (m) {
    const w = parseNumberToken(m[1]);
    const d = parseNumberToken(m[2]);
    const h = parseNumberToken(m[3]);
    if (w != null && d != null && h != null) {
      const detectedUnit = detectUnit(m[0]);
      const unit = detectedUnit === 'in' || detectedUnit === 'cm' || detectedUnit === 'ft'
        ? detectedUnit
        : undefined;
      return finalize({ width: w, depth: d, height: h, unit, raw: m[0].trim() });
    }
  }

  return null;
}

function parseDimensionsFromSignals(signals: string): ExtractedProductData['dimensions'] | null {
  const lines = signals
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const byPrefix = (prefix: string) =>
    lines
      .filter((l) => l.startsWith(prefix))
      .map((l) => l.replace(`${prefix}:`, '').trim())
      .join('\n');

  const priorityChunks = [
    byPrefix('explicit_dimensions_label'),
    byPrefix('dim_labelled'),
    byPrefix('dim_label'),
    byPrefix('dim_WxDxH'),
    byPrefix('dim_overall'),
    byPrefix('embedded_dimensions'),
    byPrefix('shopify_dimensions'),
    byPrefix('spec_row'),
    byPrefix('spec_def'),
    (() => {
      const specIdx = lines.findIndex((l) => l === 'spec_sections:');
      if (specIdx === -1) return '';
      return lines.slice(specIdx + 1, specIdx + 25).join(' ');
    })(),
  ].filter(Boolean);

  for (const chunk of priorityChunks) {
    const parsed = parseDimensionsFromText(chunk);
    if (parsed && hasPrimaryDimensions(parsed)) return parsed;
  }

  // Last resort: search in all dimension-prefixed lines only
  const merged = lines
    .filter((l) => /^dim_|^explicit_dimensions_label|^shopify_dim|^embedded_dim|^spec_/.test(l))
    .join(' ');
  const parsed = parseDimensionsFromText(merged);
  return parsed && hasPrimaryDimensions(parsed) ? parsed : null;
}

/* ─── Dimension enrichment via web search ────────────── */

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

    const signalLines = signals.split('\n');
    const dimSignals = signalLines.filter(l => /^dim_|^shopify_dim|^spec_|^explicit_dim|^embedded_dim/i.test(l));

    logger.info('Page signals extracted', {
      url: sourceUrl,
      signalCount: signalLines.length,
      htmlBytes: html.length,
      preCategory,
    });

    logger.info('Dimension signals', {
      url: sourceUrl,
      count: dimSignals.length,
      signals: dimSignals.slice(0, 15),
    });

    // DEBUG: Log full scraped signals before AI normalization
    console.log('\n========== SCRAPED OUTPUT (Normal Fetch) ==========');
    console.log('URL:', sourceUrl);
    console.log('HTML length:', html.length);
    console.log('Signal count:', signalLines.length);
    console.log('--- SIGNALS START ---');
    console.log(signals);
    console.log('--- SIGNALS END ---');
    console.log('====================================================\n');

    try {
      const userContent = `Extract product data from these page signals.\n\nPRICE: If "selected_variant_price" is present, use that — it's the exact price for the URL's variant. Do NOT use og:price or meta tag prices when selected_variant_price exists.\n\nDIMENSIONS (HIGHEST PRIORITY): Look for "explicit_dimensions_label" signals FIRST — these contain the raw text near a "Dimensions" heading on the page and are the MOST AUTHORITATIVE source. Parse width, depth, height, and unit values from that text. Then use dim_labelled and dim_label signals. Do NOT confuse variant titles (like "22 x 22") with actual product dimensions. Only labelled measurements (Width/Depth/Height) are real dimensions. NEVER return a product without dimensions if ANY dimension signal (explicit_dimensions_label, dim_label, dim_labelled, dim_WxDxH, spec_sections with measurements) exists in the signals below.\n\n${signals}`;
      const responseText = await generateText({
        system: SYSTEM_PROMPT,
        userMessage: userContent,
        maxTokens: 2048,
      });

      if (responseText) {
        const parsed = tryParseJson(responseText);
        if (parsed) {
          logger.info('Direct extraction succeeded', { url: sourceUrl });
          const result = buildResult(parsed, sourceUrl, preCategory);

          // Deterministic Shopify overlay: override pricing/options with structured data
          const shopifyData = extractShopifyStructuredData(signals);
          if (shopifyData) {
            const products = result.type === 'single' ? [result.product].filter(Boolean) : (result.products ?? []);
            for (const p of products) {
              if (p) applyShopifyOverlay(p, shopifyData);
            }
            logger.info('Shopify structured data applied deterministically', {
              url: sourceUrl,
              optionCount: shopifyData.availableOptions.length,
              pricingEntries: shopifyData.pricing.length,
            });
          }

          // Merge DOM-extracted options as supplementary (never replaces existing)
          const domOptionsMatch = signals.match(/^dom_options:\s*(\[.+\])$/m);
          if (domOptionsMatch) {
            try {
              const domParsed = JSON.parse(domOptionsMatch[1]);
              if (Array.isArray(domParsed)) {
                const products = result.type === 'single' ? [result.product].filter(Boolean) : (result.products ?? []);
                for (const p of products) {
                  if (!p) continue;
                  const existingTypes = new Set(
                    (p.availableOptions ?? []).map(o => o.type.toLowerCase())
                  );
                  // Pre-clean DOM options to remove UI noise before merging
                  const cleanedDomOpts = cleanAvailableOptions(
                    domParsed
                      .filter((o: any) => o && (o.name || o.type) && Array.isArray(o.values))
                      .map((o: any) => ({ type: String(o.name ?? o.type).trim(), values: o.values.map((v: any) => String(v)) })),
                    p.productName ?? '',
                  );
                  for (const domOpt of cleanedDomOpts) {
                    const typeName = domOpt.type.charAt(0).toUpperCase() + domOpt.type.slice(1);
                    if (existingTypes.has(typeName.toLowerCase())) continue;
                    if (!p.availableOptions) p.availableOptions = [];
                    p.availableOptions.push({ type: typeName, values: domOpt.values });
                    existingTypes.add(typeName.toLowerCase());
                    logger.info('DOM option merged as supplementary', { type: typeName, valueCount: domOpt.values.length });
                  }
                }
              }
            } catch { /* ignore parse failure */ }
          }

          // Deterministic fallback from extracted signals before using web search.
          const product = result.type === 'single' ? result.product : result.products?.[0];
          let hasDims = hasPrimaryDimensions(product?.dimensions);

          if (!hasDims) {
            const deterministicDims = parseDimensionsFromSignals(signals);
            if (deterministicDims) {
              if (result.type === 'single' && result.product) {
                result.product.dimensions = deterministicDims;
              } else if (result.type === 'multiple' && result.products?.[0]) {
                result.products[0].dimensions = deterministicDims;
              }
              hasDims = true;
              logger.info('Dimensions recovered via deterministic fallback', {
                url: sourceUrl,
                dims: deterministicDims,
              });
            }
          }

          // Completeness check — trigger browser fallback for incomplete extractions,
          // not just missing dimensions
          const completeness = computeCompleteness(product);
          const needsBrowserFallback = !hasDims || completeness.score < 50;

          if (needsBrowserFallback) {
            logger.info('Extraction incomplete — attempting headless browser fetch', {
              url: sourceUrl,
              completenessScore: completeness.score,
              missingCritical: completeness.missingCritical,
              hasDims,
            });
            const rendered = await fetchRenderedContent(sourceUrl);
            if (rendered) {
              logger.info('Browser-rendered content extracted', {
                url: sourceUrl,
                productTextLen: rendered.productText.length,
                dimensionTextLen: rendered.dimensionText.length,
                dimensionText: rendered.dimensionText,
                fullBodyTextLen: rendered.fullBodyText.length,
              });

              // DEBUG: Log full browser-rendered content before AI normalization
              console.log('\n========== SCRAPED OUTPUT (Browserless Fallback) ==========');
              console.log('URL:', sourceUrl);
              console.log('productText length:', rendered.productText.length);
              console.log('dimensionText length:', rendered.dimensionText.length);
              console.log('fullBodyText length:', rendered.fullBodyText.length);
              console.log('--- PRODUCT TEXT START ---');
              console.log(rendered.productText.slice(0, 5000));
              console.log('--- PRODUCT TEXT END ---');
              console.log('--- DIMENSION TEXT START ---');
              console.log(rendered.dimensionText);
              console.log('--- DIMENSION TEXT END ---');
              console.log('--- FULL BODY TEXT (first 3000 chars) START ---');
              console.log(rendered.fullBodyText.slice(0, 3000));
              console.log('--- FULL BODY TEXT END ---');
              console.log('============================================================\n');

              // If score is very low, re-extract the full product from browser content
              if (completeness.score < 50 && rendered.productText.length > 200) {
                try {
                  const reUserContent = `Extract product data from this page content rendered by a headless browser.\n\nPRICE: Look for price patterns like "$1,234" or "Price: 1234".\n\nDIMENSIONS (HIGHEST PRIORITY):\nDimension-specific text found on the page:\n${rendered.dimensionText || '(none found)'}\n\nFull product area text:\n${rendered.productText.slice(0, 15_000)}`;
                  const reExtractText = await generateText({
                    system: SYSTEM_PROMPT,
                    userMessage: reUserContent,
                    maxTokens: 2048,
                  });
                  if (reExtractText) {
                    const reParsed = tryParseJson(reExtractText);
                    if (reParsed) {
                      const reResult = buildResult(reParsed, sourceUrl, preCategory);
                      const reProduct = reResult.type === 'single' ? reResult.product : reResult.products?.[0];
                      const reCompleteness = computeCompleteness(reProduct);
                      // Only use re-extraction if it's actually better
                      if (reCompleteness.score > completeness.score && reProduct && product) {
                        logger.info('Browser re-extraction improved completeness', {
                          url: sourceUrl,
                          before: completeness.score,
                          after: reCompleteness.score,
                        });
                        // Merge: keep original fields if re-extraction is missing them
                        if (!reProduct.brandName && product.brandName) reProduct.brandName = product.brandName;
                        if (!reProduct.images?.primary && product.images?.primary) reProduct.images = product.images;
                        if (!reProduct.availableOptions && product.availableOptions) reProduct.availableOptions = product.availableOptions;
                        if (!reProduct.pricing && product.pricing) reProduct.pricing = product.pricing;
                        if (!reProduct.activeVariant && product.activeVariant) reProduct.activeVariant = product.activeVariant;
                        // Replace the product in result
                        if (result.type === 'single') result.product = reProduct;
                        else if (result.products?.[0]) result.products[0] = reProduct;
                        // Re-apply Shopify overlay if available
                        if (shopifyData) applyShopifyOverlay(reProduct, shopifyData);
                        hasDims = hasPrimaryDimensions(reProduct.dimensions);
                      }
                    }
                  }
                } catch (err: any) {
                  logger.warn('Browser re-extraction failed', { url: sourceUrl, err: err?.message });
                }
              }

              // Try parsing dimensions from the targeted dimension text first, then product text, then full body
              if (!hasDims) {
                const textsToTry = [rendered.dimensionText, rendered.productText, rendered.fullBodyText].filter(Boolean);
                for (const text of textsToTry) {
                  const browserDims = parseDimensionsFromText(text);
                  if (browserDims) {
                    const targetProduct = result.type === 'single' ? result.product : result.products?.[0];
                    if (targetProduct) targetProduct.dimensions = browserDims;
                    hasDims = true;
                    logger.info('Dimensions recovered via headless browser', {
                      url: sourceUrl,
                      dims: browserDims,
                    });
                    break;
                  }
                }
              }
            }
          }

          if (!hasDims) {
            logger.info('Dimensions not found after all extraction attempts', { url: sourceUrl });
          }

          // Attach extraction metadata
          const finalProduct = result.type === 'single' ? result.product : result.products?.[0];
          const finalCompleteness = computeCompleteness(finalProduct);
          result.extractionMeta = {
            method: needsBrowserFallback ? 'browser' : 'direct',
            completenessScore: finalCompleteness.score,
            shopifyOverlay: !!shopifyData,
            browserReExtracted: needsBrowserFallback && completeness.score < 50,
            missingFields: finalCompleteness.missingCritical,
          };

          setCachedResult(sourceUrl, result);
          return result;
        }
      }
      logger.warn('Direct extraction returned no JSON', { url: sourceUrl });
    } catch (err: any) {
      logger.error('Direct extraction Claude call failed', { url: sourceUrl, err: err?.message });
    }
  } else {
    logger.info('HTML fetch returned empty/short content — trying headless browser', {
      url: sourceUrl,
      bytes: html?.length ?? 0,
    });

    // Try headless browser before falling back to web search
    const rendered = await fetchRenderedContent(sourceUrl);
    if (rendered && rendered.productText.length > 100) {
      logger.info('Browser-rendered content for bot-blocked page', {
        url: sourceUrl,
        productTextLen: rendered.productText.length,
        dimensionTextLen: rendered.dimensionText.length,
        dimensionText: rendered.dimensionText,
      });

      // DEBUG: Log full browser-rendered content before AI normalization (bot-blocked path)
      console.log('\n========== SCRAPED OUTPUT (Browserless - Bot Blocked) ==========');
      console.log('URL:', sourceUrl);
      console.log('productText length:', rendered.productText.length);
      console.log('dimensionText length:', rendered.dimensionText.length);
      console.log('fullBodyText length:', rendered.fullBodyText.length);
      console.log('--- PRODUCT TEXT START ---');
      console.log(rendered.productText.slice(0, 5000));
      console.log('--- PRODUCT TEXT END ---');
      console.log('--- DIMENSION TEXT START ---');
      console.log(rendered.dimensionText);
      console.log('--- DIMENSION TEXT END ---');
      console.log('--- FULL BODY TEXT (first 3000 chars) START ---');
      console.log(rendered.fullBodyText.slice(0, 3000));
      console.log('--- FULL BODY TEXT END ---');
      console.log('================================================================\n');

      try {
        const browserUserContent = `Extract product data from this page content rendered by a headless browser.\n\nPRICE: Look for price patterns like "$1,234" or "Price: 1234".\n\nDIMENSIONS (HIGHEST PRIORITY):\nDimension-specific text found on the page:\n${rendered.dimensionText || '(none found)'}\n\nFull product area text:\n${rendered.productText.slice(0, 15_000)}`;
        const browserResponseText = await generateText({
          system: SYSTEM_PROMPT,
          userMessage: browserUserContent,
          maxTokens: 2048,
        });

        if (browserResponseText) {
          const parsed = tryParseJson(browserResponseText);
          if (parsed) {
            logger.info('Browser-rendered extraction succeeded', { url: sourceUrl });
            const result = buildResult(parsed, sourceUrl);

            // Deterministic dimension fallback from browser text
            const product = result.type === 'single' ? result.product : result.products?.[0];
            if (!hasPrimaryDimensions(product?.dimensions)) {
              const textsToTry = [rendered.dimensionText, rendered.productText, rendered.fullBodyText].filter(Boolean);
              for (const text of textsToTry) {
                const dims = parseDimensionsFromText(text);
                if (dims) {
                  if (result.type === 'single' && result.product) result.product.dimensions = dims;
                  else if (result.type === 'multiple' && result.products?.[0]) result.products[0].dimensions = dims;
                  break;
                }
              }
            }

            const browserCompleteness = computeCompleteness(product);
            result.extractionMeta = {
              method: 'browser',
              completenessScore: browserCompleteness.score,
              shopifyOverlay: false,
              browserReExtracted: false,
              missingFields: browserCompleteness.missingCritical,
            };

            setCachedResult(sourceUrl, result);
            return result;
          }
        }
      } catch (err: any) {
        logger.error('Browser-rendered Claude call failed', { url: sourceUrl, err: err?.message });
      }
    }
  }

  // Stage 3: Final fallback — web search (when both static + browser fetch fail)
  logger.info('Falling back to web search', { url: sourceUrl });
  const result = await extractWithWebSearch(sourceUrl);
  const searchProduct = result.type === 'single' ? result.product : result.products?.[0];
  const searchCompleteness = computeCompleteness(searchProduct);
  result.extractionMeta = {
    method: 'search',
    completenessScore: searchCompleteness.score,
    shopifyOverlay: false,
    browserReExtracted: false,
    missingFields: searchCompleteness.missingCritical,
  };
  setCachedResult(sourceUrl, result);
  return result;
}

/* ─── Web search fallback ────────────────────────────── */

async function extractWithWebSearch(sourceUrl: string): Promise<ExtractionResult> {
  // Single AI call — web_search tool handles iterations internally (Claude/Agent Router only).
  // For Gemini, falls back to plain generation without web search.
  const wsUserContent = `Search for the product at this URL and extract its full details:\n${sourceUrl}\n\nI need: name, price, currency, main image URL, furniture category, and metadata (description, key features, materials, assembly, care instructions, warranty, style, etc.).\n\nDIMENSIONS ARE THE MOST IMPORTANT DATA — find the product's width, depth, height measurements. Almost every furniture product page has dimensions (e.g. "68.5 x 85 x 54" or "68.5"W x 85"D x 54"H"). Search thoroughly for these. Include them in the dimensions object with numeric values and unit.\n\nReturn ONLY the JSON object as specified.`;
  const wsResponseText = await generateWithTools({
    system: SYSTEM_PROMPT,
    userMessage: wsUserContent,
    maxTokens: 3072,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
  });

  if (wsResponseText) {
    const parsed = tryParseJson(wsResponseText);
    if (parsed) {
      logger.info('Web search extraction succeeded', { url: sourceUrl });
      return buildResult(parsed, sourceUrl);
    }
  }

  const responseText = (wsResponseText || '').slice(0, 200);

  logger.warn('Web search extraction failed', { url: sourceUrl, responseText });
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
    if (parsed.length === 1) {
      const result: ExtractionResult = { type: 'single', product: normalizeProduct(parsed[0], sourceUrl, preCategory) };
      return result;
    }
    const multiResult: ExtractionResult = {
      type: 'multiple',
      totalFound: parsed.length,
      products: parsed.map((p) => normalizeProduct(p, sourceUrl, preCategory)),
    };
    return multiResult;
  }

  if (parsed.type === 'multiple' && Array.isArray(parsed.products)) {
    if (parsed.products.length === 0)
      throw new ExtractionError('No products found on this page.', 'NO_PRODUCTS');
    const multiResult: ExtractionResult = {
      type: 'multiple',
      totalFound: parsed.totalFound ?? parsed.products.length,
      products: parsed.products.map((p: any) => normalizeProduct(p, sourceUrl, preCategory)),
    };
    return multiResult;
  }

  const productData = parsed.product ?? parsed;
  if (!productData.productName || typeof productData.productName !== 'string') {
    throw new ExtractionError('Could not extract product name from this page.', 'PARSE_FAILED');
  }
  const singleResult: ExtractionResult = { type: 'single', product: normalizeProduct(productData, sourceUrl, preCategory) };
  console.log('\n═══ EXTRACTED PRODUCT JSON ═══');
  console.log(JSON.stringify(singleResult, null, 2));
  console.log('═══════════════════════════════\n');
  return singleResult;
}

/* ─── Clean available options: remove UI noise, deduplicate ── */

// Option type names that are website UI, not product variants
const NOISE_OPTION_TYPES = new Set([
  'selection summary', 'location menu', 'location', 'quantity', 'qty',
  'share', 'wishlist', 'add to cart', 'delivery', 'delivery options',
  'protection plan', 'protection', 'warranty plan', 'gift wrap',
  'store pickup', 'shipping method', 'zip code', 'postal code',
]);

// Option values that are UI actions/labels, not selectable product variants
const NOISE_VALUE_PATTERNS = [
  /^\d+\s*options?\s*available$/i,       // "265 options available"
  /^and\s+\d+\s+other\s+options?$/i,    // "and 3 other options"
  /^view\s*all$/i,                        // "View all"
  /^close\s*menu$/i,                      // "Close Menu"
  /^zip\s*code$/i,                        // "Zip Code"
  /^save\s*(for\s*later)?$/i,             // "Save for Later", "Save"
  /^add\s*to\s*(cart|bag|wishlist)$/i,    // "Add to Cart"
  /^select\s/i,                           // "Select a ..."
  /^choose\s/i,                           // "Choose ..."
  /^enter\s/i,                            // "Enter zip code"
  /^none$/i,                              // "None"
  /^not\s*selected$/i,                    // "Not selected"
  /^n\/a$/i,
  /^\d+\s*options?$/i,                   // "4 options"
  /^see\s+(all|more)/i,                  // "See all", "See more"
  /^show\s+(all|more)/i,                 // "Show all"
];

function cleanAvailableOptions(
  options: Array<{ type: string; values: string[] }>,
  productName: string,
): Array<{ type: string; values: string[] }> {
  const productNameLower = productName.toLowerCase().trim();

  return options
    .filter(opt => !NOISE_OPTION_TYPES.has(opt.type.toLowerCase().trim()))
    .map(opt => {
      // Deduplicate and filter noisy values
      const seen = new Set<string>();
      const cleanValues = opt.values.filter(v => {
        const vLower = v.toLowerCase().trim();
        // Skip duplicates
        if (seen.has(vLower)) return false;
        seen.add(vLower);
        // Skip if value matches the product name
        if (vLower === productNameLower) return false;
        // Skip UI action patterns
        if (NOISE_VALUE_PATTERNS.some(pat => pat.test(v.trim()))) return false;
        return true;
      });
      return { type: opt.type, values: cleanValues };
    })
    .filter(opt => opt.values.length >= 2); // Must have 2+ values to be a real option
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

  // Currency
  if (raw.currency && typeof raw.currency === 'string') {
    const c = raw.currency.trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(c)) result.currency = c;
  }
  if (!result.currency) {
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

  // Category: use AI result, fall back to deterministic pre-match, then normalize to taxonomy
  if (raw.category && typeof raw.category === 'string') {
    result.category = normalizeCategoryToTaxonomy(raw.category);
  } else if (preCategory) {
    result.category = normalizeCategoryToTaxonomy(preCategory);
  }

  // ── New variant-aware fields ──

  // variantId
  if (raw.variantId && typeof raw.variantId === 'string') {
    result.variantId = raw.variantId.trim();
  } else if (raw.variant_id && typeof raw.variant_id === 'string') {
    result.variantId = raw.variant_id.trim();
  } else {
    // Try to extract from URL query param
    try {
      const url = new URL(sourceUrl);
      const vid = url.searchParams.get('variant');
      if (vid) result.variantId = vid;
    } catch { /* ignore */ }
  }

  // SKU
  if (raw.sku && typeof raw.sku === 'string') {
    result.sku = raw.sku.trim();
  } else if (raw.metadata?.sku && typeof raw.metadata.sku === 'string') {
    result.sku = raw.metadata.sku.trim();
  }

  // activeVariant
  if (raw.activeVariant && typeof raw.activeVariant === 'object' && !Array.isArray(raw.activeVariant)) {
    const av = { ...raw.activeVariant } as Record<string, string | number>;
    // Ensure price is numeric
    if (av.price != null) {
      const p = typeof av.price === 'string'
        ? parseFloat(String(av.price).replace(/[^0-9.]/g, ''))
        : Number(av.price);
      av.price = !isNaN(p) && p > 0 ? p : 0;
    }
    result.activeVariant = av;
  } else if (raw.active_variant && typeof raw.active_variant === 'object') {
    result.activeVariant = raw.active_variant;
  }

  // images
  if (raw.images && typeof raw.images === 'object' && !Array.isArray(raw.images)) {
    const imgs: ExtractedProductData['images'] = {};
    if (raw.images.primary && typeof raw.images.primary === 'string' && raw.images.primary.startsWith('http')) {
      imgs.primary = raw.images.primary;
    }
    if (Array.isArray(raw.images.gallery)) {
      imgs.gallery = raw.images.gallery.filter((u: unknown) => typeof u === 'string' && String(u).startsWith('http'));
    }
    if (raw.images.note && typeof raw.images.note === 'string') {
      imgs.note = raw.images.note;
    }
    if (Object.keys(imgs).length > 0) result.images = imgs;
  }
  // Fallback: build images from legacy imageUrl field
  if (!result.images?.primary) {
    const imgUrl = raw.imageUrl ?? raw.images?.primary;
    if (imgUrl && typeof imgUrl === 'string' && imgUrl.startsWith('http')) {
      result.images = { ...(result.images || {}), primary: imgUrl };
    }
  }

  // pricing — full variant price matrix
  if (Array.isArray(raw.pricing) && raw.pricing.length > 0) {
    result.pricing = raw.pricing
      .filter((entry: any) => entry && typeof entry === 'object')
      .map((entry: any) => {
        const normalized: Record<string, string | number> = {};
        for (const [k, v] of Object.entries(entry)) {
          if (k === 'price') {
            const p = typeof v === 'string' ? parseFloat(String(v).replace(/[^0-9.]/g, '')) : Number(v);
            normalized.price = !isNaN(p) ? p : 0;
          } else if (typeof v === 'string' || typeof v === 'number') {
            normalized[k] = v;
          }
        }
        return normalized;
      });
  }

  // If no pricing array but we have activeVariant or legacy price, build one
  if (!result.pricing || result.pricing.length === 0) {
    if (result.activeVariant?.price != null) {
      result.pricing = [{ ...result.activeVariant }];
    } else if (raw.price != null) {
      const p = typeof raw.price === 'string'
        ? parseFloat(raw.price.replace(/[^0-9.]/g, ''))
        : Number(raw.price);
      if (!isNaN(p) && p > 0) {
        result.pricing = [{ price: p }];
      }
    }
  }

  // If no activeVariant but we have pricing, use first entry
  if (!result.activeVariant && result.pricing && result.pricing.length > 0) {
    result.activeVariant = { ...result.pricing[0] };
  }

  // availableOptions
  if (Array.isArray(raw.availableOptions) && raw.availableOptions.length > 0) {
    const opts: Array<{ type: string; values: string[] }> = [];
    for (const opt of raw.availableOptions) {
      if (opt && (typeof opt.type === 'string' || typeof opt.name === 'string') && Array.isArray(opt.values)) {
        const values = opt.values.filter((v: unknown) => typeof v === 'string' && v.length > 0);
        if (values.length >= 2) {
          opts.push({ type: (opt.type || opt.name).trim(), values });
        }
      }
    }
    if (opts.length > 0) result.availableOptions = opts;
  }
  // Fallback: build from legacy options array
  if (!result.availableOptions && Array.isArray(raw.options) && raw.options.length > 0) {
    const opts: Array<{ type: string; values: string[] }> = [];
    for (const opt of raw.options) {
      if (opt && typeof opt.name === 'string' && Array.isArray(opt.values)) {
        const values = opt.values.filter((v: unknown) => typeof v === 'string' && v.length > 0);
        if (values.length >= 2) {
          opts.push({ type: opt.name.trim(), values });
        }
      }
    }
    if (opts.length > 0) result.availableOptions = opts;
  }
  // Fallback: build from metadata availableColors/availableSizes and finishes
  if (!result.availableOptions) {
    const autoOpts: Array<{ type: string; values: string[] }> = [];
    const md = raw.metadata;
    if (md) {
      if (Array.isArray(md.availableColors) && md.availableColors.length >= 2) {
        autoOpts.push({ type: 'Color', values: md.availableColors.filter((v: unknown) => typeof v === 'string') });
      }
      if (Array.isArray(md.availableSizes) && md.availableSizes.length >= 2) {
        autoOpts.push({ type: 'Size', values: md.availableSizes.filter((v: unknown) => typeof v === 'string') });
      }
    }
    if (!autoOpts.some(o => o.type === 'Color') && Array.isArray(raw.finishes) && raw.finishes.length >= 2) {
      autoOpts.push({ type: 'Color', values: raw.finishes.filter((f: unknown) => typeof f === 'string') });
    }
    if (autoOpts.length > 0) result.availableOptions = autoOpts;
  }

  // features
  if (Array.isArray(raw.features) && raw.features.length > 0) {
    result.features = raw.features.filter((f: unknown) => typeof f === 'string' && f.length > 0);
  }
  // Fallback: promote from metadata.keyFeatures
  if (!result.features || result.features.length === 0) {
    if (raw.metadata?.keyFeatures && Array.isArray(raw.metadata.keyFeatures)) {
      result.features = raw.metadata.keyFeatures.filter((f: unknown) => typeof f === 'string');
    }
  }

  // materials — structured object
  if (raw.materials && typeof raw.materials === 'object' && !Array.isArray(raw.materials)) {
    result.materials = {};
    for (const [k, v] of Object.entries(raw.materials)) {
      if (typeof v === 'string' && v.length > 0) {
        result.materials[k] = v.trim();
      } else if (Array.isArray(v)) {
        result.materials[k] = v.filter((s: unknown) => typeof s === 'string');
      }
    }
    if (Object.keys(result.materials).length === 0) result.materials = undefined;
  }
  // Fallback: build from legacy material string
  if (!result.materials && raw.material && typeof raw.material === 'string') {
    result.materials = { primary: raw.material.trim() };
  }

  // promotions
  if (Array.isArray(raw.promotions) && raw.promotions.length > 0) {
    result.promotions = raw.promotions.filter((p: unknown) => typeof p === 'string' && p.length > 0);
  }

  // shipping
  if (raw.shipping && typeof raw.shipping === 'string') {
    result.shipping = raw.shipping.trim();
  }

  // availability
  if (raw.availability && typeof raw.availability === 'string') {
    result.availability = raw.availability.trim();
  }

  // productUrl
  const pUrl = raw.productUrl ?? raw.product_url;
  if (pUrl && typeof pUrl === 'string' && pUrl.startsWith('http')) {
    result.productUrl = pUrl;
  } else {
    result.productUrl = sourceUrl;
  }

  // Dimensions — aggressive normalization (unchanged logic)
  if (raw.dimensions && typeof raw.dimensions === 'object') {
    const d = raw.dimensions;
    const dims: ExtractedProductData['dimensions'] = {};
    if (d.length != null && !isNaN(Number(d.length))) dims.length = Number(d.length);
    if (d.width != null && !isNaN(Number(d.width))) dims.width = Number(d.width);
    if (d.height != null && !isNaN(Number(d.height))) dims.height = Number(d.height);
    if (d.depth != null && !isNaN(Number(d.depth))) dims.depth = Number(d.depth);
    if (d.weight != null && !isNaN(Number(d.weight))) dims.weight = Number(d.weight);
    if (typeof d.unit === 'string') dims.unit = d.unit;
    if (d.raw && typeof d.raw === 'string') dims.raw = d.raw;
    const normalized = normalizeDimensionsObject(dims);
    if (normalized && Object.keys(normalized).length > 0) result.dimensions = normalized;
  }

  if (raw.leadTime && typeof raw.leadTime === 'string') result.leadTime = raw.leadTime.trim();

  // ── Secondary dimensions: promote from metadata and raw ──
  const secDimKeys: Record<string, string> = {
    seatHeight: 'seatHeight', seat_height: 'seatHeight',
    seatDepth: 'seatDepth', seat_depth: 'seatDepth',
    seatWidth: 'seatWidth', seat_width: 'seatWidth',
    armHeight: 'armHeight', arm_height: 'armHeight',
    clearance: 'clearance',
    diameter: 'diameter',
  };
  const secDims: ExtractedProductData['secondaryDimensions'] = {};
  // From raw.secondaryDimensions if LLM returned them directly
  if (raw.secondaryDimensions && typeof raw.secondaryDimensions === 'object') {
    for (const [k, v] of Object.entries(raw.secondaryDimensions)) {
      if (v != null && !isNaN(Number(v)) && Number(v) > 0) {
        secDims[k] = Number(v);
      }
    }
  }
  // Promote from metadata string fields (e.g., "seatHeight": "18 inches")
  const md = raw.metadata;
  if (md && typeof md === 'object') {
    for (const [rawKey, normalizedKey] of Object.entries(secDimKeys)) {
      if (secDims[normalizedKey] != null) continue; // already set
      const val = md[rawKey];
      if (typeof val === 'string') {
        const numMatch = val.match(/(\d+(?:\.\d+)?)/);
        if (numMatch) secDims[normalizedKey] = Number(numMatch[1]);
      } else if (typeof val === 'number' && val > 0) {
        secDims[normalizedKey] = val;
      }
    }
  }
  if (Object.keys(secDims).length > 0) {
    if (!secDims.unit && result.dimensions?.unit) secDims.unit = result.dimensions.unit;
    result.secondaryDimensions = secDims;
  }

  // ── Legacy fields for backward compat ──

  // price — derive from activeVariant for legacy consumers
  if (result.activeVariant?.price != null) {
    result.price = Number(result.activeVariant.price);
  } else if (raw.price != null) {
    const p = typeof raw.price === 'string'
      ? parseFloat(raw.price.replace(/[^0-9.]/g, ''))
      : Number(raw.price);
    if (!isNaN(p) && p > 0) result.price = p;
  }

  // imageUrl — derive from images.primary for legacy consumers
  if (result.images?.primary) {
    result.imageUrl = result.images.primary;
  }

  // material — derive from materials.primary for legacy consumers
  if (result.materials?.primary && typeof result.materials.primary === 'string') {
    result.material = result.materials.primary;
  }

  // finishes + legacy options are derived after cross-validation (below)

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

  // ── Post-extraction validation: sanity-check dimensions and prices by category ──
  validateExtraction(result);

  // ── Cross-validation: ensure availableOptions, activeVariant, and pricing are consistent ──

  // Collect all option keys that appear in pricing entries (excluding 'price')
  const pricingOptionKeys = new Set<string>();
  if (result.pricing) {
    for (const entry of result.pricing) {
      for (const key of Object.keys(entry)) {
        if (key !== 'price') pricingOptionKeys.add(key);
      }
    }
  }

  // Collect all option keys from activeVariant (excluding 'price')
  const activeVariantKeys = new Set<string>();
  if (result.activeVariant) {
    for (const key of Object.keys(result.activeVariant)) {
      if (key !== 'price') activeVariantKeys.add(key);
    }
  }

  // Build a map of existing availableOptions by lowercase type
  const existingOptionTypes = new Map<string, { type: string; values: Set<string> }>();
  if (result.availableOptions) {
    for (const opt of result.availableOptions) {
      existingOptionTypes.set(opt.type.toLowerCase(), { type: opt.type, values: new Set(opt.values) });
    }
  }

  // Merge option keys from pricing and activeVariant into availableOptions
  const allOptionKeys = new Set([...pricingOptionKeys, ...activeVariantKeys]);
  for (const key of allOptionKeys) {
    const existing = existingOptionTypes.get(key.toLowerCase());
    // Collect all values for this key from pricing entries
    const valuesFromPricing = new Set<string>();
    if (result.pricing) {
      for (const entry of result.pricing) {
        const val = entry[key];
        if (val != null && typeof val === 'string') valuesFromPricing.add(val);
      }
    }
    // Add value from activeVariant
    if (result.activeVariant?.[key] != null && typeof result.activeVariant[key] === 'string') {
      valuesFromPricing.add(result.activeVariant[key] as string);
    }

    if (existing) {
      // Merge any new values into existing option
      for (const v of valuesFromPricing) existing.values.add(v);
    } else if (valuesFromPricing.size >= 2) {
      // New option type discovered from pricing/activeVariant — add it
      // Capitalize the key for display (e.g., "finish" → "Finish")
      const displayType = key.charAt(0).toUpperCase() + key.slice(1);
      existingOptionTypes.set(key.toLowerCase(), { type: displayType, values: valuesFromPricing });
    }
  }

  // ── Promote materials into availableOptions ──
  // Only promote when materials represent genuinely selectable alternatives
  // (e.g., "Oak" vs "Walnut" for frame). Do NOT promote when the materials object
  // describes different COMPONENTS of the product (frame, upholstery, legs, etc.)
  // — those are descriptions, not user-selectable options.
  if (result.materials) {
    const materialOptionKey = 'material';

    // Check if a Material option already exists from LLM/Shopify/pricing data
    if (!existingOptionTypes.has(materialOptionKey)) {
      const materialValues = new Set<string>();

      // Only promote if there's a single "primary" key with multiple values,
      // or an explicit "options" array. Multiple component keys (frame, upholstery, legs)
      // indicate a bill-of-materials, not selectable choices.
      const componentKeys = Object.keys(result.materials).filter(
        k => k !== 'certifications' && k !== 'finish_coating'
      );
      const isBillOfMaterials = componentKeys.length >= 2;

      if (!isBillOfMaterials) {
        for (const [key, val] of Object.entries(result.materials)) {
          if (key === 'certifications' || key === 'finish_coating') continue;
          if (Array.isArray(val)) {
            for (const v of val) {
              if (typeof v === 'string' && v.length > 0) materialValues.add(v);
            }
          } else if (typeof val === 'string' && val.length > 0) {
            materialValues.add(val);
          }
        }
      }

      // Only add as option if there are 2+ selectable values
      if (materialValues.size >= 2) {
        existingOptionTypes.set(materialOptionKey, {
          type: 'Material',
          values: materialValues,
        });
      }
    }
  }

  // ── Merge DOM-extracted options (supplementary) ──
  // DOM options may capture options the LLM missed (e.g., Finish swatches on custom frontends)
  // Only add option types that don't already exist.
  // This is handled by the cross-validation above for pricing/activeVariant keys,
  // but DOM options need explicit merging here since they're not in the pricing matrix.

  // Rebuild availableOptions from the merged map
  if (existingOptionTypes.size > 0) {
    result.availableOptions = Array.from(existingOptionTypes.values())
      .filter(opt => opt.values.size >= 2)
      .map(opt => ({ type: opt.type, values: Array.from(opt.values) }));
  }

  // ── Clean options: remove UI noise, deduplicate values ──
  if (result.availableOptions) {
    result.availableOptions = cleanAvailableOptions(result.availableOptions, result.productName);
    if (result.availableOptions.length === 0) result.availableOptions = undefined;
  }

  // Re-derive legacy fields after cross-validation
  if (result.availableOptions) {
    const finishOpt = result.availableOptions.find(o => ['Finish', 'Color', 'Fabric'].includes(o.type));
    if (finishOpt) result.finishes = finishOpt.values;
    result.options = result.availableOptions.map(o => ({ name: o.type, values: o.values }));
  }

  return result;
}
