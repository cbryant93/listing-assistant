import { useState } from 'react';
import { open } from '@tauri-apps/api/dialog';
import { invoke } from '@tauri-apps/api/tauri';
import { PhotoGroup } from './services/photoGroupingService';
import { Listing } from './types/listing';
import UploadScreen from './components/UploadScreen';
import ItemCard from './components/ItemCard';

interface ItemData {
  group: PhotoGroup;
  listing: Partial<Listing>;
  isExpanded: boolean;
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

  const handleAutoFill = async (index: number) => {
    const item = items[index];

    try {
      setIsProcessing(true);

      const { calculatePrice } = await import('./services/pricingService');
      const { generateDescription } = await import('./services/aiDescriptionService');
      const { getRRP, getProductInfoForAI } = await import('./services/googleShoppingService');
      const { analyzeImage } = await import('./services/imageRecognitionService');

      // Load image as base64
      const imageData = await invoke<string>('read_image_as_base64', { filePath: item.group.primaryPhoto });
      const base64Image = imageData.split(',')[1]; // Remove data:image/jpeg;base64, prefix

      console.log('Starting auto-fill with image:', item.group.primaryPhoto);

      // Step 1: Analyze photo with Vision API for brand/category/labels
      console.log('Step 1: Calling Google Vision API...');
      const recognition = await analyzeImage(base64Image, 'AIzaSyBMcOzFdSDZqD2gIHFxihPk_4dgeKS46QU');
      console.log('Vision API result:', recognition);

      const brand = item.listing.brand || recognition.brand || '';
      const category = item.listing.category || recognition.category || '';

      // Build title from Vision API detection
      let productTitle = '';
      if (brand && category) {
        productTitle = `${brand} ${category.charAt(0).toUpperCase() + category.slice(1)}`;
      } else if (brand && recognition.labels.length > 0) {
        const topLabel = recognition.labels[0];
        productTitle = `${brand} ${topLabel.charAt(0).toUpperCase() + topLabel.slice(1)}`;
      } else if (recognition.labels.length > 0) {
        productTitle = recognition.labels.slice(0, 2).map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(' ');
      }

      // Step 2: Get RRP from Google Shopping (median price)
      console.log('Step 2: Getting RRP from Google Shopping...');
      let rrpFromShopping = null;
      if (brand && category) {
        try {
          rrpFromShopping = await getRRP(brand, category, 'e0100564fc4f869cb5b7aa5411263e372dfae03fa1e7d214b7b6c98f14b606d5');
          console.log('RRP from shopping:', rrpFromShopping);
        } catch (error) {
          console.error('Error getting RRP:', error);
        }
      }

      // Step 3: Get product info for description
      console.log('Step 3: Getting product details for description...');
      let scrapedData = null;
      if (brand && category) {
        try {
          scrapedData = await getProductInfoForAI(brand, category, 'e0100564fc4f869cb5b7aa5411263e372dfae03fa1e7d214b7b6c98f14b606d5');
          console.log('Product info:', scrapedData);
        } catch (error) {
          console.error('Error getting product info:', error);
        }
      }

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

      // Update listing
      handleUpdateListing(index, {
        title: item.listing.title || generatedTitle.trim(),
        brand: brand || item.listing.brand,
        category: category || item.listing.category,
        description: descriptionResult.fullText,
        price: calculatedPrice,
        rrp: rrp > 0 ? rrp : undefined,
      });

      setIsProcessing(false);

      alert('Auto-fill complete! ✨\n\n' +
        `Detected: ${brand || 'Unknown'} ${category || 'item'}\n` +
        (scrapedData ? 'Used Google Shopping data for description.' : ''));
    } catch (error) {
      console.error('Error auto-filling data:', error);
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
