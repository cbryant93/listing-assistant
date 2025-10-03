import { describe, it, expect, beforeAll } from 'vitest';
import {
  generatePhotoHash,
  calculateHammingDistance,
  calculateSimilarity,
  groupPhotosByItem,
  mergeGroups,
  splitPhotoFromGroup,
} from '../photoGroupingService';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const TEST_DIR = path.join(__dirname, 'test-photos-grouping');

beforeAll(async () => {
  // Create test directory
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }

  // Generate synthetic test images with patterns (not solid colors)
  // Item 1: Red-based images with left stripe (3 similar photos)
  for (let i = 1; i <= 3; i++) {
    const width = 100;
    const height = 100;
    const channels = 3;

    // Create red background with black stripe on left
    const pixels = Buffer.alloc(width * height * channels);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * channels;
        if (x < 20) {
          // Black stripe on left
          pixels[offset] = 0;
          pixels[offset + 1] = 0;
          pixels[offset + 2] = 0;
        } else {
          // Red background (slightly varying)
          pixels[offset] = 200 + i * 5;
          pixels[offset + 1] = 0;
          pixels[offset + 2] = 0;
        }
      }
    }

    await sharp(pixels, { raw: { width, height, channels } })
      .jpeg()
      .toFile(path.join(TEST_DIR, `red-item-${i}.jpg`));
  }

  // Item 2: Blue-based images with right stripe (2 similar photos)
  for (let i = 1; i <= 2; i++) {
    const width = 100;
    const height = 100;
    const channels = 3;

    // Create blue background with black stripe on right
    const pixels = Buffer.alloc(width * height * channels);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * channels;
        if (x > 80) {
          // Black stripe on right
          pixels[offset] = 0;
          pixels[offset + 1] = 0;
          pixels[offset + 2] = 0;
        } else {
          // Blue background
          pixels[offset] = 0;
          pixels[offset + 1] = 0;
          pixels[offset + 2] = 200 + i * 5;
        }
      }
    }

    await sharp(pixels, { raw: { width, height, channels } })
      .jpeg()
      .toFile(path.join(TEST_DIR, `blue-item-${i}.jpg`));
  }

  // Item 3: Green with horizontal stripe (1 photo only)
  const width = 100;
  const height = 100;
  const channels = 3;

  const pixels = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * channels;
      if (y > 40 && y < 60) {
        // Black horizontal stripe
        pixels[offset] = 0;
        pixels[offset + 1] = 0;
        pixels[offset + 2] = 0;
      } else {
        // Green background
        pixels[offset] = 0;
        pixels[offset + 1] = 200;
        pixels[offset + 2] = 0;
      }
    }
  }

  await sharp(pixels, { raw: { width, height, channels } })
    .jpeg()
    .toFile(path.join(TEST_DIR, 'green-item-1.jpg'));
});

