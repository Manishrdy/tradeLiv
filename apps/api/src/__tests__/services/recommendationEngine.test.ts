/**
 * Tests for recommendationEngine.
 *
 * The engine calls the unified AI provider which is mocked here.
 * We test: response parsing, input building, and error handling.
 */

import { generateRecommendation, RecommendationInput } from '../../services/recommendationEngine';

// Mock the AI provider — intercept generateText calls
jest.mock('../../services/aiProvider', () => ({
  generateText: jest.fn().mockResolvedValue('{}'),
}));

import { generateText } from '../../services/aiProvider';

const mockGenerateText = generateText as jest.Mock;

const BASIC_INPUT: RecommendationInput = {
  room: {
    name: 'Living Room',
    dimensions: '18ft × 14ft (252 sqft)',
    categoryNeeds: ['Sofas', 'Coffee Tables'],
    budgetRange: '$5,000 – $10,000',
  },
  clientRequirements: {
    colorPalette: 'Warm neutrals',
    materialPreferences: 'Leather',
    seatingCapacity: 6,
  },
  comparedProducts: [
    {
      name: 'Haven Sofa',
      brand: 'West Elm',
      price: '$2,499',
      dimensions: '86"W × 36"D × 34"H',
      material: 'Top-grain leather',
      leadTime: '8-12 weeks',
      finishes: ['Camel', 'Charcoal'],
      features: ['Down-blend cushions', 'Kiln-dried hardwood frame'],
      availability: 'In stock',
    },
    {
      name: 'Harmony Sofa',
      brand: 'West Elm',
      price: '$3,199',
      dimensions: '92"W × 40"D × 35"H',
      material: 'Italian leather',
      leadTime: '10-14 weeks',
      finishes: ['Tan', 'Black'],
      features: ['Modular design', 'Stainless steel legs'],
      availability: 'Made to order',
    },
  ],
  designerNotes: 'Client prefers lower profile seating',
};

beforeEach(() => {
  mockGenerateText.mockReset();
});

/* ═══════════════════════════════════════════════════════
   Successful responses
   ═══════════════════════════════════════════════════════ */

describe('generateRecommendation — success', () => {
  it('returns parsed recommendation from AI response', async () => {
    mockGenerateText.mockResolvedValue(JSON.stringify({
      recommendedProduct: 'Haven Sofa',
      recommendation: 'The Haven Sofa is the best fit for your living room.',
      tradeOffs: ['Haven is cheaper but has longer lead time', 'Harmony offers modular design'],
      internalNotes: ['Check if camel leather matches existing furniture'],
    }));

    const result = await generateRecommendation(BASIC_INPUT);
    expect(result.recommendedProduct).toBe('Haven Sofa');
    expect(result.recommendation).toContain('Haven Sofa');
    expect(result.tradeOffs).toHaveLength(2);
    expect(result.internalNotes).toHaveLength(1);
  });

  it('handles response wrapped in markdown code fences', async () => {
    const json = {
      recommendedProduct: 'Harmony Sofa',
      recommendation: 'The Harmony Sofa offers the modular flexibility your client needs.',
      tradeOffs: ['Higher price point'],
      internalNotes: ['Made to order — confirm timeline with client'],
    };
    mockGenerateText.mockResolvedValue('```json\n' + JSON.stringify(json) + '\n```');

    const result = await generateRecommendation(BASIC_INPUT);
    expect(result.recommendedProduct).toBe('Harmony Sofa');
  });

  it('handles missing optional fields gracefully', async () => {
    mockGenerateText.mockResolvedValue(JSON.stringify({
      recommendation: 'Both products are suitable.',
      tradeOffs: ['Price difference'],
    }));

    const result = await generateRecommendation(BASIC_INPUT);
    expect(result.recommendedProduct).toBeNull();
    expect(result.recommendation).toBe('Both products are suitable.');
    expect(result.internalNotes).toEqual([]);
  });
});

/* ═══════════════════════════════════════════════════════
   Input building — verify what gets sent to AI
   ═══════════════════════════════════════════════════════ */

