import { getDb } from "./connection.js";

export function initSchema(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS images (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      full_path       TEXT NOT NULL UNIQUE,
      filename        TEXT NOT NULL,
      file_size_bytes INTEGER,
      file_modified_at TEXT NOT NULL,
      mime_type       TEXT,
      width           INTEGER,
      height          INTEGER,
      exif_camera     TEXT,
      exif_date_taken TEXT,
      exif_gps_lat    REAL,
      exif_gps_lon    REAL,
      upload_file_id  TEXT,
      uploaded_at     TEXT,
      batch_id        TEXT,
      batch_custom_id TEXT,
      processed       INTEGER NOT NULL DEFAULT 0,
      analysis_result TEXT,
      processed_at    TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_images_upload_file_id ON images(upload_file_id);
    CREATE INDEX IF NOT EXISTS idx_images_processed ON images(processed);
    CREATE INDEX IF NOT EXISTS idx_images_full_path ON images(full_path);
  `);
}
