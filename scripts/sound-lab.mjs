// Objective quality gate for the AIONIX sound kit (renders the REAL bundle offline):
//   node scripts/sound-lab.mjs http://localhost:3001 out/sounds
// For every sound: no clipping (peak < −1 dBFS), no DC, bounded length, and
// loudness inside its priority band so the kit is level-matched. Writes a WAV
// per sound so a human can listen.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const [, , adminUrl = "http://localhost:3001", out = "out/sounds"] = process.argv;
mkdirSync(out, { recursive: true });
const env = readFileSync("apps/api/.env", "utf8");
const ADMIN_PASSWORD = env.match(/^ADMIN_PASSWORD=(.+)$/m)[1].trim();

// Loudness (loudest 50 ms RMS, dBFS) band and max length per priority.
const BANDS = {
  1: { lo: -32, hi: -17, maxS: 0.45, label: "micro" },
  2: { lo: -28, hi: -13, maxS: 1.5, label: "feedback" },
  3: { lo: -26, hi: -11, maxS: 1.9, label: "commerce" },
  4: { lo: -24, hi: -9, maxS: 2.9, label: "celebration" },
  5: { lo: -21, hi: -7, maxS: 2.7, label: "alert" },
};

const browser = await chromium.launch();
const failures = [];
try {
  const ctx = await browser.newContext();
  await ctx.request.post(`${adminUrl}/api/auth/login`, { data: { email: "admin@aionix.market", password: ADMIN_PASSWORD, scope: "admin" } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${adminUrl}/configuracoes/sons`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__aionixSoundLab, null, { timeout: 30000 });
  const { names, meta } = await page.evaluate(() => ({ names: window.__aionixSoundLab.names, meta: window.__aionixSoundLab.meta }));

  const rows = [];
  for (const name of names) {
    const r = await page.evaluate((n) => window.__aionixSoundLab.run(n), name);
    writeFileSync(`${out}/${name}.wav`, Buffer.from(r.wav, "base64"));
    const band = BANDS[meta[name].priority];
    const issues = [];
    if (r.peakDb > -1) issues.push(`clips (peak ${r.peakDb.toFixed(1)} dBFS)`);
    if (Math.abs(r.dcOffset) > 0.003) issues.push(`DC ${r.dcOffset.toFixed(4)}`);
    if (r.durationS > band.maxS) issues.push(`too long ${r.durationS.toFixed(2)}s > ${band.maxS}s`);
    if (r.loudnessDb < band.lo) issues.push(`too quiet ${r.loudnessDb.toFixed(1)} < ${band.lo}`);
    if (r.loudnessDb > band.hi) issues.push(`too loud ${r.loudnessDb.toFixed(1)} > ${band.hi}`);
    if (r.brightness > 0.12) issues.push(`harsh (bright ${r.brightness.toFixed(3)})`);
    rows.push({ name, prio: meta[name].priority, ...r, issues });
    if (issues.length) failures.push(`${name}: ${issues.join(", ")}`);
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad("sound", 17) + pad("prio", 13) + pad("peak", 8) + pad("loud", 8) + pad("len", 7) + pad("bright", 8) + "status");
  for (const r of rows) {
    console.log(
      pad(r.name, 17) + pad(`${r.prio} ${BANDS[r.prio].label}`, 13) + pad(r.peakDb.toFixed(1), 8) + pad(r.loudnessDb.toFixed(1), 8) + pad(r.durationS.toFixed(2), 7) + pad(r.brightness.toFixed(3), 8) + (r.issues.length ? "✗ " + r.issues.join("; ") : "✓"),
    );
  }
  for (const p of [1, 2, 3, 4, 5]) {
    const l = rows.filter((r) => r.prio === p).map((r) => r.loudnessDb);
    if (l.length > 1) console.log(`  priority ${p}: loudness spread ${(Math.max(...l) - Math.min(...l)).toFixed(1)} dB over ${l.length} sounds`);
  }
  assert.equal(errors.length, 0, errors.join("\n"));
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(`\n✗ ${failures.length} sound(s) outside the quality gate:\n  ` + failures.join("\n  "));
  process.exit(1);
}
console.log(`\n✓ sound lab passed — WAVs in ${out}/`);
