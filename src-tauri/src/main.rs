#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use std::fs;
use base64::{Engine as _, engine::general_purpose};

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

fn main() {
  let context = tauri::generate_context!();
  tauri::Builder::default()
    .menu(if cfg!(target_os = "macos") {
      tauri::Menu::os_default(&context.package_info().name)
    } else {
      tauri::Menu::default()
    })
    .invoke_handler(tauri::generate_handler![read_image_as_base64])
    .run(context)
    .expect("error while running tauri application");
}
