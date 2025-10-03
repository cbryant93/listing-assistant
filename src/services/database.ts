import Database from 'better-sqlite3';
import path from 'path';
import { app } from '@tauri-apps/api';

let db: Database.Database | null = null;

// Initialize database connection
export async function initDatabase(): Promise<Database.Database> {
  if (db) return db;

  // Get app data directory
  const appDataDir = await app.getPath('data');
  const dbPath = path.join(appDataDir, 'listings.db');

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Create tables
  createTables();

  return db;
}

// Create database tables
function createTables() {
  if (!db) throw new Error('Database not initialized');

  // Listings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT,
      brand TEXT,
      size TEXT,
      condition TEXT NOT NULL CHECK(condition IN (
        'new_with_tags',
        'new_without_tags',
        'very_good',
        'good',
        'satisfactory'
      )),
      colors TEXT NOT NULL DEFAULT '[]',
      materials TEXT NOT NULL DEFAULT '[]',
      rrp REAL NOT NULL DEFAULT 0,
      price REAL NOT NULL DEFAULT 0,
      parcel_size TEXT CHECK(parcel_size IN ('small', 'medium', 'large')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Photos table
  db.exec(`
    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      original_path TEXT NOT NULL,
      is_edited INTEGER NOT NULL DEFAULT 0,
      photo_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
    )
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_photos_listing_id ON photos(listing_id);
    CREATE INDEX IF NOT EXISTS idx_photos_order ON photos(listing_id, photo_order);
  `);
}

// Get database instance
export function getDatabase(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

// Close database connection
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}
