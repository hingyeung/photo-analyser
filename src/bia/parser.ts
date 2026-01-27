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

    let results;
    try {
      results = await anthropic.beta.messages.batches.results(batchId);
    } catch (err: any) {
      console.error(`Failed to fetch results for batch ${batchId}:`);
      if (err.status) console.error(`  HTTP status: ${err.status}`);
      if (err.error) console.error(`  API error:`, JSON.stringify(err.error, null, 2));
      else console.error(`  Error:`, err.message ?? err);
      throw err;
    }

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
          const content = entry.result.message.content[0];
          const rawText = content.type === "text" ? content.text : JSON.stringify(content);
          console.error(`  ✗ ${customId}: failed to parse result`);
          console.error(`    Raw response: ${rawText.substring(0, 500)}`);
          console.error(`    Parse error:`, err instanceof Error ? err.message : err);
        }
      } else if (entry.result.type === "errored") {
        errorCount++;
        const apiError = entry.result.error;
        console.error(`  ✗ ${customId}: errored — ${apiError.error.type}: ${apiError.error.message}`);
      } else if (entry.result.type === "expired") {
        errorCount++;
        console.error(`  ✗ ${customId}: expired (request was not processed before batch expiry)`);
      } else if (entry.result.type === "canceled") {
        errorCount++;
        console.error(`  ✗ ${customId}: canceled`);
      }
    }

    console.log(
      `Batch ${batchId}: ${successCount} succeeded, ${errorCount} errors`
    );
  }
}
