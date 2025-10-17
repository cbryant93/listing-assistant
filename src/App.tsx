import { useState } from 'react';
import { open } from '@tauri-apps/api/dialog';
import { invoke } from '@tauri-apps/api/tauri';
import { PhotoGroup } from './services/photoGroupingService';
import { Listing } from './types/listing';
import UploadScreen from './components/UploadScreen';
import ItemCard from './components/ItemCard';

interface ProductSuggestion {
  title: string;
  price?: number;
  source: string;
  thumbnail?: string;
  link?: string; // Google Shopping URL
  serpapi_product_api?: string; // SerpAPI Product endpoint URL
  serpapi_immersive_product_api?: string; // SerpAPI Immersive Product endpoint URL
  product_id?: string;
  immersive_product_page_token?: string; // Token for Immersive Product API
}

interface CategorySuggestion {
  path: string[];
  confidence: number;
  category: string;
  pathString: string; // Full path as string (e.g., "Men > Clothing > Tops")
}

interface ItemData {
  group: PhotoGroup;
  listing: Partial<Listing>;
  isExpanded: boolean;
  isAnalyzing?: boolean;
  productSuggestions?: ProductSuggestion[];
  selectedProduct?: ProductSuggestion; // Store selected product for description generation
  scrapedData?: any; // Store scraped data for description regeneration
  categorySuggestions?: CategorySuggestion[]; // Top category matches
}

/**
 * Auto-detect parcel size based on category
 */
function detectParcelSize(category?: string): string {
  if (!category) return '';

  const cat = category.toLowerCase();

  // Small items
  if (cat.includes('accessory') || cat.includes('accessories') ||
      cat.includes('belt') || cat.includes('scarf') ||
      cat.includes('hat') || cat.includes('glove') ||
      cat.includes('tie') || cat.includes('socks') ||
      cat.includes('t-shirt') || cat.includes('tee') || cat.includes('top')) {
    return 'small';
  }

  // Large items
  if (cat.includes('shoe') || cat.includes('trainer') || cat.includes('sneaker') ||
      cat.includes('boot') || cat.includes('jacket') || cat.includes('coat') ||
      cat.includes('blazer') || cat.includes('hoodie')) {
    return 'large';
  }

  // Extra large items
  if (cat.includes('winter coat') || cat.includes('puffer') || cat.includes('parka')) {
    return 'extra_large';
  }

  // Medium (default for most clothing)
  return 'medium';
}

// Parse material string and extract up to 3 materials
function parseMaterials(materialString?: string): string[] {
  if (!materialString) return [];

  const materials: string[] = [];
  const text = materialString.toLowerCase();

  // Material mapping to Vinted options
  const materialMap: Record<string, string> = {
    'cotton': 'cotton',
    'polyester': 'polyester',
    'wool': 'wool',
    'leather': 'leather',
    'denim': 'denim',
    'silk': 'silk',
    'linen': 'linen',
    'nylon': 'nylon',
    'elastane': 'elastane',
    'spandex': 'elastane', // Map spandex to elastane
    'viscose': 'viscose',
    'acrylic': 'acrylic',
    'cashmere': 'cashmere',
    'synthetic': 'synthetic',
  };

  // Extract materials in order of appearance
  for (const [keyword, material] of Object.entries(materialMap)) {
    if (text.includes(keyword) && !materials.includes(material)) {
      materials.push(material);
      if (materials.length >= 3) break; // Max 3 materials
    }
  }

  console.log('Parsed materials:', materialString, '→', materials);
  return materials;
}

