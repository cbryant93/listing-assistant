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

    console.log();
    return { brand, labels, text };
  } catch (error) {
    console.error('✗ Vision API Error:', error.message);
    return null;
  }
}

// Test 2: SerpAPI Reverse Image Search
async function testSerpAPI() {
  console.log('TEST 2: SerpAPI Reverse Image Search (Google Lens)');
  console.log('-'.repeat(80));

  try {
    const response = await fetch(
      `https://serpapi.com/search?engine=google_lens&api_key=${SERPAPI_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
        }),
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error('✗ SerpAPI Error:', data.error);
      return null;
    }

    console.log('✓ SerpAPI Response received');

    // Parse visual matches
    if (data.visual_matches && data.visual_matches.length > 0) {
      console.log('✓ Visual matches found:', data.visual_matches.length);
      console.log();
      console.log('Top 3 matches:');
      data.visual_matches.slice(0, 3).forEach((match, i) => {
        console.log(`  ${i + 1}. ${match.title || 'No title'}`);
        console.log(`     Source: ${match.source || 'Unknown'}`);
        console.log(`     Link: ${match.link || 'No link'}`);
        console.log();
      });
    } else {
      console.log('- No visual matches found');
    }

    // Parse shopping results
    if (data.shopping_results && data.shopping_results.length > 0) {
      console.log('✓ Shopping results found:', data.shopping_results.length);
      console.log();
      console.log('Top 3 shopping results:');
      data.shopping_results.slice(0, 3).forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.title || 'No title'}`);
        console.log(`     Price: £${item.extracted_price || item.price || 'N/A'}`);
        console.log(`     Source: ${item.source || 'Unknown'}`);
        console.log();
      });
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
  const visionResult = await testVisionAPI();
  const serpResult = await testSerpAPI();

  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));

  if (visionResult) {
    console.log('Vision API: ✓ Success');
    if (visionResult.brand) {
      console.log('  Brand:', visionResult.brand);
    }
    console.log('  Labels:', visionResult.labels.slice(0, 3).join(', '));
  } else {
    console.log('Vision API: ✗ Failed');
  }

  if (serpResult) {
    console.log('SerpAPI: ✓ Success');
    if (serpResult.visual_matches && serpResult.visual_matches.length > 0) {
      console.log('  Top match:', serpResult.visual_matches[0].title);
    }
  } else {
    console.log('SerpAPI: ✗ Failed');
  }
})();
