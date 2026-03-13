import "dotenv/config";
import path from "node:path";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  ANTHROPIC_API_KEY: requireEnv("ANTHROPIC_API_KEY"),
  IMAGE_DIR: path.resolve(requireEnv("IMAGE_DIR")),
  DB_PATH: path.resolve(process.env.DB_PATH || "./data/photo-analyser.db"),
  MODEL: process.env.MODEL || "claude-sonnet-4-5-20250929",
  BATCH_SIZE: parseInt(process.env.BATCH_SIZE || "50", 10),
  POLL_INTERVAL_MS: parseInt(process.env.POLL_INTERVAL_MS || "30000", 10),
  IMAGE_EXTENSIONS: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"],
} as const;
