import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import {
  validatePhoto,
  getPhotoMetadata,
  validatePhotoCount,
  resizePhoto,
  getRecommendedDimensions,
  getPhotoConstraints,
} from '../photoService';

describe('PhotoService', () => {
  const testDir = path.join(__dirname, 'test-photos');
  let testPhotoPath: string;

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });

    // Create a test image (100x100 red square)
    testPhotoPath = path.join(testDir, 'test-photo.jpg');
    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .jpeg()
      .toFile(testPhotoPath);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('validatePhoto', () => {
    it('should validate a valid photo', async () => {
      // Create a larger test image (800x800)
      const validPhotoPath = path.join(testDir, 'valid-photo.jpg');
      await sharp({
        create: {
          width: 800,
          height: 800,
          channels: 3,
          background: { r: 0, g: 255, b: 0 },
        },
      })
        .jpeg()
        .toFile(validPhotoPath);

      const result = await validatePhoto(validPhotoPath);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject photos that are too small (< 640px)', async () => {
      const result = await validatePhoto(testPhotoPath); // 100x100

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Warning: Image dimensions are small. Recommended minimum: 640px');
    });

    it('should reject non-existent files', async () => {
      const result = await validatePhoto('/non/existent/photo.jpg');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Failed to read image');
    });

    it('should accept JPG format', async () => {
      const jpgPath = path.join(testDir, 'photo.jpg');
      await sharp({
        create: {
          width: 800,
          height: 800,
          channels: 3,
          background: { r: 100, g: 100, b: 100 },
        },
      })
        .jpeg()
        .toFile(jpgPath);

      const result = await validatePhoto(jpgPath);
      expect(result.valid).toBe(true);
    });

    it('should accept PNG format', async () => {
      const pngPath = path.join(testDir, 'photo.png');
      await sharp({
        create: {
          width: 800,
          height: 800,
          channels: 3,
          background: { r: 100, g: 100, b: 100 },
        },
      })
        .png()
        .toFile(pngPath);

      const result = await validatePhoto(pngPath);
      expect(result.valid).toBe(true);
    });
  });

  describe('getPhotoMetadata', () => {
    it('should return correct metadata', async () => {
      const metadata = await getPhotoMetadata(testPhotoPath);

      expect(metadata.width).toBe(100);
      expect(metadata.height).toBe(100);
      expect(metadata.format).toBe('jpeg');
      expect(metadata.size).toBeGreaterThan(0);
    });
  });

  describe('validatePhotoCount', () => {
    it('should validate photo count within range (1-20)', () => {
      const result = validatePhotoCount(5);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject 0 photos', () => {
      const result = validatePhotoCount(0);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least 1 photo required');
    });

    it('should reject more than 20 photos', () => {
      const result = validatePhotoCount(21);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Maximum 20 photos allowed');
    });

    it('should accept exactly 1 photo', () => {
      const result = validatePhotoCount(1);
      expect(result.valid).toBe(true);
    });

    it('should accept exactly 20 photos', () => {
      const result = validatePhotoCount(20);
      expect(result.valid).toBe(true);
    });
  });

  describe('resizePhoto', () => {
    it('should resize photo to recommended dimensions', async () => {
      // Create a large test image (2000x3000)
      const largePhotoPath = path.join(testDir, 'large-photo.jpg');
      await sharp({
        create: {
          width: 2000,
          height: 3000,
          channels: 3,
          background: { r: 0, g: 0, b: 255 },
        },
      })
        .jpeg()
        .toFile(largePhotoPath);

      const resizedPath = path.join(testDir, 'resized-photo.jpg');
      await resizePhoto(largePhotoPath, resizedPath, 1000, 1500);

      const metadata = await getPhotoMetadata(resizedPath);

      // Should be resized to fit within 1000x1500 while maintaining aspect ratio
      expect(metadata.width).toBeLessThanOrEqual(1000);
      expect(metadata.height).toBeLessThanOrEqual(1500);
    });

    it('should not upscale small images', async () => {
      // Test photo is 100x100
      const resizedPath = path.join(testDir, 'resized-small.jpg');
      await resizePhoto(testPhotoPath, resizedPath, 1000, 1500);

      const metadata = await getPhotoMetadata(resizedPath);

      // Should remain 100x100 (not upscaled)
      expect(metadata.width).toBe(100);
      expect(metadata.height).toBe(100);
    });
  });

  describe('getRecommendedDimensions', () => {
    it('should return Vinted recommended dimensions', () => {
      const dims = getRecommendedDimensions();

      expect(dims.width).toBe(1000);
      expect(dims.height).toBe(1500);
    });
  });

  describe('getPhotoConstraints', () => {
    it('should return all photo constraints', () => {
      const constraints = getPhotoConstraints();

      expect(constraints.maxPhotos).toBe(20);
      expect(constraints.minPhotos).toBe(1);
      expect(constraints.recommendedWidth).toBe(1000);
      expect(constraints.recommendedHeight).toBe(1500);
      expect(constraints.allowedFormats).toContain('jpg');
      expect(constraints.allowedFormats).toContain('png');
      expect(constraints.allowedFormats).toContain('gif');
      expect(constraints.maxFileSizeMB).toBe(10);
    });
  });
});
