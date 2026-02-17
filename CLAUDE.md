# Photo Analyser

Photograph quality analysis tool using Anthropic LLM. Scores photos on professional photography criteria (composition, lighting, colour/tone, storytelling, technical execution, overall impact) and generates captions and keywords.

## Tech Stack

- **Language:** TypeScript (ES modules, strict mode)
- **Runtime:** Node.js via `tsx` (no pre-compilation step)
- **Database:** SQLite via `better-sqlite3` (synchronous)
- **Image processing:** `sharp` (resizing), `exifreader` (EXIF extraction)
- **Frontend:** Vanilla JS single-page app (static, no framework)
- **AI:** Anthropic SDK (`@anthropic-ai/sdk`) — Files API (beta), Message Batches API, Vision

## Architecture

Three independent CLI modules:

- **IMS** (`npm run ims`) — Image Metadata Synchroniser: scans `IMAGE_DIR`, extracts EXIF, resizes to ≤800×800 JPEG, uploads to Anthropic Files API, stores metadata in SQLite
- **BIA** (`npm run bia`) — Batch Image Analyser: submits uploaded images to Anthropic Message Batches API, polls for completion, parses results into DB
- **Export** (`npm run export`) — Static Site Exporter: reads SQLite, writes JSON sidecars + gallery manifest, copies images, emits a self-contained `dist/` directory

## Project Structure

```
src/
├── config.ts          # centralised env var loading from .env
├── types.ts           # ImageRecord, AnalysisResult interfaces
├── db/
│   ├── connection.ts  # SQLite singleton (WAL mode)
│   └── schema.ts      # images table creation
├── ims/               # Image Metadata Synchroniser
│   ├── index.ts       # CLI entry point / orchestrator
│   ├── scanner.ts     # directory scan & change detection
│   ├── metadata.ts    # EXIF extraction
│   ├── resizer.ts     # sharp resize
│   └── uploader.ts    # Anthropic Files API upload
├── bia/               # Batch Image Analyser
│   ├── index.ts       # CLI entry point / orchestrator
│   ├── prompt.ts      # photography analysis system prompt
│   ├── batcher.ts     # batch creation & submission
│   ├── poller.ts      # poll batch status
│   └── parser.ts      # parse JSONL results → DB
├── tools/             # Utility scripts
│   ├── list-files.ts  # list files uploaded to Anthropic
│   └── list-db.ts     # list images table contents
├── export/            # Static Site Exporter
│   ├── index.ts       # CLI entry point / orchestrator
│   └── writer.ts      # JSON sidecar writing, file copying
└── static/            # Browser-side SPA source files
    ├── index.html     # SPA shell
    ├── app.js         # Vanilla JS SPA
    └── css/
        └── styles.css # Stylesheet
```

## Database

Single SQLite file at `data/photo-analyser.db` (gitignored). One `images` table with metadata columns, `upload_file_id` (Anthropic), `batch_id`, `processed` flag, and `analysis_result` (serialised JSON).

## Configuration

All config via `.env` file (see `.env.example`). Required: `ANTHROPIC_API_KEY`, `IMAGE_DIR`.

## Commands

```bash
npm run ims          # Sync images from IMAGE_DIR → DB + Anthropic Files API
npm run bia          # Submit unprocessed images for batch analysis
npm run export       # Generate dist/ static site from database
npm run list-files   # List files uploaded to Anthropic Files API
npm run list-db      # List images table contents with status summary
npx tsc --noEmit     # Type-check
```

## Design Notes

Detailed requirements and high-level design are in `docs/session_0/design_notes.md`.

## Conventions

- Use Australian spelling in all outputs (e.g. colour, analyse, organisation)
- ESM imports with `.js` extensions (required by `"type": "module"`)
- All modules are idempotent and safe to re-run
- Per-image error handling — one failure does not halt a batch run
- The Anthropic Files API uses beta access (`client.beta.files`)
- The batch API `file_id` image source uses a type assertion (`as any`) in `batcher.ts` because the non-beta SDK types don't yet include `FileImageSource`
