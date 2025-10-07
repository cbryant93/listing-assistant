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
  link?: string; // Product URL for future scraping
}

interface ItemData {
  group: PhotoGroup;
  listing: Partial<Listing>;
  isExpanded: boolean;
  isAnalyzing?: boolean;
  productSuggestions?: ProductSuggestion[];
  selectedProduct?: ProductSuggestion; // Store selected product for description generation
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
          condition: 'very_good' as const,
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

  const handleProductSelect = (index: number, product: ProductSuggestion) => {
    setItems(items.map((item, i) => {
      if (i === index) {
        return {
          ...item,
          listing: {
            ...item.listing,
            title: product.title,
            rrp: product.price || item.listing.rrp
          },
          selectedProduct: product, // Store for future description generation
          productSuggestions: undefined // Clear suggestions to hide dropdown
        };
      }
      return item;
    }));
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
      const recognition = await analyzeMultipleImages(base64Images, 'AIzaSyBMcOzFdSDZqD2gIHFxihPk_4dgeKS46QU');
      console.log('Multi-image analysis result:', recognition);

      const brand = item.listing.brand || recognition.brand || '';
      const category = item.listing.category || recognition.suggestedCategory || '';
      const productTitle = recognition.suggestedTitle;
      const smartQuery = recognition.smartQuery; // Smart query built from OCR + labels!
      const detectedSize = recognition.detectedSize; // Size extracted from clothing labels

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
        // Query 1: Use the smart query (includes OCR keywords like "taco", "graphic", etc.)
        // e.g., "adidas running shirt taco"
        if (smartQuery) {
          queryVariations.push(smartQuery);
        }

        // Query 2: Brand + best label (simple fallback)
        // e.g., "dickies sweater vest"
        queryVariations.push(`${brand} ${goodLabels[0].label.toLowerCase()}`);

        // Query 3: Brand + second label (alternative view)
        // e.g., "dickies sleeveless shirt"
        if (goodLabels.length >= 2) {
          queryVariations.push(`${brand} ${goodLabels[1].label.toLowerCase()}`);
        }

        // Query 4: Brand + top 2 labels combined (more specific)
        // e.g., "dickies sweater vest sleeveless shirt"
        if (goodLabels.length >= 2) {
          queryVariations.push(`${brand} ${goodLabels[0].label.toLowerCase()} ${goodLabels[1].label.toLowerCase()}`);
        }
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
            'e0100564fc4f869cb5b7aa5411263e372dfae03fa1e7d214b7b6c98f14b606d5'
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
                link: product.link // Store product URL for future scraping
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

      // Generate description with scraped data
      const descriptionResult = generateDescription({
        brand: brand || undefined,
        category: category || undefined,
        size: item.listing.size,
        condition: item.listing.condition || 'very_good',
        colors: item.listing.colors,
        materials: item.listing.materials,
        scrapedData: scrapedData ? {
          title: scrapedData.title,
          description: scrapedData.description,
          price: scrapedData.extracted_price,
          rating: scrapedData.rating,
          reviews: scrapedData.reviews,
        } : undefined,
      });

      // Generate title: Use reverse search result first, then Vision API fallback
      let generatedTitle = productTitle; // From reverse image search

      if (!generatedTitle) {
        // Fallback to Vision API detection
        if (brand && category) {
          const capitalizedCategory = category.charAt(0).toUpperCase() + category.slice(1);
          generatedTitle = `${brand} ${capitalizedCategory}`;
        } else if (brand) {
          const topLabel = recognition.labels[0];
          const capitalizedLabel = topLabel ? topLabel.charAt(0).toUpperCase() + topLabel.slice(1) : '';
          generatedTitle = `${brand} ${capitalizedLabel}`;
        } else if (category) {
          const capitalizedCategory = category.charAt(0).toUpperCase() + category.slice(1);
          generatedTitle = capitalizedCategory;
        } else {
          const topLabels = recognition.labels.slice(0, 2).map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(' ');
          generatedTitle = topLabels || 'Clothing Item';
        }
      }

      // Update listing with product suggestions and detected size
      handleUpdateListing(index, {
        title: item.listing.title || generatedTitle.trim(),
        brand: brand || item.listing.brand,
        category: category || item.listing.category,
        size: detectedSize || item.listing.size, // Auto-fill size from OCR if detected
        description: descriptionResult.fullText,
        price: calculatedPrice,
        rrp: rrp > 0 ? rrp : undefined,
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
        (scrapedData ? 'Used Google Shopping data for description.' : ''));
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
