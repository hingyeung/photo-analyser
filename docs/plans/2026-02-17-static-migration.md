# Static Site Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Express/EJS web server with a static site exporter that generates a self-contained `dist/` directory from the SQLite database.

**Architecture:** A new `npm run export` CLI (`src/export/`) reads all image records from SQLite, writes one JSON sidecar per image plus a gallery manifest, copies the original image files, and emits a vanilla-JS single-page app shell. The IMS and BIA pipeline tools are untouched. `src/web/` and `public/` are deleted.

**Tech Stack:** Node.js/TypeScript (tsx), better-sqlite3 (read-only), node:fs for file operations, vanilla JS for the browser SPA (no framework, no build step for browser assets), node:test for unit tests.

---

### Task 1: Create `src/static/` — SPA source assets

These are the browser-side files that get copied verbatim into `dist/` by the exporter.

**Files:**
- Create: `src/static/css/styles.css`
- Create: `src/static/index.html`
- Create: `src/static/app.js`

**Step 1: Create the CSS directory and copy the existing stylesheet**

```bash
mkdir -p src/static/css
cp public/css/styles.css src/static/css/styles.css
```

Expected: `src/static/css/styles.css` exists with identical content to `public/css/styles.css`.

**Step 2: Create `src/static/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Photo Analyser</title>
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <header>
    <nav>
      <a href="#/" class="logo">Photo Analyser</a>
    </nav>
  </header>
  <main>
    <p>Loading...</p>
  </main>
  <script src="app.js"></script>
</body>
</html>
```

**Step 3: Create `src/static/app.js`**

