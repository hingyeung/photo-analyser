import { initSchema } from "../db/schema.js";
import { getDb } from "../db/connection.js";
import type { ImageRecord, AnalysisResult } from "../types.js";

initSchema();

const db = getDb();
const rows = db.prepare("SELECT * FROM images ORDER BY id").all() as ImageRecord[];

if (rows.length === 0) {
  console.log("No images found in the database.");
  process.exit(0);
}

// Print header
console.log(
  "ID".padEnd(6) +
  "Filename".padEnd(40) +
  "Dimensions".padEnd(14) +
  "Upload File ID".padEnd(24) +
  "Processed".padEnd(12) +
  "Impact"
);
console.log("-".repeat(102));

// Print rows
for (const row of rows) {
  const dimensions = row.width && row.height ? `${row.width}x${row.height}` : "\u2014";
  const uploadId = row.upload_file_id ? row.upload_file_id.slice(0, 20) : "\u2014";
  const processed = row.processed ? "Yes" : "No";

  let impact: string = "\u2014";
  if (row.analysis_result) {
    try {
      const analysis = JSON.parse(row.analysis_result) as AnalysisResult;
      impact = String(analysis.overall_impact);
    } catch {
      impact = "err";
    }
  }

  console.log(
    String(row.id).padEnd(6) +
    row.filename.slice(0, 38).padEnd(40) +
    dimensions.padEnd(14) +
    uploadId.padEnd(24) +
    processed.padEnd(12) +
    impact
  );
}

// Summary
console.log("-".repeat(102));
const uploaded = rows.filter((r) => r.upload_file_id !== null).length;
const processedCount = rows.filter((r) => r.processed === 1).length;
console.log(`Total: ${rows.length} | Uploaded: ${uploaded} | Analysed: ${processedCount}`);
