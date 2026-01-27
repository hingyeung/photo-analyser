import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

let count = 0;

console.log("Fetching files from Anthropic Files API...\n");
console.log(
  "ID".padEnd(32) +
    "Filename".padEnd(40) +
    "Size (bytes)".padEnd(16) +
    "Created At"
);
console.log("-".repeat(100));

for await (const file of client.beta.files.list()) {
  console.log(
    file.id.padEnd(32) +
      file.filename.padEnd(40) +
      String(file.size_bytes).padEnd(16) +
      file.created_at
  );
  count++;
}

console.log("-".repeat(100));
console.log(`\nTotal files: ${count}`);
