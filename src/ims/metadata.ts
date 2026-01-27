import fs from "node:fs";
import ExifReader from "exifreader";
import sharp from "sharp";

export interface ImageMetadata {
  width: number | null;
  height: number | null;
  mimeType: string | null;
  exifCamera: string | null;
  exifDateTaken: string | null;
  exifGpsLat: number | null;
  exifGpsLon: number | null;
}

export async function extractMetadata(filePath: string): Promise<ImageMetadata> {
  const buffer = fs.readFileSync(filePath);

  // Dimensions and format via sharp
  const sharpMeta = await sharp(buffer).metadata();
  const width = sharpMeta.width ?? null;
  const height = sharpMeta.height ?? null;

  const formatToMime: Record<string, string> = {
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  const mimeType = sharpMeta.format ? (formatToMime[sharpMeta.format] ?? null) : null;

  // EXIF via exifreader
  let exifCamera: string | null = null;
  let exifDateTaken: string | null = null;
  let exifGpsLat: number | null = null;
  let exifGpsLon: number | null = null;

  try {
    const tags = ExifReader.load(buffer);

    const make = tags.Make?.description ?? "";
    const model = tags.Model?.description ?? "";
    exifCamera = [make, model].filter(Boolean).join(" ") || null;

    exifDateTaken = tags.DateTimeOriginal?.description ?? tags.DateTime?.description ?? null;

    if (tags.GPSLatitude && tags.GPSLongitude) {
      exifGpsLat = parseFloat(String(tags.GPSLatitude.description));
      exifGpsLon = parseFloat(String(tags.GPSLongitude.description));
      if (isNaN(exifGpsLat)) exifGpsLat = null;
      if (isNaN(exifGpsLon)) exifGpsLon = null;
    }
  } catch {
    // EXIF extraction is best-effort
  }

  return { width, height, mimeType, exifCamera, exifDateTaken, exifGpsLat, exifGpsLon };
}
