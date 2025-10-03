import { describe, it, expect } from 'vitest';
import { generateDescription } from '../aiDescriptionService';

describe('AI Description Service', () => {
  describe('generateDescription', () => {
    it('should generate description for new item with tags', () => {
      const result = generateDescription({
        brand: 'Nike',
        category: 'T-shirt',
        size: 'M',
        condition: 'new_with_tags',
        colors: ['Blue'],
        materials: ['Cotton'],
      });

      expect(result.description).toContain('Brand new with tags');
      expect(result.description).toContain('Nike');
      expect(result.description).toContain('T-shirt');
      expect(result.description).toContain('size M');
      expect(result.description).toContain('Blue');
      expect(result.description).toContain('Cotton');
      expect(result.hashtags).toHaveLength(5);
      expect(result.fullText).toContain('#');
    });

    it('should generate description for used item', () => {
      const result = generateDescription({
        brand: 'Zara',
        category: 'Jeans',
        size: '10',
        condition: 'very_good',
        colors: ['Black'],
        materials: ['Denim', 'Elastane'],
      });

      expect(result.description).toContain('Zara');
      expect(result.description).toContain('excellent condition');
      expect(result.description).toContain('size 10');
      expect(result.description).toContain('Black');
      expect(result.description).toContain('Denim');
      expect(result.hashtags).toHaveLength(5);
    });

    it('should handle multiple colors', () => {
      const result = generateDescription({
        brand: 'H&M',
        category: 'Dress',
        condition: 'good',
        colors: ['Red', 'White', 'Blue'],
      });

      expect(result.description).toContain('Red, White and Blue');
      expect(result.description).toContain('color combination');
    });

    it('should handle multiple materials', () => {
      const result = generateDescription({
        brand: 'Topshop',
        category: 'Blazer',
        condition: 'very_good',
        materials: ['Polyester', 'Wool', 'Elastane'],
      });

      expect(result.description).toContain('Polyester, Wool, Elastane');
    });

    it('should generate hashtags with brand', () => {
      const result = generateDescription({
        brand: 'Adidas',
        category: 'Hoodie',
        condition: 'new_with_tags',
        colors: ['Black'],
      });

      expect(result.hashtags).toContain('adidas');
      expect(result.hashtags).toContain('hoodie');
      expect(result.hashtags).toContain('black');
      expect(result.hashtags).toContain('nwt');
    });

    it('should generate hashtags for brand new item', () => {
      const result = generateDescription({
        brand: 'Uniqlo',
        category: 'Shirt',
        condition: 'new_without_tags',
      });

      expect(result.hashtags).toContain('brandnew');
    });

    it('should handle missing optional fields', () => {
      const result = generateDescription({
        condition: 'good',
      });

      expect(result.description).toBeTruthy();
      expect(result.hashtags).toHaveLength(5);
      expect(result.fullText).toContain(result.description);
    });

    it('should include additional info in description', () => {
      const result = generateDescription({
        brand: 'Nike',
        category: 'Trainers',
        condition: 'very_good',
        additionalInfo: 'Only worn twice, smoke-free home.',
      });

      expect(result.description).toContain('Only worn twice');
      expect(result.description).toContain('smoke-free home');
    });

    it('should format fullText with description and hashtags', () => {
      const result = generateDescription({
        brand: 'Gap',
        category: 'Jeans',
        condition: 'good',
        colors: ['Blue'],
      });

      expect(result.fullText).toContain(result.description);
      expect(result.fullText).toContain('#gap');
      expect(result.fullText).toContain('#jeans');
      expect(result.fullText).toContain('#blue');
    });

    it('should always return exactly 5 hashtags', () => {
      const testCases = [
        {
          brand: 'Nike',
          category: 'T-shirt',
          condition: 'new_with_tags' as const,
          colors: ['Blue', 'Red'],
          materials: ['Cotton'],
        },
        {
          brand: 'Zara',
          condition: 'good' as const,
        },
        {
          condition: 'satisfactory' as const,
        },
      ];

      for (const testCase of testCases) {
        const result = generateDescription(testCase);
        expect(result.hashtags).toHaveLength(5);
      }
    });

    it('should remove spaces from multi-word hashtags', () => {
      const result = generateDescription({
        brand: 'Calvin Klein',
        category: 'Polo Shirt',
        condition: 'very_good',
        colors: ['Light Blue'],
        materials: ['Faux Leather'],
      });

      expect(result.hashtags).toContain('calvinklein');
      expect(result.hashtags).toContain('poloshirt');
      expect(result.hashtags).toContain('lightblue');
      expect(result.hashtags).toContain('fauxleather');
    });

    it('should handle satisfactory condition', () => {
      const result = generateDescription({
        brand: 'Primark',
        category: 'Socks',
        condition: 'satisfactory',
      });

      expect(result.description).toContain('well-loved with some signs of wear');
    });
  });
});
