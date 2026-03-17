import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import logger from '../config/logger';

const client = new Anthropic({ apiKey: config.claudeApiKey });

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

const SYSTEM_PROMPT = `You are a furniture product data extractor for an interior design trade platform.

When given a URL, use web search to visit the page and extract product data. First determine if it is:
A) A SINGLE PRODUCT page (shows one product with details, price, specs)
B) A COLLECTION/CATEGORY page (shows a grid/list of multiple products)

After searching, respond with ONLY a valid JSON object (no markdown, no backticks, no explanation).

For a SINGLE PRODUCT page, return:
{
  "type": "single",
  "product": {
    "productName": "exact product name",
    "brandName": "manufacturer or brand",
    "price": 1299.00,
    "imageUrl": "direct URL to the main product image (full https:// URL)",
    "productUrl": "canonical product page URL",
    "dimensions": { "length": 84, "width": 37, "height": 33, "unit": "in" },
    "material": "primary material",
    "finishes": ["Finish 1", "Finish 2"],
    "leadTime": "e.g. 4-6 weeks",
    "category": "one of the allowed categories"
  }
}

For a COLLECTION/CATEGORY page, return:
{
  "type": "multiple",
  "totalFound": 12,
  "products": [
    {
      "productName": "Product 1",
      "brandName": "Brand",
      "price": 999.00,
      "imageUrl": "direct image URL",
      "productUrl": "link to the individual product page",
      "category": "category"
    }
  ]
}

Rules:
- price: Extract the EXACT price shown as the primary/main price on the page for the specific product or variant in the URL. Do NOT use "starting from", "as low as", or the lowest variant price. If the URL contains a variant parameter, use that variant's price. If a single price is displayed prominently, use that. If a sale price is shown alongside a strikethrough original, use the sale price (the one the customer pays). Omit price entirely if you cannot find a specific, confident value on the page.
- dimensions: numeric values. Set unit to original unit on the page.
- imageUrl must be a direct image URL (from a CDN or ending in .jpg/.png/.webp), not a page URL.
- finishes: array of available finish/color options. Omit if none found.
- category must be one of: Sofa, Dining Table, Bed, Desk, Storage, Lighting, Armchair, Side Table, Bookshelf, Mirror, Rug, Wardrobe, TV Unit, Coffee Table, Console Table, Bar Stool, Ottoman, Bench, Dresser, Nightstand, Chair, Table, Outdoor, Accessories
- For collection pages, include productUrl for each product.
- IMPORTANT: Your final message MUST be ONLY the JSON object. No other text.`;

export async function extractProductFromUrl(sourceUrl: string): Promise<ExtractionResult> {
  // Build initial messages
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Extract product details from this URL: ${sourceUrl}`,
    },
  ];

  // Multi-turn loop: keep going while Claude wants to use tools
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    attempts++;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages,
      tools: [{ type: 'web_search_20250305' as any, name: 'web_search' }],
    });

    // Check if the response contains tool use — if so, we need to continue
    const hasToolUse = response.content.some((block) => block.type === 'tool_use');
    const textBlocks = response.content.filter((block) => block.type === 'text');

    if (hasToolUse) {
      // Add the assistant's response (with tool use) to messages
      messages.push({ role: 'assistant', content: response.content as any });

      // Build tool results for each tool use block
      const toolResults: any[] = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          // web_search_20250305 is server-side — Anthropic executes the search before
          // returning the response. We acknowledge with empty content so Claude continues
          // using the real search results already in its context.
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: '',
          });
        }
      }
      messages.push({ role: 'user', content: toolResults });

      // If we also got a text block with valid JSON, try parsing it
      if (textBlocks.length > 0) {
        const jsonResult = tryParseJsonFromBlocks(textBlocks);
        if (jsonResult) return buildResult(jsonResult);
      }

      // Otherwise continue the loop
      continue;
    }

    // No tool use — this should be the final response with JSON
    if (textBlocks.length > 0) {
      const jsonResult = tryParseJsonFromBlocks(textBlocks);
      if (jsonResult) return buildResult(jsonResult);
    }

    // If stop_reason is end_turn and we have no parseable JSON, one more nudge
    if (response.stop_reason === 'end_turn' && attempts < maxAttempts) {
      messages.push({ role: 'assistant', content: response.content as any });
      messages.push({
        role: 'user',
        content: 'Please provide the extracted product data as a JSON object now. No explanation, just the JSON.',
      });
      continue;
    }

    // Give up
    const lastText = textBlocks.map((b: any) => b.text).join('\n').slice(0, 300);
    logger.warn('Extractor did not return valid JSON after all attempts', { lastText, attempts });
    throw new Error('Failed to extract product data. The page may be difficult to read. Try a different URL or add the product manually.');
  }

  throw new Error('Extraction timed out after multiple attempts. Try a different URL.');
}

function tryParseJsonFromBlocks(textBlocks: any[]): any | null {
  for (const block of textBlocks) {
    if (block.type !== 'text') continue;
    let text = block.text.trim();
    if (!text) continue;

    // Strip markdown fences
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    // Try to find JSON in the text (might have leading/trailing prose)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) continue;

    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      continue;
    }
  }
  return null;
}

function buildResult(parsed: any): ExtractionResult {
  // Handle flat array
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) throw new Error('No products found on this page.');
    if (parsed.length === 1) {
      return { type: 'single', product: normalizeProduct(parsed[0]) };
    }
    return {
      type: 'multiple',
      totalFound: parsed.length,
      products: parsed.map(normalizeProduct),
    };
  }

  // Structured response with type field
  if (parsed.type === 'multiple' && Array.isArray(parsed.products)) {
    if (parsed.products.length === 0) throw new Error('No products found on this page.');
    return {
      type: 'multiple',
      totalFound: parsed.totalFound ?? parsed.products.length,
      products: parsed.products.map(normalizeProduct),
    };
  }

  // Single product
  const productData = parsed.product ?? parsed;

  if (!productData.productName || typeof productData.productName !== 'string') {
    throw new Error('Could not extract product name from this page.');
  }

  return { type: 'single', product: normalizeProduct(productData) };
}

function normalizeProduct(raw: any): ExtractedProductData {
  const result: ExtractedProductData = {
    productName: raw.productName || raw.product_name || 'Unknown Product',
  };

  if (raw.brandName && typeof raw.brandName === 'string') {
    result.brandName = raw.brandName;
  }
  if (raw.price != null) {
    const p = typeof raw.price === 'string'
      ? parseFloat(raw.price.replace(/[^0-9.]/g, ''))
      : Number(raw.price);
    if (!isNaN(p) && p > 0) result.price = p;
  }
  if (raw.imageUrl && typeof raw.imageUrl === 'string' && raw.imageUrl.startsWith('http')) {
    result.imageUrl = raw.imageUrl;
  }
  if (raw.productUrl && typeof raw.productUrl === 'string' && raw.productUrl.startsWith('http')) {
    result.productUrl = raw.productUrl;
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
  if (raw.material && typeof raw.material === 'string') {
    result.material = raw.material;
  }
  if (Array.isArray(raw.finishes) && raw.finishes.length > 0) {
    result.finishes = raw.finishes.filter((f: unknown) => typeof f === 'string' && f.length > 0);
  }
  if (raw.leadTime && typeof raw.leadTime === 'string') {
    result.leadTime = raw.leadTime;
  }
  if (raw.category && typeof raw.category === 'string') {
    result.category = raw.category;
  }

  return result;
}
