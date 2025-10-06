/**
 * Image Recognition Service
 * Uses Google Vision API to identify products from photos
 *
 * Features:
 * - Logo detection (Nike, Adidas, etc.)
 * - Object labeling (sneakers, dress, jacket)
 * - Text detection (OCR for labels)
 *
 * Free tier: 1,000 images/month
 * Sign up: https://cloud.google.com/vision
 */

import { fetch } from '@tauri-apps/api/http';

export interface ImageRecognitionResult {
  brand?: string;
  category?: string;
  labels: string[];
  detectedText?: string;
  confidence: number;
}

/**
 * Analyze an image using Google Vision API
 * @param imageBase64 Base64-encoded image data (without data:image prefix)
 * @param apiKey Google Cloud Vision API key
 */
export async function analyzeImage(
  imageBase64: string,
  apiKey: string
): Promise<ImageRecognitionResult> {
  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          type: 'Json',
          payload: {
            requests: [
              {
                image: {
                  content: imageBase64,
                },
                features: [
                  { type: 'LOGO_DETECTION', maxResults: 5 },
                  { type: 'LABEL_DETECTION', maxResults: 10 },
                  { type: 'TEXT_DETECTION', maxResults: 1 },
                ],
              },
            ],
          },
        },
      }
    );

    const data = response.data as any;
    const annotations = data.responses[0];

    // Extract brand from logo detection
    let brand: string | undefined;
    if (annotations.logoAnnotations && annotations.logoAnnotations.length > 0) {
      brand = annotations.logoAnnotations[0].description;
    }

    // Extract category from labels
    const labels: string[] = (annotations.labelAnnotations || []).map(
      (label: any) => label.description.toLowerCase()
    );

    const category = inferCategory(labels);

    // Extract text (for OCR)
    let detectedText: string | undefined;
    if (annotations.textAnnotations && annotations.textAnnotations.length > 0) {
      detectedText = annotations.textAnnotations[0].description;
    }

    // Calculate overall confidence
    const confidence =
      annotations.logoAnnotations?.[0]?.score ||
      annotations.labelAnnotations?.[0]?.score ||
      0.5;

    return {
      brand,
      category,
      labels,
      detectedText,
      confidence,
    };
  } catch (error) {
    console.error('Error analyzing image:', error);
    throw new Error(`Failed to analyze image: ${(error as Error).message}`);
  }
}

/**
 * Infer clothing category from detected labels
 */
function inferCategory(labels: string[]): string | undefined {
  const categoryMap: Record<string, string[]> = {
    trainers: ['shoe', 'sneaker', 'trainer', 'footwear', 'running shoe'],
    dress: ['dress', 'gown', 'frock'],
    shirt: ['shirt', 't-shirt', 'tee', 'top', 'blouse'],
    jeans: ['jeans', 'denim', 'pants', 'trousers'],
    jacket: ['jacket', 'coat', 'blazer', 'outerwear'],
    hoodie: ['hoodie', 'sweatshirt', 'sweater'],
    skirt: ['skirt', 'mini skirt', 'maxi skirt'],
    shorts: ['shorts', 'short pants'],
    bag: ['bag', 'handbag', 'purse', 'backpack'],
    watch: ['watch', 'wristwatch', 'timepiece'],
    sunglasses: ['sunglasses', 'eyewear', 'shades'],
  };

  for (const [category, keywords] of Object.entries(categoryMap)) {
    for (const keyword of keywords) {
      if (labels.some(label => label.includes(keyword))) {
        return category;
      }
    }
  }

  // Fallback to most specific label
  return labels[0];
}

/**
 * Mock function for testing without API key
 * Simulates Google Vision API response
 */
export function getMockImageRecognition(imagePath: string): ImageRecognitionResult {
  // Extract filename for mock logic
  const filename = imagePath.toLowerCase();

  let brand: string | undefined;
  let category: string | undefined;
  const labels: string[] = [];

  // Mock brand detection
  if (filename.includes('nike')) {
    brand = 'Nike';
    category = 'trainers';
    labels.push('sneaker', 'footwear', 'athletic shoe');
  } else if (filename.includes('adidas')) {
    brand = 'Adidas';
    category = 'trainers';
    labels.push('sneaker', 'sportswear', 'athletic shoe');
  } else if (filename.includes('zara')) {
    brand = 'Zara';
    category = 'dress';
    labels.push('dress', 'clothing', 'fashion');
  } else {
    // Generic mock
    labels.push('clothing', 'apparel', 'fashion');
    category = 'clothing';
  }

  return {
    brand,
    category,
    labels,
    detectedText: 'Size: M\\nMade in Bangladesh\\n100% Cotton',
    confidence: 0.85,
  };
}
