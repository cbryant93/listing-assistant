import type { ListingWithPhotos } from '@types/listing';
import fs from 'fs/promises';

export interface VintedExportData {
  title: string;
  description: string;
  category: string;
  brand: string;
  size: string;
  condition: string;
  colors: string[];
  materials: string[];
  price: number;
  parcel_size: string;
  photos: string[]; // Array of photo file paths
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

// Convert listing to Vinted export format
export function prepareVintedExport(listing: ListingWithPhotos): VintedExportData {
  return {
    title: listing.title,
    description: listing.description,
    category: listing.category || '',
    brand: listing.brand || '',
    size: listing.size || '',
    condition: listing.condition,
    colors: listing.colors,
    materials: listing.materials,
    price: listing.price,
    parcel_size: listing.parcel_size || 'medium',
    photos: listing.photos.map(photo => photo.file_path),
  };
}

// Export listing as JSON
export async function exportAsJSON(
  listing: ListingWithPhotos,
  outputPath: string
): Promise<ExportResult> {
  try {
    const exportData = prepareVintedExport(listing);
    const jsonData = JSON.stringify(exportData, null, 2);

    await fs.writeFile(outputPath, jsonData, 'utf-8');

    return {
      success: true,
      filePath: outputPath,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Export listing as CSV
export async function exportAsCSV(
  listing: ListingWithPhotos,
  outputPath: string
): Promise<ExportResult> {
  try {
    const exportData = prepareVintedExport(listing);

    // CSV headers
    const headers = [
      'title',
      'description',
      'category',
      'brand',
      'size',
      'condition',
      'colors',
      'materials',
      'price',
      'parcel_size',
      'photo_1',
      'photo_2',
      'photo_3',
      'photo_4',
      'photo_5',
    ];

    // CSV values
    const values = [
      escapeCsvValue(exportData.title),
      escapeCsvValue(exportData.description),
      escapeCsvValue(exportData.category),
      escapeCsvValue(exportData.brand),
      escapeCsvValue(exportData.size),
      exportData.condition,
      escapeCsvValue(exportData.colors.join('; ')),
      escapeCsvValue(exportData.materials.join('; ')),
      exportData.price.toString(),
      exportData.parcel_size,
      ...exportData.photos.slice(0, 5).map(escapeCsvValue),
    ];

    // Pad with empty values if less than 5 photos
    while (values.length < headers.length) {
      values.push('');
    }

    const csvContent = [headers.join(','), values.join(',')].join('\n');

    await fs.writeFile(outputPath, csvContent, 'utf-8');

    return {
      success: true,
      filePath: outputPath,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Escape CSV value (handle quotes, commas, newlines)
function escapeCsvValue(value: string): string {
  if (!value) return '';

  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

// Validate export data
export function validateExportData(listing: ListingWithPhotos): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Required fields
  if (!listing.title || listing.title.trim() === '') {
    errors.push('Title is required');
  }

  if (!listing.description || listing.description.trim() === '') {
    errors.push('Description is required');
  }

  if (!listing.condition) {
    errors.push('Condition is required');
  }

  if (listing.price <= 0) {
    errors.push('Price must be greater than 0');
  }

  // Photo requirements (1-20)
  if (!listing.photos || listing.photos.length === 0) {
    errors.push('At least 1 photo is required');
  }

  if (listing.photos && listing.photos.length > 20) {
    errors.push('Maximum 20 photos allowed');
  }

  // Validate colors (max 3)
  if (listing.colors && listing.colors.length > 3) {
    errors.push('Maximum 3 colors allowed');
  }

  // Validate materials (max 3)
  if (listing.materials && listing.materials.length > 3) {
    errors.push('Maximum 3 materials allowed');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Generate export summary
export function getExportSummary(listing: ListingWithPhotos) {
  const exportData = prepareVintedExport(listing);

  return {
    title: exportData.title,
    price: `£${exportData.price.toFixed(2)}`,
    condition: exportData.condition,
    photoCount: exportData.photos.length,
    hasCategory: !!exportData.category,
    hasBrand: !!exportData.brand,
    hasSize: !!exportData.size,
    colorCount: exportData.colors.length,
    materialCount: exportData.materials.length,
  };
}

// Export multiple listings as JSON array
export async function exportMultipleAsJSON(
  listings: ListingWithPhotos[],
  outputPath: string
): Promise<ExportResult> {
  try {
    const exportData = listings.map(prepareVintedExport);
    const jsonData = JSON.stringify(exportData, null, 2);

    await fs.writeFile(outputPath, jsonData, 'utf-8');

    return {
      success: true,
      filePath: outputPath,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Export multiple listings as CSV
export async function exportMultipleAsCSV(
  listings: ListingWithPhotos[],
  outputPath: string
): Promise<ExportResult> {
  try {
    // CSV headers
    const headers = [
      'title',
      'description',
      'category',
      'brand',
      'size',
      'condition',
      'colors',
      'materials',
      'price',
      'parcel_size',
      'photo_1',
      'photo_2',
      'photo_3',
      'photo_4',
      'photo_5',
    ];

    const rows: string[] = [headers.join(',')];

    // Add each listing as a row
    for (const listing of listings) {
      const exportData = prepareVintedExport(listing);

      const values = [
        escapeCsvValue(exportData.title),
        escapeCsvValue(exportData.description),
        escapeCsvValue(exportData.category),
        escapeCsvValue(exportData.brand),
        escapeCsvValue(exportData.size),
        exportData.condition,
        escapeCsvValue(exportData.colors.join('; ')),
        escapeCsvValue(exportData.materials.join('; ')),
        exportData.price.toString(),
        exportData.parcel_size,
        ...exportData.photos.slice(0, 5).map(escapeCsvValue),
      ];

      // Pad with empty values if less than 5 photos
      while (values.length < headers.length) {
        values.push('');
      }

      rows.push(values.join(','));
    }

    const csvContent = rows.join('\n');

    await fs.writeFile(outputPath, csvContent, 'utf-8');

    return {
      success: true,
      filePath: outputPath,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
