// Generates PWA icons (leaf mark on brand green) into apps/web/public/icons.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const sharp = createRequire("D:/PROJETOS/AIONIX market/apps/api/package.json")("sharp");

const out = "apps/web/public/icons";
mkdirSync(out, { recursive: true });

const svg = (size, pad, radius) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#13784f"/><stop offset="1" stop-color="#0b4f37"/>
    </linearGradient>
  </defs>
  <clipPath id="c"><rect width="512" height="512" rx="${radius}"/></clipPath>
  <g clip-path="url(#c)">
    <rect width="512" height="512" fill="url(#g)"/>
    <circle cx="392" cy="120" r="150" fill="#1f9a67" opacity="0.35"/>
  </g>
  <g transform="translate(256 256) scale(${1 - pad}) translate(-256 -256)">
    <path d="M140 380c0-150 90-240 250-248 8 166-80 256-250 248z" fill="#ffffff"/>
    <path d="M150 372c44-92 118-166 214-214" stroke="#0c5a3e" stroke-width="22" stroke-linecap="round" fill="none"/>
  </g>
</svg>`;

const jobs = [
  ["icon-192.png", 192, 0.1, 110],
  ["icon-512.png", 512, 0.1, 110],
  ["apple-touch-icon.png", 180, 0.1, 0],
  ["maskable-512.png", 512, 0.28, 0],
];
for (const [name, size, pad, radius] of jobs) {
  await sharp(Buffer.from(svg(size, pad, radius))).resize(size, size).png().toFile(`${out}/${name}`);
  console.log(name);
}
await sharp(Buffer.from(svg(64, 0.1, 110))).resize(64, 64).png().toFile("apps/web/src/app/icon.png");
await sharp(Buffer.from(svg(64, 0.1, 110))).resize(64, 64).png().toFile("apps/admin/src/app/icon.png");
console.log("favicons");
