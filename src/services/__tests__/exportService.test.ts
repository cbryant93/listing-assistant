import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import type { ListingWithPhotos } from '@types/listing';
import {
  prepareVintedExport,
  exportAsJSON,
  exportAsCSV,
  validateExportData,
  getExportSummary,
  exportMultipleAsJSON,
  exportMultipleAsCSV,
} from '../exportService';

describe('ExportService', () => {
  const testDir = path.join(__dirname, 'test-exports');

  const mockListing: ListingWithPhotos = {
    id: 1,
    title: 'Nike Running Jacket',
    description: 'Great condition running jacket #Nike #Running',
    category: 'Women > Clothing > Jackets',
    brand: 'Nike',
    size: 'M',
    condition: 'very_good',
    colors: ['Black', 'White'],
    materials: ['Polyester', 'Elastane'],
    rrp: 50.0,
    price: 25.0,
    parcel_size: 'medium',
    notes: 'Bought last year',
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
    photos: [
      {
        id: 1,
        listing_id: 1,
        file_path: '/uploads/photo1.jpg',
        original_path: '/temp/photo1.jpg',
        is_edited: false,
        order: 0,
        created_at: '2025-01-01',
      },
      {
        id: 2,
        listing_id: 1,
        file_path: '/uploads/photo2.jpg',
        original_path: '/temp/photo2.jpg',
        is_edited: true,
        order: 1,
        created_at: '2025-01-01',
      },
    ],
  };

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('prepareVintedExport', () => {
    it('should prepare listing data for export', () => {
      const exportData = prepareVintedExport(mockListing);

      expect(exportData.title).toBe('Nike Running Jacket');
      expect(exportData.description).toBe('Great condition running jacket #Nike #Running');
      expect(exportData.category).toBe('Women > Clothing > Jackets');
      expect(exportData.brand).toBe('Nike');
      expect(exportData.size).toBe('M');
      expect(exportData.condition).toBe('very_good');
      expect(exportData.colors).toEqual(['Black', 'White']);
      expect(exportData.materials).toEqual(['Polyester', 'Elastane']);
      expect(exportData.price).toBe(25.0);
      expect(exportData.parcel_size).toBe('medium');
      expect(exportData.photos).toHaveLength(2);
    });

    it('should handle missing optional fields', () => {
      const minimalListing: ListingWithPhotos = {
        ...mockListing,
        category: null,
        brand: null,
        size: null,
        parcel_size: null,
      };

      const exportData = prepareVintedExport(minimalListing);

      expect(exportData.category).toBe('');
      expect(exportData.brand).toBe('');
      expect(exportData.size).toBe('');
      expect(exportData.parcel_size).toBe('medium'); // Default
    });
  });

  describe('exportAsJSON', () => {
    it('should export listing as JSON file', async () => {
      const outputPath = path.join(testDir, 'listing.json');
      const result = await exportAsJSON(mockListing, outputPath);

      expect(result.success).toBe(true);
      expect(result.filePath).toBe(outputPath);

      // Verify file content
      const content = await fs.readFile(outputPath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.title).toBe('Nike Running Jacket');
      expect(parsed.price).toBe(25.0);
      expect(parsed.photos).toHaveLength(2);
    });

    it('should handle export errors', async () => {
      const invalidPath = '/invalid/path/listing.json';
      const result = await exportAsJSON(mockListing, invalidPath);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('exportAsCSV', () => {
    it('should export listing as CSV file', async () => {
      const outputPath = path.join(testDir, 'listing.csv');
      const result = await exportAsCSV(mockListing, outputPath);

      expect(result.success).toBe(true);
      expect(result.filePath).toBe(outputPath);

      // Verify file content
      const content = await fs.readFile(outputPath, 'utf-8');
      const lines = content.split('\n');

      expect(lines[0]).toContain('title,description,category');
      expect(lines[1]).toContain('Nike Running Jacket');
      expect(lines[1]).toContain('25');
    });

    it('should escape CSV values with commas', async () => {
      const listingWithComma: ListingWithPhotos = {
        ...mockListing,
        title: 'Nike Jacket, Size M',
        description: 'Great condition, barely worn',
      };

      const outputPath = path.join(testDir, 'comma-test.csv');
      await exportAsCSV(listingWithComma, outputPath);

      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('"Nike Jacket, Size M"');
      expect(content).toContain('"Great condition, barely worn"');
    });

    it('should handle listings with fewer than 5 photos', async () => {
      const outputPath = path.join(testDir, 'few-photos.csv');
      const result = await exportAsCSV(mockListing, outputPath); // Has 2 photos

      expect(result.success).toBe(true);

      const content = await fs.readFile(outputPath, 'utf-8');
      const lines = content.split('\n');
      const values = lines[1].split(',');

      // Should have empty values for photo_3, photo_4, photo_5
      expect(values.length).toBeGreaterThanOrEqual(13);
    });
  });

  describe('validateExportData', () => {
    it('should validate complete listing', () => {
      const result = validateExportData(mockListing);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require title', () => {
      const invalidListing: ListingWithPhotos = {
        ...mockListing,
        title: '',
      };

      const result = validateExportData(invalidListing);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Title is required');
    });

    it('should require description', () => {
      const invalidListing: ListingWithPhotos = {
        ...mockListing,
        description: '',
      };

      const result = validateExportData(invalidListing);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Description is required');
    });

    it('should require at least 1 photo', () => {
      const invalidListing: ListingWithPhotos = {
        ...mockListing,
        photos: [],
      };

      const result = validateExportData(invalidListing);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least 1 photo is required');
    });

    it('should reject more than 20 photos', () => {
      const photos = Array.from({ length: 21 }, (_, i) => ({
        id: i,
        listing_id: 1,
        file_path: `/uploads/photo${i}.jpg`,
        original_path: `/temp/photo${i}.jpg`,
        is_edited: false,
        order: i,
        created_at: '2025-01-01',
      }));

      const invalidListing: ListingWithPhotos = {
        ...mockListing,
        photos,
      };

      const result = validateExportData(invalidListing);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Maximum 20 photos allowed');
    });

    it('should reject more than 3 colors', () => {
      const invalidListing: ListingWithPhotos = {
        ...mockListing,
        colors: ['Black', 'White', 'Grey', 'Blue'],
      };

      const result = validateExportData(invalidListing);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Maximum 3 colors allowed');
    });

    it('should reject more than 3 materials', () => {
      const invalidListing: ListingWithPhotos = {
        ...mockListing,
        materials: ['Cotton', 'Polyester', 'Elastane', 'Wool'],
      };

      const result = validateExportData(invalidListing);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Maximum 3 materials allowed');
    });

    it('should reject price <= 0', () => {
      const invalidListing: ListingWithPhotos = {
        ...mockListing,
        price: 0,
      };

      const result = validateExportData(invalidListing);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Price must be greater than 0');
    });
  });

  describe('getExportSummary', () => {
    it('should generate export summary', () => {
      const summary = getExportSummary(mockListing);

      expect(summary.title).toBe('Nike Running Jacket');
      expect(summary.price).toBe('£25.00');
      expect(summary.condition).toBe('very_good');
      expect(summary.photoCount).toBe(2);
      expect(summary.hasCategory).toBe(true);
      expect(summary.hasBrand).toBe(true);
      expect(summary.hasSize).toBe(true);
      expect(summary.colorCount).toBe(2);
      expect(summary.materialCount).toBe(2);
    });
  });

  describe('exportMultipleAsJSON', () => {
    it('should export multiple listings as JSON array', async () => {
      const listing2: ListingWithPhotos = {
        ...mockListing,
        id: 2,
        title: 'Adidas Trainers',
        price: 30.0,
      };

      const outputPath = path.join(testDir, 'multiple.json');
      const result = await exportMultipleAsJSON([mockListing, listing2], outputPath);

      expect(result.success).toBe(true);

      const content = await fs.readFile(outputPath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].title).toBe('Nike Running Jacket');
      expect(parsed[1].title).toBe('Adidas Trainers');
    });
  });

  describe('exportMultipleAsCSV', () => {
    it('should export multiple listings as CSV', async () => {
      const listing2: ListingWithPhotos = {
        ...mockListing,
        id: 2,
        title: 'Adidas Trainers',
        price: 30.0,
      };

      const outputPath = path.join(testDir, 'multiple.csv');
      const result = await exportMultipleAsCSV([mockListing, listing2], outputPath);

      expect(result.success).toBe(true);

      const content = await fs.readFile(outputPath, 'utf-8');
      const lines = content.split('\n');

      expect(lines).toHaveLength(3); // Header + 2 rows
      expect(lines[1]).toContain('Nike Running Jacket');
      expect(lines[2]).toContain('Adidas Trainers');
    });
  });
});
