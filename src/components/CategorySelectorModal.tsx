import { useState } from 'react';
import vintedCategories from '../../Vinted_categories.json';

interface CategoryNode {
  name: string;
  children: CategoryNode[];
}

interface CategorySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (categoryPath: string) => void;
  currentValue?: string;
}

export default function CategorySelectorModal({
  isOpen,
  onClose,
  onSelect,
  currentValue,
}: CategorySelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [navigationStack, setNavigationStack] = useState<CategoryNode[]>([vintedCategories as CategoryNode]);
  const [selectedPath, setSelectedPath] = useState<string[]>(
    currentValue ? currentValue.split(' > ') : []
  );

  if (!isOpen) return null;

  const currentLevel = navigationStack[navigationStack.length - 1];
  const currentCategories = currentLevel.children;

  // Global search across all categories
  const searchAllCategories = (query: string): Array<{ category: CategoryNode; path: string[] }> => {
    const results: Array<{ category: CategoryNode; path: string[] }> = [];
    const search = (node: CategoryNode, currentPath: string[]) => {
      if (node.name.toLowerCase().includes(query.toLowerCase()) && currentPath.length > 0) {
        results.push({ category: node, path: [...currentPath, node.name] });
      }
      node.children.forEach(child => search(child, [...currentPath, node.name]));
    };
    (vintedCategories as CategoryNode).children.forEach(child =>
      search(child, [])
    );
    return results.slice(0, 50); // Limit to 50 results for performance
  };

  // Filter categories based on search
  const searchResults = searchQuery ? searchAllCategories(searchQuery) : null;
  const filteredCategories = searchQuery
    ? searchResults?.map(r => r.category) || []
    : currentCategories;

  const handleCategoryClick = (category: CategoryNode, searchResultPath?: string[]) => {
    // If this is a search result, use the full path from search
    if (searchResultPath) {
      const cleanPath = searchResultPath.filter(p => p !== 'Category');
      setSelectedPath(cleanPath);
      // Don't navigate deeper for search results - just select the category
      return;
    }

    // Normal navigation: build path based on current navigation depth
    const currentDepth = navigationStack.length - 1; // -1 because root doesn't count
    const newPath = selectedPath.slice(0, currentDepth);
    newPath.push(category.name);
    setSelectedPath(newPath);

    // If has children, navigate deeper
    if (category.children.length > 0) {
      setNavigationStack([...navigationStack, category]);
    }
  };

  const handleBack = () => {
    if (navigationStack.length > 1) {
      setNavigationStack(navigationStack.slice(0, -1));
      setSelectedPath(selectedPath.slice(0, -1));
    }
  };

  const handleSave = () => {
    if (selectedPath.length > 0) {
      // Remove "Category" from path if present
      const cleanPath = selectedPath.filter(p => p !== 'Category');
      onSelect(cleanPath.join(' > '));
      onClose();
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    // Reset to root navigation when clearing search
    setNavigationStack([vintedCategories as CategoryNode]);
    setSelectedPath([]);
  };

  const getCategoryIcon = (name: string) => {
    const iconMap: Record<string, string> = {
      Women: '👗',
      Men: '👔',
      Kids: '👶',
      Home: '🏠',
      Electronics: '💻',
      Entertainment: '📚',
    };
    return iconMap[name] || '📁';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg w-full max-w-md h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Category</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find a category"
              className="w-full px-4 py-3 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Navigation Breadcrumb or Back to Browse */}
        {searchQuery ? (
          <div className="px-4 pb-2">
            <button
              onClick={handleClearSearch}
              className="text-teal-600 hover:text-teal-700 text-sm flex items-center gap-1"
            >
              ← Back to browse
            </button>
          </div>
        ) : selectedPath.length > 0 ? (
          <div className="px-4 pb-2">
            <button
              onClick={handleBack}
              className="text-teal-600 hover:text-teal-700 text-sm flex items-center gap-1"
            >
              ← {selectedPath.join(' > ')}
            </button>
          </div>
        ) : null}

        {/* Category List */}
        <div className="flex-1 overflow-y-auto">
          {searchQuery && searchResults ? (
            // Search results with full paths
            searchResults.map((result, index) => {
              const resultPathString = result.path.filter(p => p !== 'Category').join(' > ');
              const currentPathString = selectedPath.join(' > ');
              const isSelected = resultPathString === currentPathString;

              return (
                <button
                  key={index}
                  onClick={() => handleCategoryClick(result.category, result.path)}
                  className={`w-full flex flex-col items-start px-4 py-3 hover:bg-gray-50 border-b border-gray-100 text-left ${
                    isSelected ? 'bg-teal-50 border-teal-200' : ''
                  }`}
                >
                  <span className={`text-base font-medium ${isSelected ? 'text-teal-700' : 'text-gray-900'}`}>
                    {result.category.name}
                  </span>
                  <span className={`text-xs mt-1 ${isSelected ? 'text-teal-600' : 'text-gray-500'}`}>
                    {resultPathString}
                  </span>
                </button>
              );
            })
          ) : (
            // Normal navigation
            filteredCategories.map((category, index) => (
              <button
                key={index}
                onClick={() => handleCategoryClick(category)}
                className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 border-b border-gray-100 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl text-teal-600">
                    {getCategoryIcon(category.name)}
                  </span>
                  <span className="text-base font-medium text-gray-900">
                    {category.name}
                  </span>
                </div>
                {category.children.length > 0 && (
                  <span className="text-gray-400">›</span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Save Button */}
        <div className="p-4 border-t">
          <button
            onClick={handleSave}
            disabled={selectedPath.length === 0}
            className="w-full py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
