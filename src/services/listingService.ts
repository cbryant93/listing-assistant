import { getDatabase } from './database';
import type { Listing, ListingWithPhotos, Photo } from '@types/listing';

// Create a new listing
export function createListing(listing: Omit<Listing, 'id' | 'created_at' | 'updated_at'>): number {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO listings (
      title, description, category, brand, size, condition,
      colors, materials, rrp, price, parcel_size, notes
    ) VALUES (
      @title, @description, @category, @brand, @size, @condition,
      @colors, @materials, @rrp, @price, @parcel_size, @notes
    )
  `);

  const result = stmt.run({
    title: listing.title,
    description: listing.description,
    category: listing.category || null,
    brand: listing.brand || null,
    size: listing.size || null,
    condition: listing.condition,
    colors: JSON.stringify(listing.colors),
    materials: JSON.stringify(listing.materials),
    rrp: listing.rrp,
    price: listing.price,
    parcel_size: listing.parcel_size || null,
    notes: listing.notes || null,
  });

  return result.lastInsertRowid as number;
}

// Get listing by ID
export function getListingById(id: number): Listing | null {
  const db = getDatabase();

  const stmt = db.prepare('SELECT * FROM listings WHERE id = ?');
  const row = stmt.get(id) as any;

  if (!row) return null;

  return {
    ...row,
    colors: JSON.parse(row.colors),
    materials: JSON.parse(row.materials),
  };
}

// Get listing with photos
export function getListingWithPhotos(id: number): ListingWithPhotos | null {
  const db = getDatabase();

  const listing = getListingById(id);
  if (!listing) return null;

  const photoStmt = db.prepare(`
    SELECT id, listing_id, file_path, original_path, is_edited, photo_order as "order", created_at
    FROM photos
    WHERE listing_id = ?
    ORDER BY photo_order ASC
  `);

  const photos = photoStmt.all(id) as Photo[];

  return {
    ...listing,
    photos: photos.map(p => ({
      ...p,
      is_edited: Boolean(p.is_edited),
    })),
  };
}

// Get all listings
export function getAllListings(): Listing[] {
  const db = getDatabase();

  const stmt = db.prepare('SELECT * FROM listings ORDER BY created_at DESC');
  const rows = stmt.all() as any[];

  return rows.map(row => ({
    ...row,
    colors: JSON.parse(row.colors),
    materials: JSON.parse(row.materials),
  }));
}

// Update listing
export function updateListing(id: number, updates: Partial<Omit<Listing, 'id' | 'created_at' | 'updated_at'>>): boolean {
  const db = getDatabase();

  const fields: string[] = [];
  const values: any = { id };

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = @${key}`);
      if (key === 'colors' || key === 'materials') {
        values[key] = JSON.stringify(value);
      } else {
        values[key] = value;
      }
    }
  });

  if (fields.length === 0) return false;

  fields.push("updated_at = datetime('now')");

  const stmt = db.prepare(`
    UPDATE listings
    SET ${fields.join(', ')}
    WHERE id = @id
  `);

  const result = stmt.run(values);
  return result.changes > 0;
}

// Delete listing (photos will be cascade deleted)
export function deleteListing(id: number): boolean {
  const db = getDatabase();

  const stmt = db.prepare('DELETE FROM listings WHERE id = ?');
  const result = stmt.run(id);

  return result.changes > 0;
}

// Add photo to listing
export function addPhoto(photo: Omit<Photo, 'id' | 'created_at'>): number {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO photos (listing_id, file_path, original_path, is_edited, photo_order)
    VALUES (@listing_id, @file_path, @original_path, @is_edited, @order)
  `);

  const result = stmt.run({
    listing_id: photo.listing_id,
    file_path: photo.file_path,
    original_path: photo.original_path,
    is_edited: photo.is_edited ? 1 : 0,
    order: photo.order,
  });

  return result.lastInsertRowid as number;
}

// Get photos for listing
export function getPhotosForListing(listingId: number): Photo[] {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT id, listing_id, file_path, original_path, is_edited, photo_order as "order", created_at
    FROM photos
    WHERE listing_id = ?
    ORDER BY photo_order ASC
  `);

  const photos = stmt.all(listingId) as any[];

  return photos.map(p => ({
    ...p,
    is_edited: Boolean(p.is_edited),
  }));
}

// Delete photo
export function deletePhoto(id: number): boolean {
  const db = getDatabase();

  const stmt = db.prepare('DELETE FROM photos WHERE id = ?');
  const result = stmt.run(id);

  return result.changes > 0;
}

// Update photo order
export function updatePhotoOrder(photoId: number, newOrder: number): boolean {
  const db = getDatabase();

  const stmt = db.prepare('UPDATE photos SET photo_order = ? WHERE id = ?');
  const result = stmt.run(newOrder, photoId);

  return result.changes > 0;
}
