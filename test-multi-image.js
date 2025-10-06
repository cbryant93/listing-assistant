/**
 * Test script to analyze MULTIPLE images of the same item
 * Combines labels from all photos to get better product detection
 * Run with: node test-multi-image.js <image1> <image2> <image3> ...
 */

const fs = require('fs');

// API Keys
const GOOGLE_VISION_API_KEY = 'AIzaSyBMcOzFdSDZqD2gIHFxihPk_4dgeKS46QU';
const SERPAPI_KEY = 'e0100564fc4f869cb5b7aa5411263e372dfae03fa1e7d214b7b6c98f14b606d5';

// Get image paths from command line
const imagePaths = process.argv.slice(2);
if (imagePaths.length === 0) {
  console.error('Usage: node test-multi-image.js <image1> <image2> <image3> ...');
  process.exit(1);
}

console.log('Testing multi-image analysis with', imagePaths.length, 'images');
console.log('='.repeat(80));

// Analyze single image with Vision API
async function analyzeImage(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

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
              { type: 'LABEL_DETECTION', maxResults: 15 },
              { type: 'TEXT_DETECTION', maxResults: 1 },
              { type: 'WEB_DETECTION', maxResults: 10 },
            ],
          },
        ],
      }),
    }
  );

  const data = await response.json();
  const annotations = data.responses[0];

  // Extract brand from logos
  let brand = null;
  if (annotations.logoAnnotations && annotations.logoAnnotations.length > 0) {
    brand = annotations.logoAnnotations[0].description;
  }

  // Extract labels with scores
  const labels = (annotations.labelAnnotations || []).map(l => ({
    label: l.description,
    score: l.score,
  }));

  return { brand, labels };
}

// Analyze all images
(async () => {
  console.log('Analyzing all images...');
  console.log();

  const results = [];

  for (let i = 0; i < imagePaths.length; i++) {
    const imagePath = imagePaths[i];
    console.log(`Image ${i + 1}/${imagePaths.length}: ${imagePath}`);

    try {
      const result = await analyzeImage(imagePath);
      results.push(result);

      console.log('  Brand:', result.brand || 'None');
      console.log('  Labels:', result.labels.slice(0, 5).map(l => l.label).join(', '));
      console.log();
    } catch (error) {
      console.error('  Error:', error.message);
      console.log();
    }
  }

  console.log('='.repeat(80));
  console.log('COMBINED ANALYSIS');
  console.log('='.repeat(80));

  // Combine brands (use most common)
  const brands = results.map(r => r.brand).filter(b => b);
  const brandCounts = {};
  brands.forEach(b => {
    brandCounts[b] = (brandCounts[b] || 0) + 1;
  });
  const detectedBrand = Object.keys(brandCounts).sort((a, b) => brandCounts[b] - brandCounts[a])[0] || null;

  if (detectedBrand) {
    console.log('✓ Detected Brand:', detectedBrand);
    console.log('  (appeared in', brandCounts[detectedBrand], 'of', imagePaths.length, 'images)');
  } else {
    console.log('- No brand detected');
  }
  console.log();

  // Combine labels across all images
  const labelScores = {};
  results.forEach(result => {
    result.labels.forEach(({ label, score }) => {
      if (!labelScores[label]) {
        labelScores[label] = [];
      }
      labelScores[label].push(score);
    });
  });

  // Calculate average score for each label
  const labelAverages = Object.keys(labelScores).map(label => ({
    label,
    avgScore: labelScores[label].reduce((a, b) => a + b, 0) / labelScores[label].length,
    appearances: labelScores[label].length,
  }));

  // Sort by average score
  labelAverages.sort((a, b) => b.avgScore - a.avgScore);

  console.log('✓ Combined Labels (sorted by confidence):');
  console.log();
  labelAverages.slice(0, 10).forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.label}`);
    console.log(`     Confidence: ${(item.avgScore * 100).toFixed(1)}%`);
    console.log(`     Appeared in: ${item.appearances}/${imagePaths.length} images`);
    console.log();
  });

  // Build search query from top labels
  const topLabels = labelAverages.slice(0, 3).map(l => l.label);
  let searchQuery = '';

  if (detectedBrand) {
    // Use brand + top 2 labels
    searchQuery = `${detectedBrand} ${topLabels.slice(0, 2).join(' ')}`;
  } else {
    // Use top 3 labels
    searchQuery = topLabels.join(' ');
  }

  console.log('Suggested search query:', searchQuery);
  console.log();

  // Search Google Shopping
  console.log('='.repeat(80));
  console.log('GOOGLE SHOPPING SEARCH');
  console.log('='.repeat(80));

  const url = new URL('https://serpapi.com/search');
  url.searchParams.set('engine', 'google_shopping');
  url.searchParams.set('q', searchQuery);
  url.searchParams.set('api_key', SERPAPI_KEY);
  url.searchParams.set('gl', 'uk');
  url.searchParams.set('hl', 'en');
  url.searchParams.set('num', '20');

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.shopping_results && data.shopping_results.length > 0) {
    console.log('✓ Shopping results found:', data.shopping_results.length);
    console.log();
    console.log('Top 5 results:');
    data.shopping_results.slice(0, 5).forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.title || 'No title'}`);
      console.log(`     Price: £${item.extracted_price || item.price || 'N/A'}`);
      console.log(`     Source: ${item.source || 'Unknown'}`);
      console.log();
    });

    // Calculate pricing
    const prices = data.shopping_results
      .map(r => r.extracted_price || r.price)
      .filter(p => p && !isNaN(p));

    if (prices.length > 0) {
      const sortedPrices = [...prices].sort((a, b) => a - b);
      const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

      console.log('Price analysis:');
      console.log(`  Median RRP: £${medianPrice.toFixed(2)}`);
      console.log(`  Average: £${avgPrice.toFixed(2)}`);
      console.log(`  Range: £${Math.min(...prices).toFixed(2)} - £${Math.max(...prices).toFixed(2)}`);
      console.log();

      const suggestedPrice = (medianPrice / 2) + 5;
      console.log(`  Suggested Vinted Price: £${suggestedPrice.toFixed(2)} (formula: RRP/2 + 5)`);
    }
  } else {
    console.log('- No shopping results found');
  }

  console.log();
  console.log('='.repeat(80));
  console.log('FINAL RECOMMENDATION');
  console.log('='.repeat(80));

  if (detectedBrand && topLabels.length > 0) {
    console.log('Title:', `${detectedBrand} ${topLabels[0]}`);
  } else if (topLabels.length > 0) {
    console.log('Title:', topLabels.slice(0, 2).join(' '));
  }

  console.log('Search worked best with:', searchQuery);
})();
