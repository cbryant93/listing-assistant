/**
 * Category Mapping Service
 * Maps Vision API labels to Vinted category hierarchy
 */

import vintedCategories from '../../Vinted_categories.json';

interface CategoryNode {
  name: string;
  children: CategoryNode[];
}

interface CategoryMatch {
  path: string[]; // Full path: ["Women", "Clothing", "Tops & t-shirts", "T-shirts"]
  confidence: number; // 0-1 score
  category: string; // Final category name
}

/**
 * Find best matching Vinted category for Vision API labels
 * @param labels Vision API labels (e.g., ["T-shirt", "Sleeve", "Black"])
 * @param gender Optional gender hint ("men" or "women")
 * @param productContext Optional product context (title, scraped category, etc.)
 * @returns Best matching category path
 */
export function findBestCategory(
  labels: string[],
  gender?: string,
  productContext?: {
    productTitle?: string;
    scrapedCategory?: string;
  }
): CategoryMatch | null {
  const matches = findTopCategoryMatches(labels, gender, productContext, 1);
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Find top N matching Vinted categories for Vision API labels
 * @param labels Vision API labels (e.g., ["T-shirt", "Sleeve", "Black"])
 * @param gender Optional gender hint ("men" or "women")
 * @param productContext Optional product context (title, scraped category, etc.)
 * @param topN Number of top matches to return (default: 5)
 * @returns Array of top matching categories sorted by confidence
 */
export function findTopCategoryMatches(
  labels: string[],
  gender?: string,
  productContext?: {
    productTitle?: string;
    scrapedCategory?: string;
  },
  topN: number = 5
): CategoryMatch[] {
  const labelWords = labels.map(l => l.toLowerCase());

  // Add product context to labels for better matching
  if (productContext?.productTitle) {
    const titleWords = productContext.productTitle.toLowerCase().split(/[\s-]+/);
    labelWords.push(...titleWords);
  }
  if (productContext?.scrapedCategory) {
    labelWords.push(productContext.scrapedCategory.toLowerCase());
  }

  console.log('Finding category for labels:', labelWords);

  // Start from root
  const root = vintedCategories as CategoryNode;
  const allMatches: CategoryMatch[] = [];

  // Search through all paths
  const searchNode = (node: CategoryNode, currentPath: string[], depth: number) => {
    const nodeName = node.name.toLowerCase();

    // Calculate match score for this node
    let score = 0;

    // Check if any label matches this category name
    for (const label of labelWords) {
      // Exact match
      if (nodeName === label) {
        score += 10;
      }
      // Partial match (label contains category or vice versa)
      else if (nodeName.includes(label) || label.includes(nodeName)) {
        score += 5;
      }
      // Word-by-word match (e.g., "t-shirt" matches "t-shirts")
      else {
        const nodeWords = nodeName.split(/[\s&-]+/);
        const labelTokens = label.split(/[\s&-]+/);

        for (const nw of nodeWords) {
          for (const lt of labelTokens) {
            if (nw === lt && nw.length > 2) {
              score += 3;
            }
          }
        }
      }
    }

    // Gender match bonus
    if (gender && nodeName === gender.toLowerCase()) {
      score += 20;
    }

    // Prioritize deeper matches (more specific)
    score += depth * 0.5;

    // Only consider leaf nodes or specific categories
    const isLeaf = node.children.length === 0;
    const isSpecificCategory = depth >= 3; // At least 3 levels deep

    if ((isLeaf || isSpecificCategory) && score > 0) {
      allMatches.push({
        path: [...currentPath, node.name],
        confidence: Math.min(score / 20, 1), // Normalize to 0-1
        category: node.name,
      });
    }

    // Recurse into children
    for (const child of node.children) {
      searchNode(child, [...currentPath, node.name], depth + 1);
    }
  };

  // Start search from root's children (skip "Category" root)
  for (const child of root.children) {
    searchNode(child, [], 0);
  }

  // Sort by confidence (highest first) and return top N
  const topMatches = allMatches
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, topN);

  console.log(`Top ${topN} category matches:`, topMatches);

  return topMatches;
}

/**
 * Get category path as string (e.g., "Women > Clothing > Tops & t-shirts > T-shirts")
 */
export function getCategoryPathString(match: CategoryMatch): string {
  return match.path.join(' > ');
}

