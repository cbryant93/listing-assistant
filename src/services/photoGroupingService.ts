/**
 * Photo Grouping Service
 * Groups uploaded photos into separate items using image similarity
 *
 * Approach:
 * 1. Extract perceptual hash from each photo (using Sharp)
 * 2. Calculate similarity between photos (Hamming distance)
 * 3. Cluster similar photos together (same item)
 * 4. Return grouped photo sets
 *
 * This enables the UI flow:
 * - User uploads all photos in bulk
 * - App automatically groups them by item
 * - User reviews grouped items and confirms/adjusts
 */

import sharp from 'sharp';

export interface PhotoGroup {
  id: string; // Unique group identifier
  photos: string[]; // Photo file paths in this group
  primaryPhoto: string; // Main photo for the item (first photo)
  confidence: number; // Confidence score (0-1) for grouping accuracy
}

export interface PhotoHash {
  path: string;
  hash: string; // Perceptual hash
}

/**
 * Generate perceptual hash for an image
 * Uses difference hash (dHash) algorithm:
 * 1. Resize to 9x8 grayscale
 * 2. Compare adjacent pixels
 * 3. Generate 64-bit hash
 */
export async function generatePhotoHash(imagePath: string): Promise<string> {
  const image = sharp(imagePath);

  // Resize to 9x8 and convert to grayscale
  const { data } = await image
    .resize(9, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Calculate difference hash
  const hash: string[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = data[row * 9 + col];
      const right = data[row * 9 + col + 1];
      hash.push(left > right ? '1' : '0');
    }
  }

  return hash.join('');
}

/**
 * Calculate Hamming distance between two binary hashes
 * Returns number of differing bits (0 = identical, 64 = completely different)
 */
export function calculateHammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error('Hashes must be the same length');
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }

  return distance;
}

/**
 * Calculate similarity between two photos (0-1 scale)
 * 1 = identical, 0 = completely different
 */
export function calculateSimilarity(hash1: string, hash2: string): number {
  const distance = calculateHammingDistance(hash1, hash2);
  const maxDistance = hash1.length; // 64 for dHash
  return 1 - (distance / maxDistance);
}

/**
 * Group photos by similarity
 * Photos with similarity > threshold are grouped together
 *
 * @param photoPaths Array of photo file paths
 * @param similarityThreshold Minimum similarity to group (0-1, default 0.75)
 * @returns Array of photo groups
 */
export async function groupPhotosByItem(
  photoPaths: string[],
  similarityThreshold: number = 0.75
): Promise<PhotoGroup[]> {
  if (photoPaths.length === 0) {
    return [];
  }

  // Generate hashes for all photos
  const photoHashes: PhotoHash[] = await Promise.all(
    photoPaths.map(async (path) => ({
      path,
      hash: await generatePhotoHash(path),
    }))
  );

  // Group photos using hierarchical clustering
  const groups: PhotoGroup[] = [];
  const assigned = new Set<number>(); // Track which photos are already grouped

  for (let i = 0; i < photoHashes.length; i++) {
    if (assigned.has(i)) continue;

    // Start a new group with this photo
    const group: string[] = [photoHashes[i].path];
    assigned.add(i);

    // Find all similar photos
    for (let j = i + 1; j < photoHashes.length; j++) {
      if (assigned.has(j)) continue;

      const similarity = calculateSimilarity(
        photoHashes[i].hash,
        photoHashes[j].hash
      );

      if (similarity >= similarityThreshold) {
        group.push(photoHashes[j].path);
        assigned.add(j);
      }
    }

    // Create group
    groups.push({
      id: `item-${groups.length + 1}`,
      photos: group,
      primaryPhoto: group[0],
      confidence: group.length > 1 ? 0.85 : 0.5, // Higher confidence for multi-photo groups
    });
  }

  return groups;
}

/**
 * Advanced grouping using multiple similarity comparisons
 * Compares each photo against all photos in a group (not just the first)
 * More accurate but slower
 */
