import { coinAdjustSchema, loyaltySettingsSchema, rewardInputSchema } from "@aionix/shared";
import { and, desc, eq, gte, sql, type SQL } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/client";
import { requireAdmin } from "../lib/auth";
import { notFound, pageParams, parse, str } from "../lib/http";
import { creditCoins, serializeRedemption, serializeReward, useGiftVoucher } from "../lib/loyalty";
import { getLoyaltySettings, saveLoyaltySettings } from "../lib/settings";

const r = schema.rewards;
const rd = schema.redemptions;
const ce = schema.coinEntries;
const TZ = "America/Sao_Paulo";
const DAY = 86_400_000;

export const adminLoyaltyRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (req) => {
    requireAdmin(req);
  });

  app.get("/settings", async () => ({ settings: await getLoyaltySettings() }));
  app.put("/settings", async (req) => ({ settings: await saveLoyaltySettings(parse(loyaltySettingsSchema, req.body)) }));

  /** KPIs + 30-day series for the loyalty screen. */
  app.get("/overview", async () => {
    const since30 = new Date(Date.now() - 30 * DAY);
    const [[totals], [recent], [members], topRewards, series] = await Promise.all([
      db
        .select({
          circulating: sql<number>`coalesce(sum(${ce.coins}) filter (where ${ce.status} = 'settled'), 0)::int`,
          pending: sql<number>`coalesce(sum(${ce.coins}) filter (where ${ce.status} = 'pending'), 0)::int`,
          issued: sql<number>`coalesce(sum(${ce.coins}) filter (where ${ce.status} = 'settled' and ${ce.coins} > 0 and ${ce.type} <> 'refund'), 0)::int`,
          redeemed: sql<number>`coalesce(-sum(${ce.coins}) filter (where ${ce.type} = 'redeem'), 0)::int`,
        })
        .from(ce),
      db
        .select({
          issued30: sql<number>`coalesce(sum(${ce.coins}) filter (where ${ce.status} = 'settled' and ${ce.coins} > 0 and ${ce.type} <> 'refund'), 0)::int`,
          redeemed30: sql<number>`coalesce(-sum(${ce.coins}) filter (where ${ce.type} = 'redeem'), 0)::int`,
          redemptions30: sql<number>`count(*) filter (where ${ce.type} = 'redeem')::int`,
        })
        .from(ce)
        .where(gte(ce.createdAt, since30)),
      db
        .select({ n: sql<number>`count(distinct ${ce.userId})::int` })
        .from(ce)
        .where(and(eq(ce.status, "settled"), sql`${ce.coins} > 0`)),
      db
        .select({ id: r.id, name: r.name, type: r.type, costCoins: r.costCoins, redeemedCount: r.redeemedCount, active: r.active })
        .from(r)
        .orderBy(desc(r.redeemedCount))
        .limit(5),
      db.execute<{ day: string; issued: number; redeemed: number }>(sql`
        select to_char(date_trunc('day', ${ce.createdAt} at time zone ${TZ}), 'YYYY-MM-DD') as day,
               coalesce(sum(${ce.coins}) filter (where ${ce.status} = 'settled' and ${ce.coins} > 0 and ${ce.type} <> 'refund'), 0)::int as issued,
               coalesce(-sum(${ce.coins}) filter (where ${ce.type} = 'redeem'), 0)::int as redeemed
        from ${ce}
        where ${ce.createdAt} >= ${since30.toISOString()}::timestamptz
        group by 1 order by 1`),
    ]);
    const byDay = new Map([...series].map((x) => [x.day, x]));
    const points: { key: string; label: string; issued: number; redeemed: number }[] = [];
    for (let d = 29; d >= 0; d--) {
      const date = new Date(Date.now() - d * DAY);
      const key = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(date);
      const label = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(date);
      const x = byDay.get(key);
      points.push({ key, label, issued: x?.issued ?? 0, redeemed: x?.redeemed ?? 0 });
    }
    return {
      kpis: {
        ...(totals ?? { circulating: 0, pending: 0, issued: 0, redeemed: 0 }),
        ...(recent ?? { issued30: 0, redeemed30: 0, redemptions30: 0 }),
        members: members?.n ?? 0,
      },
      topRewards,
      series: points,
    };
  });

  // ---- Rewards -----------------------------------------------------------
  const rewardQuery = () =>
    db
      .select({
        reward: r,
        product: { id: schema.products.id, name: schema.products.name, imageUrl: schema.products.imageUrl, priceCents: schema.products.priceCents },
      })
      .from(r)
      .leftJoin(schema.products, eq(schema.products.id, r.productId));

  app.get("/rewards", async () => {
    const rows = await rewardQuery().orderBy(r.sortOrder, r.costCoins, r.createdAt);
    return { items: rows.map(({ reward, product }) => ({ ...serializeReward(reward, product), redeemedCount: reward.redeemedCount })) };
  });

  const toRow = (input: ReturnType<typeof rewardInputSchema.parse>) => ({
    name: input.name,
    description: input.description,
    type: input.type,
    costCoins: input.costCoins,
    value: input.type === "discount_fixed" || input.type === "discount_percent" ? input.value : 0,
    maxDiscountCents: input.type === "discount_percent" ? (input.maxDiscountCents ?? null) : null,
    productId: input.type === "product" ? (input.productId ?? null) : null,
    imageUrl: input.imageUrl ?? null,
    minOrderCents: input.minOrderCents,
    stock: input.stock ?? null,
    maxPerCustomer: input.maxPerCustomer ?? null,
    active: input.active,
    sortOrder: input.sortOrder,
  });

  app.post("/rewards", async (req, reply) => {
    const input = parse(rewardInputSchema, req.body);
    const [row] = await db.insert(r).values(toRow(input)).returning();
    const [full] = await rewardQuery().where(eq(r.id, row!.id));
    return reply.status(201).send({ reward: serializeReward(full!.reward, full!.product) });
  });

  app.put("/rewards/:id", async (req) => {
    const { id } = req.params as { id: string };
    const input = parse(rewardInputSchema, req.body);
    const [row] = await db.update(r).set(toRow(input)).where(eq(r.id, id)).returning({ id: r.id });
    if (!row) throw notFound("Prêmio não encontrado");
    const [full] = await rewardQuery().where(eq(r.id, id));
    return { reward: serializeReward(full!.reward, full!.product) };
  });

  app.patch("/rewards/:id", async (req) => {
    const { id } = req.params as { id: string };
    const { active } = parse(z.object({ active: z.boolean() }), req.body);
    const [row] = await db.update(r).set({ active }).where(eq(r.id, id)).returning({ id: r.id });
    if (!row) throw notFound("Prêmio não encontrado");
    return { ok: true };
  });

  app.delete("/rewards/:id", async (req) => {
    const { id } = req.params as { id: string };
    const [row] = await db.delete(r).where(eq(r.id, id)).returning({ id: r.id });
    if (!row) throw notFound("Prêmio não encontrado");
    return { ok: true };
  });

  // ---- Redemptions (vouchers) --------------------------------------------
  app.get("/redemptions", async (req) => {
    const q = req.query as Record<string, string | undefined>;
    const { page, pageSize, offset } = pageParams(q, 100);
    const conds: SQL[] = [];
    if (q.status && ["available", "applied", "used", "cancelled"].includes(q.status)) conds.push(eq(rd.status, q.status as "available"));
    const term = str(q.q);
    if (term) {
      const pattern = `%${term.toLowerCase()}%`;
      const codePrefix = `${term.toUpperCase().replace(/[^A-Z0-9-]/g, "")}%`;
      conds.push(sql`(${rd.code} like ${codePrefix} or lower(${schema.users.name}) like ${pattern} or lower(${schema.users.email}) like ${pattern})`);
    }
    const where = conds.length ? and(...conds) : undefined;
    const [rows, [{ total } = { total: 0 }]] = await Promise.all([
      db
        .select({ row: rd, number: schema.orders.number, customerName: schema.users.name, customerEmail: schema.users.email })
        .from(rd)
        .innerJoin(schema.users, eq(schema.users.id, rd.userId))
        .leftJoin(schema.orders, eq(schema.orders.id, rd.orderId))
        .where(where)
        .orderBy(desc(rd.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ total: sql<number>`count(*)::int` }).from(rd).innerJoin(schema.users, eq(schema.users.id, rd.userId)).where(where),
    ]);
    return {
      items: rows.map(({ row, number, customerName, customerEmail }) => ({ ...serializeRedemption(row, { orderNumber: number }), customerName, customerEmail })),
      total,
      page,
      pageSize,
    };
  });

  /** Counter flow: the shopper shows the code, the store marks the gift as delivered. */
  app.post("/redemptions/use", async (req) => {
    const { code } = parse(z.object({ code: z.string().trim().min(4).max(40) }), req.body);
    return { redemption: await useGiftVoucher(code) };
  });

  // ---- Customer wallet ---------------------------------------------------
  app.get("/customers/:id/coins", async (req) => {
    const { id } = req.params as { id: string };
    const [rows, [totals]] = await Promise.all([
      db
        .select({ entry: ce, number: schema.orders.number })
        .from(ce)
        .leftJoin(schema.orders, eq(schema.orders.id, ce.orderId))
        .where(eq(ce.userId, id))
        .orderBy(desc(ce.createdAt))
        .limit(60),
      db
        .select({
          balance: sql<number>`coalesce(sum(${ce.coins}) filter (where ${ce.status} = 'settled'), 0)::int`,
          pending: sql<number>`coalesce(sum(${ce.coins}) filter (where ${ce.status} = 'pending'), 0)::int`,
        })
        .from(ce)
        .where(eq(ce.userId, id)),
    ]);
    return {
      balance: totals?.balance ?? 0,
      pending: totals?.pending ?? 0,
      items: rows.map(({ entry, number }) => ({
        id: entry.id,
        type: entry.type,
        status: entry.status,
        coins: entry.coins,
        note: entry.note,
        orderId: entry.orderId,
        orderNumber: number ?? null,
        createdAt: entry.createdAt.toISOString(),
      })),
    };
  });

  app.post("/customers/:id/coins", async (req) => {
    const { id } = req.params as { id: string };
    const { coins, note } = parse(coinAdjustSchema, req.body);
    const [user] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.id, id), eq(schema.users.role, "customer")));
    if (!user) throw notFound("Cliente não encontrado");
    await creditCoins(id, coins, "adjust", note);
    return { ok: true };
  });
};
