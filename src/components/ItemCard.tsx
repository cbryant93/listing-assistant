import { Listing } from '../types/listing';
import { PhotoGroup } from '../services/photoGroupingService';
import PhotoThumbnail from './PhotoThumbnail';

interface ProductSuggestion {
  title: string;
  price?: number;
  source: string;
  thumbnail?: string;
  link?: string;
}

interface ItemData {
  group: PhotoGroup;
  listing: Partial<Listing>;
  isExpanded: boolean;
  isAnalyzing?: boolean;
  productSuggestions?: ProductSuggestion[];
  selectedProduct?: ProductSuggestion;
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

  return (
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
                value={listing.condition || 'very_good'}
                onChange={(e) => onUpdateListing(index, { condition: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="new_with_tags">New with tags</option>
                <option value="new_without_tags">New without tags</option>
                <option value="very_good">Very good</option>
                <option value="good">Good</option>
                <option value="satisfactory">Satisfactory</option>
              </select>
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
  );
}
