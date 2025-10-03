# Listing Assistant

A lightweight desktop application for managing marketplace listings with photo editing, form management, and pricing calculations.

## Tech Stack

- **Tauri** - Lightweight desktop framework (native webview + Rust backend)
- **React 18** - Frontend UI
- **Vite 3** - Build tool and dev server
- **TypeScript** - Type safety
- **Rust** - Backend

## Prerequisites

- Node.js 22.20.0
- Rust 1.90.0+ (installed via [rustup](https://rustup.rs/))
- Cargo (comes with Rust)

### macOS Setup

Node.js 22 is installed via Homebrew and requires PATH configuration:

```bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
```

Rust environment needs to be sourced:

```bash
. "$HOME/.cargo/env"
```

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run tauri:dev
```

**Note**: First run takes 2-5 minutes (compiling Rust crates). Subsequent runs are instant.

## Available Commands

- `npm run dev` - Vite dev server only (browser)
- `npm run tauri:dev` - Full Tauri development mode
- `npm run build` - Build for production
- `npm run tauri:build` - Build Tauri desktop app

## Project Structure

```
listing-assistant-tauri/
├── src/                    # React frontend
│   ├── App.tsx
│   ├── main.tsx
│   └── App.css
├── src-tauri/              # Rust backend
│   ├── src/
│   │   └── main.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Roadmap

### Phase 1
- [ ] Photo import and basic editing (crop, brightness, compress)
- [ ] Manual form entry: brand, size, condition, RRP
- [ ] Pricing calculator
- [ ] SQLite database for storing listings
- [ ] Export ready-to-upload data

### Phase 2
- [ ] Google Vision OCR for reading labels
- [ ] Google Shopping search for RRP lookup
- [ ] Optional: remove.bg API integration
- [ ] Automated listing generation

## License

MIT
