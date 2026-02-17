# Photo Analyser

Photograph quality analysis tool powered by Anthropic's Claude. Scores photos on six professional photography criteria, generates descriptive captions, and extracts keywords — all viewable through a static gallery website.

## How It Works

The tool operates as a three-stage pipeline:

1. **IMS** (Image Metadata Synchroniser) — Scans a local directory, extracts EXIF metadata, resizes images for cost efficiency, and uploads them to the Anthropic Files API.
2. **BIA** (Batch Image Analyser) — Submits uploaded images to the Anthropic Message Batches API for AI analysis, polls for completion, and stores the parsed results.
3. **Export** — Generates a self-contained static website in `dist/` with a gallery, sorting, and detailed per-image views including scores, captions, keywords, and metadata.

Each module is independent, idempotent, and safe to re-run.

## Scoring Criteria

Each image is scored from 0–10 on:

| Criterion | What It Measures |
|---|---|
| **Composition** | Framing, rule of thirds, balance, leading lines |
| **Lighting** | Exposure, shadows, highlights, contrast |
| **Colour & Tone** | White balance, colour harmony, saturation |
| **Subject & Storytelling** | Emotion, sense of place, narrative |
| **Technical Execution** | Focus, sharpness, noise, clarity |
| **Overall Impact** | Memorability, mood, appeal |

The AI also produces a brief justification comment, a descriptive caption, and up to 10 keywords per image.

## Prerequisites

- **Node.js** (v18+)
- **Anthropic API key** with access to the Files API (beta) and Message Batches API

## Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API key and image directory path
```

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | — | Your Anthropic API key |
| `IMAGE_DIR` | Yes | — | Absolute path to the directory of photos to analyse |
| `DB_PATH` | No | `./data/photo-analyser.db` | SQLite database file location |
| `MODEL` | No | `claude-sonnet-4-5-20250929` | Anthropic model to use for analysis |
| `BATCH_SIZE` | No | `50` | Number of images per batch submission |
| `POLL_INTERVAL_MS` | No | `30000` | Milliseconds between batch status polls |

## Usage

Run the modules in sequence:

```bash
# 1. Scan images, extract metadata, and upload to Anthropic
npm run ims

# 2. Submit uploaded images for batch analysis and wait for results
npm run bia

# 3. Generate the static site
npm run export

# 4. Serve and open locally
npx serve dist
```

Then open the URL shown by `serve` (typically `http://localhost:3000`) to browse the gallery.

> **Note:** Open via a local server, not directly as a `file://` URL — browsers block `fetch()` on `file://` URLs.

### Utility Scripts

```bash
npm run list-files     # List files uploaded to the Anthropic Files API
npm run list-db        # List database contents with status summary
npm run list-db -- -d  # Detailed view with all scores, captions, and keywords
npm run list-batches   # List all batches from the Anthropic API with status
npm run clear-db       # Delete all rows from the images table
npm run clear-db -- --reset-analysis  # Clear analysis data only (keeps uploads)
npm run clear-files    # Delete all files from the Anthropic Files API
```

### Type Checking

```bash
npx tsc --noEmit
```

## Project Structure

```
src/
├── config.ts          # Centralised environment variable loading
├── types.ts           # ImageRecord and AnalysisResult interfaces
├── db/
│   ├── connection.ts  # SQLite singleton (WAL mode)
│   └── schema.ts      # Images table creation
├── ims/               # Image Metadata Synchroniser
│   ├── index.ts       # CLI entry point / orchestrator
│   ├── scanner.ts     # Directory scan & change detection
│   ├── metadata.ts    # EXIF extraction (camera, date, GPS)
│   ├── resizer.ts     # Resize to ≤800x800 JPEG via sharp
│   └── uploader.ts    # Anthropic Files API upload
├── bia/               # Batch Image Analyser
│   ├── index.ts       # CLI entry point / orchestrator
│   ├── prompt.ts      # Photography analysis system prompt
│   ├── batcher.ts     # Batch creation & submission
│   ├── poller.ts      # Poll batch status until complete
│   └── parser.ts      # Parse JSONL results into database
├── tools/             # Utility scripts
│   ├── list-files.ts  # List Anthropic uploaded files
│   ├── list-db.ts     # List database contents (supports --detail)
│   ├── list-batches.ts # List Anthropic API batches with status
│   ├── clear-db.ts    # Clear database (supports --reset-analysis)
│   └── clear-files.ts # Delete all files from Anthropic Files API
├── export/            # Static Site Exporter
│   ├── index.ts       # CLI entry point / orchestrator
│   └── writer.ts      # JSON sidecar writing, file copying
└── static/            # Browser-side SPA source files
    ├── index.html     # SPA shell
    ├── app.js         # Vanilla JS SPA
    └── css/
        └── styles.css # Stylesheet
```

## Tech Stack

- **TypeScript** (ES modules, strict mode) — run directly via `tsx`
- **SQLite** via `better-sqlite3` — synchronous, WAL mode, single `images` table
- **sharp** — image resizing to reduce API costs
- **ExifReader** — EXIF metadata extraction (camera, date, GPS)
- **Vanilla JS SPA** — static gallery with dark theme, hash-based routing, no framework
- **Anthropic SDK** — Files API (beta) for uploads, Message Batches API for analysis

## Gallery

The static site supports:

- **Sorting** by date added, filename, or overall impact score (client-side)
- **Detail view** with colour-coded score bars, caption, keywords, and EXIF metadata
- **Hash-based routing** (`#/` for gallery, `#/image/<filename>` for detail)
- **Dark theme** with responsive layout

## Design Decisions

- **Cost optimisation**: Images are resized to ≤800x800 JPEG (quality 70) before upload, and the Message Batches API is used instead of synchronous calls.
- **Per-image error handling**: A single image failure does not halt a batch run.
- **Idempotent modules**: All three CLI modules detect prior state and skip already-completed work, making them safe to re-run at any time.
- **Rate limiting**: IMS introduces a 200ms delay between uploads to avoid hitting API rate limits.

## Licence

ISC