/**
 * Map common Vision API labels to Vinted categories
 * This helps with common cases before doing the full search
 */
const QUICK_MAPPINGS: Record<string, string[]> = {
  // Tops
  't-shirt': ['Clothing', 'Tops & t-shirts', 'T-shirts'],
  'tshirt': ['Clothing', 'Tops & t-shirts', 'T-shirts'],
  'shirt': ['Clothing', 'Tops & t-shirts', 'Shirts'],
  'blouse': ['Clothing', 'Tops & t-shirts', 'Blouses'],
  'vest': ['Clothing', 'Tops & t-shirts', 'Vest tops'],
  'tank top': ['Clothing', 'Tops & t-shirts', 'Vest tops'],

  // Jumpers
  'sweater': ['Clothing', 'Jumpers & sweaters', 'Jumpers'],
  'jumper': ['Clothing', 'Jumpers & sweaters', 'Jumpers'],
  'hoodie': ['Clothing', 'Jumpers & sweaters', 'Hoodies & sweatshirts'],
  'sweatshirt': ['Clothing', 'Jumpers & sweaters', 'Hoodies & sweatshirts'],
  'cardigan': ['Clothing', 'Jumpers & sweaters', 'Cardigans'],
  'waistcoat': ['Clothing', 'Jumpers & sweaters', 'Waistcoats'],
  'sleeveless jumper': ['Clothing', 'Jumpers & sweaters', 'Sleeveless jumpers'],
  'sleeveless sweater': ['Clothing', 'Jumpers & sweaters', 'Sleeveless jumpers'],
  'sweater vest': ['Clothing', 'Jumpers & sweaters', 'Sleeveless jumpers'],

  // Outerwear
  'jacket': ['Clothing', 'Outerwear', 'Jackets'],
  'coat': ['Clothing', 'Outerwear', 'Coats'],
  'parka': ['Clothing', 'Outerwear', 'Coats', 'Parkas'],
  'bomber jacket': ['Clothing', 'Outerwear', 'Jackets', 'Bomber jackets'],
  'denim jacket': ['Clothing', 'Outerwear', 'Jackets', 'Denim jackets'],

  // Bottoms
  'jeans': ['Clothing', 'Jeans'],
  'trousers': ['Clothing', 'Trousers & leggings'],
  'shorts': ['Clothing', 'Shorts & cropped trousers'],
  'leggings': ['Clothing', 'Trousers & leggings', 'Leggings'],

  // Dresses & skirts
  'dress': ['Clothing', 'Dresses'],
  'skirt': ['Clothing', 'Skirts'],

  // Shoes
  'trainers': ['Shoes', 'Trainers'],
  'sneakers': ['Shoes', 'Trainers'],
  'boots': ['Shoes', 'Boots'],
  'heels': ['Shoes', 'Heels'],
  'sandals': ['Shoes', 'Sandals'],
};

/**
 * Try to find quick category mapping
 */
export function findQuickCategory(labels: string[], gender?: string): CategoryMatch | null {
  const labelWords = labels.map(l => l.toLowerCase());

  for (const label of labelWords) {
    if (QUICK_MAPPINGS[label]) {
      const path = [gender || 'Women', ...QUICK_MAPPINGS[label]];
      return {
        path,
        confidence: 0.9,
        category: path[path.length - 1],
      };
    }
  }

  return null;
}

/**
 * Get all Vinted categories as flat list for dropdown
 * Returns array of {value: "path", label: "display text"}
 */
export function getAllCategories(): Array<{ value: string; label: string }> {
  const categories: Array<{ value: string; label: string }> = [];
  const root = vintedCategories as CategoryNode;

  const traverse = (node: CategoryNode, path: string[]) => {
    const currentPath = [...path, node.name];

    // Only add categories that are at least 3 levels deep (Gender > Type > Subcategory)
    if (currentPath.length >= 3 && currentPath[0] !== 'Category') {
      const pathString = currentPath.join(' > ');
      categories.push({
        value: pathString,
        label: pathString,
      });
    }

    // Recurse into children
    for (const child of node.children) {
      traverse(child, currentPath);
    }
  };

  // Start from root's children (skip "Category" root)
  for (const child of root.children) {
    traverse(child, []);
  }

  return categories;
}
