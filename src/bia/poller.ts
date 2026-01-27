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
    let status;
    try {
      status = await anthropic.beta.messages.batches.retrieve(batchId);
    } catch (err: any) {
      console.error(`Failed to retrieve batch ${batchId}:`);
      if (err.status) console.error(`  HTTP status: ${err.status}`);
      if (err.error) console.error(`  API error:`, JSON.stringify(err.error, null, 2));
      else console.error(`  Error:`, err.message ?? err);
      throw err;
    }

    while (status.processing_status !== "ended") {
      console.log(
        `Batch ${batchId}: ${status.processing_status} — waiting ${config.POLL_INTERVAL_MS / 1000}s...`
      );
      await new Promise((r) => setTimeout(r, config.POLL_INTERVAL_MS));
      try {
        status = await anthropic.beta.messages.batches.retrieve(batchId);
      } catch (err: any) {
        console.error(`Failed to poll batch ${batchId}:`);
        if (err.status) console.error(`  HTTP status: ${err.status}`);
        if (err.error) console.error(`  API error:`, JSON.stringify(err.error, null, 2));
        else console.error(`  Error:`, err.message ?? err);
        throw err;
      }
    }

    const counts = status.request_counts;
    console.log(
      `Batch ${batchId}: ended — ${counts.succeeded} succeeded, ${counts.errored} errored, ${counts.expired} expired, ${counts.canceled} canceled`
    );
    completedBatchIds.push(batchId);
  }

  return completedBatchIds;
}
