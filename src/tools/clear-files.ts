import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

console.log("Fetching files from Anthropic Files API...\n");

const files: { id: string; filename: string }[] = [];

for await (const file of client.beta.files.list()) {
  files.push({ id: file.id, filename: file.filename });
}

if (files.length === 0) {
  console.log("No files found. Nothing to delete.");
  process.exit(0);
}

console.log(`Found ${files.length} file(s). Deleting...\n`);

let deleted = 0;

for (const file of files) {
  try {
    await client.beta.files.delete(file.id);
    console.log(`Deleted ${file.id} (${file.filename})`);
    deleted++;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to delete ${file.id} (${file.filename}): ${message}`);
  }

  // Brief delay between deletions to avoid rate limits
  await new Promise((resolve) => setTimeout(resolve, 200));
}

console.log(`\nDone. Deleted ${deleted} file(s).`);
