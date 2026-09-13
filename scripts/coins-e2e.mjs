// E2E for the coins/loyalty loop (run against STAGING only):
//   node scripts/coins-e2e.mjs http://localhost:3000 out/coins   (env: ADMIN_PASSWORD, API=http://localhost:8080)
// Flow: customer has coins → redeems "R$ 5" in the wallet UI → voucher applied in cart →
// checkout → admin advances the order to delivered → customer sees the coin celebration.
import { readFileSync } from "node:fs";
import { chromium, devices } from "playwright";

const [, , web = "http://localhost:3000", out = "out/coins"] = process.argv;
const API = process.env.API ?? "http://localhost:8080/api";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? readFileSync("apps/api/.env", "utf8").match(/^ADMIN_PASSWORD=(.+)$/m)?.[1]?.trim();
const step = (s) => console.log(`\n▶ ${s}`);
const fail = (m) => {
  console.error(`✗ ${m}`);
  process.exit(1);
};

// ---- tiny cookie-jar API client (admin + setup) ---------------------------
function client() {
  let jar = "";
  return async (path, body, method) => {
    const res = await fetch(API + path, { method: method ?? (body ? "POST" : "GET"), headers: { "content-type": "application/json", cookie: jar }, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.getSetCookie?.() ?? [];
    if (set.length) jar = set.map((c) => c.split(";")[0]).join("; ");
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`${path} → ${res.status} ${data?.error?.message ?? ""}`);
    return data;
  };
}
const admin = client();
const customer = client();

step("setup: customer login + top up to afford a reward");
await customer("/auth/login", { email: "cliente@aionix.market", password: "aionix2026" });
await admin("/auth/login", { email: "admin@aionix.market", password: ADMIN_PASSWORD, scope: "admin" });
const me = (await customer("/auth/session")).user;
const program = await customer("/loyalty/program");
if (!program.enabled) fail("loyalty program is disabled");
const fiveOff = program.rewards.find((r) => r.type === "discount_fixed" && r.value === 500) ?? program.rewards.find((r) => r.type === "discount_fixed");
if (!fiveOff) fail("no fixed-discount reward seeded");
let wallet = await customer("/me/loyalty");
if (wallet.balance < fiveOff.costCoins) await admin(`/admin/loyalty/customers/${me.id}/coins`, { coins: fiveOff.costCoins - wallet.balance + 10, note: "Recarga do teste E2E" });
await customer("/me/loyalty/seen", {});
wallet = await customer("/me/loyalty");
const balanceBefore = wallet.balance;
console.log(`  balance ${balanceBefore}, reward "${fiveOff.name}" costs ${fiveOff.costCoins}`);

// Cart: 4 cheap in-stock products, so we clear the voucher minimum.
const products = (await customer("/products?pageSize=30")).items.filter((p) => p.stock > 5);
const cart = products.slice(0, 4).map((p) => ({
  productId: p.id, slug: p.slug, name: p.name, imageUrl: p.imageUrl, blurDataUrl: p.blurDataUrl, unitLabel: p.unitLabel,
  priceCents: p.finalPriceCents, compareAtCents: p.compareAtCents, viaClub: false, stock: p.stock, quantity: 3,
}));

// ---- browser --------------------------------------------------------------
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "pt-BR" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && !/vibrate|hydrat/i.test(m.text()) && errors.push(m.text().slice(0, 200)));
await page.request.post(`${web}/api/auth/login`, { data: { email: "cliente@aionix.market", password: "aionix2026" } });
// The achievements front shows a floating "Nova conquista" notice that can cover footer CTAs;
// dismiss it whenever it appears so this test only exercises the coins flow.
await page.addLocatorHandler(
  page.locator('aside[aria-label="Nova conquista"]'),
  async (notice) => {
    // Hide (never remove): the node belongs to React and removing it crashes the next unmount.
    await notice.evaluateAll((els) => els.forEach((el) => (el.style.visibility = "hidden"))).catch(() => {});
  },
  { noWaitAfter: true },
);
await page.goto(web, { waitUntil: "domcontentloaded" });
await page.evaluate((items) => localStorage.setItem("aionix-cart-v1", JSON.stringify({ state: { items }, version: 2 })), cart);

