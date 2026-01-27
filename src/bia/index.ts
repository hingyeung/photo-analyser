import { initSchema } from "../db/schema.js";
import { submitBatches } from "./batcher.js";
import { pollPendingBatches } from "./poller.js";
import { parseResults } from "./parser.js";

async function main() {
  console.log("Batch Image Analyser — starting");
  initSchema();

  // Step 1: Submit any unprocessed images that haven't been batched yet
  await submitBatches();

  // Step 2: Poll all pending batches until they complete
  const completedBatchIds = await pollPendingBatches();

  // Step 3: Parse results for completed batches
  if (completedBatchIds.length > 0) {
    await parseResults(completedBatchIds);
  }

  console.log("Done.");
}

main().catch((err: any) => {
  console.error("Fatal error in Batch Image Analyser:");
  if (err.status) console.error(`  HTTP status: ${err.status}`);
  if (err.error) console.error(`  API error:`, JSON.stringify(err.error, null, 2));
  if (err.message) console.error(`  Message: ${err.message}`);
  if (!err.status && !err.error && !err.message) console.error(err);
  process.exit(1);
});