function App() {
  const [items, setItems] = useState<ItemData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleUploadPhotos = async () => {
    try {
      setIsProcessing(true);
      console.log('Opening file picker...');

      // Open file picker for multiple photos
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'Images',
          extensions: ['jpg', 'jpeg', 'png', 'gif']
        }]
      });

      console.log('Selected files:', selected);

      if (!selected || (Array.isArray(selected) && selected.length === 0)) {
        console.log('No files selected');
        setIsProcessing(false);
        return;
      }

      const photoPaths = Array.isArray(selected) ? selected : [selected];
      console.log('Photo paths:', photoPaths);

      // Simple mode: Create one item with all selected photos
      // User will upload photos item-by-item
      const groups = [{
        id: `item-${items.length + 1}`,
        photos: photoPaths,
        primaryPhoto: photoPaths[0],
        confidence: 1.0,
      }];

      console.log('Created groups:', groups);

      // Create item data for each group
      const newItems: ItemData[] = groups.map((group, index) => ({
        group,
        listing: {
          title: '',
          description: '',
          condition: undefined, // No default - user must select
          colors: [],
          materials: [],
          rrp: 0,
          price: 0,
        },
        isExpanded: false,
      }));

      console.log('Created items:', newItems);
      setItems(newItems);
      setIsProcessing(false);
      console.log('Upload complete!');
    } catch (error) {
      console.error('Error uploading photos:', error);
      alert('Error uploading photos: ' + (error as Error).message);
      setIsProcessing(false);
    }
  };

  const handleToggleExpand = (index: number) => {
    setItems(items.map((item, i) =>
      i === index ? { ...item, isExpanded: !item.isExpanded } : item
    ));
  };

  const handleUpdateListing = (index: number, updates: Partial<Listing>) => {
    setItems(items.map((item, i) =>
      i === index ? { ...item, listing: { ...item.listing, ...updates } } : item
    ));
  };

  const handleProductSelect = async (index: number, product: ProductSuggestion) => {
    console.log('Product selected:', product.title);
    console.log('Product URL:', product.link);

    // Calculate price based on RRP
    const { calculatePrice } = await import('./services/pricingService');
    const rrp = product.price || 0;
    let calculatedPrice = 10; // Default minimum
    if (rrp > 0) {
      const item = items[index];
      const priceCalc = calculatePrice(rrp, item.listing.condition || 'very_good');
      calculatedPrice = priceCalc.suggestedPrice;
    }

    // Immediately update UI: fill title/RRP/price and hide dropdown
    setItems(prevItems => prevItems.map((it, i) => {
      if (i === index) {
        return {
          ...it,
          listing: {
            ...it.listing,
            title: product.title,
            rrp: rrp > 0 ? rrp : undefined,
            price: calculatedPrice,
          },
          selectedProduct: product,
          productSuggestions: undefined // Hide dropdown immediately
        };
      }
      return it;
    }));

    // Scrape product page and generate description (async, don't block UI)
    if (product) {
      try {
        const { resolveRetailerUrl } = await import('./services/googleShoppingService');
        const { scrapeProductPage } = await import('./services/webScraperService');
        const { generateDescription } = await import('./services/aiDescriptionService');

        // Get retailer URL using 3-lane approach
        console.log('🔄 Resolving retailer URL (3-lane approach)...');
        const result = await resolveRetailerUrl(
          product as any, // Cast to ProductData
          import.meta.env.VITE_SERPAPI_KEY
        );

        const retailerUrl = result.retailerUrl;
        console.log(`Retailer URL: ${retailerUrl || 'Not found'} (Lane ${result.lane || 'none'})`);

        // Use immersive product data if available (from Lane B), otherwise scrape
        let scrapedData: any = {};

        if (result.immersiveProductData) {
          // Use description from Immersive Product API
          console.log('✅ Using description from Immersive Product API');
          scrapedData = {
            description: result.immersiveProductData.description,
            features: result.immersiveProductData.features,
            title: result.immersiveProductData.title,
            brand: result.immersiveProductData.brand,
          };

          // Also scrape retailer page for material composition (not in Immersive API)
          if (retailerUrl) {
            console.log('🔍 Scraping retailer page for material data...');
            const retailerData = await scrapeProductPage(retailerUrl);
            if (retailerData.material) {
              scrapedData.material = retailerData.material;
              console.log('✅ Found material:', retailerData.material);
            } else {
              // Fallback: Try extracting material from description text
              console.log('⚠️ Could not scrape material, trying to extract from description...');
              const descText = result.immersiveProductData.description || '';
              const materialMatch = descText.match(/(\d+%\s*(?:cotton|polyester|wool|leather|elastane|nylon|viscose|acrylic|spandex|cashmere|denim|silk|linen)[^.]*)/i);
              if (materialMatch) {
                scrapedData.material = materialMatch[0];
                console.log('✅ Extracted material from description:', scrapedData.material);
              }
            }
          }
        } else if (retailerUrl) {
          // Fallback: scrape retailer page
          console.log(`✅ Found retailer URL: ${retailerUrl}`);
          console.log(`Scraping retailer page for product description...`);
          scrapedData = await scrapeProductPage(retailerUrl);
        } else {
          console.log('❌ No retailer URL found, will generate basic description');
        }

        console.log('Product data:', scrapedData);

        // Parse materials from scraped data
        const scrapedMaterials = parseMaterials(scrapedData.material);

        // Detect Vinted category using product title + scraped data + Vision labels
        const categoryService = await import('./services/categoryMappingService');
        const { findTopCategoryMatches, getCategoryPathString } = categoryService;

        // Get current item to access Vision labels
        const currentItem = items[index];

        // Get Vision API labels (stored in item during auto-fill)
        const visionLabels = currentItem.listing.category ? [currentItem.listing.category] : [];

        // Detect gender from product title
        const titleLower = product.title.toLowerCase();
        let gender: 'men' | 'women' | undefined;
        if (titleLower.includes("men's") || titleLower.includes('mens') || titleLower.match(/\bmen\b/)) {
          gender = 'men';
        } else if (titleLower.includes("women's") || titleLower.includes('womens') || titleLower.match(/\bwomen\b/)) {
          gender = 'women';
        }

        // Extract keywords from product title for better matching
        const titleKeywords = product.title.toLowerCase().split(/[\s-]+/).filter(w => w.length > 2);
        visionLabels.push(...titleKeywords);

        // Get top 5 category matches for dropdown
        const categoryMatches = findTopCategoryMatches(visionLabels, gender, {
          productTitle: product.title,
          scrapedCategory: scrapedData.category,
        }, 5);

        const categorySuggestions: CategorySuggestion[] = categoryMatches.map(match => ({
          path: match.path,
          confidence: match.confidence,
          category: match.category,
          pathString: getCategoryPathString(match),
        }));

        // Auto-fill with top match
        const vintedCategoryPath = categorySuggestions.length > 0 ? categorySuggestions[0].pathString : undefined;
        console.log('🏷️ Top category suggestions:', categorySuggestions.map(s => `${s.pathString} (${(s.confidence * 100).toFixed(0)}%)`));

        // Get latest item state
        setItems(prevItems => {
          const item = prevItems[index];

          // Generate enhanced description with scraped data
          const descriptionInput = {
            brand: item.listing.brand,
            category: item.listing.category,
            size: item.listing.size,
            condition: item.listing.condition, // Optional - only if user selected
            rrp: item.listing.rrp, // Pass listing RRP
            colors: item.listing.colors,
            materials: scrapedMaterials.length > 0 ? scrapedMaterials : item.listing.materials,
            scrapedData: scrapedData.description || scrapedData.features ? {
              title: scrapedData.title || product.title,
              description: scrapedData.description,
              features: scrapedData.features,
              material: scrapedData.material,
              color: scrapedData.color,
            } : undefined,
          };

          console.log('Description input:', descriptionInput);

          const descriptionResult = generateDescription(descriptionInput);

          console.log('Generated description:', descriptionResult.fullText);

          // Update description AND store scraped data + category suggestions for future use
          return prevItems.map((it, i) => {
            if (i === index) {
              return {
                ...it,
                scrapedData, // Store for condition changes
                categorySuggestions, // Store category suggestions for dropdown
                listing: {
                  ...it.listing,
                  description: descriptionResult.fullText,
                  materials: scrapedMaterials.length > 0 ? scrapedMaterials : it.listing.materials,
                  vinted_category_path: vintedCategoryPath || it.listing.vinted_category_path,
                },
              };
            }
            return it;
          });
        });

        console.log('✅ Description generated from scraped product data');
      } catch (error) {
        console.error('Error scraping product page:', error);
        // Fallback: generate description using product title as "scraped data"
        const { generateDescription } = await import('./services/aiDescriptionService');
        setItems(prevItems => {
          const item = prevItems[index];
          const descriptionResult = generateDescription({
            brand: item.listing.brand,
            category: item.listing.category,
            size: item.listing.size,
            condition: item.listing.condition || 'very_good',
            colors: item.listing.colors,
            materials: item.listing.materials,
            scrapedData: {
              title: product.title,
              // Use title as a hint for description generation
            },
          });
          return prevItems.map((it, i) => {
            if (i === index) {
              return {
                ...it,
                listing: {
                  ...it.listing,
                  description: descriptionResult.fullText,
                },
              };
            }
            return it;
          });
        });
        console.log('⚠️ Generated fallback description using product title (scraping failed)');
      }
    }
  };

  const handleAutoFill = async (index: number) => {
    const item = items[index];

    try {
      setIsProcessing(true);

      // Set analyzing state for this item
      setItems(prev => prev.map((it, i) =>
        i === index ? { ...it, isAnalyzing: true } : it
      ));

      const { calculatePrice } = await import('./services/pricingService');
      const { generateDescription } = await import('./services/aiDescriptionService');
      const { getRRP, getProductInfoForAI } = await import('./services/googleShoppingService');
      const { analyzeMultipleImages } = await import('./services/multiImageRecognitionService');

      console.log('Starting auto-fill...');
      console.log(`Analyzing ${item.group.photos.length} photos...`);

      // Load ALL images as base64
      const base64Images: string[] = [];
      for (const photoPath of item.group.photos) {
        const imageData = await invoke<string>('read_image_as_base64', { filePath: photoPath });
        const base64Image = imageData.split(',')[1]; // Remove data:image/jpeg;base64, prefix
        base64Images.push(base64Image);
      }

      // Step 1: Analyze ALL photos with Vision API for brand/category/labels
      console.log('Step 1: Analyzing all images with Google Vision API...');
      const recognition = await analyzeMultipleImages(base64Images, import.meta.env.VITE_GOOGLE_VISION_API_KEY);
      console.log('Multi-image analysis result:', recognition);

      // Capitalize brand name (first letter of each word)
      const rawBrand = item.listing.brand || recognition.brand || '';
      const brand = rawBrand
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

      // Don't detect category yet - will do it after product selection for better accuracy
      // (using product title + scraped data + vision labels together)

      const category = item.listing.category || recognition.suggestedCategory || '';
      const productTitle = recognition.suggestedTitle;
      const smartQuery = recognition.smartQuery; // Smart query built from OCR + labels!
      const detectedSize = recognition.detectedSize; // Size extracted from clothing labels
      const dominantColors = recognition.dominantColors; // Dominant colors detected from images (up to 2)

      // Step 2: Build simple, clean search queries
      console.log('Step 2: Building search queries...');
      const { searchGoogleShopping } = await import('./services/googleShoppingService');

      const queryVariations: string[] = [];

      // Get top 2-3 non-color, non-generic labels from Vision API (they're already good!)
      const colors = ['white', 'black', 'red', 'blue', 'grey', 'gray', 'green', 'yellow'];
      const genericTerms = ['fashion', 'textile', 'clothing', 'apparel', 'garment', 'product', 'style', 'design'];

      const goodLabels = recognition.topLabels
        .filter(l => {
          const lower = l.label.toLowerCase();
          return !colors.includes(lower) && !genericTerms.includes(lower);
        })
        .slice(0, 3); // Top 3 labels only

      console.log('Using labels:', goodLabels.map(l => l.label));
      console.log('Smart query (with OCR keywords):', smartQuery);

      if (brand && goodLabels.length > 0) {
        // Extract keywords from BOTH smart query (OCR text) AND vision labels
        // Smart query has specific keywords like "taco graphic running"
        // Vision labels have generic keywords like "sleeve", "t-shirt", "sportswear"
        const keywords = new Set<string>();

        // First, add keywords from smart query (most specific!)
        if (smartQuery) {
          smartQuery.toLowerCase()
            .replace(brand.toLowerCase(), '') // Remove brand name
            .split(' ')
            .forEach(word => {
              if (word.length > 2 && !['the', 'and', 'for', 'with'].includes(word)) {
                keywords.add(word);
              }
            });
        }

        // Then add keywords from vision labels (fallback)
        goodLabels.forEach(label => {
          label.label.toLowerCase().split(' ').forEach(word => {
            if (word.length > 2) {
              keywords.add(word);
            }
          });
        });

        const keywordList = Array.from(keywords);
        console.log('Extracted keywords:', keywordList);

        // Normalize keywords (handle variations like "t-shirt" -> "tshirt", "polo-shirt" -> "polo shirt")
        const normalizedKeywords = keywordList.map(k => {
          // Remove hyphens for matching (but keep original for display)
          const normalized = k.replace(/-/g, '');
          return { original: k, normalized };
        });

        // Separate garment types from descriptors
        const garmentTypes = ['vest', 'sweater', 'shirt', 'tshirt', 'tee', 'jacket', 'coat', 'dress', 'skirt', 'hoodie', 'cardigan', 'blazer', 'top', 'blouse', 'polo', 'jumper', 'pullover'];
        const garmentWords = normalizedKeywords
          .filter(k => garmentTypes.includes(k.normalized))
          .map(k => k.original); // Use original keyword
        const descriptorWords = normalizedKeywords
          .filter(k => !garmentTypes.includes(k.normalized))
          .map(k => k.original);

        console.log('Garment words:', garmentWords);
        console.log('Descriptor words:', descriptorWords);

        // Valid compound garment types (these can be combined into ONE search term)
        // Check for "t-shirt" as a single keyword or compounds like "sweater vest"
        const validCompounds = [
          ['sweater', 'vest'], // sweater vest
          ['polo', 'shirt'],   // polo shirt
          ['tank', 'top'],     // tank top
        ];

        // Check if we have a valid compound garment type
        const compoundMatch = validCompounds.find(compound =>
          compound.every(word => garmentWords.some(g => g.replace(/-/g, '') === word))
        );

        // Build realistic, descriptive search queries
        // Strategy: Combine multiple descriptors for most specific search
        const queries: string[] = [];

        if (descriptorWords.length > 0 && garmentWords.length > 0) {
          // Filter out generic/common descriptors
          const genericDescriptors = ['active', 'sleeve', 'sportswear', 'clothing', 'apparel', 'fashion', 'textile'];
          const specificDescriptors = descriptorWords.filter(d => !genericDescriptors.includes(d));
          const fallbackDescriptors = descriptorWords.filter(d => genericDescriptors.includes(d));

          // Use specific descriptors first (e.g., "taco", "graphic", "running")
          const prioritizedDescriptors = [...specificDescriptors, ...fallbackDescriptors];

          // If we have a valid compound (e.g., "sweater vest"), use it
          if (compoundMatch) {
            // Query 1: Brand + top 2 descriptors + compound
            // e.g., "dickies sleeveless sweater vest"
            const desc = prioritizedDescriptors.slice(0, 1).join(' ');
            const query = `${brand.toLowerCase()} ${desc} ${compoundMatch.join(' ')}`;
            queries.push(query);
          }

          // Query 1: Brand + top 2-3 specific descriptors + garment type
          // e.g., "adidas taco graphic t-shirt" (very specific!)
          if (specificDescriptors.length >= 2) {
            const desc = specificDescriptors.slice(0, 2).join(' '); // Combine top 2 descriptors
            const query1 = `${brand.toLowerCase()} ${desc} ${garmentWords[0]}`;
            queries.push(query1);
          }

          // Query 2: Brand + first specific descriptor + garment type
          // e.g., "adidas taco t-shirt"
          if (specificDescriptors.length > 0) {
            const query2 = `${brand.toLowerCase()} ${specificDescriptors[0]} ${garmentWords[0]}`;
            if (!queries.includes(query2)) {
              queries.push(query2);
            }
          }

          // Query 3: Brand + second specific descriptor + garment type
          // e.g., "adidas graphic t-shirt"
          if (specificDescriptors.length > 1) {
            const query3 = `${brand.toLowerCase()} ${specificDescriptors[1]} ${garmentWords[0]}`;
            if (!queries.includes(query3)) {
              queries.push(query3);
            }
          }

          // Query 4: Brand + first descriptor (any) + second garment type
          // e.g., "adidas taco shirt"
          if (garmentWords.length > 1) {
            const query4 = `${brand.toLowerCase()} ${prioritizedDescriptors[0]} ${garmentWords[1]}`;
            if (!queries.includes(query4)) {
              queries.push(query4);
            }
          }

          // Fallback: If no specific descriptors, use generic ones
          if (queries.length === 0) {
            const query = `${brand.toLowerCase()} ${prioritizedDescriptors[0]} ${garmentWords[0]}`;
            queries.push(query);
          }
        } else if (descriptorWords.length > 0) {
          // No garment words, just use descriptors with brand
          const topDescriptors = descriptorWords.slice(0, 3);
          topDescriptors.forEach(desc => {
            queries.push(`${brand.toLowerCase()} ${desc}`);
          });
        } else {
          // Fallback: No descriptor words, use full labels
          // Query 1: Brand + first full label
          const query1 = `${brand.toLowerCase()} ${goodLabels[0].label.toLowerCase()}`;
          queries.push(query1);

          // Query 2: Brand + second full label
          if (goodLabels.length >= 2) {
            const query2 = `${brand.toLowerCase()} ${goodLabels[1].label.toLowerCase()}`;
            if (!queries.includes(query2)) {
              queries.push(query2);
            }
          }
        }

        queryVariations.push(...queries);
      }

      console.log('Running queries:', queryVariations);

      let rrpFromShopping = null;
      let scrapedData = null;
      const productSuggestions: ProductSuggestion[] = [];
      const allPrices: number[] = [];

      // Run all query variations and collect results
      for (const query of queryVariations) {
        try {
          console.log(`Searching: "${query}"`);
          const shoppingResults = await searchGoogleShopping(
            query,
            import.meta.env.VITE_SERPAPI_KEY
          );

          console.log(`  Found ${shoppingResults.products.length} results`);

          // Collect top 5 products from each query (avoid duplicates by title)
          const existingTitles = new Set(productSuggestions.map(s => s.title.toLowerCase()));

          shoppingResults.products.slice(0, 5).forEach(product => {
            const titleLower = product.title.toLowerCase();
            if (!existingTitles.has(titleLower)) {
              productSuggestions.push({
                title: product.title,
                price: product.extracted_price || product.price,
                source: `${product.source || 'Google Shopping'} (${query})`,
                thumbnail: product.thumbnail,
                link: product.link,
                serpapi_product_api: product.serpapi_product_api, // Pre-built Product API URL
                serpapi_immersive_product_api: product.serpapi_immersive_product_api, // Pre-built Immersive API URL
                product_id: product.product_id,
                immersive_product_page_token: product.immersive_product_page_token,
              });
              existingTitles.add(titleLower);
            }
          });

          // Collect all prices for median calculation
          const prices = shoppingResults.products
            .map(p => p.extracted_price || p.price)
            .filter((p): p is number => p !== undefined && p > 0);
          allPrices.push(...prices);

          // Use first query's top product for description data
          if (!scrapedData && shoppingResults.products.length > 0) {
            scrapedData = shoppingResults.products[0];
          }

        } catch (error) {
          console.error(`Error searching "${query}":`, error);
        }
      }

      // Calculate median RRP from ALL results across all queries
      if (allPrices.length > 0) {
        const sortedPrices = [...allPrices].sort((a, b) => a - b);
        rrpFromShopping = sortedPrices[Math.floor(sortedPrices.length / 2)];
        console.log(`Total results: ${productSuggestions.length} products, Median RRP: £${rrpFromShopping}`);
      }

      // Prioritize results by retailer tier
      const premiumRetailers = ['asos', 'john lewis', 'zalando', 'next', 'selfridges', 'harrods'];
      const standardRetailers = ['m&s', 'marks & spencer', 'debenhams', 'jd sports', 'sports direct',
                                  'nike', 'adidas', 'very', 'boohoo', 'pretty little thing'];
      const marketplaceRetailers = ['amazon', 'ebay'];

      const getRetailerTier = (source: string): number => {
        const lower = source.toLowerCase();
        if (premiumRetailers.some(r => lower.includes(r))) return 1; // Best
        if (standardRetailers.some(r => lower.includes(r))) return 2; // Good
        if (marketplaceRetailers.some(r => lower.includes(r))) return 3; // Last resort
        return 4; // Unknown retailers last
      };

      productSuggestions.sort((a, b) => {
        // First: Sort by retailer tier (premium > standard > marketplace > unknown)
        const aTier = getRetailerTier(a.source);
        const bTier = getRetailerTier(b.source);
        if (aTier !== bTier) return aTier - bTier;

        // Second: Prioritize items with prices
        if (a.price && !b.price) return -1;
        if (!a.price && b.price) return 1;

        // Third: Higher price first (RRP is usually more accurate than clearance prices)
        if (a.price && b.price) return b.price - a.price;

        return 0; // Keep original order
      });

      // Use RRP from Google Shopping
      let rrp = item.listing.rrp || 0;
      if (!rrp && rrpFromShopping) {
        rrp = rrpFromShopping;
      } else if (!rrp && scrapedData?.extracted_price) {
        rrp = scrapedData.extracted_price;
      }

      // Calculate price
      let calculatedPrice = item.listing.price || 10;
      if (rrp && rrp > 0) {
        const priceCalc = calculatePrice(rrp, item.listing.condition || 'very_good');
        calculatedPrice = priceCalc.suggestedPrice;
      }

      // Generate title: Use reverse search result first, then Vision API fallback
      let generatedTitle = productTitle; // From reverse image search

      if (!generatedTitle) {
        // Fallback to Vision API detection
        if (brand && category) {
          const capitalizedCategory = category.charAt(0).toUpperCase() + category.slice(1);
          generatedTitle = `${brand} ${capitalizedCategory}`;
        } else if (brand) {
          const topLabel = recognition.topLabels[0]?.label;
          const capitalizedLabel = topLabel ? topLabel.charAt(0).toUpperCase() + topLabel.slice(1) : '';
          generatedTitle = `${brand} ${capitalizedLabel}`;
        } else if (category) {
          const capitalizedCategory = category.charAt(0).toUpperCase() + category.slice(1);
          generatedTitle = capitalizedCategory;
        } else {
          const topLabels = recognition.topLabels.slice(0, 2).map(l => l.label.charAt(0).toUpperCase() + l.label.slice(1)).join(' ');
          generatedTitle = topLabels || 'Clothing Item';
        }
      }

      // Auto-detect parcel size based on category
      const parcelSize = detectParcelSize(category);

      // Update listing with product suggestions and detected size (NO description, price, or RRP, or category yet)
      handleUpdateListing(index, {
        title: item.listing.title || generatedTitle.trim(),
        brand: brand || item.listing.brand,
        category: category || item.listing.category,
        // vinted_category_path will be set after product selection for better accuracy
        size: detectedSize || item.listing.size, // Auto-fill size from OCR if detected
        colors: dominantColors.length > 0 ? dominantColors : item.listing.colors, // Auto-fill detected colors (up to 2)
        parcel_size: parcelSize || item.listing.parcel_size, // Auto-detect parcel size
        // Don't set price, RRP, or Vinted category until user selects a product
      });

      // Update item with product suggestions and clear analyzing state
      setItems(prev => prev.map((it, i) =>
        i === index ? {
          ...it,
          isAnalyzing: false,
          productSuggestions: productSuggestions.length > 0 ? productSuggestions : undefined,
          isExpanded: true // Auto-expand to show the suggestions
        } : it
      ));

      setIsProcessing(false);

      alert('Auto-fill complete! ✨\n\n' +
        `Detected: ${brand || 'Unknown'} ${category || 'item'}\n` +
        (detectedSize ? `Size: ${detectedSize}\n` : '') +
        '\nClick a product suggestion to generate description.');
    } catch (error) {
      console.error('Error auto-filling data:', error);

      // Clear analyzing state on error
      setItems(prev => prev.map((it, i) =>
        i === index ? { ...it, isAnalyzing: false } : it
      ));

      setIsProcessing(false);
      alert('Error auto-filling data: ' + (error as Error).message);
    }
  };

  const handleDeleteItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUploadToVinted = () => {
    // Placeholder for Phase 3
    alert('Phase 3: Upload to Vinted coming soon! 🚀');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Listing Assistant</h1>
          <p className="mt-2 text-sm text-gray-600">
            Upload photos, organize items, and prepare for Vinted
          </p>
        </div>

        {/* Upload Screen or Items List */}
        {items.length === 0 ? (
          <UploadScreen
            onUpload={handleUploadPhotos}
            isProcessing={isProcessing}
          />
        ) : (
          <div className="space-y-6">
            {/* Items List */}
            {items.map((item, index) => (
              <ItemCard
                key={item.group.id}
                item={item}
                index={index}
                onToggleExpand={handleToggleExpand}
                onUpdateListing={handleUpdateListing}
                onProductSelect={handleProductSelect}
                onAutoFill={handleAutoFill}
                onDelete={handleDeleteItem}
              />
            ))}

            {/* Add New Item Button */}
            <button
              onClick={handleUploadPhotos}
              className="w-full py-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors"
            >
              ➕ Add New Item (Upload Photos)
            </button>

            {/* Upload to Vinted Button */}
            <div className="flex justify-end">
              <button
                onClick={handleUploadToVinted}
                className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
              >
                🚀 Upload All to Vinted
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
