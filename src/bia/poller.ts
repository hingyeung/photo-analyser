import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "../db/connection.js";
import { config } from "../config.js";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  }
  return client;
}

export async function pollPendingBatches(): Promise<string[]> {
  const db = getDb();

  const rows = db
    .prepare(
      "SELECT DISTINCT batch_id FROM images WHERE batch_id IS NOT NULL AND processed = 0"
    )
    .all() as { batch_id: string }[];

  const pendingBatchIds = rows.map((r) => r.batch_id);

  if (pendingBatchIds.length === 0) {
    console.log("No pending batches to poll.");
    return [];
  }

  console.log(`Polling ${pendingBatchIds.length} pending batch(es)...`);
  const completedBatchIds: string[] = [];
  const anthropic = getClient();

  for (const batchId of pendingBatchIds) {
    let status = await anthropic.messages.batches.retrieve(batchId);

    while (status.processing_status !== "ended") {
      console.log(
        `Batch ${batchId}: ${status.processing_status} — waiting ${config.POLL_INTERVAL_MS / 1000}s...`
      );
      await new Promise((r) => setTimeout(r, config.POLL_INTERVAL_MS));
      status = await anthropic.messages.batches.retrieve(batchId);
    }

    console.log(`Batch ${batchId}: ended`);
    completedBatchIds.push(batchId);
  }

  return completedBatchIds;
}