```javascript
(function () {
  var allImages = [];
  var currentSort = 'created_at';
  var currentOrder = 'desc';

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getSortedImages() {
    return allImages.slice().sort(function (a, b) {
      var aVal, bVal;
      if (currentSort === 'overall_impact') {
        aVal = a.overall_impact != null ? a.overall_impact : -1;
        bVal = b.overall_impact != null ? b.overall_impact : -1;
      } else if (currentSort === 'filename') {
        aVal = a.filename;
        bVal = b.filename;
      } else {
        aVal = a.created_at;
        bVal = b.created_at;
      }
      if (aVal < bVal) return currentOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return currentOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  function renderCard(img) {
    var badge;
    if (img.processed && img.overall_impact != null) {
      var cls = img.overall_impact >= 7 ? 'green' : img.overall_impact >= 4 ? 'amber' : 'red';
      badge = '<span class="badge badge-' + cls + '">' + img.overall_impact + '/10</span>';
    } else {
      badge = '<span class="badge badge-grey">Pending</span>';
    }
    return '<a href="#/image/' + encodeURIComponent(img.filename) + '" class="card">' +
      '<div class="card-image">' +
      '<img src="photos/' + encodeURIComponent(img.filename) + '" alt="' + escapeHtml(img.filename) + '" loading="lazy">' +
      '</div>' +
      '<div class="card-info">' +
      '<span class="card-filename">' + escapeHtml(img.filename) + '</span>' +
      badge +
      '</div>' +
      '</a>';
  }

  function renderGallery() {
    var sorted = getSortedImages();
    var sortLinks = ['created_at', 'filename', 'overall_impact'].map(function (s) {
      var label = s === 'created_at' ? 'Date added' : s === 'filename' ? 'Filename' : 'Score';
      return '<a href="#" data-sort="' + s + '" class="' + (currentSort === s ? 'active' : '') + '">' + label + '</a>';
    }).join('');

    document.querySelector('main').innerHTML =
      '<div class="gallery-header">' +
      '<h1>Gallery</h1>' +
      '<p class="count">' + allImages.length + ' image' + (allImages.length !== 1 ? 's' : '') + '</p>' +
      '<div class="sort-controls"><label>Sort by:</label>' + sortLinks + '</div>' +
      '</div>' +
      '<div class="gallery-grid">' +
      sorted.map(renderCard).join('') +
      '</div>';

    document.querySelectorAll('[data-sort]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        var sort = el.getAttribute('data-sort');
        if (sort === currentSort) {
          currentOrder = currentOrder === 'desc' ? 'asc' : 'desc';
        } else {
          currentSort = sort;
          currentOrder = sort === 'filename' ? 'asc' : 'desc';
        }
        renderGallery();
      });
    });
  }

  function renderAnalysis(analysis) {
    var scoreKeys = ['composition', 'lighting', 'color_and_tone', 'subject_storytelling', 'technical_execution', 'overall_impact'];
    var rows = scoreKeys.map(function (key) {
      var val = analysis[key];
      var cls = val >= 7 ? 'green' : val >= 4 ? 'amber' : 'red';
      return '<div class="score-row">' +
        '<span class="score-label">' + key.replace(/_/g, ' ') + '</span>' +
        '<div class="score-bar-bg"><div class="score-bar score-bar-' + cls + '" style="width:' + (val * 10) + '%"></div></div>' +
        '<span class="score-value">' + val + '</span>' +
        '</div>';
    }).join('');

    var keywords = (analysis.keywords || []).map(function (kw) {
      return '<span class="keyword">' + escapeHtml(kw) + '</span>';
    }).join('');

    return '<div class="scores"><h3>Scores</h3>' + rows + '</div>' +
      '<div class="detail-section"><h3>Comment</h3><p>' + escapeHtml(analysis.comment) + '</p></div>' +
      '<div class="detail-section"><h3>Caption</h3><p>' + escapeHtml(analysis.caption) + '</p></div>' +
      '<div class="detail-section"><h3>Keywords</h3><div class="keywords">' + keywords + '</div></div>';
  }

  function renderMetadata(img) {
    var rows = [];
    if (img.exif_camera) rows.push('<tr><td>Camera</td><td>' + escapeHtml(img.exif_camera) + '</td></tr>');
    if (img.exif_date_taken) rows.push('<tr><td>Date taken</td><td>' + escapeHtml(img.exif_date_taken) + '</td></tr>');
    if (img.width && img.height) rows.push('<tr><td>Dimensions</td><td>' + img.width + ' x ' + img.height + '</td></tr>');
    if (img.file_size_bytes) rows.push('<tr><td>File size</td><td>' + (img.file_size_bytes / 1024 / 1024).toFixed(2) + ' MB</td></tr>');
    if (img.exif_gps_lat && img.exif_gps_lon) rows.push('<tr><td>GPS</td><td>' + img.exif_gps_lat.toFixed(5) + ', ' + img.exif_gps_lon.toFixed(5) + '</td></tr>');
    if (rows.length === 0) return '';
    return '<div class="detail-section"><h3>Metadata</h3><table class="meta-table">' + rows.join('') + '</table></div>';
  }

  function renderDetail(filename) {
    fetch('data/' + encodeURIComponent(filename) + '.json')
      .then(function (res) {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then(function (img) {
        var sorted = getSortedImages();
        var idx = sorted.findIndex(function (i) { return i.filename === filename; });
        var prev = idx > 0 ? sorted[idx - 1] : null;
        var next = idx < sorted.length - 1 ? sorted[idx + 1] : null;

        var nav = '<div class="detail-nav">' +
          (prev ? '<a href="#/image/' + encodeURIComponent(prev.filename) + '">&laquo; Previous</a>' : '<span></span>') +
          '<a href="#/">Back to Gallery</a>' +
          (next ? '<a href="#/image/' + encodeURIComponent(next.filename) + '">Next &raquo;</a>' : '<span></span>') +
          '</div>';

        document.querySelector('main').innerHTML = nav +
          '<div class="detail-container">' +
          '<div class="detail-image"><img src="photos/' + encodeURIComponent(img.filename) + '" alt="' + escapeHtml(img.filename) + '"></div>' +
          '<div class="detail-sidebar">' +
          '<h2>' + escapeHtml(img.filename) + '</h2>' +
          (img.analysis ? renderAnalysis(img.analysis) : '<div class="detail-section"><p class="pending-text">Analysis not yet available.</p></div>') +
          renderMetadata(img) +
          '</div>' +
          '</div>';
      })
      .catch(function () {
        document.querySelector('main').innerHTML = '<p>Image not found.</p>';
      });
  }

  function handleHash() {
    var hash = window.location.hash;
    var match = hash.match(/^#\/image\/(.+)$/);
    if (match) {
      renderDetail(decodeURIComponent(match[1]));
    } else {
      renderGallery();
    }
  }

  fetch('data/index.json')
    .then(function (res) { return res.json(); })
    .then(function (data) {
      allImages = data.images;
      window.addEventListener('hashchange', handleHash);
      handleHash();
    })
    .catch(function () {
      document.querySelector('main').innerHTML = '<p>Failed to load image data.</p>';
    });
})();
```

