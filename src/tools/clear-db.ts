import { initSchema } from "../db/schema.js";
import { getDb } from "../db/connection.js";

initSchema();

const db = getDb();
const resetAnalysis = process.argv.includes("--reset-analysis");

if (resetAnalysis) {
  const result = db
    .prepare(
      `UPDATE images
         SET batch_id = NULL,
             batch_custom_id = NULL,
             processed = 0,
             analysis_result = NULL,
             processed_at = NULL`
    )
    .run();

  console.log(`Cleared analysis data for ${result.changes} image(s).`);
} else {
  const result = db.prepare("DELETE FROM images").run();
  console.log(`Deleted ${result.changes} image(s) from database.`);
}
