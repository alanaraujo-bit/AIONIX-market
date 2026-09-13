import { canTransition, orderStatusUpdateSchema, ORDER_STATUSES, type OrderStatus } from "@aionix/shared";
import { and, desc, eq, gte, inArray, lt, lte, ne, sql, type SQL } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { db, schema } from "../db/client";
import { requireAdmin } from "../lib/auth";
import { publish } from "../lib/events";
import { conflict, notFound, pageParams, parse, str } from "../lib/http";
import { serializeOrder } from "../lib/serializers";
import { loadOrderDetail, restoreStock } from "./account";

const o = schema.orders;
const TZ = "America/Sao_Paulo";
const DAY = 86_400_000;
const ACTIVE: OrderStatus[] = ["pending", "confirmed", "picking", "out_for_delivery"];

/** Start of the current day in São Paulo (UTC-3, no DST since 2019). */
function startOfTodaySP(now = new Date()) {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
  return new Date(`${ymd}T00:00:00-03:00`);
}

function pct(curr: number, prev: number) {
  if (!prev) return curr ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

export const adminOpsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (req) => {
    requireAdmin(req);
  });

  app.get("/dashboard", async (req) => {
    const { range = "today" } = req.query as { range?: string };
    const days = range === "30d" ? 30 : range === "7d" ? 7 : 1;
    const start = new Date(startOfTodaySP().getTime() - (days - 1) * DAY);
    const prevStart = new Date(start.getTime() - days * DAY);
    const notCancelled = ne(o.status, "cancelled");

    const kpiQuery = (from: Date, to?: Date) =>
      db
        .select({
          revenueCents: sql<number>`coalesce(sum(${o.totalCents}) filter (where ${o.status} <> 'cancelled'), 0)::int`,
          orders: sql<number>`count(*) filter (where ${o.status} <> 'cancelled')::int`,
          cancelled: sql<number>`count(*) filter (where ${o.status} = 'cancelled')::int`,
          items: sql<number>`coalesce(sum(${o.itemCount}) filter (where ${o.status} <> 'cancelled'), 0)::int`,
          customers: sql<number>`count(distinct ${o.userId})::int`,
        })
        .from(o)
        .where(to ? and(gte(o.createdAt, from), lt(o.createdAt, to)) : gte(o.createdAt, from));

    const bucket = days === 1 ? "hour" : "day";
    const fmt = days === 1 ? "HH24" : "YYYY-MM-DD";
    const [[curr], [prev], series, statusRows, topProducts, lowStock, recent, [newCustomers]] = await Promise.all([
      kpiQuery(start),
      kpiQuery(prevStart, start),
      db.execute<{ bucket: string; revenue: number; orders: number }>(sql`
        select to_char(date_trunc(${bucket}, ${o.createdAt} at time zone ${TZ}), ${fmt}) as bucket,
               coalesce(sum(${o.totalCents}), 0)::int as revenue,
               count(*)::int as orders
        from ${o}
        where ${o.createdAt} >= ${start.toISOString()}::timestamptz and ${o.status} <> 'cancelled'
        group by 1 order by 1`),
      db
        .select({ status: o.status, n: sql<number>`count(*)::int` })
        .from(o)
        .where(inArray(o.status, ACTIVE))
        .groupBy(o.status),
      db
        .select({
          productId: schema.orderItems.productId,
          name: schema.orderItems.name,
          imageUrl: sql<string | null>`max(${schema.orderItems.imageUrl})`,
          units: sql<number>`sum(${schema.orderItems.quantity})::int`,
          revenueCents: sql<number>`sum(${schema.orderItems.totalCents})::int`,
        })
        .from(schema.orderItems)
        .innerJoin(o, eq(o.id, schema.orderItems.orderId))
        .where(and(gte(o.createdAt, start), notCancelled))
        .groupBy(schema.orderItems.productId, schema.orderItems.name)
        .orderBy(desc(sql`sum(${schema.orderItems.quantity})`))
        .limit(6),
      db
        .select({
          id: schema.products.id,
          name: schema.products.name,
          stock: schema.products.stock,
          imageUrl: schema.products.imageUrl,
          unitLabel: schema.products.unitLabel,
        })
        .from(schema.products)
        .where(and(eq(schema.products.active, true), lte(schema.products.stock, 10)))
        .orderBy(schema.products.stock)
        .limit(6),
      db
        .select({ order: o, customerName: schema.users.name })
        .from(o)
        .innerJoin(schema.users, eq(schema.users.id, o.userId))
        .orderBy(desc(o.createdAt))
        .limit(8),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.users)
        .where(and(eq(schema.users.role, "customer"), gte(schema.users.createdAt, start))),
    ]);

    // Fill empty buckets so charts render a continuous axis.
    const byBucket = new Map([...series].map((r) => [r.bucket, r]));
    const points: { label: string; key: string; revenueCents: number; orders: number }[] = [];
    if (days === 1) {
      for (let h = 0; h < 24; h++) {
        const key = String(h).padStart(2, "0");
        const r = byBucket.get(key);
        points.push({ key, label: `${key}h`, revenueCents: r?.revenue ?? 0, orders: r?.orders ?? 0 });
      }
    } else {
      for (let d = 0; d < days; d++) {
        const date = new Date(start.getTime() + d * DAY + 12 * 3600_000);
        const key = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(date);
        const label = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(date);
        const r = byBucket.get(key);
        points.push({ key, label, revenueCents: r?.revenue ?? 0, orders: r?.orders ?? 0 });
      }
    }

    const c = curr ?? { revenueCents: 0, orders: 0, cancelled: 0, items: 0, customers: 0 };
    const pv = prev ?? { revenueCents: 0, orders: 0, cancelled: 0, items: 0, customers: 0 };
    const avg = c.orders ? Math.round(c.revenueCents / c.orders) : 0;
    const prevAvg = pv.orders ? Math.round(pv.revenueCents / pv.orders) : 0;
    const statusCounts = Object.fromEntries(ACTIVE.map((s) => [s, 0])) as Record<string, number>;
    for (const r of statusRows) statusCounts[r.status] = r.n;

    return {
      range,
      generatedAt: new Date().toISOString(),
      kpis: {
        revenueCents: c.revenueCents,
        revenueDelta: pct(c.revenueCents, pv.revenueCents),
        orders: c.orders,
        ordersDelta: pct(c.orders, pv.orders),
        avgTicketCents: avg,
        avgTicketDelta: pct(avg, prevAvg),
        itemsSold: c.items,
        cancelled: c.cancelled,
        newCustomers: newCustomers?.n ?? 0,
        activeOrders: ACTIVE.reduce((s, k) => s + (statusCounts[k] ?? 0), 0),
      },
      pipeline: statusCounts,
      series: points,
      topProducts,
      lowStock,
      recentOrders: recent.map((r) => ({ ...serializeOrder(r.order), customerName: r.customerName })),
    };
  });

  app.get("/orders", async (req) => {
    const q = req.query as Record<string, string | undefined>;
    const { page, pageSize, offset } = pageParams(q, 100);
    const conds: SQL[] = [];
    if (q.status === "active") conds.push(inArray(o.status, ACTIVE));
    else if (q.status && (ORDER_STATUSES as readonly string[]).includes(q.status)) {
      conds.push(eq(o.status, q.status as OrderStatus));
    }
    const term = str(q.q);
    if (term) {
      const digits = term.replace(/\D/g, "");
      const pattern = `%${term.toLowerCase()}%`;
      conds.push(
        sql`(${digits ? sql`${o.number} = ${Number(digits)} or ` : sql``}lower(${schema.users.name}) like ${pattern} or lower(${schema.users.email}) like ${pattern})`,
      );
    }
    const where = conds.length ? and(...conds) : undefined;
    const [rows, [{ total } = { total: 0 }], counts] = await Promise.all([
      db
        .select({ order: o, customerName: schema.users.name, customerPhone: schema.users.phone })
        .from(o)
        .innerJoin(schema.users, eq(schema.users.id, o.userId))
        .where(where)
        .orderBy(desc(o.createdAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(o)
        .innerJoin(schema.users, eq(schema.users.id, o.userId))
        .where(where),
      db.select({ status: o.status, n: sql<number>`count(*)::int` }).from(o).groupBy(o.status),
    ]);
    return {
      items: rows.map((r) => ({ ...serializeOrder(r.order), customerName: r.customerName, customerPhone: r.customerPhone })),
      total,
      page,
      pageSize,
      counts: Object.fromEntries(counts.map((c) => [c.status, c.n])),
    };
  });

  app.get("/orders/:id", async (req) => {
    const { id } = req.params as { id: string };
    const detail = /^[0-9a-f-]{36}$/i.test(id) ? await loadOrderDetail(id) : null;
    if (!detail) throw notFound("Pedido não encontrado");
    return {
      order: serializeOrder(detail.order, { items: detail.items, events: detail.events, customer: detail.customer }),
    };
  });

  app.patch("/orders/:id/status", async (req) => {
    const { id } = req.params as { id: string };
    const { status, note } = parse(orderStatusUpdateSchema, req.body);
    const updated = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(o).where(eq(o.id, id)).for("update");
      if (!current) throw notFound("Pedido não encontrado");
      if (!canTransition(current.status, status)) {
        throw conflict("Transição de status inválida para este pedido", "INVALID_TRANSITION");
      }
      const [row] = await tx.update(o).set({ status }).where(eq(o.id, id)).returning();
      if (status === "cancelled") await restoreStock(tx, id);
      await tx.insert(schema.orderEvents).values({ orderId: id, status, note: note ?? null });
      return row!;
    });
    publish({
      type: "order.updated",
      orderId: updated.id,
      userId: updated.userId,
      number: updated.number,
      status: updated.status,
      totalCents: updated.totalCents,
      at: new Date().toISOString(),
    });
    return { order: serializeOrder(updated) };
  });
};
