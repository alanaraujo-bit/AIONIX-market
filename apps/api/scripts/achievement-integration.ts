/** Run against local/staging only: pnpm exec tsx --env-file=.env scripts/achievement-integration.ts */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { buildApp } from "../src/app";
import { db, schema, sqlClient } from "../src/db/client";
import { achievements, achievementAwards } from "../src/db/achievement-schema";
import type { Achievement, AchievementInput, MyAchievements } from "@aionix/shared";

const host = new URL(process.env.DATABASE_URL!).hostname;
assert(["localhost", "127.0.0.1", "hayabusa.proxy.rlwy.net"].includes(host), "Only documented staging/local database is allowed");
const app = await buildApp();
app.log.level = "silent";
await app.ready();
const suffix = randomUUID();
const userIds: string[] = [], achievementIds: string[] = [], orderIds: string[] = [], productIds: string[] = [], categoryIds: string[] = [];
const password = randomUUID();
const cookieOf = (response: Awaited<ReturnType<typeof app.inject>>) => response.cookies.map(cookie => `${cookie.name}=${cookie.value}`).join("; ");
async function customer(name: string) {
  const email = `achievement-${name}-${suffix}@example.test`;
  const response = await app.inject({ method: "POST", url: "/api/auth/register", payload: { name: `QA ${name}`, email, password } });
  assert.equal(response.statusCode, 201);
  const id = response.json().user.id as string; userIds.push(id);
  return { id, email, cookie: cookieOf(response) };
}
async function read(cookie: string) { const response = await app.inject({ url: "/api/me/achievements", headers: { cookie } }); assert.equal(response.statusCode, 200, response.body); return response.json<MyAchievements>(); }
let checks = 0;
const check = (name: string, condition: unknown) => { assert(condition, name); checks++; console.log(`PASS ${name}`); };
try {
  const alice = await customer("Alice"), bob = await customer("Bob"), admin = await customer("Admin");
  await db.update(schema.users).set({ role: "admin" }).where(eq(schema.users.id, admin.id));
  const adminLogin = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: admin.email, password, scope: "admin" } });
  assert.equal(adminLogin.statusCode, 200); const adminHeaders = { cookie: cookieOf(adminLogin) };
  check("anonymous progress forbidden", (await app.inject({ url: "/api/me/achievements" })).statusCode === 401);
  check("customer admin listing forbidden", (await app.inject({ url: "/api/admin/achievements", headers: { cookie: alice.cookie } })).statusCode === 403);
  const [category] = await db.insert(schema.categories).values({ name: "Achievement integration", slug: `achievement-${suffix}`, active: false }).returning(); categoryIds.push(category!.id);
  const [product] = await db.insert(schema.products).values({ name: "Achievement integration", slug: `achievement-${suffix}`, categoryId: category!.id, priceCents: 12000, active: false }).returning(); productIds.push(product!.id);
  const base: AchievementInput = { slug: `qa-${suffix}`, title: "QA conquista original", description: "Uma conquista isolada para validação automatizada.", icon: "trophy", color: "amber", category: "shopping", difficulty: "medium", rule: { metric: "orders_count", target: 1, productId: product!.id, categoryId: category!.id, minOrderCents: 10000, paymentMethod: "pix" }, xp: 123, bonusCoins: 17, active: true, sortOrder: 99999 };
  const create = await app.inject({ method: "POST", url: "/api/admin/achievements", headers: adminHeaders, payload: base });
  assert.equal(create.statusCode, 201, create.body); const definition = create.json<Achievement>(); achievementIds.push(definition.id);
  check("unknown filter reference rejected", (await app.inject({ method: "POST", url: "/api/admin/achievements", headers: adminHeaders, payload: { ...base, slug: `qa-unknown-${suffix}`, rule: { ...base.rule, productId: randomUUID() } } })).statusCode === 400);
  check("duplicate identifier conflict", (await app.inject({ method: "POST", url: "/api/admin/achievements", headers: adminHeaders, payload: base })).statusCode === 409);
  async function order(userId: string, status: "pending" | "cancelled" | "delivered", paymentMethod: "pix" | "cash" = "pix", totalCents = 12000, createdAt = new Date()) {
    const [row] = await db.insert(schema.orders).values({ userId, status, subtotalCents: totalCents, totalCents, paymentMethod, deliverySlot: "QA", address: {}, itemCount: 1, fulfillmentMethod: "pickup", createdAt }).returning(); orderIds.push(row!.id);
    await db.insert(schema.orderItems).values({ orderId: row!.id, productId: product!.id, name: "QA", unitPriceCents: totalCents, originalUnitPriceCents: totalCents, quantity: 1, totalCents });
    return row!;
  }
  await order(alice.id, "pending"); await order(alice.id, "cancelled");
  let progress = await read(alice.cookie);
  check("pending/cancelled never count", progress.achievements.find(item => item.id === definition.id)?.current === 0);
  await order(alice.id, "delivered", "cash"); await order(alice.id, "delivered", "pix", 9999);
  progress = await read(alice.cookie);
  check("all filters apply together", progress.achievements.find(item => item.id === definition.id)?.current === 0);
  await order(alice.id, "delivered", "pix", 12000, new Date("2026-09-01T02:00:00Z"));
  const concurrent = await Promise.all(Array.from({ length: 8 }, () => read(alice.cookie)));
  check("all concurrent calls return earned", concurrent.every(value => value.achievements.find(item => item.id === definition.id)?.unlocked));
  const awards = await db.select().from(achievementAwards).where(and(eq(achievementAwards.userId, alice.id), eq(achievementAwards.achievementId, definition.id)));
  check("one immutable award under concurrency", awards.length === 1);
  const entries = await db.select().from(schema.coinEntries).where(and(eq(schema.coinEntries.userId, alice.id), eq(schema.coinEntries.note, `Conquista: ${base.title}`)));
  check("coin bonus credited exactly once", entries.length === 1 && entries[0]!.coins === 17);
  const otherAck = await app.inject({ method: "POST", url: "/api/me/achievements/acknowledge", headers: { cookie: bob.cookie }, payload: { ids: [awards[0]!.id] } });
  assert.equal(otherAck.statusCode, 200);
  check("acknowledgement cannot affect another user", (await read(alice.cookie)).celebrations.some(item => item.id === awards[0]!.id));
  await app.inject({ method: "POST", url: "/api/me/achievements/acknowledge", headers: { cookie: alice.cookie }, payload: { ids: [awards[0]!.id] } });
  check("own acknowledgement persists", !(await read(alice.cookie)).celebrations.some(item => item.id === awards[0]!.id));
  await order(bob.id, "delivered"); await read(bob.cookie);
  const recipients = await app.inject({ url: `/api/admin/achievements/${definition.id}/recipients?pageSize=1&search=QA`, headers: adminHeaders });
  check("recipient pagination reports total", recipients.json().total === 2 && recipients.json().items.length === 1);
  const searched = await app.inject({ url: `/api/admin/achievements/${definition.id}/recipients?search=Alice`, headers: adminHeaders });
  check("recipient search returns correct owner", searched.json().total === 1 && searched.json().items[0].userId === alice.id);
  const edited = await app.inject({ method: "PUT", url: `/api/admin/achievements/${definition.id}`, headers: adminHeaders, payload: { ...base, title: "QA editada", xp: 999, bonusCoins: 888 } });
  assert.equal(edited.statusCode, 200, edited.body);
  await app.inject({ method: "POST", url: `/api/admin/achievements/${definition.id}/archive`, headers: adminHeaders });
  const preserved = (await read(alice.cookie)).achievements.find(item => item.id === definition.id);
  check("edit/archive preserves earned snapshot", preserved?.title === base.title && preserved.xp === 123 && preserved.bonusCoins === 17);
  check("edit never recredits bonus", (await db.select().from(schema.coinEntries).where(and(eq(schema.coinEntries.userId, alice.id), eq(schema.coinEntries.note, `Conquista: ${base.title}`)))).length === 1);
  console.log(`Achievement integration: ${checks} checks passed.`);
} finally {
  // Exact UUID ownership only: never delete any pre-existing fixtures or customer data.
  if (userIds.length) await db.delete(achievementAwards).where(inArray(achievementAwards.userId, userIds));
  if (achievementIds.length) await db.delete(achievements).where(inArray(achievements.id, achievementIds));
  if (userIds.length) await db.delete(schema.coinEntries).where(inArray(schema.coinEntries.userId, userIds));
  if (orderIds.length) await db.delete(schema.orders).where(inArray(schema.orders.id, orderIds));
  if (productIds.length) await db.delete(schema.products).where(inArray(schema.products.id, productIds));
  if (categoryIds.length) await db.delete(schema.categories).where(inArray(schema.categories.id, categoryIds));
  if (userIds.length) await db.delete(schema.users).where(inArray(schema.users.id, userIds));
  await app.close(); await sqlClient.end({ timeout: 5 });
}
