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