**Step 4: Commit**

```bash
git add src/static/
git commit -m "Add static SPA source assets (index.html, app.js, styles.css)"
```

---

### Task 2: Create `src/export/writer.ts` with unit tests

**Files:**
- Create: `src/export/writer.ts`
- Create: `src/export/writer.test.ts`

**Step 1: Write the failing test**

Create `src/export/writer.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ImageRecord } from "../types.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "photo-export-test-"));
}

function makeImageRecord(overrides: Partial<ImageRecord> = {}): ImageRecord {
  return {
    id: 1,
    full_path: "/images/test.jpg",
    filename: "test.jpg",
    file_size_bytes: 102400,
    file_modified_at: "2026-01-01T00:00:00Z",
    mime_type: "image/jpeg",
    width: 1920,
    height: 1080,
    exif_camera: "Sony A7IV",
    exif_date_taken: "2026-01-01",
    exif_gps_lat: -33.865,
    exif_gps_lon: 151.209,
    upload_file_id: "file_abc",
    uploaded_at: "2026-01-01T01:00:00Z",
    batch_id: "batch_xyz",
    batch_custom_id: "custom_1",
    processed: 1,
    analysis_result: JSON.stringify({
      composition: 8,
      lighting: 7,
      color_and_tone: 6,
      subject_storytelling: 9,
      technical_execution: 7,
      overall_impact: 8,
      comment: "Good shot",
      caption: "A test image",
      keywords: ["test", "photo"],
    }),
    processed_at: "2026-01-01T02:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T02:00:00Z",
    ...overrides,
  };
}

test("writeManifest creates data/index.json with correct shape", async () => {
  const { writeManifest } = await import("./writer.js");
  const distDir = makeTempDir();
  const records = [
    makeImageRecord({ filename: "a.jpg", processed: 1 }),
    makeImageRecord({ filename: "b.jpg", processed: 0, analysis_result: null }),
  ];

  writeManifest(distDir, records);

  const raw = fs.readFileSync(path.join(distDir, "data", "index.json"), "utf8");
  const manifest = JSON.parse(raw);

  assert.equal(manifest.total, 2);
  assert.ok(manifest.generated_at);
  assert.equal(manifest.images[0].filename, "a.jpg");
  assert.equal(manifest.images[0].overall_impact, 8);
  assert.equal(manifest.images[1].filename, "b.jpg");
  assert.equal(manifest.images[1].overall_impact, null);

  fs.rmSync(distDir, { recursive: true });
});

test("writeSidecar creates data/<filename>.json omitting pipeline fields", async () => {
  const { writeSidecar } = await import("./writer.js");
  const distDir = makeTempDir();
  const record = makeImageRecord();

  writeSidecar(distDir, record);

  const raw = fs.readFileSync(path.join(distDir, "data", "test.jpg.json"), "utf8");
  const sidecar = JSON.parse(raw);

  assert.equal(sidecar.filename, "test.jpg");
  assert.equal(sidecar.width, 1920);
  assert.equal(sidecar.analysis.overall_impact, 8);
  assert.equal(sidecar.analysis.keywords[0], "test");

  // Pipeline-only fields must not be present
  assert.equal(sidecar.upload_file_id, undefined);
  assert.equal(sidecar.batch_id, undefined);
  assert.equal(sidecar.batch_custom_id, undefined);
  assert.equal(sidecar.uploaded_at, undefined);

  fs.rmSync(distDir, { recursive: true });
});

test("copyImage copies a file to dist/photos/", async () => {
  const { copyImage } = await import("./writer.js");
  const distDir = makeTempDir();
  const imageDir = makeTempDir();
  const filename = "sample.jpg";
  fs.writeFileSync(path.join(imageDir, filename), "fake-image-data");

  copyImage(distDir, imageDir, filename);

  const dest = path.join(distDir, "photos", filename);
  assert.ok(fs.existsSync(dest));
  assert.equal(fs.readFileSync(dest, "utf8"), "fake-image-data");

  fs.rmSync(distDir, { recursive: true });
  fs.rmSync(imageDir, { recursive: true });
});

test("copyStatic copies index.html, app.js, and css/styles.css", async () => {
  const { copyStatic } = await import("./writer.js");
  const distDir = makeTempDir();
  const staticDir = makeTempDir();
  fs.mkdirSync(path.join(staticDir, "css"));
  fs.writeFileSync(path.join(staticDir, "index.html"), "<html></html>");
  fs.writeFileSync(path.join(staticDir, "app.js"), "/* js */");
  fs.writeFileSync(path.join(staticDir, "css", "styles.css"), "body{}");

  copyStatic(distDir, staticDir);

  assert.ok(fs.existsSync(path.join(distDir, "index.html")));
  assert.ok(fs.existsSync(path.join(distDir, "app.js")));
  assert.ok(fs.existsSync(path.join(distDir, "css", "styles.css")));

  fs.rmSync(distDir, { recursive: true });
  fs.rmSync(staticDir, { recursive: true });
});
```

