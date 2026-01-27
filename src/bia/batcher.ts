import Anthropic from "@anthropic-ai/sdk";
import type { BatchCreateParams } from "@anthropic-ai/sdk/resources/beta/messages/batches.js";
import { getDb } from "../db/connection.js";
import { config } from "../config.js";
import { ANALYSIS_SYSTEM_PROMPT } from "./prompt.js";
import type { ImageRecord } from "../types.js";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  }
  return client;
}

export async function submitBatches(): Promise<string[]> {
  const db = getDb();

  const images = db
    .prepare(
      "SELECT * FROM images WHERE upload_file_id IS NOT NULL AND processed = 0 AND batch_id IS NULL"
    )
    .all() as ImageRecord[];

  if (images.length === 0) {
    console.log("No unprocessed images to submit.");
    return [];
  }

  console.log(`Found ${images.length} image(s) to submit for analysis`);

  const batchIds: string[] = [];

  // Split into chunks of BATCH_SIZE
  for (let i = 0; i < images.length; i += config.BATCH_SIZE) {
    const chunk = images.slice(i, i + config.BATCH_SIZE);

    const requests: BatchCreateParams.Request[] = chunk.map((img) => ({
      custom_id: `img-${img.id}`,
      params: {
        model: config.MODEL,
        max_tokens: 1024,
        system: ANALYSIS_SYSTEM_PROMPT,
        messages: [
          {
            role: "user" as const,
            content: [
              {
                type: "image" as const,
                source: {
                  type: "file" as const,
                  file_id: img.upload_file_id!,
                },
              },
              {
                type: "text" as const,
                text: "Please analyse this photograph.",
              },
            ],
          },
        ],
      },
    }));

    const chunkNum = Math.floor(i / config.BATCH_SIZE) + 1;
    const anthropic = getClient();

    let batch;
    try {
      batch = await anthropic.beta.messages.batches.create({
        requests,
        betas: ["files-api-2025-04-14"],
      });
    } catch (err: any) {
      const fileIds = chunk.slice(0, 3).map((img) => img.upload_file_id);
      console.error(
        `Failed to create batch (chunk ${chunkNum}, ${chunk.length} images)`
      );
      console.error(`  File IDs (first ${Math.min(3, chunk.length)}): ${fileIds.join(", ")}`);
      console.error(`  Model: ${config.MODEL}`);
      if (err.status) console.error(`  HTTP status: ${err.status}`);
      if (err.error) console.error(`  API error:`, JSON.stringify(err.error, null, 2));
      else console.error(`  Error:`, err.message ?? err);
      throw err;
    }

    console.log(
      `Batch submitted: ${batch.id} (${chunk.length} images, chunk ${chunkNum})`
    );

    // Store batch_id against each image
    const updateStmt = db.prepare(
      "UPDATE images SET batch_id = ?, batch_custom_id = ?, updated_at = datetime('now') WHERE id = ?"
    );
    for (const img of chunk) {
      updateStmt.run(batch.id, `img-${img.id}`, img.id);
    }

    batchIds.push(batch.id);
  }

  return batchIds;
}
