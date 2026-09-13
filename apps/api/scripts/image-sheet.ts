// Contact sheet (before | after) of the seed image pipeline for Commons photos.
// usage: pnpm exec tsx --env-file=.env scripts/image-sheet.ts <out.png>
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import seed from "../src/db/seed-images.json" with { type: "json" };
import { processImage } from "../src/lib/images";

const out = process.argv[2]!;
const groups = ["hortifruti", "acougue"] as const;
const tiles: Buffer[] = [];
for (const g of groups) {
  for (const e of (seed as any)[g] as { i: number; name: string; img: string }[]) {
    const res = await fetch(e.img, { headers: { "User-Agent": "AIONIX-market-seed/1.0 (contact: dev@aionix.market)" } });
    const buf = Buffer.from(await res.arrayBuffer());
    // White tiles mimic the product card (the plate defect is invisible on an off-white canvas).
    const before = await sharp(buf).flatten({ background: "#fff" }).resize(200, 200, { fit: "contain", background: "#fff" }).png().toBuffer();
    const r = await processImage(buf, { maxSize: 1000, trim: true });
    const after = await sharp(r.data).resize(200, 200, { fit: "contain", background: "#fff" }).png().toBuffer();
    tiles.push(await sharp({ create: { width: 400, height: 200, channels: 3, background: "#fff" } }).composite([{ input: before, left: 0, top: 0 }, { input: after, left: 200, top: 0 }]).png().toBuffer());
    console.log(g, e.i, e.name, r.background);
    await new Promise((r) => setTimeout(r, 400));
  }
}
const cols = 3;
const rows = Math.ceil(tiles.length / cols);
const sheet = await sharp({ create: { width: 400 * cols, height: 200 * rows, channels: 3, background: "#f6f4ee" } })
  .composite(tiles.map((t, i) => ({ input: t, left: (i % cols) * 400, top: Math.floor(i / cols) * 200 })))
  .png()
  .toBuffer();
writeFileSync(out, sheet);
