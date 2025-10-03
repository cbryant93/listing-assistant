import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { app } from '@tauri-apps/api';

// Vinted photo constraints
const MAX_PHOTOS = 20;
const MIN_PHOTOS = 1;
const RECOMMENDED_WIDTH = 1000;
const RECOMMENDED_HEIGHT = 1500;
const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'gif'];
const MAX_FILE_SIZE_MB = 10;

export interface PhotoValidationResult {
  valid: boolean;
  errors: string[];
}

export interface PhotoMetadata {
  width: number;
  height: number;
  format: string;
  size: number; // bytes
}

// Validate photo file
export async function validatePhoto(filePath: string): Promise<PhotoValidationResult> {
  const errors: string[] = [];

  try {
    // Check if file exists
    await fs.access(filePath);

    // Get file stats
    const stats = await fs.stat(filePath);
    const fileSizeInMB = stats.size / (1024 * 1024);

    // Check file size
    if (fileSizeInMB > MAX_FILE_SIZE_MB) {
      errors.push(`File size (${fileSizeInMB.toFixed(2)}MB) exceeds maximum ${MAX_FILE_SIZE_MB}MB`);
    }

    // Get image metadata
    const metadata = await sharp(filePath).metadata();

    // Check format
    if (metadata.format && !ALLOWED_FORMATS.includes(metadata.format.toLowerCase())) {
      errors.push(`Format ${metadata.format} not allowed. Supported: ${ALLOWED_FORMATS.join(', ')}`);
    }

    // Check dimensions (warning, not error)
    if (metadata.width && metadata.height) {
      if (metadata.width < 640 || metadata.height < 640) {
        errors.push('Warning: Image dimensions are small. Recommended minimum: 640px');
      }
    }
  } catch (error) {
    errors.push(`Failed to read image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Get photo metadata
export async function getPhotoMetadata(filePath: string): Promise<PhotoMetadata> {
  const metadata = await sharp(filePath).metadata();
  const stats = await fs.stat(filePath);

  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || 'unknown',
    size: stats.size,
  };
}

// Validate photo count for listing
export function validatePhotoCount(count: number): PhotoValidationResult {
  const errors: string[] = [];

  if (count < MIN_PHOTOS) {
    errors.push(`At least ${MIN_PHOTOS} photo required`);
  }

  if (count > MAX_PHOTOS) {
    errors.push(`Maximum ${MAX_PHOTOS} photos allowed`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Copy photo to uploads directory
export async function importPhoto(
  sourcePath: string,
  listingId: number,
  photoOrder: number
): Promise<string> {
  // Get app data directory
  const appDataDir = await app.getPath('data');
  const uploadsDir = path.join(appDataDir, 'uploads', listingId.toString());

  // Create uploads directory if it doesn't exist
  await fs.mkdir(uploadsDir, { recursive: true });

  // Generate unique filename
  const ext = path.extname(sourcePath);
  const filename = `photo_${photoOrder}_${Date.now()}${ext}`;
  const destPath = path.join(uploadsDir, filename);

  // Copy file
  await fs.copyFile(sourcePath, destPath);

  return destPath;
}

// Delete photo file from filesystem
export async function deletePhotoFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error(`Failed to delete photo file: ${filePath}`, error);
  }
}

// Resize photo to recommended dimensions
export async function resizePhoto(
  sourcePath: string,
  destPath: string,
  width: number = RECOMMENDED_WIDTH,
  height: number = RECOMMENDED_HEIGHT
): Promise<void> {
  await sharp(sourcePath)
    .resize(width, height, {
      fit: 'inside', // Maintain aspect ratio
      withoutEnlargement: true, // Don't upscale small images
    })
    .toFile(destPath);
}

// Get recommended dimensions for Vinted
export function getRecommendedDimensions(): { width: number; height: number } {
  return {
    width: RECOMMENDED_WIDTH,
    height: RECOMMENDED_HEIGHT,
  };
}

// Get photo constraints
export function getPhotoConstraints() {
  return {
    maxPhotos: MAX_PHOTOS,
    minPhotos: MIN_PHOTOS,
    recommendedWidth: RECOMMENDED_WIDTH,
    recommendedHeight: RECOMMENDED_HEIGHT,
    allowedFormats: ALLOWED_FORMATS,
    maxFileSizeMB: MAX_FILE_SIZE_MB,
  };
}
