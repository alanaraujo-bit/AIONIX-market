import { chromium, devices } from "playwright";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const out = ".impeccable/review";
await mkdir(out, { recursive: true });
const env = Object.fromEntries((await readFile("apps/api/.env", "utf8")).split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => { const at = line.indexOf("="); return [line.slice(0, at), line.slice(at + 1).replace(/^['"]|['"]$/g, "")]; }));
assert(new URL(env.DATABASE_URL).hostname === "hayabusa.proxy.rlwy.net", "Visual tests must use staging");
const browser = await chromium.launch();
const errors = [];
const results = [];
async function session(port, admin = false, mobile = false) {
  const context = await browser.newContext(mobile ? { ...devices["iPhone 13"], deviceScaleFactor: 1, locale: "pt-BR" } : { viewport: {width:1440,height:1000}, locale:"pt-BR" });
  const response = await context.request.post(`http://localhost:${port}/api/auth/login`, { data: admin ? {email: env.ADMIN_EMAIL || "admin@aionix.market", password: env.ADMIN_PASSWORD, scope:"admin"} : {email:"cliente@aionix.market",password:"aionix2026"} });
  assert(response.ok(), `Login ${port}: ${response.status()}`);
  const page = await context.newPage();
  page.on("pageerror", e => errors.push(e.message));
  return { context, page };
}
try {
  for (const mobile of [true,false]) {
    const {context,page} = await session(3000,false,mobile);
    await page.goto("http://localhost:3000/conquistas");
    await page.getByRole("heading", {name:"Sua coleção",exact:true}).waitFor();
    const noticeClose = page.getByRole("button",{name:"Ver em outro momento"});
    if (await noticeClose.count()) await noticeClose.click();
    await page.screenshot({path:`${out}/achievements-${mobile ? "mobile" : "desktop"}.png`});
    await page.getByRole("button",{name:"Conquistadas",exact:true}).click();
    assert(await page.getByRole("button",{name:/, conquistada$/}).count() > 0, "Existing delivered-order achievements appear");
    await page.getByRole("button",{name:/, conquistada$/}).first().click();
    await page.getByRole("dialog",{name:"Detalhes da conquista"}).waitFor();
    await page.getByRole("button",{name:"Voltar à coleção"}).waitFor();
    await page.screenshot({path:`${out}/achievement-detail-${mobile ? "mobile" : "desktop"}.png`});
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({state:"hidden"});
    await page.getByRole("button",{name:"Todas",exact:true}).click();
    await page.getByRole("searchbox",{name:"Buscar conquista"}).fill("impossible-search-term");
    await page.getByText("Nenhuma conquista com esse nome.").waitFor();
    results.push(`consumer ${mobile ? "mobile" : "desktop"}: collection, earned filter, detail, Escape, search empty passed`);
    await context.close();
  }
  const {context,page} = await session(3001,true);
  await page.goto("http://localhost:3001/conquistas");
  await page.getByRole("heading",{name:"Primeiro capítulo",exact:true}).waitFor();
  await page.screenshot({path:`out`.replace("out",out)+"/achievements-admin-desktop.png",fullPage:false});
  await page.getByRole("button",{name:"Criar conquista",exact:true}).click();
  await page.getByRole("dialog").waitFor();
  await page.screenshot({path:`${out}/achievements-admin-editor.png`});
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({state:"hidden"});
  await page.getByRole("button",{name:"Ver clientes que conquistaram Primeiro capítulo",exact:true}).click();
  await page.getByRole("dialog").waitFor();
  await page.screenshot({path:`${out}/achievements-admin-recipients.png`});
  results.push("admin: catalog, editor, recipients opened");
  await context.close();
  const small = await session(3001,true,true);
  await small.page.goto("http://localhost:3001/conquistas");
  await small.page.getByRole("heading",{name:"Primeiro capítulo",exact:true}).waitFor();
  await small.page.screenshot({path:`${out}/achievements-admin-mobile.png`});
  assert(await small.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),"Admin must not overflow mobile");
  await small.context.close();
  assert.equal(errors.length,0,errors.join("\n"));
  await writeFile(`${out}/achievements-visual-results.json`,JSON.stringify({results,errors},null,2));
  console.log(results.join("\n"));
} finally { await browser.close(); }
