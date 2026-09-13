// Visual QA helper: node scripts/shot.mjs <url> <out.png> [--desktop] [--login] [--full] [--wait ms]
import { chromium, devices } from "playwright";

const [, , url, out, ...flags] = process.argv;
const desktop = flags.includes("--desktop");
const wait = Number(flags[flags.indexOf("--wait") + 1]) || 1500;
const browser = await chromium.launch();
const ctx = await browser.newContext(desktop ? { viewport: { width: 1440, height: 900 } } : { ...devices["iPhone 13"], locale: "pt-BR" });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errors.push(`[${m.type()}] ${m.text().slice(0, 300)}`));
page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));

if (flags.includes("--login")) {
  const origin = new URL(url).origin;
  const res = await page.request.post(`${origin}/api/auth/login`, {
    data: { email: process.env.LOGIN_EMAIL ?? "cliente@aionix.market", password: process.env.LOGIN_PASSWORD ?? "aionix2026", scope: process.env.LOGIN_SCOPE },
  });
  if (!res.ok()) console.error("login failed", res.status(), await res.text());
}

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(wait);
const scroll = Number(flags[flags.indexOf("--scroll") + 1]) || 0;
if (scroll) {
  await page.evaluate((y) => document.querySelector(".scroll-y")?.scrollTo({ top: y }), scroll);
  await page.waitForTimeout(1200);
}
for (const sel of flags.filter((f) => f.startsWith("--click=")).map((f) => f.slice(8))) {
  await page.locator(sel).first().click();
  await page.waitForTimeout(900);
}
await page.screenshot({ path: out, fullPage: flags.includes("--full") });
console.log("saved", out);
if (errors.length) console.log("console:\n" + [...new Set(errors)].join("\n"));
await browser.close();
