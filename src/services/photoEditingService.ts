import sharp from 'sharp';
import path from 'path';

export interface CropOptions {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface BrightnessContrastOptions {
  brightness?: number; // -100 to 100 (0 = no change)
  contrast?: number; // -100 to 100 (0 = no change)
}

export interface CompressionOptions {
  quality?: number; // 1-100 (default: 80)
  format?: 'jpeg' | 'png' | 'webp';
}

// Crop photo
export async function cropPhoto(
  sourcePath: string,
  destPath: string,
  cropOptions: CropOptions
): Promise<void> {
  await sharp(sourcePath)
    .extract({
      left: Math.round(cropOptions.left),
      top: Math.round(cropOptions.top),
      width: Math.round(cropOptions.width),
      height: Math.round(cropOptions.height),
    })
    .toFile(destPath);
}

// Adjust brightness and contrast
export async function adjustBrightnessContrast(
  sourcePath: string,
  destPath: string,
  options: BrightnessContrastOptions
): Promise<void> {
  let image = sharp(sourcePath);

  // Apply brightness adjustment (-100 to +100)
  if (options.brightness !== undefined && options.brightness !== 0) {
    // Sharp uses modulate for brightness: 1 = normal, >1 = brighter, <1 = darker
    // Convert -100 to +100 range to 0.5 to 1.5 range
    const brightnessFactor = 1 + options.brightness / 100;
    image = image.modulate({ brightness: brightnessFactor });
  }

  // Apply contrast adjustment (-100 to +100)
  if (options.contrast !== undefined && options.contrast !== 0) {
    // Sharp linear uses a and b: output = a * input + b
    // For contrast: a = (259 * (contrast + 255)) / (255 * (259 - contrast))
    // Simplified for our range: 1 + contrast/100
    const contrastFactor = 1 + options.contrast / 100;
    image = image.linear(contrastFactor, -(128 * contrastFactor) + 128);
  }

  await image.toFile(destPath);
}

// Compress photo
export async function compressPhoto(
  sourcePath: string,
  destPath: string,
  options: CompressionOptions = {}
): Promise<void> {
  const { quality = 80, format = 'jpeg' } = options;

  let image = sharp(sourcePath);

  if (format === 'jpeg') {
    image = image.jpeg({ quality, mozjpeg: true });
  } else if (format === 'png') {
    image = image.png({ compressionLevel: 9, quality });
  } else if (format === 'webp') {
    image = image.webp({ quality });
  }

  await image.toFile(destPath);
}

// Resize and compress for Vinted (optimized version)
export async function optimizeForVinted(
  sourcePath: string,
  destPath: string,
  targetWidth: number = 1000,
  targetHeight: number = 1500
): Promise<void> {
  await sharp(sourcePath)
    .resize(targetWidth, targetHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({
      quality: 85,
      mozjpeg: true,
    })
    .toFile(destPath);
}

// Rotate photo
export async function rotatePhoto(
  sourcePath: string,
  destPath: string,
  degrees: number
): Promise<void> {
  await sharp(sourcePath).rotate(degrees).toFile(destPath);
}

// Auto-rotate based on EXIF orientation
export async function autoRotate(sourcePath: string, destPath: string): Promise<void> {
  await sharp(sourcePath).rotate().toFile(destPath);
}

// Get image info for editing preview
export async function getImageInfo(filePath: string) {
  const metadata = await sharp(filePath).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format,
    hasAlpha: metadata.hasAlpha || false,
    orientation: metadata.orientation,
  };
}

// Apply multiple edits in sequence
export async function applyEdits(
  sourcePath: string,
  destPath: string,
  edits: {
    crop?: CropOptions;
    brightness?: number;
    contrast?: number;
    rotate?: number;
    compression?: CompressionOptions;
  }
): Promise<void> {
  let image = sharp(sourcePath);

  // Apply crop if specified
  if (edits.crop) {
    image = image.extract({
      left: Math.round(edits.crop.left),
      top: Math.round(edits.crop.top),
      width: Math.round(edits.crop.width),
      height: Math.round(edits.crop.height),
    });
  }

  // Apply rotation if specified
  if (edits.rotate && edits.rotate !== 0) {
    image = image.rotate(edits.rotate);
  }

  // Apply brightness if specified
  if (edits.brightness !== undefined && edits.brightness !== 0) {
    const brightnessFactor = 1 + edits.brightness / 100;
    image = image.modulate({ brightness: brightnessFactor });
  }

  // Apply contrast if specified
  if (edits.contrast !== undefined && edits.contrast !== 0) {
    const contrastFactor = 1 + edits.contrast / 100;
    image = image.linear(contrastFactor, -(128 * contrastFactor) + 128);
  }

  // Apply compression
  const compressionOptions = edits.compression || { quality: 85, format: 'jpeg' };
  if (compressionOptions.format === 'jpeg') {
    image = image.jpeg({ quality: compressionOptions.quality || 85, mozjpeg: true });
  } else if (compressionOptions.format === 'png') {
    image = image.png({ compressionLevel: 9, quality: compressionOptions.quality || 85 });
  }

  await image.toFile(destPath);
}
