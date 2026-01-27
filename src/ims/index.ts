import { initSchema } from "../db/schema.js";
import { getDb } from "../db/connection.js";
import { scanForNewOrUpdatedImages } from "./scanner.js";
import { extractMetadata } from "./metadata.js";
import { resizeImage } from "./resizer.js";
import { uploadImage } from "./uploader.js";

async function main() {
  console.log("Image Metadata Synchroniser — starting");
  initSchema();
  const db = getDb();

  const filesToSync = await scanForNewOrUpdatedImages();
  console.log(`Found ${filesToSync.length} image(s) to sync`);

  if (filesToSync.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  const upsert = db.prepare(`
    INSERT INTO images (full_path, filename, file_size_bytes, file_modified_at, mime_type, width, height, exif_camera, exif_date_taken, exif_gps_lat, exif_gps_lon, upload_file_id, uploaded_at, updated_at)
    VALUES (@full_path, @filename, @file_size_bytes, @file_modified_at, @mime_type, @width, @height, @exif_camera, @exif_date_taken, @exif_gps_lat, @exif_gps_lon, @upload_file_id, @uploaded_at, datetime('now'))
    ON CONFLICT(full_path) DO UPDATE SET
      file_size_bytes = @file_size_bytes,
      file_modified_at = @file_modified_at,
      mime_type = @mime_type,
      width = @width,
      height = @height,
      exif_camera = @exif_camera,
      exif_date_taken = @exif_date_taken,
      exif_gps_lat = @exif_gps_lat,
      exif_gps_lon = @exif_gps_lon,
      upload_file_id = @upload_file_id,
      uploaded_at = @uploaded_at,
      processed = 0,
      analysis_result = NULL,
      processed_at = NULL,
      batch_id = NULL,
      batch_custom_id = NULL,
      updated_at = datetime('now')
  `);

  let successCount = 0;
  let errorCount = 0;

  for (const file of filesToSync) {
    try {
      console.log(`Processing: ${file.filename}`);

      const metadata = await extractMetadata(file.fullPath);
      const resizedBuffer = await resizeImage(file.fullPath);
      const uploadFileId = await uploadImage(resizedBuffer, file.filename);

      upsert.run({
        full_path: file.fullPath,
        filename: file.filename,
        file_size_bytes: file.fileSizeBytes,
        file_modified_at: file.fileModifiedAt,
        mime_type: metadata.mimeType,
        width: metadata.width,
        height: metadata.height,
        exif_camera: metadata.exifCamera,
        exif_date_taken: metadata.exifDateTaken,
        exif_gps_lat: metadata.exifGpsLat,
        exif_gps_lon: metadata.exifGpsLon,
        upload_file_id: uploadFileId,
        uploaded_at: new Date().toISOString(),
      });

      successCount++;
      console.log(`  ✓ Uploaded (file_id: ${uploadFileId})`);

      // Small delay to avoid rate limits
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      errorCount++;
      console.error(`  ✗ Error processing ${file.filename}:`, err);
    }
  }

  console.log(`\nDone. ${successCount} synced, ${errorCount} errors.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
