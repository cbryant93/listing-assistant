#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use std::fs;
use base64::{Engine as _, engine::general_purpose};
use image::{DynamicImage, GenericImageView, imageops::FilterType};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Serialize, Deserialize)]
struct PhotoGroup {
    id: String,
    photos: Vec<String>,
    primary_photo: String,
    confidence: f64,
}

// Command to read an image file and return it as a base64 data URI
#[tauri::command]
fn read_image_as_base64(file_path: String) -> Result<String, String> {
    // Read the file
    let image_data = fs::read(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Encode to base64
    let base64_string = general_purpose::STANDARD.encode(&image_data);

    // Determine MIME type from extension
    let mime_type = if file_path.to_lowercase().ends_with(".png") {
        "image/png"
    } else if file_path.to_lowercase().ends_with(".gif") {
        "image/gif"
    } else {
        "image/jpeg" // Default to JPEG for .jpg, .jpeg, and others
    };

    // Return as data URI
    Ok(format!("data:{};base64,{}", mime_type, base64_string))
}

// Generate perceptual hash (difference hash) for an image
fn generate_dhash(img: &DynamicImage) -> Result<u64, String> {
    // Resize to 9x8 grayscale
    let resized = img.resize_exact(9, 8, FilterType::Lanczos3).to_luma8();

    let mut hash: u64 = 0;
    for y in 0..8 {
        for x in 0..8 {
            let left = resized.get_pixel(x, y)[0];
            let right = resized.get_pixel(x + 1, y)[0];
            if left > right {
                hash |= 1 << (y * 8 + x);
            }
        }
    }

    Ok(hash)
}

// Calculate Hamming distance between two hashes
fn hamming_distance(hash1: u64, hash2: u64) -> u32 {
    (hash1 ^ hash2).count_ones()
}

// Calculate similarity (0.0 to 1.0)
fn calculate_similarity(hash1: u64, hash2: u64) -> f64 {
    let distance = hamming_distance(hash1, hash2);
    1.0 - (distance as f64 / 64.0)
}

// Group photos by similarity
#[tauri::command]
fn group_photos_by_item(photo_paths: Vec<String>, similarity_threshold: f64) -> Result<Vec<PhotoGroup>, String> {
    if photo_paths.is_empty() {
        return Ok(vec![]);
    }

    // Generate hashes for all photos
    let mut hashes: Vec<(String, u64)> = Vec::new();
    for path in &photo_paths {
        let img = image::open(path)
            .map_err(|e| format!("Failed to open image {}: {}", path, e))?;
        let hash = generate_dhash(&img)?;
        hashes.push((path.clone(), hash));
    }

    // Group photos by similarity
    let mut groups: Vec<PhotoGroup> = Vec::new();
    let mut assigned: HashSet<usize> = HashSet::new();

    for i in 0..hashes.len() {
        if assigned.contains(&i) {
            continue;
        }

        let mut group_photos = vec![hashes[i].0.clone()];
        assigned.insert(i);

        // Find similar photos
        for j in (i + 1)..hashes.len() {
            if assigned.contains(&j) {
                continue;
            }

            let similarity = calculate_similarity(hashes[i].1, hashes[j].1);
            if similarity >= similarity_threshold {
                group_photos.push(hashes[j].0.clone());
                assigned.insert(j);
            }
        }

        // Create group
        let confidence = if group_photos.len() > 1 { 0.85 } else { 0.5 };
        groups.push(PhotoGroup {
            id: format!("item-{}", groups.len() + 1),
            photos: group_photos.clone(),
            primary_photo: group_photos[0].clone(),
            confidence,
        });
    }

    Ok(groups)
}

fn main() {
  let context = tauri::generate_context!();
  tauri::Builder::default()
    .menu(if cfg!(target_os = "macos") {
      tauri::Menu::os_default(&context.package_info().name)
    } else {
      tauri::Menu::default()
    })
    .invoke_handler(tauri::generate_handler![read_image_as_base64, group_photos_by_item])
    .run(context)
    .expect("error while running tauri application");
}
