import { useState } from 'react';
import { open } from '@tauri-apps/api/dialog';
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

      // Open file picker for multiple photos
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'Images',
          extensions: ['jpg', 'jpeg', 'png', 'gif']
        }]
      });

      if (!selected || (Array.isArray(selected) && selected.length === 0)) {
        setIsProcessing(false);
        return;
      }

      const photoPaths = Array.isArray(selected) ? selected : [selected];

      // Import photo grouping service
      const { groupPhotosByItem } = await import('./services/photoGroupingService');

      // Group photos by item
      const groups = await groupPhotosByItem(photoPaths, 0.75);

      // Create item data for each group
      const newItems: ItemData[] = groups.map(group => ({
        group,
        listing: {
          title: '',
          description: '',
          condition: 'very_good',
          colors: [],
          materials: [],
          rrp: 0,
          price: 0,
        },
        isExpanded: false,
      }));

      setItems(newItems);
      setIsProcessing(false);
    } catch (error) {
      console.error('Error uploading photos:', error);
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
      // Import services
      const { analyzeClothingLabel } = await import('./services/ocrService');
      const { generateDescription } = await import('./services/aiDescriptionService');
      const { calculatePrice } = await import('./services/pricingService');

      // Run OCR on first photo (assumes it has a label)
      const ocrResult = await analyzeClothingLabel(item.group.primaryPhoto);

      // Generate description
      const descriptionResult = generateDescription({
        brand: ocrResult.brand || undefined,
        condition: item.listing.condition || 'very_good',
        colors: item.listing.colors,
        materials: ocrResult.materials,
      });

      // Calculate price if we have RRP
      let calculatedPrice = item.listing.price || 0;
      if (item.listing.rrp) {
        calculatedPrice = calculatePrice(item.listing.rrp, item.listing.condition || 'very_good');
      }

      // Update listing with auto-filled data
      handleUpdateListing(index, {
        brand: ocrResult.brand || item.listing.brand,
        size: ocrResult.size || item.listing.size,
        materials: ocrResult.materials && ocrResult.materials.length > 0
          ? ocrResult.materials
          : item.listing.materials,
        description: descriptionResult.fullText,
        price: calculatedPrice,
      });
    } catch (error) {
      console.error('Error auto-filling data:', error);
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
              ➕ Add More Photos
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
