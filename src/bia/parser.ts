import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "../db/connection.js";
import { config } from "../config.js";
import type { AnalysisResult } from "../types.js";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  }
  return client;
}

export async function parseResults(batchIds: string[]): Promise<void> {
  const db = getDb();
  const anthropic = getClient();

  const updateStmt = db.prepare(
    "UPDATE images SET analysis_result = ?, processed = 1, processed_at = datetime('now'), updated_at = datetime('now') WHERE batch_custom_id = ? AND batch_id = ?"
  );

  for (const batchId of batchIds) {
    console.log(`Fetching results for batch ${batchId}...`);

    let successCount = 0;
    let errorCount = 0;

    const results = await anthropic.messages.batches.results(batchId);

    for await (const entry of results) {
      const customId = entry.custom_id;

      if (entry.result.type === "succeeded") {
        try {
          const content = entry.result.message.content[0];
          if (content.type === "text") {
            // Try to extract JSON from the response (handle possible markdown wrapping)
            let jsonText = content.text.trim();
            const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              jsonText = jsonMatch[0];
            }

            const analysis: AnalysisResult = JSON.parse(jsonText);
            updateStmt.run(JSON.stringify(analysis), customId, batchId);
            successCount++;
            console.log(`  ✓ ${customId}: overall_impact=${analysis.overall_impact}`);
          }
        } catch (err) {
          errorCount++;
          console.error(`  ✗ ${customId}: failed to parse result —`, err);
        }
      } else {
        errorCount++;
        console.error(`  ✗ ${customId}: result type=${entry.result.type}`);
      }
    }

    console.log(
      `Batch ${batchId}: ${successCount} succeeded, ${errorCount} errors`
    );
  }
}
