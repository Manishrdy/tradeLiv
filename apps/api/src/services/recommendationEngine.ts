import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import logger from '../config/logger';

let _client: Anthropic | null = null;
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: config.claudeApiKey });
  return _client;
}

const MODEL = 'claude-sonnet-4-6';

/* ─── Types ──────────────────────────────────────── */

export interface RecommendationInput {
  room: {
    name: string;
    dimensions: string | null; // e.g. "18ft × 14ft (252 sqft)"
    categoryNeeds: string[];
    budgetRange: string | null; // e.g. "$8,000 – $12,000"
  } | null;
  clientRequirements: {
    colorPalette?: string;
    materialPreferences?: string;
    seatingCapacity?: number;
    functionalConstraints?: string;
    budgetPriority?: string;
  } | null;
  comparedProducts: Array<{
    name: string;
    brand: string | null;
    price: string;
    dimensions: string | null;
    material: string | null;
    leadTime: string | null;
    finishes: string[];
    features: string[];
    availability: string | null;
  }>;
  designerNotes?: string;
}

export interface RecommendationResult {
  recommendation: string;
  tradeOffs: string[];
  internalNotes: string[];
  recommendedProduct: string | null; // product name Claude recommended
}

/* ─── System prompt ──────────────────────────────── */

const SYSTEM_PROMPT = `You are an expert interior designer's assistant helping prepare a product recommendation for a client. You will be given room context, client requirements, and a set of compared furniture products.

Your task:
1. Identify the best-fit product based on the client's stated requirements and room constraints.
2. Write a 2–4 sentence recommendation summary in a warm, professional tone suitable for sharing directly with the client. Reference specific product attributes and client requirements to justify the recommendation.
3. Write 2–3 trade-off bullet points comparing the top options. Be honest about trade-offs (price vs. quality, lead time, material, etc.)
4. Write 1–2 internal notes (for the designer only, never shared with client) about any concerns the designer should be aware of before finalizing.

Do not invent data. If a field is missing, acknowledge it rather than assume.
Tone: Confident but not salesy. This is a professional tool, not marketing copy.

Respond in the following JSON format ONLY — no markdown, no extra text:
{
  "recommendedProduct": "Product Name",
  "recommendation": "2-4 sentence summary for the client...",
  "tradeOffs": [
    "Trade-off point 1",
    "Trade-off point 2"
  ],
  "internalNotes": [
    "Internal note for designer only"
  ]
}`;

/* ─── Generate recommendation ────────────────────── */

export async function generateRecommendation(
  input: RecommendationInput,
): Promise<RecommendationResult> {
  const client = getClient();

  const userPayload: Record<string, unknown> = {};

  if (input.room) {
    userPayload.room = {
      name: input.room.name,
      dimensions: input.room.dimensions || 'Not specified',
      category_needs: input.room.categoryNeeds.length > 0 ? input.room.categoryNeeds : ['Not specified'],
      budget_range: input.room.budgetRange || 'Not specified',
    };
  }

  if (input.clientRequirements) {
    const cr = input.clientRequirements;
    userPayload.client_requirements = {
      color_palette: cr.colorPalette || 'Not specified',
      material_preferences: cr.materialPreferences || 'Not specified',
      functional_constraints: cr.functionalConstraints || 'None specified',
      seating_capacity: cr.seatingCapacity || 'Not specified',
      budget_priority: cr.budgetPriority || 'Not specified',
    };
  }

  userPayload.compared_products = input.comparedProducts.map((p) => ({
    name: p.name,
    brand: p.brand || 'Unknown brand',
    price: p.price || 'Not listed',
    dimensions: p.dimensions || 'Not listed',
    material: p.material || 'Not listed',
    lead_time: p.leadTime || 'Not listed',
    finishes: p.finishes.length > 0 ? p.finishes : ['Not listed'],
    features: p.features.length > 0 ? p.features.slice(0, 5) : ['Not listed'],
    availability: p.availability || 'Not listed',
  }));

  if (input.designerNotes) {
    userPayload.designer_notes = input.designerNotes;
  }

  const userMessage = JSON.stringify(userPayload, null, 2);

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    // Extract text from response
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Parse JSON from response (handle potential markdown code fences)
    const jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    return {
      recommendation: parsed.recommendation || '',
      tradeOffs: Array.isArray(parsed.tradeOffs) ? parsed.tradeOffs : [],
      internalNotes: Array.isArray(parsed.internalNotes) ? parsed.internalNotes : [],
      recommendedProduct: parsed.recommendedProduct || null,
    };
  } catch (err: any) {
    const errMsg = err?.message || err?.error?.message || String(err);
    const errStatus = err?.status;
    const errType = err?.error?.type;
    logger.error('recommendation generation failed', {
      message: errMsg,
      status: errStatus,
      type: errType,
      name: err?.name,
    });
    throw new Error(errMsg || 'Failed to generate recommendation. Please try again.');
  }
}
