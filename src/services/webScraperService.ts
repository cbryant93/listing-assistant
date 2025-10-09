/**
 * Web Scraper Service
 * Fetches and extracts product information from retailer URLs
 * Used to generate better product descriptions and hashtags
 */

import { fetch } from '@tauri-apps/api/http';

export interface ScrapedProductData {
  title?: string;
  description?: string;
  features?: string[];
  material?: string;
  color?: string;
  brand?: string;
  category?: string;
  price?: number;
  images?: string[];
}

/**
 * Search for retailer URL using Google search
 * Searches for: "[product title] [retailer name]" and extracts the retailer URL
 */
export async function searchRetailerUrl(productTitle: string, retailerName: string): Promise<string | null> {
  try {
    console.log(`🔍 Searching for retailer URL: "${productTitle}" at ${retailerName}`);

    // Build search query
    const searchQuery = encodeURIComponent(`${productTitle} ${retailerName} buy`);
    const searchUrl = `https://www.google.com/search?q=${searchQuery}`;

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      responseType: 2,
    });

    if (!response.ok) {
      console.error(`Google search failed: ${response.status}`);
      return null;
    }

    const html = response.data as string;

    // Map retailer names to domains
    const retailers: Record<string, string[]> = {
      'asos': ['asos.com'],
      'johnlewis': ['johnlewis.com'],
      'john lewis': ['johnlewis.com'],
      'zalando': ['zalando.co.uk'],
      'ebay': ['ebay.co.uk'],
      'amazon': ['amazon.co.uk'],
      'next': ['next.co.uk'],
      'marksandspencer': ['marksandspencer.com'],
      'm&s': ['marksandspencer.com'],
      'marks & spencer': ['marksandspencer.com'],
      'nike': ['nike.com'],
      'adidas': ['adidas.co.uk', 'adidas.com'],
    };

    // Find matching domain
    const retailerKey = retailerName.toLowerCase().replace(/[^a-z&\s]/g, '');
    const domains = retailers[retailerKey] || [];

    // Search for URLs from these domains
    for (const domain of domains) {
      const escapedDomain = domain.replace('.', '\\.');
      const urlPattern = new RegExp(`https?:\\/\\/(?:www\\.)?${escapedDomain}\\/[^\\s"'<>]+`, 'gi');
      const matches = html.match(urlPattern);

      if (matches && matches.length > 0) {
        const url = matches[0];
        console.log('✅ Found retailer URL via search:', url);
        return url;
      }
    }

    console.log('❌ No retailer URL found');
    return null;
  } catch (error) {
    console.error('Error searching for retailer URL:', error);
    return null;
  }
}

/**
 * Scrape product page for details
 * @param url Product URL to scrape (can be Google Shopping URL or direct retailer URL)
 * @returns Extracted product data
 */
