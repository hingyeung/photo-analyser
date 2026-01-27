import Anthropic from "@anthropic-ai/sdk";
import type { BatchCreateParams } from "@anthropic-ai/sdk/resources/messages/batches.js";
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
                  type: "file",
                  file_id: img.upload_file_id!,
                },
              } as any,  // file_id source is supported by the API but not yet typed in the non-beta SDK
              {
                type: "text" as const,
                text: "Please analyse this photograph.",
              },
            ],
          },
        ],
      },
    }));

    const anthropic = getClient();
    const batch = await anthropic.messages.batches.create({ requests });

    console.log(
      `Batch submitted: ${batch.id} (${chunk.length} images, chunk ${Math.floor(i / config.BATCH_SIZE) + 1})`
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
