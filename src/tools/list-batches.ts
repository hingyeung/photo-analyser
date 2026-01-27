import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

console.log("Fetching message batches from Anthropic API...\n");
console.log(
  "ID".padEnd(36) +
    "Status".padEnd(16) +
    "Created At".padEnd(28) +
    "Succeeded".padEnd(12) +
    "Errored".padEnd(10) +
    "Expired".padEnd(10) +
    "Cancelled".padEnd(12) +
    "Processing"
);
console.log("-".repeat(134));

let total = 0;
let inProgress = 0;
let ended = 0;
let cancelling = 0;

for await (const batch of client.beta.messages.batches.list()) {
  const rc = batch.request_counts;
  const status = batch.processing_status;

  const prefix = status === "in_progress" ? ">>> " : "    ";
  const line =
    batch.id.padEnd(36) +
    status.padEnd(16) +
    batch.created_at.padEnd(28) +
    String(rc.succeeded).padEnd(12) +
    String(rc.errored).padEnd(10) +
    String(rc.expired).padEnd(10) +
    String(rc.canceled).padEnd(12) +
    String(rc.processing);

  console.log(prefix + line);

  total++;
  if (status === "in_progress") inProgress++;
  else if (status === "ended") ended++;
  else if (status === "canceling") cancelling++;
}

console.log("-".repeat(134));

if (total === 0) {
  console.log("\nNo batches found.");
} else {
  console.log(
    `\nTotal: ${total} | In progress: ${inProgress} | Ended: ${ended} | Cancelling: ${cancelling}`
  );
  if (inProgress > 0) {
    console.log(`\n>>> ${inProgress} batch(es) currently in progress`);
  }
}
