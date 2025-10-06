/**
 * Test script to test API integrations without UI
 * Run with: node test-api.js <image-path>
 */

const fs = require('fs');
const path = require('path');

// API Keys
const GOOGLE_VISION_API_KEY = 'AIzaSyBMcOzFdSDZqD2gIHFxihPk_4dgeKS46QU';
const SERPAPI_KEY = 'e0100564fc4f869cb5b7aa5411263e372dfae03fa1e7d214b7b6c98f14b606d5';

// Get image path from command line
const imagePath = process.argv[2];
if (!imagePath) {
  console.error('Usage: node test-api.js <image-path>');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error('Error: Image file not found:', imagePath);
  process.exit(1);
}

console.log('Testing API integrations with image:', imagePath);
console.log('='.repeat(80));

// Read image and convert to base64
const imageBuffer = fs.readFileSync(imagePath);
const base64Image = imageBuffer.toString('base64');

console.log('✓ Image loaded, size:', imageBuffer.length, 'bytes');
console.log('✓ Base64 encoded, length:', base64Image.length, 'characters');
console.log();

// Test 1: Google Vision API
async function testVisionAPI() {
  console.log('TEST 1: Google Vision API');
  console.log('-'.repeat(80));

  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: base64Image,
              },
              features: [
                { type: 'LOGO_DETECTION', maxResults: 5 },
                { type: 'LABEL_DETECTION', maxResults: 10 },
                { type: 'TEXT_DETECTION', maxResults: 1 },
                { type: 'WEB_DETECTION', maxResults: 10 },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error('✗ Vision API Error:', data.error);
      return null;
    }

    const annotations = data.responses[0];

    // Extract brand from logos
    let brand = null;
    if (annotations.logoAnnotations && annotations.logoAnnotations.length > 0) {
      brand = annotations.logoAnnotations[0].description;
      console.log('✓ Logo detected:', brand);
    } else {
      console.log('- No logos detected');
    }

    // Extract labels
    const labels = (annotations.labelAnnotations || []).map(l => l.description);
    console.log('✓ Labels detected:', labels.slice(0, 5).join(', '));

    // Extract text
    let text = null;
    if (annotations.textAnnotations && annotations.textAnnotations.length > 0) {
      text = annotations.textAnnotations[0].description;
      console.log('✓ Text detected:', text.substring(0, 100).replace(/\n/g, ' '));
    } else {
      console.log('- No text detected');
    }

    // Extract web detection data
    let webData = null;
    if (annotations.webDetection) {
      const web = annotations.webDetection;
      console.log();
      console.log('✓ Web Detection:');

      if (web.bestGuessLabels && web.bestGuessLabels.length > 0) {
        console.log('  Best guess:', web.bestGuessLabels[0].label);
      }

      if (web.webEntities && web.webEntities.length > 0) {
        console.log('  Web entities:', web.webEntities.slice(0, 3).map(e => e.description).join(', '));
      }

      if (web.pagesWithMatchingImages && web.pagesWithMatchingImages.length > 0) {
        console.log('  Pages with matching images:', web.pagesWithMatchingImages.length);
        console.log('  Top 3 pages:');
        web.pagesWithMatchingImages.slice(0, 3).forEach((page, i) => {
          console.log(`    ${i + 1}. ${page.pageTitle || 'No title'}`);
          console.log(`       ${page.url}`);
        });
      }

      webData = web;
    }

    console.log();
    return { brand, labels, text, webData };
  } catch (error) {
    console.error('✗ Vision API Error:', error.message);
    return null;
  }
}

