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
  ocrText: string;  // Combined OCR text from all images
  smartQuery: string;  // Smart search query built from OCR + labels
  dominantColor?: string;  // Primary color detected (e.g., "black", "white", "blue")
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
    const allOcrText: string[] = [];

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
                    { type: 'TEXT_DETECTION', maxResults: 5 },  // ADD OCR!
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

      // Collect brands from logos
      if (annotations.logoAnnotations && annotations.logoAnnotations.length > 0) {
        allBrands.push(annotations.logoAnnotations[0].description);
      }

      // Collect brands from OCR text (more reliable!)
      if (annotations.textAnnotations && annotations.textAnnotations.length > 0) {
        const ocrText = annotations.textAnnotations[0].description;
        allOcrText.push(ocrText);

        // Extract brand names from OCR (Nike, Adidas, Dickies, etc.)
        const brandPattern = /(adidas|nike|dickies|puma|reebok|under armour|new balance)/gi;
        const brandMatches = ocrText.match(brandPattern);
        if (brandMatches) {
          brandMatches.forEach(b => allBrands.push(b.toLowerCase()));
        }
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

    // Combine OCR text
    const combinedOcrText = allOcrText.join(' ');

    // Detect dominant color from labels
    const dominantColor = extractDominantColor(topLabels.map(l => l.label));

    // Build smart search query from OCR + labels (NOT Web Detection!)
    let smartQuery = '';
    const queryParts: string[] = [];

    // Add brand
    if (brand) {
      queryParts.push(brand);
    }

    // Add dominant color (helps refine results significantly!)
    if (dominantColor) {
      queryParts.push(dominantColor);
    }

    // Add garment type from labels
    if (topLabels.length > 0) {
      // Filter out colors and generic terms
      const colors = ['white', 'black', 'red', 'blue', 'grey', 'gray', 'green', 'yellow'];
      const genericTerms = ['fashion', 'textile', 'clothing', 'apparel', 'garment', 'product', 'style'];

      const garmentLabels = topLabels
        .filter(l => {
          const lower = l.label.toLowerCase();
          return !colors.includes(lower) && !genericTerms.includes(lower);
        })
        // Prefer specific compound terms (vest, jacket, etc.) over generic descriptors
        .sort((a, b) => {
          // Prioritize specific garment types
          const specificTerms = ['vest', 'jacket', 'coat', 'hoodie', 'sweater', 'cardigan', 'blazer', 'dress', 'skirt'];
          const aHasSpecific = specificTerms.some(term => a.label.toLowerCase().includes(term));
          const bHasSpecific = specificTerms.some(term => b.label.toLowerCase().includes(term));

          if (aHasSpecific && !bHasSpecific) return -1; // a comes first
          if (!aHasSpecific && bHasSpecific) return 1;  // b comes first

          // Then prefer multi-word labels
          const aWords = a.label.split(' ').length;
          const bWords = b.label.split(' ').length;
          if (aWords !== bWords) return bWords - aWords; // More words first

          return b.avgScore - a.avgScore; // Then by score
        });

      // Use just the most specific label (specific garment types preferred)
      if (garmentLabels.length > 0) {
        queryParts.push(garmentLabels[0].label.toLowerCase());
      }
    }

    // Add keywords from OCR (graphics, model codes, etc.)
    // Look for interesting keywords like "taco", "graphic", style names, etc.
    const keywords = extractKeywords(combinedOcrText);
    keywords.forEach(k => queryParts.push(k));

    smartQuery = queryParts.join(' ').trim();

    // Build suggested title (for display)
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
    console.log('  Dominant color:', dominantColor || 'None');
    console.log('  Smart query:', smartQuery);

    return {
      brand,
      brandConfidence,
      topLabels,
      suggestedCategory,
      suggestedTitle,
      ocrText: combinedOcrText,
      smartQuery,
      dominantColor,
    };
  } catch (error) {
    console.error('Error analyzing multiple images:', error);
    throw new Error(`Failed to analyze images: ${(error as Error).message}`);
  }
}

/**
 * Extract useful keywords from OCR text
 * Looks for: graphics, model codes, style names, etc.
 */
function extractKeywords(ocrText: string): string[] {
  const keywords: string[] = [];
  const lowerText = ocrText.toLowerCase();

  // Look for graphic/print names (taco, skull, logo, etc.)
  const graphicPatterns = /(taco|skull|graphic|print|logo|stripe|camo|floral|paisley|leopard)/gi;
  const graphicMatches = ocrText.match(graphicPatterns);
  if (graphicMatches) {
    graphicMatches.forEach(m => keywords.push(m.toLowerCase()));
  }

  // Look for style keywords (running, training, work, athletic, etc.)
  const stylePatterns = /(running|training|work|athletic|performance|sport|active|casual)/gi;
  const styleMatches = ocrText.match(stylePatterns);
  if (styleMatches) {
    // Only add first style match to avoid too many keywords
    keywords.push(styleMatches[0].toLowerCase());
  }

  // Look for model codes (GN1234, RN12345, etc.)
  const modelPatterns = /[A-Z]{2}\d{4,}/g;
  const modelMatches = ocrText.match(modelPatterns);
  if (modelMatches) {
    // Model codes are very specific - add them!
    keywords.push(modelMatches[0]);
  }

  // Remove duplicates
  return [...new Set(keywords)];
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

/**
 * Extract dominant color from labels
 * Returns the most prominent color detected in the images
 */
function extractDominantColor(labels: string[]): string | undefined {
  // Common clothing colors
  const colorMap: Record<string, string[]> = {
    'black': ['black', 'dark'],
    'white': ['white', 'cream', 'ivory'],
    'grey': ['grey', 'gray', 'silver'],
    'blue': ['blue', 'navy', 'denim', 'indigo', 'azure'],
    'red': ['red', 'crimson', 'burgundy', 'maroon'],
    'green': ['green', 'olive', 'emerald', 'lime'],
    'yellow': ['yellow', 'gold', 'mustard'],
    'orange': ['orange', 'rust', 'copper'],
    'pink': ['pink', 'rose', 'blush'],
    'purple': ['purple', 'violet', 'lavender'],
    'brown': ['brown', 'tan', 'beige', 'khaki', 'taupe'],
    'multi': ['multicolor', 'multi-color', 'colorful', 'pattern'],
  };

  // Count color mentions in labels
  const colorCounts: Record<string, number> = {};

  for (const label of labels) {
    const lowerLabel = label.toLowerCase();

    // Check exact match first
    for (const [color, variants] of Object.entries(colorMap)) {
      if (variants.some(v => lowerLabel === v || lowerLabel.includes(v))) {
        colorCounts[color] = (colorCounts[color] || 0) + 1;
        break; // Only count once per label
      }
    }
  }

  // Return most mentioned color
  const sortedColors = Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1]);

  return sortedColors.length > 0 ? sortedColors[0][0] : undefined;
}
