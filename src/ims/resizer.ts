import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import convert from "heic-convert";

async function toJpegBuffer(filePath: string): Promise<Buffer> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".heic" || ext === ".heif") {
    const inputBuffer = fs.readFileSync(filePath);
    const output = await convert({ buffer: inputBuffer as unknown as ArrayBuffer, format: "JPEG", quality: 1 });
    return Buffer.from(output);
  }
  return fs.readFileSync(filePath);
}

export async function resizeImage(filePath: string): Promise<Buffer> {
  const buffer = await toJpegBuffer(filePath);
  return sharp(buffer)
    .resize(800, 800, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 70 })
    .toBuffer();
}
