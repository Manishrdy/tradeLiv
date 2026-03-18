import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import logger from '../config/logger';

const client = new Anthropic({ apiKey: config.claudeApiKey });

/* ─── Models ─────────────────────────────────────────── */

const MODEL_FAST = 'claude-haiku-4-5-20251001';  // Direct extraction (no tools)
const MODEL_SEARCH = 'claude-sonnet-4-6';         // Web search fallback

/* ─── Constants ─────────────────────────────────────── */

// Signals (meta/JSON-LD) are always in <head>; 150KB captures it entirely.
const HTML_READ_LIMIT = 150_000;

/* ─── Types ──────────────────────────────────────────── */

export interface ExtractedProductData {
  productName: string;
  brandName?: string;
  price?: number;
  imageUrl?: string;
  productUrl?: string;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    unit?: 'in' | 'cm' | 'ft';
  };
  material?: string;
  finishes?: string[];
  leadTime?: string;
  category?: string;
}

export interface ExtractionResult {
  type: 'single' | 'multiple';
  product?: ExtractedProductData;
  products?: ExtractedProductData[];
  totalFound?: number;
}

/* ─── System prompt ──────────────────────────────────── */

const SYSTEM_PROMPT = `You are a furniture product data extractor for an interior design trade platform.

You receive structured signals extracted from a product page (meta tags, JSON-LD, breadcrumbs, etc.).
Respond with ONLY a valid JSON object. No markdown, no explanation, no extra text.

REQUIRED — always include these four fields:
- productName: the product name. Use og:title or JSON-LD name. Strip " | Brand" or " - Site Name" suffixes from titles.
- price: number only (e.g. 1299.00). Use the current/sale price if shown. null if no price found anywhere.
- imageUrl: the main product image as a full https:// URL. Prefer og:image, then JSON-LD image, then twitter:image. CDN URLs with query params (e.g. ?w=800&fmt=webp) are valid — include them exactly. null only if truly no image signal exists.
- category: ALWAYS infer the furniture category, even if not explicit. Use the product name and breadcrumbs. Must be exactly one of: Sofa, Dining Table, Bed, Desk, Storage, Lighting, Armchair, Side Table, Bookshelf, Mirror, Rug, Wardrobe, TV Unit, Coffee Table, Console Table, Bar Stool, Ottoman, Bench, Dresser, Nightstand, Chair, Table, Outdoor, Accessories

OPTIONAL — include only when clearly present in the signals:
- brandName: manufacturer or brand name
- dimensions: { length, width, height, unit } — unit must be "in", "cm", or "ft"
- material: primary material (e.g. "Solid Walnut", "Bouclé Fabric")
- finishes: array of finish/color option strings
- leadTime: delivery lead time string (e.g. "4–6 weeks")
- productUrl: canonical product page URL

For a SINGLE PRODUCT page respond:
{
  "type": "single",
  "product": {
    "productName": "Sven Charme Tan Sofa",
    "price": 1895.00,
    "imageUrl": "https://cdn.example.com/sven-sofa.jpg?w=800",
    "category": "Sofa",
    "brandName": "Article",
    "productUrl": "https://example.com/products/sven-sofa"
  }
}

For a COLLECTION/CATEGORY page (multiple products visible) respond:
{
  "type": "multiple",
  "totalFound": 24,
  "products": [
    { "productName": "...", "price": 999.00, "imageUrl": "https://...", "category": "Chair", "productUrl": "https://..." }
  ]
}

Rules:
- price: numeric only, no currency symbols or commas. Use sale/current price. null if absent.
- imageUrl: must start with https://. Include CDN query params as-is. Never fabricate a URL.
- category: always infer from product name or breadcrumbs. Never leave this null.
- Output ONLY the JSON object.`;

/* ─── HTML fetch ─────────────────────────────────────── */

