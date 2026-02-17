# Design: Migrate Web Layer to Static Site

**Date:** 2026-02-17
**Status:** Approved

## Overview

Replace the Express/EJS dynamic web server with a static site exporter. The IMS and BIA pipeline tools continue to use SQLite as their source of truth. A new `npm run export` command reads SQLite and generates a self-contained `dist/` directory ready to deploy to any static host.

## Goals

- Remove the Node.js server requirement for browsing photos
- Produce a `dist/` directory deployable to any static host (S3, GitHub Pages, Netlify, etc.)
- Keep the IMS → BIA → export workflow simple and sequential

## Architecture

### Current

```
IMS → SQLite ← BIA
                ↑
            Express/EJS (src/web/)
```

### Proposed

```
IMS → SQLite ← BIA
                ↑
            src/export/ → dist/   (static files)
```

### `dist/` Layout

```
dist/
├── index.html          # SPA shell
├── app.js              # vanilla JS SPA (no framework)
├── css/
│   └── styles.css      # copied from src/static/css/styles.css
├── data/
│   ├── index.json      # gallery manifest (all images, lightweight)
│   └── <filename>.json # one sidecar per image (full detail)
└── photos/
    └── <filename>      # original image files copied from IMAGE_DIR
```

## Data Model

### `dist/data/index.json`

Loaded once on gallery page. Contains only what is needed to render gallery cards.

```json
{
  "generated_at": "2026-02-17T12:00:00Z",
  "total": 150,
  "images": [
    {
      "filename": "photo.jpg",
      "overall_impact": 8,
      "processed": 1,
      "created_at": "2026-02-17T00:00:00Z"
    }
  ]
}
```

### `dist/data/<filename>.json`

Fetched on demand when a detail view is opened. Omits pipeline-only fields (`upload_file_id`, `uploaded_at`, `batch_id`, `batch_custom_id`).

```json
{
  "filename": "photo.jpg",
  "file_size_bytes": 4321000,
  "width": 4000,
  "height": 3000,
  "exif_camera": "Canon EOS R5",
  "exif_date_taken": "2026-01-15",
  "exif_gps_lat": -33.865,
  "exif_gps_lon": 151.209,
  "created_at": "2026-02-17T00:00:00Z",
  "analysis": {
    "composition": 8,
    "lighting": 7,
    "color_and_tone": 8,
    "subject_storytelling": 6,
    "technical_execution": 7,
    "overall_impact": 8,
    "comment": "...",
    "caption": "...",
    "keywords": ["landscape", "sunset"]
  }
}
```

## SPA Behaviour

**Routing:** Hash-based (`#/` for gallery, `#/image/<filename>` for detail). No server required.

**Gallery view:**
- Fetches `data/index.json` on load
- Renders image grid with score badges
- Sort controls (date added, filename, score) — client-side sort, re-render in place
- No pagination — all images in one manifest fetch

**Detail view:**
- Triggered by hash change to `#/image/<filename>`
- Fetches `data/<filename>.json`
- Renders: scores with bar chart, comment, caption, keywords, EXIF metadata table
- Prev/Next navigation derived from current `index.json` array order
- Back to Gallery link resets hash to `#/`

**Implementation:** Plain JS in `app.js` — no TypeScript compilation required for the browser asset.

## Source File Changes

### New files

```
src/export/
├── index.ts      # CLI entry: reads SQLite, orchestrates export
└── writer.ts     # writes JSON files, copies images and CSS
src/static/
├── index.html    # SPA shell
├── app.js        # vanilla JS SPA
└── css/
    └── styles.css  # moved from public/css/styles.css
```

### Removed files

- `src/web/` (all 7 TypeScript files)
- `public/` (entire directory — CSS moved to `src/static/css/`)

### `package.json` changes

- Replace `"web": "tsx src/web/index.ts"` with `"export": "tsx src/export/index.ts"`
- Remove dependencies: `express`, `ejs`
- Remove devDependencies: `@types/express`, `@types/ejs`

## Export Command Flow

1. Clean (or create) `dist/`
2. Copy `src/static/index.html` → `dist/index.html`
3. Copy `src/static/app.js` → `dist/app.js`
4. Copy `src/static/css/styles.css` → `dist/css/styles.css`
5. Read all images from SQLite
6. Write `dist/data/index.json` (manifest)
7. For each image: write `dist/data/<filename>.json`, copy image to `dist/photos/<filename>`

## Updated Workflow

```bash
npm run ims      # Sync images from IMAGE_DIR → SQLite + Anthropic Files API
npm run bia      # Submit unprocessed images for batch analysis
npm run export   # Generate dist/ static site
# Then deploy dist/ to any static host
```
