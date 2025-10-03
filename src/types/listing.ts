export interface Photo {
  id: number;
  listing_id: number;
  file_path: string;
  original_path: string;
  is_edited: boolean;
  order: number;
  created_at: string;
}

export interface Listing {
  id: number;
  title: string;
  description: string; // Includes hashtags
  category: string;
  brand: string;
  size: string;
  condition: 'new' | 'excellent' | 'good' | 'satisfactory';
  colors: string[]; // JSON array
  materials: string[]; // JSON array, max 3
  rrp: number; // Recommended Retail Price
  price: number; // Final selling price
  parcel_size: string;
  notes: string; // Internal notes only
  created_at: string;
  updated_at: string;
}

export interface ListingWithPhotos extends Listing {
  photos: Photo[];
}