**Step 2: Run test to verify it fails**

```bash
npx tsx --test src/export/writer.test.ts
```

Expected: FAIL — `Cannot find module './writer.js'`

**Step 3: Create `src/export/writer.ts`**

```typescript
import fs from "node:fs";
import path from "node:path";
import type { ImageRecord, AnalysisResult } from "../types.js";

export interface ManifestEntry {
  filename: string;
  overall_impact: number | null;
  processed: number;
  created_at: string;
}

export interface Manifest {
  generated_at: string;
  total: number;
  images: ManifestEntry[];
}

export interface Sidecar {
  filename: string;
  file_size_bytes: number | null;
  width: number | null;
  height: number | null;
  exif_camera: string | null;
  exif_date_taken: string | null;
  exif_gps_lat: number | null;
  exif_gps_lon: number | null;
  created_at: string;
  analysis: AnalysisResult | null;
}

export function writeManifest(distDir: string, images: ImageRecord[]): void {
  const dataDir = path.join(distDir, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const entries: ManifestEntry[] = images.map((img) => {
    const analysis = img.analysis_result
      ? (JSON.parse(img.analysis_result) as AnalysisResult)
      : null;
    return {
      filename: img.filename,
      overall_impact: analysis?.overall_impact ?? null,
      processed: img.processed,
      created_at: img.created_at,
    };
  });

  const manifest: Manifest = {
    generated_at: new Date().toISOString(),
    total: entries.length,
    images: entries,
  };

  fs.writeFileSync(
    path.join(dataDir, "index.json"),
    JSON.stringify(manifest, null, 2)
  );
}

export function writeSidecar(distDir: string, image: ImageRecord): void {
  const dataDir = path.join(distDir, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const analysis = image.analysis_result
    ? (JSON.parse(image.analysis_result) as AnalysisResult)
    : null;

  const sidecar: Sidecar = {
    filename: image.filename,
    file_size_bytes: image.file_size_bytes,
    width: image.width,
    height: image.height,
    exif_camera: image.exif_camera,
    exif_date_taken: image.exif_date_taken,
    exif_gps_lat: image.exif_gps_lat,
    exif_gps_lon: image.exif_gps_lon,
    created_at: image.created_at,
    analysis,
  };

  fs.writeFileSync(
    path.join(dataDir, `${image.filename}.json`),
    JSON.stringify(sidecar, null, 2)
  );
}

export function copyImage(
  distDir: string,
  imageDir: string,
  filename: string
): void {
  const photosDir = path.join(distDir, "photos");
  fs.mkdirSync(photosDir, { recursive: true });
  fs.copyFileSync(
    path.join(imageDir, filename),
    path.join(photosDir, filename)
  );
}

export function copyStatic(distDir: string, staticDir: string): void {
  fs.copyFileSync(
    path.join(staticDir, "index.html"),
    path.join(distDir, "index.html")
  );
  fs.copyFileSync(
    path.join(staticDir, "app.js"),
    path.join(distDir, "app.js")
  );
  const cssDir = path.join(distDir, "css");
  fs.mkdirSync(cssDir, { recursive: true });
  fs.copyFileSync(
    path.join(staticDir, "css", "styles.css"),
    path.join(cssDir, "styles.css")
  );
}
```

