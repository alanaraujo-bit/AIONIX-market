// Verifies PWA installability against a deployed origin.
// usage: node scripts/pwa-check.mjs https://aionix-market.vercel.app
import { chromium, devices } from "playwright";

const origin = (process.argv[2] ?? "https://aionix-market.vercel.app").replace(/\/$/, "");
let failed = 0;
const check = (ok, label, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failed++;
};

const manifestRes = await fetch(`${origin}/manifest.webmanifest`);
const ctype = manifestRes.headers.get("content-type") ?? "";
check(manifestRes.ok, "manifest 200", String(manifestRes.status));
check(/application\/manifest\+json/.test(ctype), "manifest content-type", ctype);
const manifest = await manifestRes.json();
check(manifest.display === "standalone", "display standalone", manifest.display);
check(manifest.start_url && manifest.name && manifest.short_name, "manifest name/start_url");
const has192 = manifest.icons?.some((i) => /192/.test(i.sizes));
const has512 = manifest.icons?.some((i) => /512/.test(i.sizes));
const maskable = manifest.icons?.some((i) => /maskable/.test(i.purpose ?? ""));
check(has192 && has512, "icons 192 + 512 declared");
check(maskable, "maskable icon declared");
for (const icon of manifest.icons ?? []) {
  const r = await fetch(new URL(icon.src, `${origin}/`));
  check(r.ok && (r.headers.get("content-type") ?? "").startsWith("image/"), `icon ${icon.src}`, `${r.status} ${r.headers.get("content-type")}`);
}
const sw = await fetch(`${origin}/sw.js`);
check(sw.ok && /javascript/.test(sw.headers.get("content-type") ?? ""), "sw.js served as JS", sw.headers.get("content-type") ?? "");
const offline = await fetch(`${origin}/offline.html`);
check(offline.ok, "offline.html 200", String(offline.status));

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "pt-BR" });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)));
await page.goto(origin, { waitUntil: "networkidle" });
const reg = await page.evaluate(async () => {
  const r = await navigator.serviceWorker?.ready;
  return r ? { scope: r.scope, state: r.active?.state } : null;
});
check(!!reg?.state, "service worker registered", JSON.stringify(reg));
const themeMeta = await page.locator('meta[name="theme-color"]').first().getAttribute("content");
check(!!themeMeta, "theme-color meta", themeMeta ?? "");
const capable = await page.locator('meta[name="mobile-web-app-capable"], meta[name="apple-mobile-web-app-capable"]').count();
check(capable >= 2, "web-app-capable metas (standard + apple)", String(capable));
const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
check(/user-scalable=no/.test(viewport ?? ""), "viewport locks zoom", viewport ?? "");

// Offline: navigate to a fresh route while offline → SW must serve offline.html
await page.goto(`${origin}/buscar`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await ctx.setOffline(true);
await page.goto(`${origin}/ofertas`).catch(() => {});
await page.waitForTimeout(500);
const offlineText = await page.locator("body").innerText().catch(() => "");
check(/offline|sem conex/i.test(offlineText), "offline fallback rendered", offlineText.replace(/\s+/g, " ").slice(0, 80));
await ctx.setOffline(false);

check(errors.length === 0, "no console errors", errors.join(" | "));
await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nAll PWA checks passed");
process.exit(failed ? 1 : 0);
