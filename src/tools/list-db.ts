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

const detailMode = process.argv.includes("--detail") || process.argv.includes("-d");

if (detailMode) {
  printDetail(rows);
} else {
  printTable(rows);
}

// Summary
const separator = detailMode ? "\u2501".repeat(56) : "-".repeat(102);
console.log(separator);
const uploaded = rows.filter((r) => r.upload_file_id !== null).length;
const processedCount = rows.filter((r) => r.processed === 1).length;
console.log(`Total: ${rows.length} | Uploaded: ${uploaded} | Analysed: ${processedCount}`);

function printTable(rows: ImageRecord[]) {
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
}

function printDetail(rows: ImageRecord[]) {
  const line = "\u2501".repeat(56);

  for (const row of rows) {
    console.log(line);

    const dims = row.width && row.height ? `${row.width}x${row.height}` : "";
    const camera = row.exif_camera ?? "";
    const meta = [dims, camera].filter(Boolean).join(", ");
    const header = meta ? `[${row.id}] ${row.filename}  (${meta})` : `[${row.id}] ${row.filename}`;
    console.log(header);

    if (!row.analysis_result) {
      console.log("\n  (analysis not yet available)\n");
      continue;
    }

    let analysis: AnalysisResult;
    try {
      analysis = JSON.parse(row.analysis_result) as AnalysisResult;
    } catch {
      console.log("\n  (analysis result could not be parsed)\n");
      continue;
    }

    const scores: [string, number][] = [
      ["Composition", analysis.composition],
      ["Lighting", analysis.lighting],
      ["Colour & Tone", analysis.color_and_tone],
      ["Subject & Storytelling", analysis.subject_storytelling],
      ["Technical Execution", analysis.technical_execution],
      ["Overall Impact", analysis.overall_impact],
    ];

    console.log("\n  Scores:");
    for (const [label, score] of scores) {
      const dots = ".".repeat(Math.max(1, 26 - label.length));
      console.log(`    ${label} ${dots} ${score}`);
    }

    console.log(`\n  Comment:  ${analysis.comment}`);
    console.log(`  Caption:  ${analysis.caption}`);
    console.log(`  Keywords: ${analysis.keywords.join(", ")}`);
    console.log();
  }
}
