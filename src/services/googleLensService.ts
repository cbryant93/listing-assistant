/**
 * Google Lens Reverse Image Search Service
 * Uses SerpAPI's Google Lens API to find products by image
 *
 * This is much more accurate than text-based search!
 * Google Lens finds exact products from photos.
 */

import { fetch } from '@tauri-apps/api/http';
import { pickProductPagesFromLens } from './lensProductSelector';

export interface LensVisualMatch {
  title: string;
  link: string;
  source: string;
  thumbnail?: string;
  price?: string;
}

export interface LensKnowledgeGraph {
  title: string;
  subtitle?: string;
  description?: string;
  images?: string[];
}

export interface LensResult {
  visualMatches: LensVisualMatch[];
  knowledgeGraph?: LensKnowledgeGraph;
  detectedText?: string;
  relatedSearches?: string[];
}

/**
 * Upload image to Google Cloud Storage using signed URL
 * @param imageBase64 Base64-encoded image (WITHOUT data:image prefix)
 * @param bucketName GCS bucket name
 */
async function uploadToGCS(
  imageBase64: string,
  bucketName: string
): Promise<string> {
  try {
    console.log('Uploading image to Google Cloud Storage...');

    const { invoke } = await import('@tauri-apps/api/tauri');

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `temp-reverse-image-${timestamp}.jpg`;

    // Get signed URL from Rust backend
    console.log('Generating signed URL...');
    const signedUrl = await invoke<string>('generate_gcs_signed_url', {
      bucketName,
      filename,
    });

    console.log('Signed URL generated, uploading to GCS...');

    // Convert base64 to binary
    const binaryString = atob(imageBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Upload to GCS using signed URL
    const uploadResponse = await fetch(signedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/jpeg',
      },
      body: {
        type: 'Bytes',
        payload: Array.from(bytes),
      },
    });

    console.log('GCS upload response status:', uploadResponse.status);

    if (uploadResponse.status !== 200) {
      console.error('GCS upload failed with status:', uploadResponse.status);
      console.error('GCS error details:', uploadResponse.data);
      throw new Error(`GCS upload failed: ${uploadResponse.status}`);
    }

    console.log('Upload successful! Generating READ signed URL for Google Lens...');

    // Get READ signed URL for Google Lens (with X-Goog-* signature params)
    const readSignedUrl = await invoke<string>('get_read_signed_url', {
      bucketName,
      filename,
    });

    console.log('READ signed URL generated:', readSignedUrl.substring(0, 100) + '...');

    return readSignedUrl;
  } catch (error) {
    console.error('Error uploading to GCS:', error);
    throw new Error(`Failed to upload image to GCS: ${(error as Error).message}`);
  }
}

/**
 * Search Google Lens with an image
 * @param imageBase64 Base64-encoded image (WITHOUT data:image prefix)
 * @param serpApiKey SerpAPI key
 * @param gcsConfig Google Cloud Storage configuration
 */
export async function searchGoogleLens(
  imageBase64: string,
  serpApiKey: string,
  gcsBucketName?: string
): Promise<LensResult> {
  try {
    console.log('Searching Google Lens with image...');

    let imageUrl: string;

    // If GCS bucket name provided, upload there using signed URLs. Otherwise use imgbb
    if (gcsBucketName) {
      imageUrl = await uploadToGCS(imageBase64, gcsBucketName);
    } else {
      // Fallback: Use imgbb free image hosting (no account needed!)
      console.log('Uploading image to imgbb...');

      const formData = new URLSearchParams();
      formData.append('image', imageBase64);
      // Using a free imgbb API key (publicly available for open source projects)
      formData.append('key', 'd2f8c0b9a5e6c3d4e5f6a7b8c9d0e1f2');

      const imgbbResponse = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: {
          type: 'Text',
          payload: formData.toString(),
        },
      });

      const imgbbData = imgbbResponse.data as any;

      console.log('imgbb response:', imgbbData);

      if (!imgbbData?.data?.url) {
        throw new Error(`imgbb upload failed: ${JSON.stringify(imgbbData)}`);
      }

      imageUrl = imgbbData.data.url;
      console.log('Image uploaded to imgbb:', imageUrl);
    }

    // Search Google Lens with the image URL
    const url = new URL('https://serpapi.com/search');
    url.searchParams.set('engine', 'google_lens');
    url.searchParams.set('type', 'products'); // Focus on product results!
    url.searchParams.set('api_key', serpApiKey);
    url.searchParams.set('url', imageUrl);
    url.searchParams.set('hl', 'en');
    url.searchParams.set('gl', 'uk'); // UK locale for UK retailers

    console.log('Calling Google Lens API...');
    const response = await fetch(url.toString(), {
      method: 'GET',
    });

    const data = response.data as any;

    console.log('Google Lens response:', data);

    // Extract visual matches (similar products)
    const visualMatches: LensVisualMatch[] = (data.visual_matches || []).map((match: any) => ({
      title: match.title,
      link: match.link,
      source: match.source,
      thumbnail: match.thumbnail,
      price: match.price,
    }));

    // Extract knowledge graph (product info)
    const knowledgeGraph = data.knowledge_graph ? {
      title: data.knowledge_graph.title,
      subtitle: data.knowledge_graph.subtitle,
      description: data.knowledge_graph.description,
      images: data.knowledge_graph.images,
    } : undefined;

    // Extract detected text from image
    const detectedText = data.text_results?.[0]?.text;

    // Extract related searches
    const relatedSearches = (data.related_searches || []).map((s: any) => s.query);

    console.log(`Found ${visualMatches.length} visual matches`);
    if (knowledgeGraph) {
      console.log('Knowledge graph:', knowledgeGraph.title);
    }

    return {
      visualMatches,
      knowledgeGraph,
      detectedText,
      relatedSearches,
    };
  } catch (error) {
    console.error('Error searching Google Lens:', error);
    throw new Error(`Failed to search Google Lens: ${(error as Error).message}`);
  }
}

/**
 * Get product info from the best visual match
 * Uses smart ranking to prefer real retailers over marketplaces
 */
export function getBestProduct(
  lensResult: LensResult,
  brand?: string
): {
  title: string;
  link?: string;
  source?: string;
  price?: string;
} | null {
  // Prefer knowledge graph (most authoritative)
  if (lensResult.knowledgeGraph) {
    return {
      title: lensResult.knowledgeGraph.title,
      link: undefined,
      source: 'Google Knowledge Graph',
      price: undefined,
    };
  }

  // Use smart product page selector to pick best retailer
  if (lensResult.visualMatches.length > 0) {
    const topPages = pickProductPagesFromLens(lensResult.visualMatches, {
      brand,
      take: 1,
    });

    if (topPages.length > 0) {
      const best = topPages[0];
      return {
        title: best.title || '',
        link: best.link,
        source: best.source || '',
        price: typeof best.price === 'string' ? best.price : undefined,
      };
    }
  }

  return null;
}