async function fetchPageHtml(url: string): Promise<string | null> {
  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Dest': 'document',
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
        return text.length > HTML_READ_LIMIT ? text.slice(0, HTML_READ_LIMIT) : text;
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
    // If offers is an @id reference, look it up in the graph
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
          description:
            typeof product.description === 'string' ? product.description.slice(0, 300) : undefined,
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

  // ── Microdata (itemprop) fallbacks ───────────────────
  const itempropPrice =
    html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/itemprop=["']price["'][^>]*>\s*([0-9][0-9,. ]*)/i);
  if (itempropPrice) lines.push(`itemprop_price: ${itempropPrice[1].trim()}`);

  const itempropName = html.match(/itemprop=["']name["'][^>]*content=["']([^"']+)["']/i);
  if (itempropName) lines.push(`itemprop_name: ${itempropName[1]}`);

  const itempropImage =
    html.match(/itemprop=["']image["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/itemprop=["']image["'][^>]*src=["']([^"']+)["']/i);
  if (itempropImage) lines.push(`itemprop_image: ${itempropImage[1]}`);

  // ── data-price fallback ──────────────────────────────
  const dataPrice = html.match(/\bdata-price=["']([0-9]+(?:\.[0-9]{1,2})?)["']/);
  if (dataPrice) lines.push(`data_price: ${dataPrice[1]}`);

  return lines.join('\n');
}

/* ─── Main extractor ─────────────────────────────────── */

export async function extractProductFromUrl(sourceUrl: string): Promise<ExtractionResult> {
  // Stage 1: Direct fetch → signal extraction → Claude (no tools)
  const html = await fetchPageHtml(sourceUrl);

  if (html && html.length > 500) {
    const signals = extractSignals(html, sourceUrl);
    logger.info('Page signals extracted', {
      url: sourceUrl,
      signalCount: signals.split('\n').length,
      htmlBytes: html.length,
    });

    try {
      const response = await client.messages.create({
        model: MODEL_FAST,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: `Extract product data from these page signals:\n\n${signals}` },
        ],
      });

      const textBlock = response.content.find((b) => b.type === 'text') as any;
      if (textBlock?.text) {
        const parsed = tryParseJson(textBlock.text);
        if (parsed) {
          logger.info('Direct extraction succeeded', { url: sourceUrl });
          return buildResult(parsed, sourceUrl);
        }
      }
      logger.warn('Direct extraction returned no JSON', { url: sourceUrl });
    } catch (err: any) {
      logger.error('Direct extraction Claude call failed', { url: sourceUrl, err: err?.message });
    }
  } else {
    logger.info('HTML fetch returned empty/short content', { url: sourceUrl, bytes: html?.length ?? 0 });
  }

  // Stage 2: Fallback — web search (JS-rendered pages, anti-bot protected sites)
  logger.info('Falling back to web search', { url: sourceUrl });
  return extractWithWebSearch(sourceUrl);
}

/* ─── Web search fallback ────────────────────────────── */

async function extractWithWebSearch(sourceUrl: string): Promise<ExtractionResult> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Search for the product at this URL and extract its details:\n${sourceUrl}\n\nI need: name, price, main image URL, and furniture category. Return ONLY the JSON object as specified.`,
    },
  ];

  const MAX_TURNS = 4;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.messages.create({
      model: MODEL_SEARCH,
      max_tokens: 2048,
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

    if (stop_reason === 'max_tokens') {
      // No point continuing — model ran out of space
      break;
    }

    if (stop_reason === 'tool_use') {
      // `web_search_20250305` is server-side: Anthropic executes the search.
      // Send back the assistant turn + empty tool_result acknowledgements to continue.
      messages.push({ role: 'assistant', content: content as any });

      const toolUseBlocks = content.filter((b) => b.type === 'tool_use') as any[];
      messages.push({
        role: 'user',
        content: toolUseBlocks.map((b) => ({
          type: 'tool_result' as const,
          tool_use_id: b.id,
          content: '',  // server-side: Anthropic already has the results
        })) as any,
      });
      continue;
    }

    if (stop_reason === 'end_turn') {
      // Model finished but didn't return JSON — nudge once more
      if (turn < MAX_TURNS - 1) {
        messages.push({ role: 'assistant', content: content as any });
        messages.push({
          role: 'user',
          content:
            'Output ONLY the JSON object with the product data. No explanation, no markdown fences.',
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
  throw new Error(
    'Failed to extract product data from this page. Try a different URL or add the product manually.',
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

function buildResult(parsed: any, sourceUrl: string): ExtractionResult {
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) throw new Error('No products found on this page.');
    if (parsed.length === 1)
      return { type: 'single', product: normalizeProduct(parsed[0], sourceUrl) };
    return {
      type: 'multiple',
      totalFound: parsed.length,
      products: parsed.map((p) => normalizeProduct(p, sourceUrl)),
    };
  }

  if (parsed.type === 'multiple' && Array.isArray(parsed.products)) {
    if (parsed.products.length === 0) throw new Error('No products found on this page.');
    return {
      type: 'multiple',
      totalFound: parsed.totalFound ?? parsed.products.length,
      products: parsed.products.map((p: any) => normalizeProduct(p, sourceUrl)),
    };
  }

  const productData = parsed.product ?? parsed;
  if (!productData.productName || typeof productData.productName !== 'string') {
    throw new Error('Could not extract product name from this page.');
  }
  return { type: 'single', product: normalizeProduct(productData, sourceUrl) };
}

function normalizeProduct(raw: any, sourceUrl: string): ExtractedProductData {
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

  if (raw.dimensions && typeof raw.dimensions === 'object') {
    const d = raw.dimensions;
    const dims: ExtractedProductData['dimensions'] = {};
    if (d.length != null && !isNaN(Number(d.length))) dims.length = Number(d.length);
    if (d.width != null && !isNaN(Number(d.width))) dims.width = Number(d.width);
    if (d.height != null && !isNaN(Number(d.height))) dims.height = Number(d.height);
    if (['in', 'cm', 'ft'].includes(d.unit)) dims.unit = d.unit;
    if (Object.keys(dims).length > 0) result.dimensions = dims;
  }

  if (raw.material && typeof raw.material === 'string') result.material = raw.material.trim();

  if (Array.isArray(raw.finishes) && raw.finishes.length > 0) {
    result.finishes = raw.finishes.filter((f: unknown) => typeof f === 'string' && f.length > 0);
  }

  if (raw.leadTime && typeof raw.leadTime === 'string') result.leadTime = raw.leadTime.trim();
  if (raw.category && typeof raw.category === 'string') result.category = raw.category.trim();

  return result;
}
