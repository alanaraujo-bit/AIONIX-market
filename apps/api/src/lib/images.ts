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
 * Normalizes any uploaded image into an optimized WebP (max 1200px, EXIF-rotated)
 * plus a tiny blur placeholder, stores it and records it in the media library.
 */
export async function storeImage(input: Buffer, opts: { maxSize?: number; trim?: boolean } = {}): Promise<StoredImage> {
  let pipeline = sharp(input, { failOn: "none" }).rotate();
  try {
    const meta = await pipeline.metadata();
    if (!meta.width || !meta.height) throw new Error("no dimensions");
  } catch {
    throw badRequest("Arquivo de imagem inválido");
  }
  if (opts.trim) pipeline = pipeline.trim({ threshold: 12 });
  const max = opts.maxSize ?? 1200;
  const { data, info } = await pipeline
    .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .webp({ quality: 82, effort: 5 })
    .toBuffer({ resolveWithObject: true });

  const blur = await sharp(data).resize(16, 16, { fit: "inside" }).webp({ quality: 45 }).toBuffer();
  const blurDataUrl = `data:image/webp;base64,${blur.toString("base64")}`;

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
