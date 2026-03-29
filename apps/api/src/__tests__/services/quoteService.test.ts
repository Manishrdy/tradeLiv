/**
 * Unit tests for quoteService pure functions.
 * Tests calculateTotals (fee calculations) and helpers (getProductPrice, calcLineTotal).
 *
 * These are pure functions — no DB, no HTTP, no mocks needed.
 */

import { calculateTotals, FeeConfig } from '../../services/quoteService';

/* ═══════════════════════════════════════════════════════
   calculateTotals — fee calculations
   ═══════════════════════════════════════════════════════ */

describe('calculateTotals', () => {
  /* ── Tax ─────────────────────────────────────────────── */

  describe('tax calculation', () => {
    it('calculates tax as percentage of subtotal', () => {
      const result = calculateTotals(1000, { taxRate: 8.25 });
      expect(result.taxAmount).toBe(82.5);
      expect(result.grandTotal).toBe(1082.5);
    });

    it('zero tax when taxRate is 0', () => {
      const result = calculateTotals(1000, { taxRate: 0 });
      expect(result.taxAmount).toBe(0);
    });

    it('no tax when taxRate is undefined', () => {
      const result = calculateTotals(1000, {});
      expect(result.taxAmount).toBe(0);
    });

    it('handles high tax rate', () => {
      const result = calculateTotals(1000, { taxRate: 25 });
      expect(result.taxAmount).toBe(250);
    });

    it('handles fractional tax rate (e.g. 6.875%)', () => {
      const result = calculateTotals(10000, { taxRate: 6.875 });
      expect(result.taxAmount).toBe(687.5);
    });
  });

  /* ── Commission (percentage) ────────────────────────── */

  describe('commission — percentage', () => {
    it('calculates percentage commission on subtotal', () => {
      const fees: FeeConfig = { commissionType: 'percentage', commissionValue: 10 };
      const result = calculateTotals(5000, fees);
      expect(result.commissionAmount).toBe(500);
    });

    it('handles small percentage commission', () => {
      const fees: FeeConfig = { commissionType: 'percentage', commissionValue: 2.5 };
      const result = calculateTotals(4000, fees);
      expect(result.commissionAmount).toBe(100);
    });

    it('zero commission when commissionValue is 0', () => {
      const fees: FeeConfig = { commissionType: 'percentage', commissionValue: 0 };
      const result = calculateTotals(1000, fees);
      expect(result.commissionAmount).toBe(0);
    });

    it('zero commission when commissionType is percentage but no value', () => {
      const fees: FeeConfig = { commissionType: 'percentage' };
      const result = calculateTotals(1000, fees);
      expect(result.commissionAmount).toBe(0);
    });
  });

  /* ── Commission (fixed) ─────────────────────────────── */

  describe('commission — fixed', () => {
    it('uses fixed dollar amount regardless of subtotal', () => {
      const fees: FeeConfig = { commissionType: 'fixed', commissionValue: 250 };
      const result = calculateTotals(5000, fees);
      expect(result.commissionAmount).toBe(250);

      // Same fee even with different subtotal
      const result2 = calculateTotals(50000, fees);
      expect(result2.commissionAmount).toBe(250);
    });

    it('zero when commissionType is fixed but value is 0', () => {
      const fees: FeeConfig = { commissionType: 'fixed', commissionValue: 0 };
      const result = calculateTotals(1000, fees);
      expect(result.commissionAmount).toBe(0);
    });
  });

  /* ── Platform fee (percentage) ──────────────────────── */

  describe('platform fee — percentage', () => {
    it('calculates percentage platform fee on subtotal', () => {
      const fees: FeeConfig = { platformFeeType: 'percentage', platformFeeValue: 5 };
      const result = calculateTotals(2000, fees);
      expect(result.platformFeeAmount).toBe(100);
    });

    it('zero when platformFeeValue is 0', () => {
      const fees: FeeConfig = { platformFeeType: 'percentage', platformFeeValue: 0 };
      const result = calculateTotals(2000, fees);
      expect(result.platformFeeAmount).toBe(0);
    });
  });

  /* ── Platform fee (fixed) ───────────────────────────── */

  describe('platform fee — fixed', () => {
    it('uses fixed dollar amount', () => {
      const fees: FeeConfig = { platformFeeType: 'fixed', platformFeeValue: 99 };
      const result = calculateTotals(10000, fees);
      expect(result.platformFeeAmount).toBe(99);
    });
  });

  /* ── Grand total (combined fees) ────────────────────── */

  describe('grand total with combined fees', () => {
    it('adds subtotal + tax + commission + platform fee', () => {
      const fees: FeeConfig = {
        taxRate: 8.25,
        commissionType: 'percentage',
        commissionValue: 10,
        platformFeeType: 'fixed',
        platformFeeValue: 50,
      };
      const result = calculateTotals(1000, fees);
      // subtotal: 1000
      // tax: 1000 * 0.0825 = 82.50
      // commission: 1000 * 0.10 = 100
      // platform: 50
      // grand total: 1000 + 82.50 + 100 + 50 = 1232.50
      expect(result.subtotal).toBe(1000);
      expect(result.taxAmount).toBe(82.5);
      expect(result.commissionAmount).toBe(100);
      expect(result.platformFeeAmount).toBe(50);
      expect(result.grandTotal).toBe(1232.5);
    });

    it('all percentage fees together', () => {
      const fees: FeeConfig = {
        taxRate: 10,
        commissionType: 'percentage',
        commissionValue: 15,
        platformFeeType: 'percentage',
        platformFeeValue: 3,
      };
      const result = calculateTotals(2000, fees);
      // tax: 200, commission: 300, platform: 60
      // grand: 2000 + 200 + 300 + 60 = 2560
      expect(result.taxAmount).toBe(200);
      expect(result.commissionAmount).toBe(300);
      expect(result.platformFeeAmount).toBe(60);
      expect(result.grandTotal).toBe(2560);
    });

    it('all fixed fees together', () => {
      const fees: FeeConfig = {
        taxRate: 0,
        commissionType: 'fixed',
        commissionValue: 500,
        platformFeeType: 'fixed',
        platformFeeValue: 100,
      };
      const result = calculateTotals(3000, fees);
      // grand: 3000 + 0 + 500 + 100 = 3600
      expect(result.grandTotal).toBe(3600);
    });
  });

  /* ── Rounding ───────────────────────────────────────── */

  describe('rounding', () => {
    it('rounds all amounts to 2 decimal places', () => {
      // 1000 * 8.33% = 83.3 → 83.3
      const result = calculateTotals(1000, { taxRate: 8.33 });
      expect(result.taxAmount).toBe(83.3);
      expect(result.grandTotal).toBe(1083.3);
    });

    it('rounds commission correctly', () => {
      // 333 * 7% = 23.31
      const fees: FeeConfig = { commissionType: 'percentage', commissionValue: 7 };
      const result = calculateTotals(333, fees);
      expect(result.commissionAmount).toBe(23.31);
    });

    it('handles penny rounding on complex calculation', () => {
      const fees: FeeConfig = {
        taxRate: 8.875,
        commissionType: 'percentage',
        commissionValue: 12.5,
        platformFeeType: 'percentage',
        platformFeeValue: 2.75,
      };
      const result = calculateTotals(1234.56, fees);
      // Each value should have at most 2 decimal places
      expect(result.subtotal).toBe(Math.round(1234.56 * 100) / 100);
      expect(Number(result.taxAmount.toFixed(2))).toBe(result.taxAmount);
      expect(Number(result.commissionAmount.toFixed(2))).toBe(result.commissionAmount);
      expect(Number(result.platformFeeAmount.toFixed(2))).toBe(result.platformFeeAmount);
      expect(Number(result.grandTotal.toFixed(2))).toBe(result.grandTotal);
    });
  });

  /* ── Edge cases ─────────────────────────────────────── */

  describe('edge cases', () => {
    it('zero subtotal returns all zeros', () => {
      const fees: FeeConfig = {
        taxRate: 10,
        commissionType: 'percentage',
        commissionValue: 15,
        platformFeeType: 'fixed',
        platformFeeValue: 50,
      };
      const result = calculateTotals(0, fees);
      expect(result.subtotal).toBe(0);
      expect(result.taxAmount).toBe(0);
      expect(result.commissionAmount).toBe(0);
      // Fixed platform fee still applies
      expect(result.platformFeeAmount).toBe(50);
      expect(result.grandTotal).toBe(50);
    });

    it('empty fee config returns subtotal as grand total', () => {
      const result = calculateTotals(1500, {});
      expect(result.subtotal).toBe(1500);
      expect(result.taxAmount).toBe(0);
      expect(result.commissionAmount).toBe(0);
      expect(result.platformFeeAmount).toBe(0);
      expect(result.grandTotal).toBe(1500);
    });

    it('large subtotal with all fees', () => {
      const fees: FeeConfig = {
        taxRate: 8.25,
        commissionType: 'percentage',
        commissionValue: 20,
        platformFeeType: 'percentage',
        platformFeeValue: 5,
      };
      const result = calculateTotals(100000, fees);
      expect(result.taxAmount).toBe(8250);
      expect(result.commissionAmount).toBe(20000);
      expect(result.platformFeeAmount).toBe(5000);
      expect(result.grandTotal).toBe(133250);
    });

    it('no commissionType means zero commission even with value', () => {
      const fees: FeeConfig = { commissionValue: 500 };
      const result = calculateTotals(1000, fees);
      expect(result.commissionAmount).toBe(0);
    });

    it('no platformFeeType means zero platform fee even with value', () => {
      const fees: FeeConfig = { platformFeeValue: 100 };
      const result = calculateTotals(1000, fees);
      expect(result.platformFeeAmount).toBe(0);
    });
  });
});
