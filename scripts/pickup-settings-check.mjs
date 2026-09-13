// Store owner's first pickup step, through the admin UI (STAGING only):
//   node scripts/pickup-settings-check.mjs http://localhost:3001 http://localhost:3000 out/pickup-settings
// 1) turning pickup on with an empty address must show the error on the address field and save nothing;
// 2) with a real address it saves, and the customer checkout offers "Retirar na loja";
// original settings are restored at the end.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium, devices } from "playwright";

const [, , adminUrl = "http://localhost:3001", webUrl = "http://localhost:3000", out = "out/pickup-settings"] = process.argv;
mkdirSync(out, { recursive: true });
const env = readFileSync("apps/api/.env", "utf8");
assert.equal(new URL(env.match(/^DATABASE_URL=(.+)$/m)[1].trim()).hostname, "hayabusa.proxy.rlwy.net", "must run against staging");
const ADMIN_PASSWORD = env.match(/^ADMIN_PASSWORD=(.+)$/m)[1].trim();
const API = "http://localhost:8080/api";

let jar = "";
const api = async (path, body, method) => {
  const res = await fetch(API + path, { method: method ?? (body ? "POST" : "GET"), headers: { "content-type": "application/json", cookie: jar }, body: body ? JSON.stringify(body) : undefined });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) jar = set.map((c) => c.split(";")[0]).join("; ");
  return res.json();
};
await api("/auth/login", { email: "admin@aionix.market", password: ADMIN_PASSWORD, scope: "admin" });
const original = (await api("/admin/settings")).settings;
await api("/admin/settings", { ...original, pickupEnabled: false, pickupAddress: "" }, "PUT");

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: "pt-BR" });
  await ctx.request.post(`${adminUrl}/api/auth/login`, { data: { email: "admin@aionix.market", password: ADMIN_PASSWORD, scope: "admin" } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${adminUrl}/configuracoes`, { waitUntil: "networkidle" });
  const card = page.locator("section", { hasText: "Retirada na loja" });
  const address = card.getByLabel("Endereço completo de retirada");

  console.log("▶ enable with empty address");
  await card.getByRole("switch").click();
  await page.getByRole("button", { name: "Salvar" }).click();
  await card.getByText("Informe o endereço completo para retirada").waitFor({ timeout: 5000 });
  await page.screenshot({ path: `${out}/1-empty-address-error.png` });
  assert.equal((await api("/admin/settings")).settings.pickupEnabled, false, "invalid form must not save");
  console.log("  error shown on the address field; nothing saved ✓");

  console.log("▶ fill a real address and save");
  await address.fill("Loja AIONIX (staging) — Av. Paulista, 1578, Bela Vista, São Paulo/SP");
  await page.getByRole("button", { name: "Salvar" }).click();
  await page.getByText("Configurações salvas").waitFor({ timeout: 5000 });
  await page.screenshot({ path: `${out}/2-saved.png` });
  const saved = (await api("/admin/settings")).settings;
  assert.equal(saved.pickupEnabled, true);
  assert.match(saved.pickupAddress, /Paulista, 1578/);
  console.log("  saved ✓");

  console.log("▶ customer checkout offers pickup");
  const c = await browser.newContext({ ...devices["iPhone 13"], locale: "pt-BR" });
  await c.request.post(`${webUrl}/api/auth/login`, { data: { email: "cliente@aionix.market", password: "aionix2026" } });
  const cp = await c.newPage();
  cp.on("pageerror", (e) => errors.push(e.message));
  await cp.goto(webUrl, { waitUntil: "domcontentloaded" });
  const p = (await (await fetch(`${API}/products?pageSize=5`)).json()).items.find((x) => x.stock > 5);
  await cp.evaluate((item) => localStorage.setItem("aionix-cart-v1", JSON.stringify({ state: { items: [item] }, version: 2 })), { productId: p.id, slug: p.slug, name: p.name, imageUrl: p.imageUrl, blurDataUrl: p.blurDataUrl, unitLabel: p.unitLabel, priceCents: p.finalPriceCents, compareAtCents: p.compareAtCents, viaClub: false, stock: p.stock, quantity: 4 });
  await cp.goto(`${webUrl}/checkout`, { waitUntil: "networkidle" });
  await cp.getByRole("button", { name: /Retirar na loja/ }).click();
  await cp.getByText(/Paulista, 1578/).waitFor();
  await cp.screenshot({ path: `${out}/3-checkout-offers-pickup.png` });
  console.log("  checkout shows the store address ✓");

  console.log("▶ turning pickup off hides it from checkout");
  await card.getByRole("switch").click();
  await page.getByRole("button", { name: "Salvar" }).click();
  await page.getByText("Configurações salvas").first().waitFor({ timeout: 5000 });
  await cp.reload({ waitUntil: "networkidle" });
  await cp.waitForTimeout(800);
  assert.equal(await cp.getByRole("button", { name: /Retirar na loja/ }).count(), 0, "pickup option must disappear when disabled");
  console.log("  option gone ✓");

  assert.equal(errors.length, 0, errors.join("\n"));
  console.log("\n✓ pickup settings check passed");
} finally {
  await api("/admin/settings", original, "PUT");
  console.log(`  staging settings restored (pickupEnabled=${original.pickupEnabled})`);
  await browser.close();
}
