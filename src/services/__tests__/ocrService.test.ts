import { describe, it, expect } from 'vitest';
import {
  extractBrand,
  extractSize,
  extractMaterials,
} from '../ocrService';

describe('OCR Service', () => {
  describe('extractBrand', () => {
    it('should extract brand from "BRAND: Name" pattern', () => {
      const text = 'BRAND: Nike\nSize: M\n100% Cotton';
      expect(extractBrand(text)).toBe('Nike');
    });

    it('should extract brand from "Brand: Name" pattern (case insensitive)', () => {
      const text = 'Brand: Adidas\nMaterial: Polyester';
      expect(extractBrand(text)).toBe('Adidas');
    });

    it('should extract brand from all caps text', () => {
      const text = 'ZARA\nSize 12\nMade in Turkey';
      expect(extractBrand(text)).toBe('ZARA');
    });

    it('should extract known brand names', () => {
      const text = 'Made by Nike in Vietnam\nSize: L';
      expect(extractBrand(text)).toBe('Nike');
    });

    it('should return null if no brand found', () => {
      const text = 'Size: M\n100% Cotton\nMade in China';
      expect(extractBrand(text)).toBe(null);
    });

    it('should extract multi-word brand names', () => {
      const text = 'BRAND: Calvin Klein\nSize: M';
      expect(extractBrand(text)).toBe('Calvin Klein');
    });
  });

  describe('extractSize', () => {
    it('should extract size from "SIZE: X" pattern', () => {
      const text = 'Brand: Nike\nSIZE: M\n100% Cotton';
      expect(extractSize(text)).toBe('M');
    });

    it('should extract UK size', () => {
      const text = 'Brand: Zara\nUK 12\nEU 40';
      expect(extractSize(text)).toBe('UK 12');
    });

    it('should extract EU size', () => {
      const text = 'Brand: H&M\nEU 38\nMade in Bangladesh';
      expect(extractSize(text)).toBe('EU 38');
    });

    it('should extract US size', () => {
      const text = 'US 8\n100% Cotton';
      expect(extractSize(text)).toBe('US 8');
    });

    it('should extract letter sizes (S, M, L, XL)', () => {
      const text = 'Brand: Nike\nXL\n80% Cotton 20% Polyester';
      expect(extractSize(text)).toBe('XL');
    });

    it('should extract numeric sizes', () => {
      const text = 'Brand: Topshop\n10\nMade in China';
      expect(extractSize(text)).toBe('10');
    });

    it('should return null if no size found', () => {
      const text = 'Brand: Nike\n100% Cotton';
      expect(extractSize(text)).toBe(null);
    });

    it('should handle XXL sizes', () => {
      const text = 'Size: XXL';
      expect(extractSize(text)).toBe('XXL');
    });
  });

  describe('extractMaterials', () => {
    it('should extract single material with percentage', () => {
      const text = '100% Cotton\nMade in India';
      const materials = extractMaterials(text);
      expect(materials).toContain('cotton');
    });

    it('should extract multiple materials with percentages', () => {
      const text = '80% Polyester 20% Cotton\nWash at 30°C';
      const materials = extractMaterials(text);
      expect(materials).toContain('polyester');
      expect(materials).toContain('cotton');
    });

    it('should extract materials from "Material:" label', () => {
      const text = 'Material: Wool\nSize: M';
      const materials = extractMaterials(text);
      expect(materials).toContain('wool');
    });

    it('should extract materials from "Composition:" label', () => {
      const text = 'Composition: Silk and Cotton\nMade in Italy';
      const materials = extractMaterials(text);
      expect(materials).toContain('silk');
      expect(materials).toContain('cotton');
    });

    it('should extract standalone material keywords', () => {
      const text = 'Leather jacket\nSize: L\nMade in Turkey';
      const materials = extractMaterials(text);
      expect(materials).toContain('leather');
    });

    it('should limit to 3 materials (Vinted constraint)', () => {
      const text = '40% Cotton 30% Polyester 20% Wool 10% Elastane';
      const materials = extractMaterials(text);
      expect(materials.length).toBeLessThanOrEqual(3);
    });

    it('should return empty array if no materials found', () => {
      const text = 'Brand: Nike\nSize: M';
      const materials = extractMaterials(text);
      expect(materials).toEqual([]);
    });

    it('should handle complex composition text', () => {
      const text = 'COMPOSITION: OUTER: 100% POLYESTER LINING: 80% COTTON 20% ELASTANE';
      const materials = extractMaterials(text);
      expect(materials).toContain('polyester');
      expect(materials).toContain('cotton');
      expect(materials.length).toBeLessThanOrEqual(3);
    });

    it('should extract faux leather and faux fur', () => {
      const text = 'Material: Faux Leather\nSize: M';
      const materials = extractMaterials(text);
      expect(materials).toContain('faux leather');
    });

    it('should extract denim', () => {
      const text = '98% Cotton 2% Elastane\nDenim Jeans';
      const materials = extractMaterials(text);
      expect(materials).toContain('cotton');
      expect(materials).toContain('elastane');
    });
  });
});
