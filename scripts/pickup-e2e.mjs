// E2E for store pickup + achievements (run against STAGING only):
//   node scripts/pickup-e2e.mjs http://localhost:3000 out/pickup   (env: API=http://localhost:8080/api)
// Enables pickup on staging for the run (original settings are restored at the end), then:
// customer chooses "Retirar na loja" → no delivery fee → order → admin confirms → separates →
// "pronto para retirada" (customer sees it) → pickup confirmed → "Oi, pessoalmente!" medal + coins.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium, devices } from "playwright";

const [, , web = "http://localhost:3000", out = "out/pickup"] = process.argv;
mkdirSync(out, { recursive: true });
const API = process.env.API ?? "http://localhost:8080/api";
const env = readFileSync("apps/api/.env", "utf8");
assert.equal(new URL(env.match(/^DATABASE_URL=(.+)$/m)[1].trim()).hostname, "hayabusa.proxy.rlwy.net", "pickup E2E must run against staging");
const ADMIN_PASSWORD = env.match(/^ADMIN_PASSWORD=(.+)$/m)?.[1]?.trim();
const step = (s) => console.log(`\n▶ ${s}`);

function client() {
  let jar = "";
  return async (path, body, method) => {
    const res = await fetch(API + path, { method: method ?? (body ? "POST" : "GET"), headers: { "content-type": "application/json", cookie: jar }, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.getSetCookie?.() ?? [];
    if (set.length) jar = set.map((c) => c.split(";")[0]).join("; ");
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`${method ?? (body ? "POST" : "GET")} ${path} → ${res.status} ${data?.error?.message ?? ""}`);
    return data;
  };
}
const admin = client();
const customer = client();
await admin("/auth/login", { email: "admin@aionix.market", password: ADMIN_PASSWORD, scope: "admin" });
await customer("/auth/login", { email: "cliente@aionix.market", password: "aionix2026" });

const original = (await admin("/admin/settings")).settings;
const browser = await chromium.launch();
try {
  step("enable pickup on staging (restored at the end)");
  await admin("/admin/settings", { ...original, pickupEnabled: true, pickupAddress: "Loja AIONIX (staging) — Av. Paulista, 1578, Bela Vista, São Paulo/SP" }, "PUT");
  const store = (await customer("/catalog/home")).store;
  assert.equal(store.pickupEnabled, true);

  const before = await customer("/me/achievements");
  const medal = before.achievements.find((a) => a.slug === "oi-pessoalmente");
  assert(medal, "pickup achievement must be visible once pickup is enabled");
  const hadMedal = medal.unlocked;
  const walletBefore = await customer("/me/loyalty");
  console.log(`  medal "${medal.title}" unlocked before: ${hadMedal}; coins ${walletBefore.balance}`);

  // Small cart below the free-delivery threshold, so "no fee" is really pickup's doing.
  const products = (await customer("/products?pageSize=30")).items.filter((p) => p.stock > 5 && p.finalPriceCents >= 1500 && p.finalPriceCents <= 4000);
  const cart = products.slice(0, 2).map((p) => ({ productId: p.id, slug: p.slug, name: p.name, imageUrl: p.imageUrl, blurDataUrl: p.blurDataUrl, unitLabel: p.unitLabel, priceCents: p.finalPriceCents, compareAtCents: p.compareAtCents, viaClub: false, stock: p.stock, quantity: 1 }));
  assert.equal(cart.length, 2, "need two mid-priced products in stock");

  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "pt-BR" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addLocatorHandler(page.locator('aside[aria-label="Nova conquista"]'), async (n) => n.evaluateAll((els) => els.forEach((el) => (el.style.visibility = "hidden"))).catch(() => {}), { noWaitAfter: true });
  await page.request.post(`${web}/api/auth/login`, { data: { email: "cliente@aionix.market", password: "aionix2026" } });
  await page.goto(web, { waitUntil: "domcontentloaded" });
  await page.evaluate((items) => {
    localStorage.setItem("aionix-cart-v1", JSON.stringify({ state: { items }, version: 2 }));
    sessionStorage.removeItem("aionix-voucher-v1");
  }, cart);

  step("checkout with pickup");
  await page.goto(`${web}/checkout`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Retirar na loja/ }).click();
  await page.getByText(/Av\. Paulista, 1578/).waitFor();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/1-checkout-pickup.png` });
  await page.evaluate(() => document.querySelector(".scroll-y")?.scrollTo({ top: 99999 }));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/2-checkout-summary.png` });
  const placed = page.waitForResponse((r) => r.url().includes("/api/me/orders") && r.request().method() === "POST");
  await page.getByRole("button", { name: /Confirmar pedido/ }).click();
  const res = await placed;
  const { order } = await res.json();
  assert(res.ok(), `checkout failed: ${JSON.stringify(order)}`);
  assert.equal(order.fulfillmentMethod, "pickup");
  assert.equal(order.deliveryFeeCents, 0, "pickup must never charge delivery");
  assert.equal(order.address.label, "Retirada na loja");
  console.log(`  order #${order.number} total ${order.totalCents} fee ${order.deliveryFeeCents} coins ${order.coinsEarned}`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/3-success.png` });

  step("admin: confirm → separate → ready for pickup");
  for (const status of ["confirmed", "picking", "out_for_delivery"]) await admin(`/admin/orders/${order.id}/status`, { status }, "PATCH");
  await assert.rejects(admin(`/admin/orders/${order.id}/status`, { status: "picking" }, "PATCH"), /Transição/, "no going back");
  await page.goto(`${web}/pedidos/${order.id}`, { waitUntil: "networkidle" });
  await page.getByText("Pronto para retirada!").waitFor();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/4-ready.png` });

  step("admin: customer picked it up");
  await admin(`/admin/orders/${order.id}/status`, { status: "delivered" }, "PATCH");
  await page.goto(`${web}/pedidos/${order.id}`, { waitUntil: "networkidle" });
  await page.getByText(/Retirado/).first().waitFor();
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${out}/5-picked-up.png` });
  const cont = page.getByRole("button", { name: "Continuar" });
  if (await cont.isVisible().catch(() => false)) await cont.click();

  const after = await customer("/me/achievements");
  const medalAfter = after.achievements.find((a) => a.slug === "oi-pessoalmente");
  assert(medalAfter?.unlocked, "pickup medal must unlock after a completed pickup");
  const walletAfter = await customer("/me/loyalty");
  assert.equal(walletAfter.balance, walletBefore.balance + order.coinsEarned, "pickup order earns coins like any order");
  console.log(`  medal unlocked ✓ (new: ${!hadMedal}); coins ${walletBefore.balance} → ${walletAfter.balance}`);

  step("medal celebration + collection");
  await page.goto(`${web}/conquistas`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/6-collection.png` });
  await page.getByRole("button", { name: /Oi, pessoalmente!, conquistada/ }).click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/7-medal.png` });

  const detail = (await admin(`/admin/orders/${order.id}`)).order;
  assert.equal(detail.status, "delivered");
  assert.equal(detail.events.map((e) => e.status).join(">"), "pending>confirmed>picking>out_for_delivery>delivered");
  if (errors.length) console.log("page errors:\n" + [...new Set(errors)].join("\n"));
  assert.equal(errors.length, 0, "no page errors");
  await ctx.close();
  console.log("\n✓ pickup E2E passed");
} finally {
  await admin("/admin/settings", original, "PUT").catch((e) => console.error("could not restore settings:", e.message));
  console.log("  staging settings restored (pickupEnabled=" + original.pickupEnabled + ")");
  await browser.close();
}
