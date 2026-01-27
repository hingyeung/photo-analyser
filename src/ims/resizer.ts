import sharp from "sharp";
import fs from "node:fs";

export async function resizeImage(filePath: string): Promise<Buffer> {
  const buffer = fs.readFileSync(filePath);
  return sharp(buffer)
    .resize(800, 800, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 70 })
    .toBuffer();
}
