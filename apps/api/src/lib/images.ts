import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { db, schema } from "../db/client";
import { badRequest } from "./http";
import { putObject } from "./storage";

export interface StoredImage {
  id: string;
  key: string;
  url: string;
  width: number;
  height: number;
  sizeBytes: number;
  blurDataUrl: string;
}

/**
 * Averages a 6px patch at each corner. Returns the [r,g,b] background when all
 * four corners agree (uniform sweep) and are light but not already white.
 */
async function sampleBackground(input: Buffer): Promise<[number, number, number] | null> {
  const size = 96;
  const { data, info } = await sharp(input, { failOn: "none" })
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize(size, size, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const patch = 6;
  const corners = [
    [0, 0],
    [info.width - patch, 0],
    [0, info.height - patch],
    [info.width - patch, info.height - patch],
  ];
  const samples = corners.map(([x0, y0]) => {
    const acc: [number, number, number] = [0, 0, 0];
    for (let y = y0!; y < y0! + patch; y++) {
      for (let x = x0!; x < x0! + patch; x++) {
        const i = (y * info.width + x) * info.channels;
        acc[0] += data[i]!;
        acc[1] += data[i + 1]!;
        acc[2] += data[i + 2]!;
      }
    }
    return acc.map((v) => v / (patch * patch));
  });
  const mean = [0, 1, 2].map((c) => samples.reduce((s, p) => s + p[c]!, 0) / 4) as [number, number, number];
  const uniform = samples.every((p) => p.every((v, c) => Math.abs(v - mean[c]!) < 18));
  const luma = 0.2126 * mean[0] + 0.7152 * mean[1] + 0.0722 * mean[2];
  const chroma = Math.max(...mean) - Math.min(...mean);
  if (!uniform || luma < 175 || luma > 253 || chroma > 30) return null;
  return mean.map(Math.round) as [number, number, number];
}

/**
 * Normalizes any uploaded image into an optimized WebP (max 1200px, EXIF-rotated)
 * plus a tiny blur placeholder, stores it and records it in the media library.
 */
export async function storeImage(input: Buffer, opts: ProcessOptions = {}): Promise<StoredImage> {
  const { data, info, blurDataUrl } = await processImage(input, opts);
  const key = `${new Date().getUTCFullYear()}/${randomUUID()}.webp`;
  await putObject(key, data, "image/webp");
  // Origin-relative: both frontends proxy /api/* to this service, so the same
  // URL resolves on localhost, previews and production.
  const url = `/api/media/${key}`;
  const [row] = await db
    .insert(schema.media)
    .values({ key, url, mime: "image/webp", width: info.width, height: info.height, sizeBytes: data.length, blurDataUrl })
    .returning({ id: schema.media.id });
  return { id: row!.id, key, url, width: info.width, height: info.height, sizeBytes: data.length, blurDataUrl };
}

export interface ProcessOptions {
  maxSize?: number;
  trim?: boolean;
}

/** Pure image normalization (no storage/DB) so it can be exercised in isolation. */
export async function processImage(input: Buffer, opts: ProcessOptions = {}) {
  let pipeline = sharp(input, { failOn: "none" }).rotate();
  try {
    const meta = await pipeline.metadata();
    if (!meta.width || !meta.height) throw new Error("no dimensions");
  } catch {
    throw badRequest("Arquivo de imagem inválido");
  }
  let gain: number[] | null = null;
  if (opts.trim) {
    // Product shots on a light studio sweep (grey/off-white) render as a visible
    // plate inside cards. Detect a uniform light background from the corners,
    // trim against it and push it to pure white so the card blends cleanly.
    const bg = await sampleBackground(input);
    if (bg) {
      pipeline = pipeline.trim({ background: bg, threshold: 28 });
      gain = bg.map((c) => Math.min(1.3, 255 / Math.max(1, c)));
    } else {
      pipeline = pipeline.trim({ threshold: 12 });
    }
  }
  const max = opts.maxSize ?? 1200;
  if (gain) pipeline = pipeline.linear(gain, [0, 0, 0]);
  const { data, info } = await pipeline
    .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .webp({ quality: 82, effort: 5 })
    .toBuffer({ resolveWithObject: true });

  const blur = await sharp(data).resize(16, 16, { fit: "inside" }).webp({ quality: 45 }).toBuffer();
  const blurDataUrl = `data:image/webp;base64,${blur.toString("base64")}`;
  return { data, info, blurDataUrl, background: gain ? "whitened" : "kept" };
}
