import Tesseract from 'tesseract.js';

export interface OCRResult {
  text: string;
  confidence: number;
  brand?: string;
  size?: string;
  materials?: string[];
}

/**
 * Extract text from an image using Tesseract OCR
 * @param imagePath Path to the image file
 * @returns Recognized text with confidence score
 */
export async function extractTextFromImage(imagePath: string): Promise<OCRResult> {
  const result = await Tesseract.recognize(imagePath, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  return {
    text: result.data.text,
    confidence: result.data.confidence,
  };
}

/**
 * Extract brand information from OCR text
 * Common brand label patterns: "BRAND: Nike", "Brand Name", all caps text
 */
export function extractBrand(ocrText: string): string | null {
  const text = ocrText.trim();

  // Pattern 1: "BRAND: Name" or "Brand: Name"
  const brandLabelMatch = text.match(/brand:?\s*([A-Za-z0-9\s&]+?)(?=\n|$)/i);
  if (brandLabelMatch) {
    return brandLabelMatch[1].trim();
  }

  // Pattern 2: All caps words (likely brand names)
  const allCapsMatch = text.match(/\b([A-Z]{2,}(?:\s+[A-Z]{2,})?)\b/);
  if (allCapsMatch) {
    return allCapsMatch[1].trim();
  }

  // Pattern 3: Known brand keywords (expand this list)
  const knownBrands = [
    'Nike', 'Adidas', 'Zara', 'H&M', 'Primark', 'Next', 'Topshop', 'ASOS',
    'Uniqlo', 'Gap', 'Levi', 'Levis', 'Calvin Klein', 'Tommy Hilfiger',
    'Ralph Lauren', 'Gucci', 'Prada', 'Burberry', 'Superdry', 'New Balance',
  ];

  for (const brand of knownBrands) {
    const regex = new RegExp(`\\b${brand}\\b`, 'i');
    if (regex.test(text)) {
      return brand;
    }
  }

  return null;
}

/**
 * Extract size information from OCR text
 * Common patterns: "SIZE: M", "Size 12", "UK 10", "M", "L", "XL"
 */
export function extractSize(ocrText: string): string | null {
  const text = ocrText.trim();

  // Pattern 1: "SIZE: X" or "Size X"
  const sizeLabelMatch = text.match(/size:?\s*([A-Z0-9]+)/i);
  if (sizeLabelMatch) {
    return sizeLabelMatch[1].toUpperCase();
  }

  // Pattern 2: UK/EU/US size patterns
  const ukSizeMatch = text.match(/UK\s*(\d+)/i);
  if (ukSizeMatch) {
    return `UK ${ukSizeMatch[1]}`;
  }

  const euSizeMatch = text.match(/EU\s*(\d+)/i);
  if (euSizeMatch) {
    return `EU ${euSizeMatch[1]}`;
  }

  const usSizeMatch = text.match(/US\s*(\d+)/i);
  if (usSizeMatch) {
    return `US ${usSizeMatch[1]}`;
  }

  // Pattern 3: Letter sizes (XS, S, M, L, XL, XXL)
  const letterSizeMatch = text.match(/\b(XXS|XS|S|M|L|XL|XXL|XXXL)\b/i);
  if (letterSizeMatch) {
    return letterSizeMatch[1].toUpperCase();
  }

  // Pattern 4: Numeric sizes (6, 8, 10, 12, 14, etc.)
  const numericSizeMatch = text.match(/\b(6|8|10|12|14|16|18|20|22|24)\b/);
  if (numericSizeMatch) {
    return numericSizeMatch[1];
  }

  return null;
}

/**
 * Extract material information from OCR text
 * Common patterns: "100% Cotton", "80% Polyester 20% Cotton", "Material: Wool"
 */
export function extractMaterials(ocrText: string): string[] {
  const text = ocrText.toLowerCase();
  const materials: string[] = [];

  // List of materials from VINTED_CONSTRAINTS.md
  const knownMaterials = [
    'cotton', 'polyester', 'wool', 'silk', 'linen', 'cashmere', 'leather',
    'suede', 'denim', 'nylon', 'acrylic', 'viscose', 'elastane', 'spandex',
    'fleece', 'velvet', 'satin', 'chiffon', 'mesh', 'lace', 'corduroy',
    'flannel', 'tweed', 'canvas', 'faux leather', 'faux fur', 'patent leather',
  ];

  // Pattern 1: Percentage-based (e.g., "80% Cotton")
  const percentageMatches = text.matchAll(/(\d+)%\s*([a-z\s]+?)(?=\d+%|\n|$|,)/g);
  for (const match of percentageMatches) {
    const materialName = match[2].trim();
    for (const known of knownMaterials) {
      if (materialName.includes(known)) {
        if (!materials.includes(known)) {
          materials.push(known);
        }
      }
    }
  }

  // Pattern 2: "Material:" or "Composition:" labels
  const materialLabelMatch = text.match(/(?:material|composition):?\s*([^.\n]+)/i);
  if (materialLabelMatch) {
    const materialText = materialLabelMatch[1].toLowerCase();
    for (const known of knownMaterials) {
      if (materialText.includes(known) && !materials.includes(known)) {
        materials.push(known);
      }
    }
  }

  // Pattern 3: Standalone material words
  if (materials.length === 0) {
    for (const known of knownMaterials) {
      const regex = new RegExp(`\\b${known}\\b`, 'i');
      if (regex.test(text) && !materials.includes(known)) {
        materials.push(known);
      }
    }
  }

  // Limit to 3 materials (Vinted constraint)
  return materials.slice(0, 3);
}

/**
 * Analyze a photo for brand, size, and material information
 * @param imagePath Path to the clothing label/tag photo
 * @returns Extracted product information
 */
export async function analyzeClothingLabel(imagePath: string): Promise<OCRResult> {
  const ocrResult = await extractTextFromImage(imagePath);

  return {
    ...ocrResult,
    brand: extractBrand(ocrResult.text),
    size: extractSize(ocrResult.text),
    materials: extractMaterials(ocrResult.text),
  };
}
