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
