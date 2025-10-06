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
      const { getMockProductData } = await import('./services/googleShoppingService');
      const { getMockImageRecognition } = await import('./services/imageRecognitionService');

      // Step 1: Analyze first photo to identify brand/category
      // Use mock for now (replace with actual API when you have key)
      // const imageData = await invoke<string>('read_image_as_base64', { filePath: item.group.primaryPhoto });
      // const recognition = await analyzeImage(imageData.split(',')[1], 'YOUR_GOOGLE_VISION_API_KEY');
      const recognition = getMockImageRecognition(item.group.primaryPhoto);

      const brand = item.listing.brand || recognition.brand || '';
      const category = item.listing.category || recognition.category || '';

      console.log('Image recognition result:', recognition);

      // Step 2: Search Google Shopping for product data
      // const scrapedData = await getProductInfoForAI(brand, category, 'YOUR_SERPAPI_KEY');
      const scrapedData = brand && category ? getMockProductData(brand, category) : null;

      // Get RRP from scraped data if not already set
      let rrp = item.listing.rrp || 0;
      if (!rrp && scrapedData?.extracted_price) {
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

      // Update listing
      handleUpdateListing(index, {
        title: item.listing.title || `${brand} ${category}`.trim() || 'Listing',
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