export async function groupPhotosByItemAdvanced(
  photoPaths: string[],
  similarityThreshold: number = 0.70
): Promise<PhotoGroup[]> {
  if (photoPaths.length === 0) {
    return [];
  }

  // Generate hashes for all photos
  const photoHashes: PhotoHash[] = await Promise.all(
    photoPaths.map(async (path) => ({
      path,
      hash: await generatePhotoHash(path),
    }))
  );

  // Build similarity matrix
  const similarityMatrix: number[][] = [];
  for (let i = 0; i < photoHashes.length; i++) {
    similarityMatrix[i] = [];
    for (let j = 0; j < photoHashes.length; j++) {
      if (i === j) {
        similarityMatrix[i][j] = 1.0;
      } else {
        similarityMatrix[i][j] = calculateSimilarity(
          photoHashes[i].hash,
          photoHashes[j].hash
        );
      }
    }
  }

  // Group photos using average-linkage clustering
  const groups: PhotoGroup[] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < photoHashes.length; i++) {
    if (assigned.has(i)) continue;

    const groupIndices: number[] = [i];
    assigned.add(i);

    // Find all photos similar to this group
    for (let j = i + 1; j < photoHashes.length; j++) {
      if (assigned.has(j)) continue;

      // Calculate average similarity to all photos in the group
      let totalSimilarity = 0;
      for (const groupIndex of groupIndices) {
        totalSimilarity += similarityMatrix[groupIndex][j];
      }
      const avgSimilarity = totalSimilarity / groupIndices.length;

      if (avgSimilarity >= similarityThreshold) {
        groupIndices.push(j);
        assigned.add(j);
      }
    }

    // Create group
    const groupPaths = groupIndices.map(idx => photoHashes[idx].path);
    groups.push({
      id: `item-${groups.length + 1}`,
      photos: groupPaths,
      primaryPhoto: groupPaths[0],
      confidence: calculateGroupConfidence(groupIndices, similarityMatrix),
    });
  }

  return groups;
}

/**
 * Calculate confidence score for a photo group
 * Higher intra-group similarity = higher confidence
 */
function calculateGroupConfidence(
  groupIndices: number[],
  similarityMatrix: number[][]
): number {
  if (groupIndices.length === 1) {
    return 0.5; // Low confidence for single-photo groups
  }

  // Calculate average pairwise similarity within the group
  let totalSimilarity = 0;
  let pairCount = 0;

  for (let i = 0; i < groupIndices.length; i++) {
    for (let j = i + 1; j < groupIndices.length; j++) {
      totalSimilarity += similarityMatrix[groupIndices[i]][groupIndices[j]];
      pairCount++;
    }
  }

  return pairCount > 0 ? totalSimilarity / pairCount : 0.5;
}

/**
 * Merge two photo groups
 * Useful for manual adjustments in the UI
 */
export function mergeGroups(group1: PhotoGroup, group2: PhotoGroup): PhotoGroup {
  return {
    id: group1.id,
    photos: [...group1.photos, ...group2.photos],
    primaryPhoto: group1.primaryPhoto,
    confidence: Math.min(group1.confidence, group2.confidence) * 0.9, // Lower confidence after manual merge
  };
}

/**
 * Split a photo from a group into its own group
 * Useful for manual adjustments in the UI
 */
export function splitPhotoFromGroup(
  group: PhotoGroup,
  photoPath: string
): { updatedGroup: PhotoGroup; newGroup: PhotoGroup } {
  const updatedPhotos = group.photos.filter(p => p !== photoPath);

  const updatedGroup: PhotoGroup = {
    ...group,
    photos: updatedPhotos,
    primaryPhoto: updatedPhotos[0] || group.primaryPhoto,
    confidence: group.confidence * 0.9, // Lower confidence after manual split
  };

  const newGroup: PhotoGroup = {
    id: `${group.id}-split`,
    photos: [photoPath],
    primaryPhoto: photoPath,
    confidence: 0.5,
  };

  return { updatedGroup, newGroup };
}
