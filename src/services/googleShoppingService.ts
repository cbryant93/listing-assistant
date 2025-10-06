/**
 * Google Shopping Scraper Service
 * Uses SerpApi to fetch product data from Google Shopping
 *
 * Free tier: 100 searches/month
 * Pricing: $50/mo for 5,000 searches
 *
 * Sign up: https://serpapi.com/
 */

import axios from 'axios';

export interface ProductData {
  title: string;
  price?: number;
  link?: string;
  source?: string;
  rating?: number;
  reviews?: number;
  description?: string;
  thumbnail?: string;
  extracted_price?: number;
}

export interface ShoppingResult {
  products: ProductData[];
  searchQuery: string;
}

/**
 * Search Google Shopping for a product
 * @param query Search query (e.g., "Nike Air Max 90")
 * @param apiKey SerpApi API key (get from https://serpapi.com/)
 * @returns Product data from Google Shopping
 */
export async function searchGoogleShopping(
  query: string,
  apiKey: string
): Promise<ShoppingResult> {
  try {
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google_shopping',
        q: query,
        api_key: apiKey,
        gl: 'uk', // Search from UK
        hl: 'en', // English language
      },
    });

    const products: ProductData[] = (response.data.shopping_results || []).map((result: any) => ({
      title: result.title,
      price: result.extracted_price || result.price,
      link: result.link,
      source: result.source,
      rating: result.rating,
      reviews: result.reviews,
      description: result.snippet || result.description,
      thumbnail: result.thumbnail,
      extracted_price: result.extracted_price,
    }));

    return {
      products,
      searchQuery: query,
    };
  } catch (error) {
    console.error('Error searching Google Shopping:', error);
    throw new Error(`Failed to search Google Shopping: ${(error as Error).message}`);
  }
}

/**
 * Get product info for generating AI descriptions
 * Returns the top result with most complete data
 */
export async function getProductInfoForAI(
  brand: string,
  category: string,
  apiKey: string
): Promise<ProductData | null> {
  const query = `${brand} ${category}`;

  try {
    const result = await searchGoogleShopping(query, apiKey);

    if (result.products.length === 0) {
      return null;
    }

    // Return the first product (usually most relevant)
    return result.products[0];
  } catch (error) {
    console.error('Error getting product info:', error);
    return null;
  }
}

/**
 * Extract RRP (Recommended Retail Price) from Google Shopping
 * Looks for the highest price as an estimate of original retail price
 */
export async function getRRP(
  brand: string,
  category: string,
  apiKey: string
): Promise<number | null> {
  try {
    const result = await searchGoogleShopping(`${brand} ${category} new`, apiKey);

    if (result.products.length === 0) {
      return null;
    }

    // Find the highest price (likely closest to RRP for new items)
    const prices = result.products
      .map(p => p.extracted_price || p.price)
      .filter((p): p is number => p !== undefined && p > 0);

    if (prices.length === 0) {
      return null;
    }

    return Math.max(...prices);
  } catch (error) {
    console.error('Error getting RRP:', error);
    return null;
  }
}

/**
 * Demo/mock function for testing without API key
 * Returns fake data for development
 */
export function getMockProductData(brand: string, category: string): ProductData {
  return {
    title: `${brand} ${category} - Premium Quality`,
    price: 79.99,
    source: 'Example Store',
    rating: 4.5,
    reviews: 1250,
    description: `High-quality ${category} from ${brand}. Features premium materials and excellent craftsmanship. Perfect for everyday wear.`,
    extracted_price: 79.99,
  };
}
