import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import {
  cropPhoto,
  adjustBrightnessContrast,
  compressPhoto,
  optimizeForVinted,
  rotatePhoto,
  autoRotate,
  getImageInfo,
  applyEdits,
} from '../photoEditingService';

describe('PhotoEditingService', () => {
  const testDir = path.join(__dirname, 'test-editing');
  let testPhotoPath: string;

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });

    // Create a test image (400x600 gradient)
    testPhotoPath = path.join(testDir, 'test-photo.jpg');
    await sharp({
      create: {
        width: 400,
        height: 600,
        channels: 3,
        background: { r: 128, g: 128, b: 128 },
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

  describe('cropPhoto', () => {
    it('should crop photo to specified dimensions', async () => {
      const croppedPath = path.join(testDir, 'cropped.jpg');

      await cropPhoto(testPhotoPath, croppedPath, {
        left: 50,
        top: 100,
        width: 200,
        height: 300,
      });

      const metadata = await sharp(croppedPath).metadata();
      expect(metadata.width).toBe(200);
      expect(metadata.height).toBe(300);
    });

    it('should handle edge cropping', async () => {
      const croppedPath = path.join(testDir, 'edge-cropped.jpg');

      await cropPhoto(testPhotoPath, croppedPath, {
        left: 0,
        top: 0,
        width: 100,
        height: 100,
      });

      const metadata = await sharp(croppedPath).metadata();
      expect(metadata.width).toBe(100);
      expect(metadata.height).toBe(100);
    });
  });

  describe('adjustBrightnessContrast', () => {
    it('should increase brightness', async () => {
      const brightPath = path.join(testDir, 'bright.jpg');

      await adjustBrightnessContrast(testPhotoPath, brightPath, {
        brightness: 50, // Increase brightness
      });

      // File should exist and be valid
      const metadata = await sharp(brightPath).metadata();
      expect(metadata.width).toBe(400);
      expect(metadata.height).toBe(600);
    });

    it('should decrease brightness', async () => {
      const darkPath = path.join(testDir, 'dark.jpg');

      await adjustBrightnessContrast(testPhotoPath, darkPath, {
        brightness: -50, // Decrease brightness
      });

      const metadata = await sharp(darkPath).metadata();
      expect(metadata.width).toBe(400);
      expect(metadata.height).toBe(600);
    });

    it('should adjust contrast', async () => {
      const contrastPath = path.join(testDir, 'contrast.jpg');

      await adjustBrightnessContrast(testPhotoPath, contrastPath, {
        contrast: 30,
      });

      const metadata = await sharp(contrastPath).metadata();
      expect(metadata.width).toBe(400);
      expect(metadata.height).toBe(600);
    });

    it('should adjust both brightness and contrast', async () => {
      const adjustedPath = path.join(testDir, 'adjusted.jpg');

      await adjustBrightnessContrast(testPhotoPath, adjustedPath, {
        brightness: 20,
        contrast: 10,
      });

      const metadata = await sharp(adjustedPath).metadata();
      expect(metadata.width).toBe(400);
      expect(metadata.height).toBe(600);
    });

    it('should handle zero adjustment (no change)', async () => {
      const unchangedPath = path.join(testDir, 'unchanged.jpg');

      await adjustBrightnessContrast(testPhotoPath, unchangedPath, {
        brightness: 0,
        contrast: 0,
      });

      const metadata = await sharp(unchangedPath).metadata();
      expect(metadata.width).toBe(400);
    });
  });

  describe('compressPhoto', () => {
    it('should compress photo with default quality (80)', async () => {
      const compressedPath = path.join(testDir, 'compressed.jpg');

      await compressPhoto(testPhotoPath, compressedPath);

      // Check file exists
      const stats = await fs.stat(compressedPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should compress with custom quality', async () => {
      const lowQualityPath = path.join(testDir, 'low-quality.jpg');

      await compressPhoto(testPhotoPath, lowQualityPath, {
        quality: 50,
      });

      const stats = await fs.stat(lowQualityPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should compress to PNG format', async () => {
      const pngPath = path.join(testDir, 'compressed.png');

      await compressPhoto(testPhotoPath, pngPath, {
        quality: 80,
        format: 'png',
      });

      const metadata = await sharp(pngPath).metadata();
      expect(metadata.format).toBe('png');
    });

    it('should compress to WebP format', async () => {
      const webpPath = path.join(testDir, 'compressed.webp');

      await compressPhoto(testPhotoPath, webpPath, {
        quality: 80,
        format: 'webp',
      });

      const metadata = await sharp(webpPath).metadata();
      expect(metadata.format).toBe('webp');
    });
  });

  describe('optimizeForVinted', () => {
    it('should resize and optimize for Vinted', async () => {
      // Create a large image
      const largePath = path.join(testDir, 'large.jpg');
      await sharp({
        create: {
          width: 2000,
          height: 3000,
          channels: 3,
          background: { r: 100, g: 150, b: 200 },
        },
      })
        .jpeg()
        .toFile(largePath);

      const optimizedPath = path.join(testDir, 'optimized.jpg');

      await optimizeForVinted(largePath, optimizedPath, 1000, 1500);

      const metadata = await sharp(optimizedPath).metadata();
      expect(metadata.width).toBeLessThanOrEqual(1000);
      expect(metadata.height).toBeLessThanOrEqual(1500);
      expect(metadata.format).toBe('jpeg');
    });

    it('should not upscale small images', async () => {
      const optimizedPath = path.join(testDir, 'small-optimized.jpg');

      await optimizeForVinted(testPhotoPath, optimizedPath); // 400x600 original

      const metadata = await sharp(optimizedPath).metadata();
      expect(metadata.width).toBe(400);
      expect(metadata.height).toBe(600);
    });
  });

  describe('rotatePhoto', () => {
    it('should rotate photo 90 degrees', async () => {
      const rotatedPath = path.join(testDir, 'rotated-90.jpg');

      await rotatePhoto(testPhotoPath, rotatedPath, 90);

      const metadata = await sharp(rotatedPath).metadata();
      // After 90° rotation, width and height swap
      expect(metadata.width).toBe(600);
      expect(metadata.height).toBe(400);
    });

    it('should rotate photo 180 degrees', async () => {
      const rotatedPath = path.join(testDir, 'rotated-180.jpg');

      await rotatePhoto(testPhotoPath, rotatedPath, 180);

      const metadata = await sharp(rotatedPath).metadata();
      // After 180° rotation, dimensions stay the same
      expect(metadata.width).toBe(400);
      expect(metadata.height).toBe(600);
    });

    it('should rotate photo 270 degrees', async () => {
      const rotatedPath = path.join(testDir, 'rotated-270.jpg');

      await rotatePhoto(testPhotoPath, rotatedPath, 270);

      const metadata = await sharp(rotatedPath).metadata();
      expect(metadata.width).toBe(600);
      expect(metadata.height).toBe(400);
    });
  });

  describe('getImageInfo', () => {
    it('should return image information', async () => {
      const info = await getImageInfo(testPhotoPath);

      expect(info.width).toBe(400);
      expect(info.height).toBe(600);
      expect(info.format).toBe('jpeg');
      expect(info.hasAlpha).toBe(false);
    });
  });

  describe('applyEdits', () => {
    it('should apply multiple edits in sequence', async () => {
      const editedPath = path.join(testDir, 'multi-edited.jpg');

      await applyEdits(testPhotoPath, editedPath, {
        crop: {
          left: 50,
          top: 50,
          width: 300,
          height: 400,
        },
        brightness: 20,
        contrast: 10,
        compression: {
          quality: 85,
          format: 'jpeg',
        },
      });

      const metadata = await sharp(editedPath).metadata();
      expect(metadata.width).toBe(300);
      expect(metadata.height).toBe(400);
      expect(metadata.format).toBe('jpeg');
    });

    it('should apply crop and rotation', async () => {
      const editedPath = path.join(testDir, 'crop-rotate.jpg');

      await applyEdits(testPhotoPath, editedPath, {
        crop: {
          left: 0,
          top: 0,
          width: 200,
          height: 200,
        },
        rotate: 90,
      });

      const metadata = await sharp(editedPath).metadata();
      // After crop to 200x200 and 90° rotation
      expect(metadata.width).toBe(200);
      expect(metadata.height).toBe(200);
    });

    it('should handle empty edits object', async () => {
      const editedPath = path.join(testDir, 'no-edits.jpg');

      await applyEdits(testPhotoPath, editedPath, {});

      const metadata = await sharp(editedPath).metadata();
      expect(metadata.width).toBe(400);
      expect(metadata.height).toBe(600);
    });
  });
});
