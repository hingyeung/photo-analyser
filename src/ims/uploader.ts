import Anthropic, { toFile } from "@anthropic-ai/sdk";
import { config } from "../config.js";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  }
  return client;
}

export async function uploadImage(
  resizedBuffer: Buffer,
  filename: string
): Promise<string> {
  const anthropic = getClient();
  const file = await anthropic.beta.files.upload({
    file: await toFile(resizedBuffer, filename, { type: "image/jpeg" }),
  });
  return file.id;
}