describe('generateRecommendation — input building', () => {
  it('sends room context, client requirements, and products to AI', async () => {
    mockGenerateText.mockResolvedValue('{"recommendedProduct":null,"recommendation":"OK","tradeOffs":[],"internalNotes":[]}');

    await generateRecommendation(BASIC_INPUT);

    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateText.mock.calls[0][0];

    // The userMessage is a JSON string of the payload
    const parsed = JSON.parse(callArgs.userMessage);

    expect(parsed.room.name).toBe('Living Room');
    expect(parsed.room.dimensions).toBe('18ft × 14ft (252 sqft)');
    expect(parsed.compared_products).toHaveLength(2);
    expect(parsed.compared_products[0].name).toBe('Haven Sofa');
    expect(parsed.client_requirements.color_palette).toBe('Warm neutrals');
    expect(parsed.designer_notes).toBe('Client prefers lower profile seating');
  });

  it('handles null room gracefully', async () => {
    mockGenerateText.mockResolvedValue('{"recommendedProduct":null,"recommendation":"OK","tradeOffs":[],"internalNotes":[]}');

    const input: RecommendationInput = {
      room: null,
      clientRequirements: null,
      comparedProducts: [
        { name: 'Sofa A', brand: 'Brand', price: '$1000', dimensions: null, material: null, leadTime: null, finishes: [], features: [], availability: null },
      ],
    };

    await generateRecommendation(input);

    const userMessage = JSON.parse(mockGenerateText.mock.calls[0][0].userMessage);
    expect(userMessage.room).toBeUndefined();
    expect(userMessage.client_requirements).toBeUndefined();
    expect(userMessage.compared_products).toHaveLength(1);
    expect(userMessage.compared_products[0].dimensions).toBe('Not listed');
    expect(userMessage.compared_products[0].finishes).toEqual(['Not listed']);
    expect(userMessage.compared_products[0].features).toEqual(['Not listed']);
  });

  it('truncates features to max 5 items', async () => {
    mockGenerateText.mockResolvedValue('{"recommendedProduct":null,"recommendation":"OK","tradeOffs":[],"internalNotes":[]}');

    const input: RecommendationInput = {
      room: null,
      clientRequirements: null,
      comparedProducts: [
        {
          name: 'Feature-heavy Sofa',
          brand: 'Brand',
          price: '$2000',
          dimensions: null,
          material: null,
          leadTime: null,
          finishes: [],
          features: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'],
          availability: null,
        },
      ],
    };

    await generateRecommendation(input);

    const userMessage = JSON.parse(mockGenerateText.mock.calls[0][0].userMessage);
    expect(userMessage.compared_products[0].features).toHaveLength(5);
    expect(userMessage.compared_products[0].features).toEqual(['F1', 'F2', 'F3', 'F4', 'F5']);
  });

  it('uses system prompt with correct role instructions', async () => {
    mockGenerateText.mockResolvedValue('{"recommendedProduct":null,"recommendation":"OK","tradeOffs":[],"internalNotes":[]}');

    await generateRecommendation(BASIC_INPUT);

    const callArgs = mockGenerateText.mock.calls[0][0];
    expect(callArgs.system).toContain('interior designer');
    expect(callArgs.system).toContain('JSON');
    expect(callArgs.maxTokens).toBe(1024);
  });
});

/* ═══════════════════════════════════════════════════════
   Error handling
   ═══════════════════════════════════════════════════════ */

describe('generateRecommendation — errors', () => {
  it('throws when AI returns invalid JSON', async () => {
    mockGenerateText.mockResolvedValue('This is not JSON at all');

    await expect(generateRecommendation(BASIC_INPUT)).rejects.toThrow();
  });

  it('throws when AI provider call fails', async () => {
    mockGenerateText.mockRejectedValue(new Error('Rate limited'));

    await expect(generateRecommendation(BASIC_INPUT)).rejects.toThrow('Rate limited');
  });

  it('throws with API error details', async () => {
    const apiError = new Error('overloaded_error');
    (apiError as any).status = 529;
    (apiError as any).error = { type: 'overloaded_error' };
    mockGenerateText.mockRejectedValue(apiError);

    await expect(generateRecommendation(BASIC_INPUT)).rejects.toThrow('overloaded_error');
  });

  it('handles empty response', async () => {
    mockGenerateText.mockResolvedValue('');

    // Should throw because JSON.parse('') fails
    await expect(generateRecommendation(BASIC_INPUT)).rejects.toThrow();
  });
});
