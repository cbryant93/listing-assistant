/**
 * Reverse Image Search Service
 * Uses Google Custom Search API to find matching products
 *
 * This replicates your manual process of reverse image searching
 * to find the exact product title, RRP, and description
 *
 * Free tier: 100 queries/day
 * Sign up: https://developers.google.com/custom-search
 */

import { fetch } from '@tauri-apps/api/http';

export interface ReverseImageSearchResult {
  title?: string;
  price?: number;
  source?: string;
  link?: string;
  snippet?: string;
}

/**
 * Perform reverse image search using Google Custom Search API
 * @param imageUrl Public URL to the image (or we can upload to temporary hosting)
 * @param apiKey Google Custom Search API key
 * @param searchEngineId Custom Search Engine ID
 */
export async function reverseImageSearch(
  imageUrl: string,
  apiKey: string,
  searchEngineId: string
): Promise<ReverseImageSearchResult[]> {
  try {
    // Google Custom Search API with image search
    const response = await axios.get(
      'https://www.googleapis.com/customsearch/v1',
      {
        params: {
          key: apiKey,
          cx: searchEngineId,
          searchType: 'image',
          q: imageUrl, // Search for this image
          num: 5, // Return top 5 results
        },
      }
    );

    const results: ReverseImageSearchResult[] = [];

    if (response.data.items) {
      for (const item of response.data.items) {
        // Try to extract price from snippet or title
        const priceMatch = item.snippet?.match(/£?(\d+(?:\.\d{2})?)/);
        const price = priceMatch ? parseFloat(priceMatch[1]) : undefined;

        results.push({
          title: item.title,
          price,
          source: item.displayLink,
          link: item.link,
          snippet: item.snippet,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error performing reverse image search:', error);
    throw new Error(`Failed to search: ${(error as Error).message}`);
  }
}

/**
 * Use SerpAPI's Google Lens for reverse image search
 * This is more accurate and easier to use - accepts base64 images directly
 *
 * @param imageBase64 Base64-encoded image data (without data:image prefix)
 * @param serpApiKey SerpAPI key
 */
export async function reverseImageSearchWithSerpApi(
  imageBase64: string,
  serpApiKey: string
): Promise<ReverseImageSearchResult[]> {
  try {
    // Use Tauri's fetch for HTTP requests
    const response = await fetch(`https://serpapi.com/search?engine=google_lens&api_key=${serpApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        type: 'Json',
        payload: {
          image: imageBase64,
        },
      },
    });

    const data = response.data as any;
    const results: ReverseImageSearchResult[] = [];

    // Parse visual matches from Google Lens results
    if (data.visual_matches) {
      for (const match of data.visual_matches.slice(0, 5)) {
        // Try to extract price from title or snippet
        const priceMatch = (match.title || match.snippet || '').match(/[£$€]?\s?(\d+(?:[.,]\d{2})?)/);
        const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : undefined;

        results.push({
          title: match.title,
          price,
          source: match.source,
          link: match.link,
          snippet: match.snippet,
        });
      }
    }

    // Also check shopping results which often have better price data
    if (data.shopping_results) {
      for (const item of data.shopping_results.slice(0, 3)) {
        results.push({
          title: item.title,
          price: item.extracted_price || item.price,
          source: item.source,
          link: item.link,
          snippet: item.snippet,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error performing reverse image search:', error);
    throw new Error(`Failed to search: ${(error as Error).message}`);
  }
}

/**
 * Mock function for testing without API key
 */
export function getMockReverseImageSearch(imagePath: string): ReverseImageSearchResult[] {
  const filename = imagePath.toLowerCase();

  // Mock based on filename
  if (filename.includes('dickies')) {
    return [
      {
        title: 'Dickies Sleeveless Work Shirt - Navy',
        price: 45.99,
        source: 'asos.com',
        link: 'https://example.com/dickies-sleeveless-shirt',
        snippet: 'Dickies sleeveless work shirt in navy. Classic workwear style...',
      },
      {
        title: 'Dickies Sleeveless Workshirt Navy Blue',
        price: 42.00,
        source: 'dickies.com',
        link: 'https://example.com/dickies-official',
        snippet: 'Official Dickies sleeveless shirt. Durable cotton blend...',
      },
    ];
  }

  if (filename.includes('nike')) {
    return [
      {
        title: 'Nike Air Max 90 Trainers - White/Black',
        price: 119.99,
        source: 'nike.com',
        link: 'https://example.com/nike-air-max',
        snippet: 'Nike Air Max 90 in classic white and black colorway...',
      },
    ];
  }

  // Generic mock
  return [
    {
      title: 'Clothing Item - Brand Name',
      price: 35.00,
      source: 'example.com',
      link: 'https://example.com/product',
      snippet: 'Generic product description...',
    },
  ];
}