**Step 4: Run tests to verify they pass**

```bash
npx tsx --test src/export/writer.test.ts
```

Expected output:
```
▶ writeManifest creates data/index.json with correct shape
  ✔ writeManifest creates data/index.json with correct shape (Xms)
▶ writeSidecar creates data/<filename>.json omitting pipeline fields
  ✔ writeSidecar creates data/<filename>.json omitting pipeline fields (Xms)
▶ copyImage copies a file to dist/photos/
  ✔ copyImage copies a file to dist/photos/ (Xms)
▶ copyStatic copies index.html, app.js, and css/styles.css
  ✔ copyStatic copies index.html, app.js, and css/styles.css (Xms)
```

**Step 5: Commit**

```bash
git add src/export/writer.ts src/export/writer.test.ts
git commit -m "Add export writer module with unit tests"
```

---

### Task 3: Create `src/export/index.ts` (CLI entry point)

**Files:**
- Create: `src/export/index.ts`

**Step 1: Create the file**

```typescript
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { getDb } from "../db/connection.js";
import { config } from "../config.js";
import type { ImageRecord } from "../types.js";
import {
  writeManifest,
  writeSidecar,
  copyImage,
  copyStatic,
} from "./writer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const distDir = path.join(projectRoot, "dist");
const staticDir = path.join(projectRoot, "src", "static");

async function main(): Promise<void> {
  console.log("Exporting static site...\n");

  // 1. Clean and recreate dist/
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true });
  }
  fs.mkdirSync(distDir);

  // 2. Copy static SPA assets
  copyStatic(distDir, staticDir);
  console.log("Copied static assets.");

  // 3. Read all images from DB
  const db = getDb();
  const images = db
    .prepare("SELECT * FROM images ORDER BY created_at DESC")
    .all() as ImageRecord[];
  console.log(`Found ${images.length} image(s) in database.`);

  // 4. Write gallery manifest
  writeManifest(distDir, images);
  console.log("Written dist/data/index.json.");

  // 5. Write sidecars and copy image files
  let exported = 0;
  let errors = 0;
  for (const image of images) {
    try {
      writeSidecar(distDir, image);
      copyImage(distDir, config.IMAGE_DIR, image.filename);
      exported++;
    } catch (err) {
      console.error(
        `  ✗ ${image.filename}: ${(err as Error).message}`
      );
      errors++;
    }
  }

  console.log(
    `\nExport complete: ${exported} image(s) exported, ${errors} error(s).`
  );
  console.log(`Output: ${distDir}`);
}

main().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});
```

**Step 2: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/export/index.ts
git commit -m "Add export CLI entry point"
```

---

### Task 4: Wire up `npm run export` in `package.json`

**Files:**
- Modify: `package.json`

**Step 1: Replace the `web` script with `export`**

In `package.json`, change:
```json
"web": "tsx src/web/index.ts",
```
to:
```json
"export": "tsx src/export/index.ts",
```

**Step 2: Run a quick smoke test**

```bash
npm run export
```

Expected output (with a populated database and `IMAGE_DIR` set in `.env`):
```
Exporting static site...

Copied static assets.
Found N image(s) in database.
Written dist/data/index.json.

