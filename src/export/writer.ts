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
