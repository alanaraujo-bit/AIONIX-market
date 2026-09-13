// Two-browser E2E: customer places an order, admin advances it, customer sees SSE update.
// usage: node scripts/realtime-e2e.mjs <webUrl> <adminUrl> <outDir>   (env: ADMIN_EMAIL, ADMIN_PASSWORD)
import { chromium, devices } from "playwright";

const [, , web = "http://localhost:3000", admin = "http://localhost:3001", out = "."] = process.argv;
const browser = await chromium.launch();
const errors = [];
const track = (page, tag) => {
  page.on("pageerror", (e) => errors.push(`[${tag}] ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`[${tag} console] ${m.text().slice(0, 200)}`));
};

// --- customer ---
const cctx = await browser.newContext({ ...devices["iPhone 13"], locale: "pt-BR" });
const c = await cctx.newPage();
track(c, "web");
await c.goto(`${web}/entrar?next=/`);
await c.getByRole("textbox", { name: "E-mail", exact: true }).fill("cliente@aionix.market");
await c.getByRole("textbox", { name: "Senha", exact: true }).fill("aionix2026");
await c.locator("form").getByRole("button", { name: "Entrar" }).click();
await c.waitForURL(`${web}/`);
await c.goto(`${web}/categoria/hortifruti`);
await c.waitForTimeout(1500);
const plus = c.getByRole("button", { name: "Adicionar ao carrinho" });
for (let i = 0; i < 4; i++) {
  await plus.nth(i % 3).click();
  await c.waitForTimeout(250);
}
await c.goto(`${web}/checkout`);
await c.waitForTimeout(2500);
await c.getByRole("button", { name: /Confirmar pedido/ }).click();
await c.getByRole("button", { name: "Acompanhar pedido" }).click({ timeout: 15000 });
await c.waitForURL(/\/pedidos\//);
const orderUrl = c.url();
const orderId = orderUrl.split("/pedidos/")[1];
await c.waitForTimeout(2500);
await c.screenshot({ path: `${out}/rt-01-customer-pending.png` });
console.log("order placed", orderId);

// --- admin ---
const actx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const a = await actx.newPage();
track(a, "admin");
await a.goto(`${admin}/login`);
await a.getByLabel("E-mail").fill(process.env.ADMIN_EMAIL ?? "admin@aionix.market");
await a.getByLabel("Senha", { exact: true }).fill(process.env.ADMIN_PASSWORD ?? "");
await a.getByRole("button", { name: "Entrar" }).click();
await a.waitForURL(/dashboard/);
await a.waitForTimeout(2500);
await a.screenshot({ path: `${out}/rt-02-admin-dashboard.png` });
await a.goto(`${admin}/pedidos/${orderId}`);
await a.waitForTimeout(2500);
await a.screenshot({ path: `${out}/rt-03-admin-order.png` });

for (const label of ["Pedido confirmado", "Em separação", "Saiu para entrega"]) {
  await a.getByRole("button", { name: label }).first().click();
  await a.waitForTimeout(1800);
}
await a.screenshot({ path: `${out}/rt-04-admin-advanced.png` });

// customer should have received SSE updates without reload
await c.waitForTimeout(1500);
const text = await c.locator("body").innerText();
await c.screenshot({ path: `${out}/rt-05-customer-live.png` });
console.log("customer sees 'Saiu para entrega':", text.includes("Saiu para entrega!"));

await a.goto(`${admin}/pedidos`);
await a.waitForTimeout(2500);
await a.screenshot({ path: `${out}/rt-06-admin-queue.png` });

if (errors.length) console.log("ERRORS:\n" + [...new Set(errors)].join("\n"));
await browser.close();
