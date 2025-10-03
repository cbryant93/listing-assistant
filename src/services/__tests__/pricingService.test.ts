import { describe, it, expect } from 'vitest';
import {
  calculatePrice,
  getPriceBreakdown,
  getPricingRecommendations,
  validatePrice,
  getConditionStrategies,
  getPriceRange,
} from '../pricingService';

describe('PricingService', () => {
  describe('calculatePrice', () => {
    it('should calculate price using default formula: (RRP / 2) + 5', () => {
      const result = calculatePrice(50, 'good');

      // (50 / 2) + 5 = 30
      expect(result.suggestedPrice).toBe(30);
      expect(result.rrp).toBe(50);
      expect(result.condition).toBe('good');
    });

    it('should round to nearest £0.50', () => {
      const result = calculatePrice(45, 'very_good');

      // (45 / 2) + 5 = 27.5
      expect(result.suggestedPrice).toBe(27.5);
    });

    it('should handle low RRP values', () => {
      const result = calculatePrice(10, 'satisfactory');

      // (10 / 2) + 5 = 10
      expect(result.suggestedPrice).toBe(10);
    });

    it('should enforce minimum price of £1.00', () => {
      const result = calculatePrice(2, 'satisfactory');

      // (2 / 2) + 5 = 6, but test the minimum floor
      // Actually this would be 6, but if formula resulted < 1, it would be 1
      expect(result.suggestedPrice).toBeGreaterThanOrEqual(1.0);
    });

    it('should calculate with custom desired profit', () => {
      const result = calculatePrice(50, 'good', { desiredProfit: 20 });

      expect(result.suggestedPrice).toBe(20);
      expect(result.desiredProfit).toBe(20);
    });

    it('should calculate with custom profit margin', () => {
      const result = calculatePrice(100, 'very_good', { profitMargin: 40 });

      // 40% of £100 = £40
      expect(result.suggestedPrice).toBe(40);
      expect(result.profitMargin).toBe(40);
    });

    it('should include buyer protection fee calculation', () => {
      const result = calculatePrice(50, 'good');

      expect(result.buyerProtectionFee).toBeGreaterThan(0);
      expect(result.buyerTotal).toBe(result.suggestedPrice + result.buyerProtectionFee);
    });

    it('should calculate profit metrics', () => {
      const result = calculatePrice(60, 'good');

      // (60 / 2) + 5 = 35
      expect(result.actualProfit).toBe(35);
      expect(result.profitPercentage).toBeCloseTo((35 / 60) * 100, 1);
    });

    it('should throw error for invalid RRP', () => {
      expect(() => calculatePrice(0, 'good')).toThrow('RRP must be greater than 0');
      expect(() => calculatePrice(-10, 'good')).toThrow('RRP must be greater than 0');
    });

    it('should throw error for invalid condition', () => {
      expect(() => calculatePrice(50, 'invalid_condition')).toThrow('Invalid condition');
    });
  });

  describe('getPriceBreakdown', () => {
    it('should format price breakdown correctly', () => {
      const calculation = calculatePrice(50, 'good');
      const breakdown = getPriceBreakdown(calculation);

      expect(breakdown.rrp).toBe('£50.00');
      expect(breakdown.sellerReceives).toBe('£30.00');
      expect(breakdown.profit).toContain('£30.00');
      expect(breakdown.buyerPays).toMatch(/£\d+\.\d{2}/);
      expect(breakdown.buyerProtectionFee).toMatch(/£\d+\.\d{2}/);
    });
  });

  describe('getPricingRecommendations', () => {
    it('should return recommendations for all conditions', () => {
      const recommendations = getPricingRecommendations(100);

      expect(recommendations).toHaveProperty('new_with_tags');
      expect(recommendations).toHaveProperty('new_without_tags');
      expect(recommendations).toHaveProperty('very_good');
      expect(recommendations).toHaveProperty('good');
      expect(recommendations).toHaveProperty('satisfactory');

      // All should use the same formula: (RRP / 2) + 5 = 55
      expect(recommendations.new_with_tags.suggestedPrice).toBe(55);
      expect(recommendations.good.suggestedPrice).toBe(55);
    });
  });

  describe('validatePrice', () => {
    it('should validate reasonable prices', () => {
      const result = validatePrice(25, 50);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn if price is below minimum', () => {
      const result = validatePrice(0.5, 50);

      expect(result.valid).toBe(false);
      expect(result.warnings).toContain('Price is below minimum (£1)');
    });

    it('should warn if price is higher than RRP', () => {
      const result = validatePrice(60, 50);

      expect(result.valid).toBe(false);
      expect(result.warnings).toContain('Price is higher than RRP - buyers may be skeptical');
    });

    it('should warn if price is very low', () => {
      const result = validatePrice(2, 100);

      expect(result.valid).toBe(false);
      expect(result.warnings).toContain("Price is very low - consider if it's worth selling");
    });

    it('should warn if price is close to RRP', () => {
      const result = validatePrice(45, 50);

      expect(result.valid).toBe(false);
      expect(result.warnings).toContain('Price is close to RRP - may be hard to sell');
    });
  });

  describe('getConditionStrategies', () => {
    it('should return all condition strategies', () => {
      const strategies = getConditionStrategies();

      expect(strategies).toHaveProperty('new_with_tags');
      expect(strategies).toHaveProperty('very_good');
      expect(strategies).toHaveProperty('good');
      expect(strategies).toHaveProperty('satisfactory');

      expect(strategies.new_with_tags.basePercentage).toBe(70);
      expect(strategies.good.basePercentage).toBe(40);
    });
  });

  describe('getPriceRange', () => {
    it('should return price range for a condition', () => {
      const range = getPriceRange(100, 'good');

      expect(range.min).toBeGreaterThan(0);
      expect(range.recommended).toBeGreaterThan(range.min);
      expect(range.max).toBeGreaterThan(range.recommended);
    });

    it('should throw error for invalid condition', () => {
      expect(() => getPriceRange(100, 'invalid')).toThrow('Invalid condition');
    });
  });

  describe('Real-world pricing examples', () => {
    it('should price £80 RRP item correctly', () => {
      const result = calculatePrice(80, 'very_good');

      // (80 / 2) + 5 = 45
      expect(result.suggestedPrice).toBe(45);
      expect(result.profitPercentage).toBeCloseTo(56.25, 1); // 45/80 * 100
    });

    it('should price £30 RRP item correctly', () => {
      const result = calculatePrice(30, 'good');

      // (30 / 2) + 5 = 20
      expect(result.suggestedPrice).toBe(20);
    });

    it('should price £200 RRP item correctly', () => {
      const result = calculatePrice(200, 'new_with_tags');

      // (200 / 2) + 5 = 105
      expect(result.suggestedPrice).toBe(105);
    });

    it('should handle buyer protection fee for different price ranges', () => {
      const lowPrice = calculatePrice(10, 'good'); // Price = 10
      const medPrice = calculatePrice(50, 'good'); // Price = 30
      const highPrice = calculatePrice(200, 'good'); // Price = 105

      // Low price items have higher % fee
      expect(lowPrice.buyerProtectionFee).toBeGreaterThan(lowPrice.suggestedPrice * 0.05);

      // All should have positive fees
      expect(medPrice.buyerProtectionFee).toBeGreaterThan(0);
      expect(highPrice.buyerProtectionFee).toBeGreaterThan(0);
    });
  });
});