Export complete: N image(s) exported, 0 error(s).
Output: /path/to/photo-analyser/dist
```

Verify the output structure:
```bash
ls dist/
# index.html  app.js  css/  data/  photos/

ls dist/data/ | head -5
# index.json
# photo1.jpg.json
# photo2.jpg.json
# ...
```

Open `dist/index.html` in a browser (via `npx serve dist`) and verify the gallery loads.

**Step 3: Commit**

```bash
git add package.json
git commit -m "Replace web script with export script in package.json"
```

---

### Task 5: Remove Express/EJS web module and `public/` directory

**Files:**
- Delete: `src/web/` (entire directory)
- Delete: `public/` (entire directory)
- Modify: `package.json` — remove express, ejs and their type packages

**Step 1: Delete the old web module and static assets**

```bash
rm -rf src/web/ public/
```

**Step 2: Remove Express and EJS from `package.json`**

In `package.json`, remove from `"dependencies"`:
- `"ejs": "^3.1.10"`
- `"express": "^4.21.2"`

Remove from `"devDependencies"`:
- `"@types/ejs": "^3.1.5"`
- `"@types/express": "^5.0.0"`

Also remove `"WEB_PORT"` from `src/config.ts` — the export script doesn't need it:

In `src/config.ts`, remove the line:
```typescript
  WEB_PORT: parseInt(process.env.WEB_PORT || "3000", 10),
```

**Step 3: Uninstall removed packages**

```bash
npm uninstall express ejs @types/express @types/ejs
```

Expected: `package.json` and `package-lock.json` updated, `node_modules` cleaned.

**Step 4: Verify TypeScript still compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 5: Run the tests again to confirm nothing broke**

```bash
npx tsx --test src/export/writer.test.ts
```

Expected: 4 tests pass.

**Step 6: Commit**

```bash
git add -A
git commit -m "Remove Express/EJS web server and public/ directory"
```

---

### Task 6: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update the Tech Stack section**

Change:
```
- **Frontend:** Express + EJS server-rendered templates
```
to:
```
- **Frontend:** Vanilla JS single-page app (static, no framework)
```

**Step 2: Update the Architecture section**

Replace the three-module description:

Old:
```
Three independent CLI modules:

- **IMS** (`npm run ims`) — ...
- **BIA** (`npm run bia`) — ...
- **Web** (`npm run web`) — Express server at `localhost:3000` showing gallery and detail views
```

New:
```
Three independent CLI modules:

- **IMS** (`npm run ims`) — Image Metadata Synchroniser: scans `IMAGE_DIR`, extracts EXIF, resizes to ≤800×800 JPEG, uploads to Anthropic Files API, stores metadata in SQLite
- **BIA** (`npm run bia`) — Batch Image Analyser: submits uploaded images to Anthropic Message Batches API, polls for completion, parses results into DB
- **Export** (`npm run export`) — Static Site Exporter: reads SQLite, writes JSON sidecars + gallery manifest, copies images, emits a self-contained `dist/` directory
```

**Step 3: Update the Project Structure section**

Replace `src/web/` with:
```
src/
├── ...
├── export/            # Static Site Exporter
│   ├── index.ts       # CLI entry point / orchestrator
│   └── writer.ts      # JSON sidecar writing, file copying
└── static/            # Browser-side SPA source files
    ├── index.html     # SPA shell
    ├── app.js         # Vanilla JS SPA
    └── css/
        └── styles.css # Stylesheet
```

**Step 4: Update the Commands section**

Replace:
```
npm run web          # Start web UI on localhost:3000
```
with:
```
npm run export       # Generate dist/ static site from database
```

**Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "Update CLAUDE.md for static site migration"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `npx tsc --noEmit` — no TypeScript errors
- [ ] `npx tsx --test src/export/writer.test.ts` — 4 tests pass
- [ ] `npm run export` — completes without errors, produces `dist/`
- [ ] `npx serve dist` → open browser → gallery loads, sort works, clicking a card opens detail, prev/next navigation works
- [ ] `src/web/` does not exist
- [ ] `public/` does not exist
- [ ] `express` and `ejs` not in `package.json`
