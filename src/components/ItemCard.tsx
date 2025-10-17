import { useState } from 'react';
import { Listing } from '../types/listing';
import { PhotoGroup } from '../services/photoGroupingService';
import PhotoThumbnail from './PhotoThumbnail';
import CategorySelectorModal from './CategorySelectorModal';

interface ProductSuggestion {
  title: string;
  price?: number;
  source: string;
  thumbnail?: string;
  link?: string;
}

interface CategorySuggestion {
  path: string[];
  confidence: number;
  category: string;
  pathString: string;
}

interface ItemData {
  group: PhotoGroup;
  listing: Partial<Listing>;
  isExpanded: boolean;
  isAnalyzing?: boolean;
  productSuggestions?: ProductSuggestion[];
  selectedProduct?: ProductSuggestion;
  scrapedData?: any; // Store scraped data for description regeneration
  categorySuggestions?: CategorySuggestion[];
}

interface ItemCardProps {
  item: ItemData;
  index: number;
  onToggleExpand: (index: number) => void;
  onUpdateListing: (index: number, updates: Partial<Listing>) => void;
  onProductSelect: (index: number, product: ProductSuggestion) => void;
  onAutoFill: (index: number) => void;
  onDelete: (index: number) => void;
}

export default function ItemCard({
  item,
  index,
  onToggleExpand,
  onUpdateListing,
  onProductSelect,
  onAutoFill,
  onDelete,
}: ItemCardProps) {
  const { group, listing, isExpanded } = item;
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  return (
    <>
      <CategorySelectorModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSelect={(categoryPath) => {
          onUpdateListing(index, { vinted_category_path: categoryPath });
        }}
        currentValue={listing.vinted_category_path}
      />

    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Card Header */}
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {listing.title || `Item ${index + 1}`}
            </h3>
            <p className="text-sm text-gray-500">{group.photos.length} photos</p>
          </div>
          <button
            onClick={() => onDelete(index)}
            className="text-red-600 hover:text-red-700"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* Photo Grid */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {group.photos.map((photo, photoIndex) => (
            <PhotoThumbnail
              key={photoIndex}
              photoPath={photo}
              alt={`Photo ${photoIndex + 1}`}
            />
          ))}
        </div>

        {/* Analyzing Status */}
        {item.isAnalyzing && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
            <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm text-blue-700 font-medium">
              Analyzing photos with AI... Please wait.
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => onAutoFill(index)}
            disabled={item.isAnalyzing}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            ✨ Auto-Fill
          </button>
          <button
            onClick={() => onToggleExpand(index)}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors text-sm font-medium"
          >
            {isExpanded ? '▲ Collapse' : '✏️ Edit Details'}
          </button>
          <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors text-sm font-medium">
            🖼️ Edit Photos
          </button>
        </div>
      </div>

      {/* Expanded Details Form */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={listing.title || ''}
                onChange={(e) => onUpdateListing(index, { title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Nike Running Trainers"
              />

              {/* Product Suggestions */}
              {item.productSuggestions && item.productSuggestions.length > 0 && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    💡 Found {item.productSuggestions.length} similar products - click to use:
                  </label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {item.productSuggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => onProductSelect(index, suggestion)}
                        className="w-full text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
                      >
                        <div className="flex gap-3 items-start">
                          {/* Product Thumbnail */}
                          {suggestion.thumbnail && (
                            <div className="flex-shrink-0">
                              <img
                                src={suggestion.thumbnail}
                                alt={suggestion.title}
                                className="w-20 h-20 object-cover rounded border border-gray-200"
                                onError={(e) => {
                                  // Hide image if it fails to load
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                          )}

                          {/* Product Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <span className="text-sm text-gray-900 flex-1">{suggestion.title}</span>
                              {suggestion.price && (
                                <span className="text-sm font-semibold text-green-600 whitespace-nowrap">
                                  £{suggestion.price}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 block">{suggestion.source}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Brand */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brand
              </label>
              <input
                type="text"
                value={listing.brand || ''}
                onChange={(e) => onUpdateListing(index, { brand: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Nike"
              />
            </div>

            {/* Vinted Category (Dropdown with suggestions) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vinted Category
              </label>
              {item.categorySuggestions && item.categorySuggestions.length > 0 ? (
                <div className="space-y-2">
                  <select
                    value={listing.vinted_category_path || ''}
                    onChange={(e) => onUpdateListing(index, { vinted_category_path: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a category...</option>
                    {/* Show current selection if it's not in suggestions */}
                    {listing.vinted_category_path &&
                     !item.categorySuggestions.some(s => s.pathString === listing.vinted_category_path) && (
                      <option value={listing.vinted_category_path}>
                        {listing.vinted_category_path} (Selected)
                      </option>
                    )}
                    {item.categorySuggestions.map((suggestion, i) => (
                      <option key={i} value={suggestion.pathString}>
                        {suggestion.pathString} ({(suggestion.confidence * 100).toFixed(0)}% match)
                      </option>
                    ))}
                  </select>
                  {listing.vinted_category_path && (
                    <p className="text-xs text-green-600">
                      ✨ Category selected - change it if needed
                    </p>
                  )}
                  <button
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="text-sm text-teal-600 hover:text-teal-700 underline"
                  >
                    Browse all categories
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={listing.vinted_category_path || ''}
                    onChange={(e) => onUpdateListing(index, { vinted_category_path: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Click browse to select category..."
                    readOnly
                  />
                  <button
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="text-sm text-teal-600 hover:text-teal-700 underline"
                  >
                    Browse all categories
                  </button>
                </div>
              )}
            </div>

            {/* Size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Size
              </label>
              <input
                type="text"
                value={listing.size || ''}
                onChange={(e) => onUpdateListing(index, { size: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., M, UK 10"
              />
              <p className="mt-1 text-xs text-gray-500">
                📸 Tip: Take a close-up photo of the size label for better auto-detection
              </p>
            </div>

            {/* Condition */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Condition
              </label>
              <select
                value={listing.condition || ''}
                onChange={async (e) => {
                  const newCondition = e.target.value as any;

                  // Regenerate description if we have scraped data
                  if (item.scrapedData && newCondition) {
                    const { generateDescription } = await import('../services/aiDescriptionService');

                    // Regenerate with the new condition
                    const descriptionInput = {
                      brand: listing.brand,
                      category: listing.category,
                      size: listing.size,
                      condition: newCondition,
                      rrp: listing.rrp,
                      colors: listing.colors,
                      materials: listing.materials,
                      scrapedData: item.scrapedData, // Use stored scraped data
                    };

                    const descriptionResult = generateDescription(descriptionInput);
                    // Update both condition and description together
                    onUpdateListing(index, {
                      condition: newCondition,
                      description: descriptionResult.fullText
                    });
                  } else {
                    // No scraped data, just update condition
                    onUpdateListing(index, { condition: newCondition });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select condition...</option>
                <option value="new_with_tags">New with tags</option>
                <option value="new_without_tags">New without tags</option>
                <option value="very_good">Very good</option>
                <option value="good">Good</option>
                <option value="satisfactory">Satisfactory</option>
              </select>
            </div>

            {/* Colors (up to 2) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Colors (up to 2)
              </label>
              <div className="space-y-2">
                {/* Primary Color */}
                <select
                  value={listing.colors?.[0] || ''}
                  onChange={(e) => {
                    const newColors = [...(listing.colors || [])];
                    if (e.target.value) {
                      newColors[0] = e.target.value;
                    } else {
                      newColors.splice(0, 1);
                    }
                    onUpdateListing(index, { colors: newColors.filter(Boolean) });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Primary color...</option>
                  <option value="black">Black</option>
                  <option value="brown">Brown</option>
                  <option value="grey">Grey</option>
                  <option value="beige">Beige</option>
                  <option value="pink">Pink</option>
                  <option value="purple">Purple</option>
                  <option value="red">Red</option>
                  <option value="yellow">Yellow</option>
                  <option value="blue">Blue</option>
                  <option value="green">Green</option>
                  <option value="orange">Orange</option>
                  <option value="white">White</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                  <option value="multi">Multi</option>
                  <option value="khaki">Khaki</option>
                  <option value="turquoise">Turquoise</option>
                  <option value="cream">Cream</option>
                  <option value="apricot">Apricot</option>
                  <option value="coral">Coral</option>
                  <option value="burgundy">Burgundy</option>
                  <option value="rose">Rose</option>
                  <option value="lilac">Lilac</option>
                  <option value="light blue">Light blue</option>
                  <option value="navy">Navy</option>
                  <option value="dark green">Dark green</option>
                  <option value="mustard">Mustard</option>
                  <option value="mint">Mint</option>
                  <option value="clear">Clear</option>
                </select>

                {/* Secondary Color (optional) */}
                {listing.colors?.[0] && (
                  <select
                    value={listing.colors?.[1] || ''}
                    onChange={(e) => {
                      const newColors = [...(listing.colors || [])];
                      if (e.target.value) {
                        newColors[1] = e.target.value;
                      } else {
                        newColors.splice(1, 1);
                      }
                      onUpdateListing(index, { colors: newColors.filter(Boolean) });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Secondary color (optional)...</option>
                    <option value="black">Black</option>
                    <option value="brown">Brown</option>
                    <option value="grey">Grey</option>
                    <option value="beige">Beige</option>
                    <option value="pink">Pink</option>
                    <option value="purple">Purple</option>
                    <option value="red">Red</option>
                    <option value="yellow">Yellow</option>
                    <option value="blue">Blue</option>
                    <option value="green">Green</option>
                    <option value="orange">Orange</option>
                    <option value="white">White</option>
                    <option value="silver">Silver</option>
                    <option value="gold">Gold</option>
                    <option value="multi">Multi</option>
                    <option value="khaki">Khaki</option>
                    <option value="turquoise">Turquoise</option>
                    <option value="cream">Cream</option>
                    <option value="apricot">Apricot</option>
                    <option value="coral">Coral</option>
                    <option value="burgundy">Burgundy</option>
                    <option value="rose">Rose</option>
                    <option value="lilac">Lilac</option>
                    <option value="light blue">Light blue</option>
                    <option value="navy">Navy</option>
                    <option value="dark green">Dark green</option>
                    <option value="mustard">Mustard</option>
                    <option value="mint">Mint</option>
                    <option value="clear">Clear</option>
                  </select>
                )}
              </div>
            </div>

            {/* Materials (up to 3) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Materials (up to 3)
              </label>
              <div className="space-y-2">
                {/* Material 1 */}
                <select
                  value={listing.materials?.[0] || ''}
                  onChange={(e) => {
                    const newMaterials = [...(listing.materials || [])];
                    if (e.target.value) {
                      newMaterials[0] = e.target.value;
                    } else {
                      newMaterials.splice(0, 1);
                    }
                    onUpdateListing(index, { materials: newMaterials.filter(Boolean) });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Primary material...</option>
                  <option value="cotton">Cotton</option>
                  <option value="polyester">Polyester</option>
                  <option value="wool">Wool</option>
                  <option value="leather">Leather</option>
                  <option value="denim">Denim</option>
                  <option value="silk">Silk</option>
                  <option value="linen">Linen</option>
                  <option value="nylon">Nylon</option>
                  <option value="elastane">Elastane/Spandex</option>
                  <option value="viscose">Viscose</option>
                  <option value="acrylic">Acrylic</option>
                  <option value="cashmere">Cashmere</option>
                  <option value="synthetic">Synthetic</option>
                  <option value="mixed">Mixed materials</option>
                </select>

                {/* Material 2 (optional) */}
                {listing.materials?.[0] && (
                  <select
                    value={listing.materials?.[1] || ''}
                    onChange={(e) => {
                      const newMaterials = [...(listing.materials || [])];
                      if (e.target.value) {
                        newMaterials[1] = e.target.value;
                      } else {
                        newMaterials.splice(1, 1);
                      }
                      onUpdateListing(index, { materials: newMaterials.filter(Boolean) });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Secondary material (optional)...</option>
                    <option value="cotton">Cotton</option>
                    <option value="polyester">Polyester</option>
                    <option value="wool">Wool</option>
                    <option value="leather">Leather</option>
                    <option value="denim">Denim</option>
                    <option value="silk">Silk</option>
                    <option value="linen">Linen</option>
                    <option value="nylon">Nylon</option>
                    <option value="elastane">Elastane/Spandex</option>
                    <option value="viscose">Viscose</option>
                    <option value="acrylic">Acrylic</option>
                    <option value="cashmere">Cashmere</option>
                    <option value="synthetic">Synthetic</option>
                    <option value="mixed">Mixed materials</option>
                  </select>
                )}

                {/* Material 3 (optional) */}
                {listing.materials?.[1] && (
                  <select
                    value={listing.materials?.[2] || ''}
                    onChange={(e) => {
                      const newMaterials = [...(listing.materials || [])];
                      if (e.target.value) {
                        newMaterials[2] = e.target.value;
                      } else {
                        newMaterials.splice(2, 1);
                      }
                      onUpdateListing(index, { materials: newMaterials.filter(Boolean) });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Third material (optional)...</option>
                    <option value="cotton">Cotton</option>
                    <option value="polyester">Polyester</option>
                    <option value="wool">Wool</option>
                    <option value="leather">Leather</option>
                    <option value="denim">Denim</option>
                    <option value="silk">Silk</option>
                    <option value="linen">Linen</option>
                    <option value="nylon">Nylon</option>
                    <option value="elastane">Elastane/Spandex</option>
                    <option value="viscose">Viscose</option>
                    <option value="acrylic">Acrylic</option>
                    <option value="cashmere">Cashmere</option>
                    <option value="synthetic">Synthetic</option>
                    <option value="mixed">Mixed materials</option>
                  </select>
                )}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <input
                type="text"
                value={listing.category || ''}
                onChange={(e) => onUpdateListing(index, { category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Trainers"
              />
            </div>

            {/* RRP */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                RRP (£)
              </label>
              <input
                type="number"
                value={listing.rrp || ''}
                onChange={(e) => onUpdateListing(index, { rrp: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
                step="0.01"
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price (£)
              </label>
              <input
                type="number"
                value={listing.price || ''}
                onChange={(e) => onUpdateListing(index, { price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
                step="0.01"
              />
            </div>

            {/* Parcel Size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Parcel Size
              </label>
              <select
                value={listing.parcel_size || ''}
                onChange={(e) => onUpdateListing(index, { parcel_size: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select size...</option>
                <option value="small">Small (e.g., accessories, t-shirts)</option>
                <option value="medium">Medium (e.g., shirts, trousers)</option>
                <option value="large">Large (e.g., shoes, jackets, coats)</option>
                <option value="extra_large">Extra Large (e.g., winter coats, boots)</option>
              </select>
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={listing.description || ''}
                onChange={(e) => onUpdateListing(index, { description: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Description with hashtags..."
              />
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