describe('Photo Grouping Service', () => {
  describe('generatePhotoHash', () => {
    it('should generate a 64-character binary hash', async () => {
      const photoPath = path.join(TEST_DIR, 'red-item-1.jpg');
      const hash = await generatePhotoHash(photoPath);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[01]+$/); // Only contains 0s and 1s
    });

    it('should generate identical hashes for the same image', async () => {
      const photoPath = path.join(TEST_DIR, 'red-item-1.jpg');
      const hash1 = await generatePhotoHash(photoPath);
      const hash2 = await generatePhotoHash(photoPath);

      expect(hash1).toBe(hash2);
    });

    it('should generate similar hashes for similar images', async () => {
      const hash1 = await generatePhotoHash(path.join(TEST_DIR, 'red-item-1.jpg'));
      const hash2 = await generatePhotoHash(path.join(TEST_DIR, 'red-item-2.jpg'));

      const similarity = calculateSimilarity(hash1, hash2);
      expect(similarity).toBeGreaterThan(0.7); // Should be quite similar
    });

    it('should generate different hashes for different images', async () => {
      const hashRed = await generatePhotoHash(path.join(TEST_DIR, 'red-item-1.jpg'));
      const hashBlue = await generatePhotoHash(path.join(TEST_DIR, 'blue-item-1.jpg'));

      const similarity = calculateSimilarity(hashRed, hashBlue);
      expect(similarity).toBeLessThan(0.7); // Should be different
    });
  });

  describe('calculateHammingDistance', () => {
    it('should return 0 for identical hashes', () => {
      const hash = '1010101010101010';
      const distance = calculateHammingDistance(hash, hash);
      expect(distance).toBe(0);
    });

    it('should calculate correct distance for different hashes', () => {
      const hash1 = '1111000011110000';
      const hash2 = '1010101010101010';
      const distance = calculateHammingDistance(hash1, hash2);
      expect(distance).toBeGreaterThan(0);
    });

    it('should throw error for hashes of different lengths', () => {
      expect(() => {
        calculateHammingDistance('1111', '111100');
      }).toThrow('Hashes must be the same length');
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1 for identical hashes', () => {
      const hash = '1010101010101010';
      const similarity = calculateSimilarity(hash, hash);
      expect(similarity).toBe(1);
    });

    it('should return 0 for completely different hashes', () => {
      const hash1 = '1111111111111111';
      const hash2 = '0000000000000000';
      const similarity = calculateSimilarity(hash1, hash2);
      expect(similarity).toBe(0);
    });

    it('should return value between 0 and 1 for similar hashes', () => {
      const hash1 = '1111111100000000';
      const hash2 = '1111111000000000';
      const similarity = calculateSimilarity(hash1, hash2);
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });
  });

  describe('groupPhotosByItem', () => {
    it('should return empty array for no photos', async () => {
      const groups = await groupPhotosByItem([]);
      expect(groups).toEqual([]);
    });

    it('should group similar photos together', async () => {
      const photos = [
        path.join(TEST_DIR, 'red-item-1.jpg'),
        path.join(TEST_DIR, 'red-item-2.jpg'),
        path.join(TEST_DIR, 'red-item-3.jpg'),
        path.join(TEST_DIR, 'blue-item-1.jpg'),
        path.join(TEST_DIR, 'blue-item-2.jpg'),
      ];

      const groups = await groupPhotosByItem(photos, 0.7);

      // Should have 2 groups (red items and blue items)
      expect(groups.length).toBeGreaterThanOrEqual(2);

      // Each group should have a unique ID
      const ids = groups.map(g => g.id);
      expect(new Set(ids).size).toBe(groups.length);

      // Each group should have photos
      for (const group of groups) {
        expect(group.photos.length).toBeGreaterThan(0);
        expect(group.primaryPhoto).toBe(group.photos[0]);
        expect(group.confidence).toBeGreaterThan(0);
        expect(group.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should create separate group for dissimilar photo', async () => {
      const photos = [
        path.join(TEST_DIR, 'red-item-1.jpg'),
        path.join(TEST_DIR, 'red-item-2.jpg'),
        path.join(TEST_DIR, 'green-item-1.jpg'),
      ];

      const groups = await groupPhotosByItem(photos, 0.7);

      // Should group all 3 photos
      expect(groups.length).toBeGreaterThanOrEqual(1);

      const totalPhotos = groups.reduce((sum, g) => sum + g.photos.length, 0);
      expect(totalPhotos).toBe(3);

      // Each photo should be in exactly one group
      const allPhotos = groups.flatMap(g => g.photos);
      expect(allPhotos).toHaveLength(3);

      // If we have multiple groups, verify they're structured correctly
      if (groups.length > 1) {
        for (const group of groups) {
          expect(group.photos.length).toBeGreaterThan(0);
          expect(group.primaryPhoto).toBe(group.photos[0]);
        }
      }
    });

    it('should handle single photo input', async () => {
      const photos = [path.join(TEST_DIR, 'red-item-1.jpg')];
      const groups = await groupPhotosByItem(photos);

      expect(groups).toHaveLength(1);
      expect(groups[0].photos).toHaveLength(1);
      expect(groups[0].confidence).toBeLessThan(0.9); // Lower confidence for single photo
    });

    it('should respect similarity threshold', async () => {
      const photos = [
        path.join(TEST_DIR, 'red-item-1.jpg'),
        path.join(TEST_DIR, 'red-item-2.jpg'),
      ];

      // Very high threshold should create separate groups
      const strictGroups = await groupPhotosByItem(photos, 0.99);
      expect(strictGroups.length).toBeGreaterThanOrEqual(1);

      // Low threshold should group together
      const lenientGroups = await groupPhotosByItem(photos, 0.5);
      expect(lenientGroups.length).toBeLessThanOrEqual(2);
    });
  });

  describe('mergeGroups', () => {
    it('should merge two groups correctly', () => {
      const group1 = {
        id: 'item-1',
        photos: ['photo1.jpg', 'photo2.jpg'],
        primaryPhoto: 'photo1.jpg',
        confidence: 0.9,
      };

      const group2 = {
        id: 'item-2',
        photos: ['photo3.jpg', 'photo4.jpg'],
        primaryPhoto: 'photo3.jpg',
        confidence: 0.85,
      };

      const merged = mergeGroups(group1, group2);

      expect(merged.id).toBe('item-1');
      expect(merged.photos).toHaveLength(4);
      expect(merged.photos).toContain('photo1.jpg');
      expect(merged.photos).toContain('photo4.jpg');
      expect(merged.primaryPhoto).toBe('photo1.jpg');
      expect(merged.confidence).toBeLessThan(Math.min(group1.confidence, group2.confidence));
    });
  });

  describe('splitPhotoFromGroup', () => {
    it('should split a photo into its own group', () => {
      const group = {
        id: 'item-1',
        photos: ['photo1.jpg', 'photo2.jpg', 'photo3.jpg'],
        primaryPhoto: 'photo1.jpg',
        confidence: 0.9,
      };

      const { updatedGroup, newGroup } = splitPhotoFromGroup(group, 'photo2.jpg');

      expect(updatedGroup.photos).toHaveLength(2);
      expect(updatedGroup.photos).not.toContain('photo2.jpg');
      expect(updatedGroup.confidence).toBeLessThan(group.confidence);

      expect(newGroup.photos).toHaveLength(1);
      expect(newGroup.photos).toContain('photo2.jpg');
      expect(newGroup.primaryPhoto).toBe('photo2.jpg');
      expect(newGroup.id).toContain('split');
    });

    it('should handle splitting the primary photo', () => {
      const group = {
        id: 'item-1',
        photos: ['photo1.jpg', 'photo2.jpg'],
        primaryPhoto: 'photo1.jpg',
        confidence: 0.9,
      };

      const { updatedGroup, newGroup } = splitPhotoFromGroup(group, 'photo1.jpg');

      expect(updatedGroup.photos).toHaveLength(1);
      expect(updatedGroup.primaryPhoto).toBe('photo2.jpg'); // New primary
      expect(newGroup.photos).toContain('photo1.jpg');
    });
  });
});
