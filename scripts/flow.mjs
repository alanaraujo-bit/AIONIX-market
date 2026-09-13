// E2E smoke: login → add to cart → cart → checkout → place order → order detail. Saves screenshots.
import { chromium, devices } from "playwright";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? ".";
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "pt-BR" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`[console] ${m.text().slice(0, 200)}`));
const shot = (name) => page.screenshot({ path: `${out}/flow-${name}.png` });

await page.goto(`${base}/entrar?next=/`);
await page.getByRole("textbox", { name: "E-mail", exact: true }).fill("cliente@aionix.market");
await page.getByRole("textbox", { name: "Senha", exact: true }).fill("aionix2026");
await shot("01-login");
await page.locator("form").getByRole("button", { name: "Entrar" }).click();
await page.waitForURL(`${base}/`);
await page.waitForTimeout(1500);

await page.goto(`${base}/produto/azeite-extra-virgem-andorinha`);
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /^Adicionar/ }).filter({ hasText: "R$" }).click();
await page.waitForTimeout(700);
await shot("02-added");

await page.goto(`${base}/categoria/cafe-matinais`);
await page.waitForTimeout(1800);
const plus = page.getByRole("button", { name: "Adicionar ao carrinho" });
await plus.nth(0).click();
await page.waitForTimeout(300);
await plus.nth(0).click();
await page.waitForTimeout(300);
await plus.nth(1).click();
await page.waitForTimeout(800);
await shot("03-category");

await page.goto(`${base}/carrinho`);
await page.waitForTimeout(2200);
await shot("04-cart");

await page.getByRole("button", { name: /Finalizar compra/ }).click();
await page.waitForURL(`${base}/checkout`);
await page.waitForTimeout(2200);
await shot("05-checkout");
await page.evaluate(() => document.querySelector(".scroll-y")?.scrollTo({ top: 9999 }));
await page.waitForTimeout(600);
await shot("06-checkout-bottom");

await page.getByRole("button", { name: /Confirmar pedido/ }).click();
await page.waitForTimeout(2500);
await shot("07-success");
await page.getByRole("button", { name: "Acompanhar pedido" }).click();
await page.waitForURL(/\/pedidos\//);
await page.waitForTimeout(2000);
await shot("08-order");
await page.goto(`${base}/pedidos`);
await page.waitForTimeout(2000);
await shot("09-orders");
await page.goto(`${base}/conta`);
await page.waitForTimeout(2000);
await shot("10-account");

console.log("order url:", page.url());
if (errors.length) console.log("ERRORS:\n" + [...new Set(errors)].join("\n"));
await browser.close();
