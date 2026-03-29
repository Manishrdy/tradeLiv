/**
 * Unit tests for orderSplitter — pure function, no DB needed.
 */

import { splitOrderByBrand, LineItem, BrandPO } from '../../services/orderSplitter';

describe('splitOrderByBrand', () => {
  /* ── Basic grouping ─────────────────────────────────── */

  describe('basic grouping', () => {
    it('groups items by brand name', () => {
      const items: LineItem[] = [
        { id: '1', brandName: 'West Elm', lineTotal: 1200 },
        { id: '2', brandName: 'CB2', lineTotal: 800 },
        { id: '3', brandName: 'West Elm', lineTotal: 600 },
      ];
      const result = splitOrderByBrand(items);

      expect(result).toHaveLength(2);

      const westElm = result.find(po => po.brandName === 'West Elm')!;
      expect(westElm.lineItems).toHaveLength(2);
      expect(westElm.subtotal).toBe(1800);

      const cb2 = result.find(po => po.brandName === 'CB2')!;
      expect(cb2.lineItems).toHaveLength(1);
      expect(cb2.subtotal).toBe(800);
    });

    it('single brand produces one PO', () => {
      const items: LineItem[] = [
        { id: '1', brandName: 'Pottery Barn', lineTotal: 500 },
        { id: '2', brandName: 'Pottery Barn', lineTotal: 750 },
        { id: '3', brandName: 'Pottery Barn', lineTotal: 300 },
      ];
      const result = splitOrderByBrand(items);

      expect(result).toHaveLength(1);
      expect(result[0].brandName).toBe('Pottery Barn');
      expect(result[0].lineItems).toHaveLength(3);
      expect(result[0].subtotal).toBe(1550);
    });

    it('each unique brand gets its own PO', () => {
      const items: LineItem[] = [
        { id: '1', brandName: 'West Elm', lineTotal: 100 },
        { id: '2', brandName: 'CB2', lineTotal: 200 },
        { id: '3', brandName: 'Crate & Barrel', lineTotal: 300 },
        { id: '4', brandName: 'Restoration Hardware', lineTotal: 400 },
      ];
      const result = splitOrderByBrand(items);

      expect(result).toHaveLength(4);
      const brandNames = result.map(po => po.brandName).sort();
      expect(brandNames).toEqual(['CB2', 'Crate & Barrel', 'Restoration Hardware', 'West Elm']);
    });
  });

  /* ── Subtotal calculation ───────────────────────────── */

  describe('subtotal calculation', () => {
    it('sums lineTotals per brand correctly', () => {
      const items: LineItem[] = [
        { id: '1', brandName: 'A', lineTotal: 99.99 },
        { id: '2', brandName: 'A', lineTotal: 149.50 },
        { id: '3', brandName: 'A', lineTotal: 0.51 },
      ];
      const result = splitOrderByBrand(items);
      expect(result[0].subtotal).toBe(250);
    });

    it('handles zero-value line items', () => {
      const items: LineItem[] = [
        { id: '1', brandName: 'Free Brand', lineTotal: 0 },
        { id: '2', brandName: 'Free Brand', lineTotal: 0 },
      ];
      const result = splitOrderByBrand(items);
      expect(result[0].subtotal).toBe(0);
    });
  });

  /* ── Line item references ───────────────────────────── */

  describe('line item references', () => {
    it('preserves all line item properties in the grouped output', () => {
      const items: LineItem[] = [
        { id: 'li-1', brandName: 'West Elm', lineTotal: 500, productId: 'p-1', quantity: 2 },
      ];
      const result = splitOrderByBrand(items);
      const li = result[0].lineItems[0];
      expect(li.id).toBe('li-1');
      expect(li.brandName).toBe('West Elm');
      expect(li.lineTotal).toBe(500);
      expect(li.productId).toBe('p-1');
      expect(li.quantity).toBe(2);
    });

    it('maintains original order within each brand group', () => {
      const items: LineItem[] = [
        { id: '1', brandName: 'A', lineTotal: 100 },
        { id: '2', brandName: 'B', lineTotal: 200 },
        { id: '3', brandName: 'A', lineTotal: 300 },
        { id: '4', brandName: 'B', lineTotal: 400 },
        { id: '5', brandName: 'A', lineTotal: 500 },
      ];
      const result = splitOrderByBrand(items);

      const groupA = result.find(po => po.brandName === 'A')!;
      expect(groupA.lineItems.map(li => li.id)).toEqual(['1', '3', '5']);

      const groupB = result.find(po => po.brandName === 'B')!;
      expect(groupB.lineItems.map(li => li.id)).toEqual(['2', '4']);
    });
  });

  /* ── Edge cases ─────────────────────────────────────── */

  describe('edge cases', () => {
    it('empty array returns empty result', () => {
      const result = splitOrderByBrand([]);
      expect(result).toEqual([]);
    });

    it('single item returns single PO with one item', () => {
      const items: LineItem[] = [
        { id: '1', brandName: 'Solo', lineTotal: 999 },
      ];
      const result = splitOrderByBrand(items);
      expect(result).toHaveLength(1);
      expect(result[0].brandName).toBe('Solo');
      expect(result[0].lineItems).toHaveLength(1);
      expect(result[0].subtotal).toBe(999);
    });

    it('handles "Unknown" brand name (fallback from quote conversion)', () => {
      const items: LineItem[] = [
        { id: '1', brandName: 'Unknown', lineTotal: 100 },
        { id: '2', brandName: 'Unknown', lineTotal: 200 },
        { id: '3', brandName: 'West Elm', lineTotal: 300 },
      ];
      const result = splitOrderByBrand(items);
      expect(result).toHaveLength(2);

      const unknown = result.find(po => po.brandName === 'Unknown')!;
      expect(unknown.lineItems).toHaveLength(2);
      expect(unknown.subtotal).toBe(300);
    });

    it('brand names are case-sensitive', () => {
      const items: LineItem[] = [
        { id: '1', brandName: 'west elm', lineTotal: 100 },
        { id: '2', brandName: 'West Elm', lineTotal: 200 },
      ];
      const result = splitOrderByBrand(items);
      // Different cases = different brands
      expect(result).toHaveLength(2);
    });

    it('preserves insertion order of brand groups', () => {
      const items: LineItem[] = [
        { id: '1', brandName: 'C-Brand', lineTotal: 100 },
        { id: '2', brandName: 'A-Brand', lineTotal: 200 },
        { id: '3', brandName: 'B-Brand', lineTotal: 300 },
      ];
      const result = splitOrderByBrand(items);
      // Map preserves insertion order
      expect(result[0].brandName).toBe('C-Brand');
      expect(result[1].brandName).toBe('A-Brand');
      expect(result[2].brandName).toBe('B-Brand');
    });

    it('handles large number of items', () => {
      const items: LineItem[] = Array.from({ length: 100 }, (_, i) => ({
        id: String(i),
        brandName: `Brand-${i % 10}`,
        lineTotal: 100,
      }));
      const result = splitOrderByBrand(items);
      expect(result).toHaveLength(10);
      for (const po of result) {
        expect(po.lineItems).toHaveLength(10);
        expect(po.subtotal).toBe(1000);
      }
    });
  });
});
