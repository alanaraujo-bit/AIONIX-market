// E2E for the sound layer (STAGING only): asserts which sounds the user actually heard
// (window.__aionixSounds is filled by the engine only when a sound really plays).
//   node scripts/sound-e2e.mjs http://localhost:3000 http://localhost:3001 out/sound-e2e
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium, devices } from "playwright";

const [, , web = "http://localhost:3000", adminUrl = "http://localhost:3001", out = "out/sound-e2e"] = process.argv;
mkdirSync(out, { recursive: true });
const API = "http://localhost:8080/api";
const env = readFileSync("apps/api/.env", "utf8");
assert.equal(new URL(env.match(/^DATABASE_URL=(.+)$/m)[1].trim()).hostname, "hayabusa.proxy.rlwy.net", "sound E2E must run against staging");
const ADMIN_PASSWORD = env.match(/^ADMIN_PASSWORD=(.+)$/m)[1].trim();
const step = (s) => console.log(`\n▶ ${s}`);

let jar = "";
const admin = async (path, body, method) => {
  const res = await fetch(API + path, { method: method ?? (body ? "POST" : "GET"), headers: { "content-type": "application/json", cookie: jar }, body: body ? JSON.stringify(body) : undefined });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) jar = set.map((c) => c.split(";")[0]).join("; ");
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${path} → ${res.status} ${data?.error?.message ?? ""}`);
  return data;
};
await admin("/auth/login", { email: "admin@aionix.market", password: ADMIN_PASSWORD, scope: "admin" });

const heard = (page) => page.evaluate(() => window.__aionixSounds ?? []);
const clearHeard = (page) => page.evaluate(() => (window.__aionixSounds = []));
async function expectHeard(page, name, what, timeout = 8000) {
  await page.waitForFunction((n) => (window.__aionixSounds ?? []).includes(n), name, { timeout }).catch(() => {});
  const list = await heard(page);
  assert(list.includes(name), `${what}: expected "${name}", heard [${list.join(", ")}]`);
  console.log(`  ♪ ${what} → ${name}`);
}

const browser = await chromium.launch();
let orderId = null;
const errors = [];
try {
  step("panel: first load asks for a click before it can ring");
  const actx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR" });
  await actx.request.post(`${adminUrl}/api/auth/login`, { data: { email: "admin@aionix.market", password: ADMIN_PASSWORD, scope: "admin" } });
  const ap = await actx.newPage();
  ap.on("pageerror", (e) => errors.push(`admin: ${e.message}`));
  await ap.goto(`${adminUrl}/dashboard`, { waitUntil: "networkidle" });
  const pill = ap.getByRole("button", { name: /ativar o alerta sonoro/ });
  const pillShown = await pill.isVisible().catch(() => false);
  console.log(`  unlock pill visible before any click: ${pillShown}`);
  if (pillShown) {
    await ap.screenshot({ path: `${out}/1-panel-unlock-pill.png` });
    await pill.click();
    await pill.waitFor({ state: "hidden", timeout: 5000 });
    console.log("  pill disappears once audio is unlocked ✓");
  } else await ap.mouse.click(700, 300);

  step("app: touching things");
  const cctx = await browser.newContext({ ...devices["iPhone 13"], locale: "pt-BR" });
  await cctx.request.post(`${web}/api/auth/login`, { data: { email: "cliente@aionix.market", password: "aionix2026" } });
  const cp = await cctx.newPage();
  cp.on("pageerror", (e) => errors.push(`app: ${e.message}`));
  await cp.addLocatorHandler(cp.locator('aside[aria-label="Nova conquista"]'), async (n) => n.evaluateAll((els) => els.forEach((el) => (el.style.visibility = "hidden"))).catch(() => {}), { noWaitAfter: true });
  await cp.goto(web, { waitUntil: "domcontentloaded" });
  await cp.evaluate(() => {
    localStorage.removeItem("aionix-cart-v1");
    localStorage.setItem("aionix-sound-v1", JSON.stringify({ state: { enabled: true }, version: 0 }));
  });
  await cp.goto(`${web}/categoria/cafe-matinais`, { waitUntil: "networkidle" });
  await cp.mouse.click(200, 120); // first gesture unlocks audio
  await clearHeard(cp);
  const plus = cp.getByRole("button", { name: "Adicionar ao carrinho" }).first();
  await plus.click();
  await expectHeard(cp, "addToCart", "first unit");
  await cp.waitForTimeout(250);
  await plus.click();
  await expectHeard(cp, "stepUp", "one more");
  await cp.waitForTimeout(250);
  await cp.getByRole("button", { name: "Diminuir" }).first().click();
  await expectHeard(cp, "stepDown", "one less");
  await cp.waitForTimeout(250);
  await cp.getByRole("button", { name: "Remover" }).first().click();
  await expectHeard(cp, "removeItem", "last unit removed");

  step("app: checkout signature + panel counter bell");
  const p = (await (await fetch(`${API}/products?pageSize=30`)).json()).items.find((x) => x.stock > 10 && x.finalPriceCents >= 3500);
  await cp.evaluate((item) => localStorage.setItem("aionix-cart-v1", JSON.stringify({ state: { items: [item] }, version: 2 })), { productId: p.id, slug: p.slug, name: p.name, imageUrl: p.imageUrl, blurDataUrl: p.blurDataUrl, unitLabel: p.unitLabel, priceCents: p.finalPriceCents, compareAtCents: p.compareAtCents, viaClub: false, stock: p.stock, quantity: 1 });
  await cp.evaluate(() => sessionStorage.removeItem("aionix-voucher-v1"));
  await cp.goto(`${web}/checkout`, { waitUntil: "networkidle" });
  await cp.mouse.click(200, 120);
  await clearHeard(cp);
  await clearHeard(ap);
  const placed = cp.waitForResponse((r) => r.url().includes("/api/me/orders") && r.request().method() === "POST");
  await cp.getByRole("button", { name: /Confirmar pedido/ }).click();
  const res = await placed;
  assert(res.ok(), `checkout failed ${res.status()}`);
  orderId = (await res.json()).order.id;
  await expectHeard(cp, "orderPlaced", "order placed");
  await expectHeard(ap, "newOrder", "panel hears the new order", 12000);
  await cp.waitForTimeout(1600);
  await cp.screenshot({ path: `${out}/2-order-placed.png` });
  await ap.waitForTimeout(400);
  await ap.screenshot({ path: `${out}/3-panel-new-order-toast.png` });

  step("app: live order news");
  await clearHeard(cp);
  await admin(`/admin/orders/${orderId}/status`, { status: "confirmed" }, "PATCH");
  await expectHeard(cp, "orderConfirmed", "store confirmed", 12000);
  await cp.waitForTimeout(1700);
  await admin(`/admin/orders/${orderId}/status`, { status: "picking" }, "PATCH");
  await expectHeard(cp, "orderPicking", "store is picking", 12000);

  step("panel: status action from the order page");
  await ap.goto(`${adminUrl}/pedidos/${orderId}`, { waitUntil: "networkidle" });
  await ap.mouse.click(700, 120);
  await clearHeard(ap);
  await clearHeard(cp);
  await ap.getByRole("button", { name: "Cancelar", exact: true }).click();
  await ap.getByRole("button", { name: "Cancelar pedido", exact: true }).click();
  await expectHeard(ap, "orderCancelled", "operator cancelled");
  await expectHeard(cp, "orderCancelled", "shopper hears the cancellation", 12000);
  const echo = (await heard(ap)).filter((n) => n === "orderCancelled").length;
  assert.equal(echo, 1, "the realtime echo must not ring a second time");
  orderId = null;

  step("app: Conta → Sons toggle");
  await cp.goto(`${web}/conta`, { waitUntil: "networkidle" });
  const sw = cp.getByRole("switch", { name: /Sons/ });
  await sw.scrollIntoViewIfNeeded();
  assert.equal(await sw.getAttribute("aria-checked"), "true");
  await clearHeard(cp);
  await sw.click();
  await expectHeard(cp, "toggleOff", "sounds off");
  assert.equal(await sw.getAttribute("aria-checked"), "false");
  await cp.screenshot({ path: `${out}/4-account-sounds-off.png` });
  await clearHeard(cp);
  await sw.click();
  await expectHeard(cp, "coin", "sounds back on (preview)");
  assert.equal(await sw.getAttribute("aria-checked"), "true");

  step("panel: sound board + settings entry");
  await ap.goto(`${adminUrl}/configuracoes`, { waitUntil: "networkidle" });
  await ap.getByRole("link", { name: /Sons e alertas/ }).click();
  await ap.waitForURL(/\/configuracoes\/sons/);
  await ap.waitForLoadState("networkidle");
  await clearHeard(ap);
  await ap.locator('[data-sound="achievement"]').click();
  await expectHeard(ap, "achievement", "board preview");
  await ap.waitForTimeout(350);
  await ap.screenshot({ path: `${out}/5-sound-board.png`, fullPage: true });

  assert.equal(errors.length, 0, errors.join("\n"));
  console.log("\n✓ sound E2E passed");
} finally {
  if (orderId) await admin(`/admin/orders/${orderId}/status`, { status: "cancelled", note: "sound-e2e cleanup" }, "PATCH").catch(() => {});
  await browser.close();
}