export async function scrapeProductPage(url: string): Promise<ScrapedProductData> {
  try {
    console.log(`Scraping product page: ${url}`);

    // If it's a Google Shopping URL, extract the real retailer URL first
    let targetUrl = url;
    if (url.includes('google.com') && url.includes('shopping')) {
      const retailerUrl = await extractRetailerUrl(url);
      if (retailerUrl) {
        targetUrl = retailerUrl;
        console.log(`Using extracted retailer URL: ${targetUrl}`);
      } else {
        console.log('Could not extract retailer URL, returning empty data');
        return {};
      }
    }

    // Fetch the HTML page
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
      },
      responseType: 2, // Text response
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${targetUrl}: ${response.status}`);
      return {};
    }

    const html = response.data as string;

    // Extract data using common patterns
    const scrapedData: ScrapedProductData = {
      title: extractMetaTag(html, 'og:title') || extractTitle(html),
      description: extractMetaTag(html, 'og:description') || extractMetaTag(html, 'description'),
      brand: extractMetaTag(html, 'og:brand') || extractJsonLdField(html, 'brand'),
      price: extractPrice(html),
      images: extractImages(html),
      features: extractFeatures(html),
      material: extractMaterial(html),
      color: extractColor(html),
      category: extractCategory(html),
    };

    console.log('Scraped product data:', scrapedData);
    return scrapedData;
  } catch (error) {
    console.error('Error scraping product page:', error);
    return {};
  }
}

/**
 * Extract meta tag content
 */
function extractMetaTag(html: string, property: string): string | undefined {
  // Try property="..."
  const propertyPattern = new RegExp(`<meta\\s+property=["']${property}["']\\s+content=["']([^"']+)["']`, 'i');
  let match = html.match(propertyPattern);
  if (match) return cleanText(match[1]);

  // Try name="..."
  const namePattern = new RegExp(`<meta\\s+name=["']${property}["']\\s+content=["']([^"']+)["']`, 'i');
  match = html.match(namePattern);
  if (match) return cleanText(match[1]);

  // Try reversed order: content first
  const reversedPattern = new RegExp(`<meta\\s+content=["']([^"']+)["']\\s+(?:property|name)=["']${property}["']`, 'i');
  match = html.match(reversedPattern);
  if (match) return cleanText(match[1]);

  return undefined;
}

/**
 * Extract title from <title> tag
 */
function extractTitle(html: string): string | undefined {
  const match = html.match(/<title>([^<]+)<\/title>/i);
  return match ? cleanText(match[1]) : undefined;
}

/**
 * Extract JSON-LD structured data field
 */
function extractJsonLdField(html: string, field: string): string | undefined {
  const jsonLdPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis;
  const matches = html.matchAll(jsonLdPattern);

  for (const match of matches) {
    try {
      const data = JSON.parse(match[1]);
      if (data[field]) {
        return typeof data[field] === 'string' ? data[field] : data[field].name || data[field]['@id'];
      }
    } catch (e) {
      // Invalid JSON, skip
    }
  }

  return undefined;
}

/**
 * Extract price
 */
function extractPrice(html: string): number | undefined {
  // Try JSON-LD price
  const jsonLdPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis;
  const matches = html.matchAll(jsonLdPattern);

  for (const match of matches) {
    try {
      const data = JSON.parse(match[1]);
      if (data.offers?.price) {
        const price = parseFloat(data.offers.price);
        if (!isNaN(price)) return price;
      }
    } catch (e) {
      // Invalid JSON, skip
    }
  }

  // Try common price patterns in HTML
  const pricePatterns = [
    /£\s*(\d+(?:\.\d{2})?)/,
    /price[^>]*>.*?£?\s*(\d+(?:\.\d{2})?)/i,
  ];

  for (const pattern of pricePatterns) {
    const match = html.match(pattern);
    if (match) {
      const price = parseFloat(match[1]);
      if (!isNaN(price) && price > 0 && price < 10000) {
        return price;
      }
    }
  }

  return undefined;
}

/**
 * Extract product images
 */
function extractImages(html: string): string[] {
  const images: string[] = [];

  // Try og:image
  const ogImage = extractMetaTag(html, 'og:image');
  if (ogImage) images.push(ogImage);

  // Try JSON-LD images
  const jsonLdPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis;
  const matches = html.matchAll(jsonLdPattern);

  for (const match of matches) {
    try {
      const data = JSON.parse(match[1]);
      if (data.image) {
        if (typeof data.image === 'string') {
          images.push(data.image);
        } else if (Array.isArray(data.image)) {
          images.push(...data.image);
        }
      }
    } catch (e) {
      // Invalid JSON, skip
    }
  }

  return [...new Set(images)]; // Remove duplicates
}

/**
 * Extract product features/bullet points
 */
function extractFeatures(html: string): string[] {
  const features: string[] = [];

  // Look for common feature list patterns
  const listPattern = /<ul[^>]*class=["'][^"']*(?:feature|detail|bullet)[^"']*["'][^>]*>(.*?)<\/ul>/gis;
  const matches = html.matchAll(listPattern);

  for (const match of matches) {
    const listHtml = match[1];
    const itemPattern = /<li[^>]*>(.*?)<\/li>/gis;
    const items = listHtml.matchAll(itemPattern);

    for (const item of items) {
      const text = cleanText(stripHtml(item[1]));
      if (text && text.length > 5 && text.length < 200) {
        features.push(text);
      }
    }
  }

  return features.slice(0, 10); // Limit to 10 features
}

/**
 * Extract material information
 */
function extractMaterial(html: string): string | undefined {
  const materialPatterns = [
    /(?:material|fabric|composition)[:\s]*([^<\n]+(?:cotton|polyester|wool|leather|denim|silk|linen|nylon|elastane)[^<\n]*)/gi,
    /(\d+%\s*(?:cotton|polyester|wool|leather|elastane|nylon)[^<\n]*)/gi,
  ];

  for (const pattern of materialPatterns) {
    const match = html.match(pattern);
    if (match) {
      return cleanText(match[1]);
    }
  }

  return undefined;
}

/**
 * Extract color information
 */
function extractColor(html: string): string | undefined {
  const colorPatterns = [
    /(?:colour|color)[:\s]*([a-z\s]+)/gi,
    /<span[^>]*class=["'][^"']*color[^"']*["'][^>]*>([^<]+)</gi,
  ];

  for (const pattern of colorPatterns) {
    const match = html.match(pattern);
    if (match) {
      const color = cleanText(match[1]);
      if (color && color.length < 30) {
        return color;
      }
    }
  }

  return undefined;
}

/**
 * Extract category
 */
function extractCategory(html: string): string | undefined {
  // Try breadcrumbs
  const breadcrumbPattern = /<nav[^>]*class=["'][^"']*breadcrumb[^"']*["'][^>]*>(.*?)<\/nav>/gis;
  const match = html.match(breadcrumbPattern);

  if (match) {
    const breadcrumbHtml = match[1];
    const linkPattern = /<a[^>]*>([^<]+)<\/a>/g;
    const links = [...breadcrumbHtml.matchAll(linkPattern)];

    if (links.length > 1) {
      // Return second-to-last breadcrumb (skip "Home" and current page)
      const category = cleanText(links[links.length - 2]?.[1]);
      if (category) return category;
    }
  }

  return undefined;
}

/**
 * Strip HTML tags
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
}

/**
 * Clean text (decode entities, trim, remove extra spaces)
 */
function cleanText(text: string | undefined): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
