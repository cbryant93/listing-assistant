/**
 * Multi-Image Recognition Service
 * Analyzes ALL photos of an item and combines results for better accuracy
 *
 * Instead of analyzing just one photo, this service:
 * - Analyzes all photos of the item
 * - Combines labels from all images
 * - Calculates average confidence scores
 * - Returns the most reliable brand and category
 */

import { fetch } from '@tauri-apps/api/http';

export interface MultiImageRecognitionResult {
  brand?: string;
  brandConfidence: number;
  topLabels: Array<{
    label: string;
    avgScore: number;
    appearances: number;
  }>;
  suggestedCategory?: string;
  suggestedTitle: string;
}

interface LabelScore {
  label: string;
  score: number;
}

/**
 * Analyze multiple images and combine results
 * @param imageBase64Array Array of base64-encoded images (without data:image prefix)
 * @param apiKey Google Cloud Vision API key
 */
export async function analyzeMultipleImages(
  imageBase64Array: string[],
  apiKey: string
): Promise<MultiImageRecognitionResult> {
  try {
    console.log(`Analyzing ${imageBase64Array.length} images...`);

    const allBrands: string[] = [];
    const allLabels: LabelScore[] = [];

    // Analyze each image
    for (let i = 0; i < imageBase64Array.length; i++) {
      console.log(`  Analyzing image ${i + 1}/${imageBase64Array.length}...`);

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
                    content: imageBase64Array[i],
                  },
                  features: [
                    { type: 'LOGO_DETECTION', maxResults: 5 },
                    { type: 'LABEL_DETECTION', maxResults: 15 },
                    { type: 'WEB_DETECTION', maxResults: 10 },
                  ],
                },
              ],
            },
          },
        }
      );

      const data = response.data as any;
      const annotations = data.responses[0];

      // Collect brands
      if (annotations.logoAnnotations && annotations.logoAnnotations.length > 0) {
        allBrands.push(annotations.logoAnnotations[0].description);
      }

      // Collect labels with scores
      if (annotations.labelAnnotations) {
        annotations.labelAnnotations.forEach((label: any) => {
          allLabels.push({
            label: label.description,
            score: label.score,
          });
        });
      }
    }

    // Find most common brand
    let brand: string | undefined;
    let brandConfidence = 0;

    if (allBrands.length > 0) {
      const brandCounts: Record<string, number> = {};
      allBrands.forEach(b => {
        brandCounts[b] = (brandCounts[b] || 0) + 1;
      });

      const mostCommonBrand = Object.keys(brandCounts).sort(
        (a, b) => brandCounts[b] - brandCounts[a]
      )[0];

      brand = mostCommonBrand;
      brandConfidence = brandCounts[mostCommonBrand] / imageBase64Array.length;
    }

    // Combine labels - calculate average score for each unique label
    const labelScores: Record<string, number[]> = {};
    allLabels.forEach(({ label, score }) => {
      if (!labelScores[label]) {
        labelScores[label] = [];
      }
      labelScores[label].push(score);
    });

    const topLabels = Object.keys(labelScores)
      .map(label => ({
        label,
        avgScore: labelScores[label].reduce((a, b) => a + b, 0) / labelScores[label].length,
        appearances: labelScores[label].length,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);

    // Infer category from top labels
    const suggestedCategory = inferCategory(topLabels.map(l => l.label));

    // Build suggested title
    let suggestedTitle = '';
    if (brand && suggestedCategory) {
      suggestedTitle = `${brand} ${suggestedCategory}`;
    } else if (brand && topLabels.length > 0) {
      suggestedTitle = `${brand} ${topLabels[0].label}`;
    } else if (topLabels.length > 0) {
      suggestedTitle = topLabels.slice(0, 2).map(l => l.label).join(' ');
    }

    console.log('Multi-image analysis complete:');
    console.log('  Brand:', brand || 'None', `(${(brandConfidence * 100).toFixed(0)}% confidence)`);
    console.log('  Top labels:', topLabels.slice(0, 5).map(l => l.label).join(', '));

    return {
      brand,
      brandConfidence,
      topLabels,
      suggestedCategory,
      suggestedTitle,
    };
  } catch (error) {
    console.error('Error analyzing multiple images:', error);
    throw new Error(`Failed to analyze images: ${(error as Error).message}`);
  }
}

/**
 * Infer clothing category from detected labels
 */
function inferCategory(labels: string[]): string | undefined {
  const categoryMap: Record<string, string[]> = {
    'sleeveless shirt': ['sleeveless shirt', 'sleeveless'],
    'sweater vest': ['sweater vest', 'vest', 'sweater'],
    trainers: ['shoe', 'sneaker', 'trainer', 'footwear', 'running shoe'],
    dress: ['dress', 'gown', 'frock'],
    shirt: ['shirt', 't-shirt', 'tee', 'top', 'blouse'],
    jeans: ['jeans', 'denim', 'pants', 'trousers'],
    jacket: ['jacket', 'coat', 'blazer', 'outerwear'],
    hoodie: ['hoodie', 'sweatshirt'],
    skirt: ['skirt', 'mini skirt', 'maxi skirt'],
    shorts: ['shorts', 'short pants'],
    bag: ['bag', 'handbag', 'purse', 'backpack'],
    watch: ['watch', 'wristwatch', 'timepiece'],
    sunglasses: ['sunglasses', 'eyewear', 'shades'],
  };

  // Check for exact matches first
  for (const label of labels) {
    const lowerLabel = label.toLowerCase();
    if (categoryMap[lowerLabel]) {
      return lowerLabel;
    }
  }

  // Check for partial matches
  for (const [category, keywords] of Object.entries(categoryMap)) {
    for (const keyword of keywords) {
      if (labels.some(label => label.toLowerCase().includes(keyword))) {
        return category;
      }
    }
  }

  // Fallback to most specific label
  return labels[0]?.toLowerCase();
}