// Test 2: SerpAPI Google Shopping Search
async function testGoogleShopping(searchQuery) {
  console.log('TEST 2: SerpAPI Google Shopping Search');
  console.log('-'.repeat(80));
  console.log('Search query:', searchQuery);
  console.log();

  try {
    const url = new URL('https://serpapi.com/search');
    url.searchParams.set('engine', 'google_shopping');
    url.searchParams.set('q', searchQuery);
    url.searchParams.set('api_key', SERPAPI_KEY);
    url.searchParams.set('num', '10');

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.error) {
      console.error('✗ SerpAPI Error:', data.error);
      return null;
    }

    console.log('✓ SerpAPI Response received');

    // Parse shopping results
    if (data.shopping_results && data.shopping_results.length > 0) {
      console.log('✓ Shopping results found:', data.shopping_results.length);
      console.log();
      console.log('Top 5 shopping results:');
      data.shopping_results.slice(0, 5).forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.title || 'No title'}`);
        console.log(`     Price: £${item.extracted_price || item.price || 'N/A'}`);
        console.log(`     Source: ${item.source || 'Unknown'}`);
        console.log(`     Rating: ${item.rating || 'N/A'} (${item.reviews || 0} reviews)`);
        console.log();
      });

      // Calculate average/median price for RRP estimation
      const prices = data.shopping_results
        .map(r => r.extracted_price || r.price)
        .filter(p => p && !isNaN(p));

      if (prices.length > 0) {
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const sortedPrices = [...prices].sort((a, b) => a - b);
        const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];

        console.log('Price analysis:');
        console.log(`  Average: £${avgPrice.toFixed(2)}`);
        console.log(`  Median: £${medianPrice.toFixed(2)}`);
        console.log(`  Range: £${Math.min(...prices).toFixed(2)} - £${Math.max(...prices).toFixed(2)}`);
        console.log();
      }
    } else {
      console.log('- No shopping results found');
    }

    console.log();
    return data;
  } catch (error) {
    console.error('✗ SerpAPI Error:', error.message);
    return null;
  }
}

// Run tests
(async () => {
  // Step 1: Use Vision API to detect brand and category
  const visionResult = await testVisionAPI();

  if (!visionResult) {
    console.log('Vision API failed - cannot continue');
    return;
  }

  // Step 2: Build search query from Vision API results
  let searchQuery = '';
  if (visionResult.brand && visionResult.labels.length > 0) {
    searchQuery = `${visionResult.brand} ${visionResult.labels[0]}`;
  } else if (visionResult.brand) {
    searchQuery = visionResult.brand;
  } else if (visionResult.labels.length > 0) {
    searchQuery = visionResult.labels.slice(0, 2).join(' ');
  }

  console.log();

  // Step 3: Use search query to find products on Google Shopping
  let shoppingResult = null;
  if (searchQuery) {
    shoppingResult = await testGoogleShopping(searchQuery);
  } else {
    console.log('Could not build search query from Vision API results');
  }

  // Summary
  console.log('='.repeat(80));
  console.log('FINAL RESULTS');
  console.log('='.repeat(80));

  if (visionResult) {
    console.log('✓ Product Detection (Vision API):');
    if (visionResult.brand) {
      console.log('  Brand:', visionResult.brand);
    }
    console.log('  Category:', visionResult.labels[0] || 'Unknown');
    console.log('  Labels:', visionResult.labels.slice(0, 3).join(', '));

    // Suggested title
    let title = '';
    if (visionResult.brand && visionResult.labels[0]) {
      title = `${visionResult.brand} ${visionResult.labels[0]}`;
    } else if (visionResult.brand) {
      title = visionResult.brand;
    } else if (visionResult.labels.length > 0) {
      title = visionResult.labels.slice(0, 2).join(' ');
    }
    console.log('  Suggested Title:', title);
  }

  console.log();

  if (shoppingResult && shoppingResult.shopping_results) {
    console.log('✓ Price Data (Google Shopping):');

    const prices = shoppingResult.shopping_results
      .map(r => r.extracted_price || r.price)
      .filter(p => p && !isNaN(p));

    if (prices.length > 0) {
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const medianPrice = [...prices].sort((a, b) => a - b)[Math.floor(prices.length / 2)];

      console.log('  Suggested RRP:', `£${medianPrice.toFixed(2)} (median price from ${prices.length} results)`);
      console.log('  Price range:', `£${Math.min(...prices).toFixed(2)} - £${Math.max(...prices).toFixed(2)}`);

      // Calculate suggested Vinted price: (RRP / 2) + 5
      const suggestedPrice = (medianPrice / 2) + 5;
      console.log('  Suggested Vinted Price:', `£${suggestedPrice.toFixed(2)} (formula: RRP/2 + 5)`);
    } else {
      console.log('  No price data available');
    }

    if (shoppingResult.shopping_results.length > 0) {
      const topResult = shoppingResult.shopping_results[0];
      console.log('  Top result:', topResult.title);
    }
  }
})();
