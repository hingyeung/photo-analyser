import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";
import { getDb } from "../db/connection.js";
import { config } from "../config.js";

export interface FileToSync {
  fullPath: string;
  filename: string;
  fileSizeBytes: number;
  fileModifiedAt: string;
}

export async function scanForNewOrUpdatedImages(): Promise<FileToSync[]> {
  const db = getDb();
  const patterns = config.IMAGE_EXTENSIONS.map(
    (ext) => `**/*${ext}`
  );

  const files = await glob(patterns, {
    cwd: config.IMAGE_DIR,
    nocase: true,
    absolute: true,
  });

  const filesToSync: FileToSync[] = [];

  for (const fullPath of files) {
    const stat = fs.statSync(fullPath);
    const modifiedAt = stat.mtime.toISOString();

    const existing = db
      .prepare("SELECT file_modified_at, upload_file_id FROM images WHERE full_path = ?")
      .get(fullPath) as { file_modified_at: string; upload_file_id: string | null } | undefined;

    if (!existing || existing.file_modified_at !== modifiedAt || !existing.upload_file_id) {
      filesToSync.push({
        fullPath,
        filename: path.basename(fullPath),
        fileSizeBytes: stat.size,
        fileModifiedAt: modifiedAt,
      });
    }
  }

  return filesToSync;
}