step("wallet → redeem reward");
await page.goto(`${web}/moedas`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/e2e-1-wallet.png` });
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
await page.getByRole("button", { name: new RegExp(escapeRe(fiveOff.name)) }).first().click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/e2e-2-redeem-sheet.png` });
await page.getByRole("button", { name: /Trocar por este prêmio/ }).click();
await page.getByText("Prêmio resgatado").waitFor({ timeout: 8000 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/e2e-3-voucher.png` });
await page.getByRole("button", { name: /Usar no próximo pedido/ }).click();

step("cart shows voucher applied");
await page.waitForURL(/\/carrinho/);
await page.getByText(/Aplicado ·/).waitFor({ timeout: 8000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/e2e-4-cart.png`, fullPage: false });
await page.evaluate(() => document.querySelector(".scroll-y")?.scrollTo({ top: 99999 }));
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/e2e-5-cart-summary.png` });

step("checkout");
await page.getByRole("button", { name: /Finalizar compra/ }).click();
await page.waitForURL(/\/checkout/);
await page.waitForTimeout(1500);
await page.evaluate(() => document.querySelector(".scroll-y")?.scrollTo({ top: 99999 }));
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/e2e-6-checkout.png` });
const placed = page.waitForResponse((r) => r.url().includes("/api/me/orders") && r.request().method() === "POST");
await page.getByRole("button", { name: /Confirmar pedido/ }).click();
const orderRes = await placed;
const { order } = await orderRes.json();
if (!orderRes.ok()) fail(`checkout failed: ${JSON.stringify(order)}`);
console.log(`  order #${order.number} total ${order.totalCents} rewardDiscount ${order.rewardDiscountCents} coins ${order.coinsEarned}`);
if (order.rewardDiscountCents !== fiveOff.value) fail(`voucher not applied (rewardDiscountCents=${order.rewardDiscountCents})`);
await page.waitForTimeout(1800);
await page.screenshot({ path: `${out}/e2e-7-success.png` });

wallet = await customer("/me/loyalty");
const voucher = wallet.vouchers.find((v) => v.orderId === order.id);
if (voucher?.status !== "applied") fail(`voucher should be 'applied', got ${voucher?.status}`);
if (wallet.pending < order.coinsEarned) fail(`pending coins ${wallet.pending} < ${order.coinsEarned}`);
console.log(`  wallet balance ${wallet.balance} (was ${balanceBefore}), pending ${wallet.pending}`);

step("admin advances order to delivered");
const detail = (await admin(`/admin/orders/${order.id}`)).order;
const flow = detail.fulfillmentMethod === "pickup" ? ["confirmed", "picking", "delivered"] : ["confirmed", "picking", "out_for_delivery", "delivered"];
for (const status of flow) await admin(`/admin/orders/${order.id}/status`, { status }, "PATCH");

step("customer sees the coins land");
await page.goto(`${web}/pedidos/${order.id}`, { waitUntil: "networkidle" });
await page.getByText(/Você ganhou|entregue/i).first().waitFor({ timeout: 10000 });
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/e2e-8-celebration-mid.png` });
await page.waitForTimeout(2200);
await page.screenshot({ path: `${out}/e2e-9-celebration.png` });
await page.getByRole("button", { name: "Continuar" }).click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/e2e-10-order-detail.png` });

wallet = await customer("/me/loyalty");
const expected = balanceBefore - fiveOff.costCoins + order.coinsEarned;
if (wallet.balance !== expected) fail(`balance ${wallet.balance} !== expected ${expected}`);
if (wallet.vouchers.find((v) => v.orderId === order.id)?.status !== "used") fail("voucher should be 'used' after delivery");
if (wallet.unseen.length) fail("celebrated entries should be marked seen");
console.log(`  final balance ${wallet.balance} = ${balanceBefore} − ${fiveOff.costCoins} + ${order.coinsEarned} ✓`);

await browser.close();
if (errors.length) console.log("page errors:\n" + [...new Set(errors)].join("\n"));
console.log("\n✓ coins E2E passed");
