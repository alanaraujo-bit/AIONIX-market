import type { CoinEntry, Redemption, Reward, Wallet } from "@aionix/shared";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema, type DB } from "../db/client";
import { publish } from "./events";
import { badRequest, conflict, notFound } from "./http";
import { computeEarnedCoins, describeReward, isCounterVoucher, reversalCoins, voucherCode, type RewardSnapshot } from "./loyalty-rules";
import { getLoyaltySettings } from "./settings";

/**
 * Loyalty data layer. Coins live in an append-only ledger (`coin_entries`);
 * the spendable balance is the sum of *settled* entries. Earned coins start
 * `pending` and settle when the order reaches `settings.awardOn`, so a
 * cancelled order never leaves spendable coins behind.
 */

type Tx = Pick<DB, "select" | "insert" | "update" | "execute">;
type RewardRow = typeof schema.rewards.$inferSelect;
type RedemptionRow = typeof schema.redemptions.$inferSelect;
type CoinEntryRow = typeof schema.coinEntries.$inferSelect;
type ProductRow = typeof schema.products.$inferSelect;

const r = schema.rewards;
const rd = schema.redemptions;
const ce = schema.coinEntries;

export interface QuoteReward {
  redemptionId: string;
  snapshot: RewardSnapshot;
  product: ProductRow | null;
}

// ---- Serializers -----------------------------------------------------------

export function snapshotOf(row: RewardRow): RewardSnapshot {
  return {
    rewardId: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    value: row.value,
    maxDiscountCents: row.maxDiscountCents,
    productId: row.productId,
    minOrderCents: row.minOrderCents,
    imageUrl: row.imageUrl,
  };
}

export function serializeReward(row: RewardRow, product: Pick<ProductRow, "id" | "name" | "imageUrl" | "priceCents"> | null): Reward {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    costCoins: row.costCoins,
    value: row.value,
    maxDiscountCents: row.maxDiscountCents,
    productId: row.productId,
    product: product ? { id: product.id, name: product.name, imageUrl: product.imageUrl, priceCents: product.priceCents } : null,
    imageUrl: row.imageUrl ?? product?.imageUrl ?? null,
    minOrderCents: row.minOrderCents,
    stock: row.stock,
    maxPerCustomer: row.maxPerCustomer,
    active: row.active,
    sortOrder: row.sortOrder,
    label: describeReward(row, product),
  };
}

export function serializeRedemption(row: RedemptionRow, extra: { orderNumber?: number | null; productName?: string | null } = {}): Redemption {
  const s = row.snapshot as RewardSnapshot;
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    coins: row.coins,
    reward: {
      id: s.rewardId,
      name: s.name,
      type: s.type,
      label: describeReward(s, extra.productName ? { name: extra.productName } : null),
      imageUrl: s.imageUrl,
      description: s.description,
      minOrderCents: s.minOrderCents,
      productId: s.productId,
    },
    orderId: row.orderId,
    orderNumber: extra.orderNumber ?? null,
    createdAt: row.createdAt.toISOString(),
    usedAt: row.usedAt ? row.usedAt.toISOString() : null,
  };
}

export function serializeCoinEntry(row: CoinEntryRow, extra: { orderNumber?: number | null; rewardName?: string | null } = {}): CoinEntry {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    coins: row.coins,
    note: row.note,
    orderId: row.orderId,
    orderNumber: extra.orderNumber ?? null,
    rewardName: extra.rewardName ?? null,
    createdAt: row.createdAt.toISOString(),
    settledAt: row.settledAt ? row.settledAt.toISOString() : null,
  };
}

// ---- Reads ----------------------------------------------------------------

export async function listActiveRewards(): Promise<Reward[]> {
  const rows = await db
    .select({ reward: r, product: { id: schema.products.id, name: schema.products.name, imageUrl: schema.products.imageUrl, priceCents: schema.products.priceCents } })
    .from(r)
    .leftJoin(schema.products, eq(schema.products.id, r.productId))
    .where(eq(r.active, true))
    .orderBy(r.sortOrder, r.costCoins);
  return rows
    .filter(({ reward }) => reward.stock === null || reward.stock > 0)
    .map(({ reward, product }) => serializeReward(reward, product));
}

export async function getBalance(userId: string, tx: Tx = db): Promise<number> {
  const [row] = await tx
    .select({ balance: sql<number>`coalesce(sum(${ce.coins}), 0)::int` })
    .from(ce)
    .where(and(eq(ce.userId, userId), eq(ce.status, "settled")));
  return row?.balance ?? 0;
}

/** Voucher the shopper wants to apply; null unless it is theirs and still available. */
export async function loadRedemptionForQuote(redemptionId: string, userId: string): Promise<QuoteReward | null> {
  if (!/^[0-9a-f-]{36}$/i.test(redemptionId)) return null;
  const [row] = await db
    .select()
    .from(rd)
    .where(and(eq(rd.id, redemptionId), eq(rd.userId, userId), eq(rd.status, "available")));
  if (!row) return null;
  const snapshot = row.snapshot as RewardSnapshot;
  const product = snapshot.productId ? (await db.select().from(schema.products).where(eq(schema.products.id, snapshot.productId)))[0] ?? null : null;
  return { redemptionId: row.id, snapshot, product };
}

export async function getWallet(userId: string): Promise<Wallet> {
  const o = schema.orders;
  const [totals, unseen, vouchers, history, rewards] = await Promise.all([
    db
      .select({
        balance: sql<number>`coalesce(sum(${ce.coins}) filter (where ${ce.status} = 'settled'), 0)::int`,
        pending: sql<number>`coalesce(sum(${ce.coins}) filter (where ${ce.status} = 'pending'), 0)::int`,
        earnedTotal: sql<number>`coalesce(sum(${ce.coins}) filter (where ${ce.status} = 'settled' and ${ce.coins} > 0 and ${ce.type} <> 'refund'), 0)::int`,
      })
      .from(ce)
      .where(eq(ce.userId, userId)),
    db
      .select({ entry: ce, number: o.number })
      .from(ce)
      .leftJoin(o, eq(o.id, ce.orderId))
      .where(and(eq(ce.userId, userId), eq(ce.status, "settled"), isNull(ce.seenAt), sql`${ce.coins} > 0`))
      .orderBy(ce.createdAt),
    db
      .select({ row: rd, number: o.number, productName: schema.products.name })
      .from(rd)
      .leftJoin(o, eq(o.id, rd.orderId))
      .leftJoin(schema.products, eq(schema.products.id, sql`(${rd.snapshot}->>'productId')::uuid`))
      .where(and(eq(rd.userId, userId), inArray(rd.status, ["available", "applied", "used"])))
      .orderBy(desc(rd.createdAt))
      .limit(40),
    db
      .select({ entry: ce, number: o.number, rewardName: sql<string | null>`${rd.snapshot}->>'name'` })
      .from(ce)
      .leftJoin(o, eq(o.id, ce.orderId))
      .leftJoin(rd, eq(rd.id, ce.redemptionId))
      .where(eq(ce.userId, userId))
      .orderBy(desc(ce.createdAt))
      .limit(40),
    listActiveRewards(),
  ]);
  const t = totals[0] ?? { balance: 0, pending: 0, earnedTotal: 0 };
  const next = rewards.filter((x) => x.costCoins > t.balance).sort((a, b) => a.costCoins - b.costCoins)[0] ?? null;
  return {
    balance: t.balance,
    pending: t.pending,
    earnedTotal: t.earnedTotal,
    unseen: unseen.map(({ entry, number }) => ({ id: entry.id, coins: entry.coins, type: entry.type, orderNumber: number ?? null, note: entry.note })),
    vouchers: vouchers.map(({ row, number, productName }) => serializeRedemption(row, { orderNumber: number, productName })),
    history: history.map(({ entry, number, rewardName }) => serializeCoinEntry(entry, { orderNumber: number, rewardName })),
    nextReward: next ? { id: next.id, name: next.name, costCoins: next.costCoins, missing: next.costCoins - t.balance } : null,
  };
}

export async function markSeen(userId: string, ids?: string[]) {
  const conds = [eq(ce.userId, userId), isNull(ce.seenAt)];
  if (ids?.length) conds.push(inArray(ce.id, ids));
  await db.update(ce).set({ seenAt: new Date() }).where(and(...conds));
}

// ---- Writes ---------------------------------------------------------------

/** Serializes wallet writes for one shopper (balance check + debit must not interleave). */
async function lockUser(tx: Tx, userId: string) {
  await tx.execute(sql`select 1 from ${schema.users} where ${schema.users.id} = ${userId} for update`);
}

/** Trades coins for a reward; returns the voucher. */
export async function redeemReward(userId: string, rewardId: string): Promise<Redemption> {
  const loyalty = await getLoyaltySettings();
  if (!loyalty.enabled) throw conflict("O programa de fidelidade está pausado", "LOYALTY_DISABLED");
  const row = await db.transaction(async (tx) => {
    await lockUser(tx, userId);
    const [reward] = await tx.select().from(r).where(and(eq(r.id, rewardId), eq(r.active, true)));
    if (!reward) throw notFound("Prêmio não encontrado");
    if (reward.stock !== null && reward.stock <= 0) throw conflict("Este prêmio esgotou", "REWARD_SOLD_OUT");
    if (reward.maxPerCustomer !== null) {
      const [{ n } = { n: 0 }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(rd)
        .where(and(eq(rd.userId, userId), eq(rd.rewardId, rewardId), inArray(rd.status, ["available", "applied", "used"])));
      if (n >= reward.maxPerCustomer) throw conflict("Você já resgatou este prêmio o máximo de vezes", "REWARD_LIMIT");
    }
    const balance = await getBalance(userId, tx);
    if (balance < reward.costCoins) {
      throw conflict(`Faltam ${reward.costCoins - balance} ${reward.costCoins - balance === 1 ? loyalty.coinName : loyalty.coinNamePlural} para este prêmio`, "INSUFFICIENT_COINS");
    }
    if (reward.stock !== null) {
      const updated = await tx
        .update(r)
        .set({ stock: sql`${r.stock} - 1`, redeemedCount: sql`${r.redeemedCount} + 1` })
        .where(and(eq(r.id, rewardId), sql`${r.stock} > 0`))
        .returning({ id: r.id });
      if (!updated.length) throw conflict("Este prêmio esgotou", "REWARD_SOLD_OUT");
    } else {
      await tx.update(r).set({ redeemedCount: sql`${r.redeemedCount} + 1` }).where(eq(r.id, rewardId));
    }
    const [created] = await tx
      .insert(rd)
      .values({ userId, rewardId, code: voucherCode(), coins: reward.costCoins, status: "available", snapshot: snapshotOf(reward) })
      .returning();
    await tx.insert(ce).values({
      userId,
      type: "redeem",
      status: "settled",
      coins: -reward.costCoins,
      redemptionId: created!.id,
      note: reward.name,
      seenAt: new Date(),
      settledAt: new Date(),
    });
    return created!;
  });
  const productName = (row.snapshot as RewardSnapshot).productId
    ? (await db.select({ name: schema.products.name }).from(schema.products).where(eq(schema.products.id, (row.snapshot as RewardSnapshot).productId!)))[0]?.name
    : null;
  return serializeRedemption(row, { productName });
}

/** Gives the coins back for a voucher that was never used. */
export async function cancelRedemption(userId: string, redemptionId: string): Promise<Redemption> {
  const row = await db.transaction(async (tx) => {
    await lockUser(tx, userId);
    const [updated] = await tx
      .update(rd)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(and(eq(rd.id, redemptionId), eq(rd.userId, userId), eq(rd.status, "available")))
      .returning();
    if (!updated) throw conflict("Este prêmio não pode mais ser devolvido", "NOT_CANCELLABLE");
    if (updated.rewardId) {
      await tx
        .update(r)
        .set({ stock: sql`case when ${r.stock} is null then null else ${r.stock} + 1 end`, redeemedCount: sql`greatest(0, ${r.redeemedCount} - 1)` })
        .where(eq(r.id, updated.rewardId));
    }
    await tx.insert(ce).values({
      userId,
      type: "refund",
      status: "settled",
      coins: updated.coins,
      redemptionId: updated.id,
      note: `Devolução: ${(updated.snapshot as RewardSnapshot).name}`,
      seenAt: new Date(),
      settledAt: new Date(),
    });
    return updated;
  });
  return serializeRedemption(row);
}

/** Inside the checkout transaction: reserves the voucher for the order. */
export async function attachRedemptionToOrder(tx: Tx, redemptionId: string, userId: string, orderId: string) {
  const updated = await tx
    .update(rd)
    .set({ status: "applied", orderId })
    .where(and(eq(rd.id, redemptionId), eq(rd.userId, userId), eq(rd.status, "available")))
    .returning({ id: rd.id });
  if (!updated.length) throw conflict("Este prêmio já foi utilizado", "REWARD_UNAVAILABLE");
}

/** Inside the checkout transaction: records the coins the order will earn. */
export async function recordOrderCoins(tx: Tx, input: { userId: string; orderId: string; coins: number; awardOn: "created" | "confirmed" | "delivered" }) {
  if (input.coins <= 0) return;
  const settled = input.awardOn === "created";
  await tx.insert(ce).values({
    userId: input.userId,
    type: "earn",
    status: settled ? "settled" : "pending",
    coins: input.coins,
    orderId: input.orderId,
    settledAt: settled ? new Date() : null,
    // Coins settled at checkout are announced by the success screen; do not replay them as a celebration.
    seenAt: settled ? new Date() : null,
  });
}

/** Immediate credit (signup bonus, admin adjustment). Positive or negative. */
export async function creditCoins(userId: string, coins: number, type: "bonus" | "adjust", note: string | null) {
  if (coins === 0) return;
  await db.transaction(async (tx) => {
    await lockUser(tx, userId);
    if (coins < 0) {
      const balance = await getBalance(userId, tx);
      if (balance + coins < 0) throw conflict(`O cliente tem só ${balance} no saldo; não é possível remover ${-coins}`, "INSUFFICIENT_COINS");
    }
    // Debits are never celebrated; credits are shown on the shopper's next wallet visit.
    await tx.insert(ce).values({ userId, type, status: "settled", coins, note, settledAt: new Date(), seenAt: coins < 0 ? new Date() : null });
  });
  const balance = await getBalance(userId);
  publish({ type: "coins.credited", userId, coins, balance, orderId: null, number: null, note, at: new Date().toISOString() });
}

/**
 * Keeps the ledger in step with an order's status. Returns realtime events
 * to publish once the surrounding transaction commits.
 */
export async function syncOrderLoyalty(
  tx: Tx,
  order: { id: string; userId: string; number: number; redemptionId: string | null },
  status: "confirmed" | "delivered" | "cancelled" | "pending" | "picking" | "out_for_delivery",
): Promise<(() => Promise<void>)[]> {
  const after: (() => Promise<void>)[] = [];
  const loyalty = await getLoyaltySettings();

  if (status === "cancelled") {
    await tx.update(ce).set({ status: "void" }).where(and(eq(ce.orderId, order.id), eq(ce.type, "earn"), eq(ce.status, "pending")));
    const settled = await tx
      .select()
      .from(ce)
      .where(and(eq(ce.orderId, order.id), eq(ce.type, "earn"), eq(ce.status, "settled")));
    if (settled.length) await lockUser(tx, order.userId);
    for (const e of settled) {
      // Never overdraw: coins already spent on rewards stay spent (the store absorbs the difference).
      const take = reversalCoins(e.coins, await getBalance(order.userId, tx));
      if (take <= 0) continue;
      await tx.insert(ce).values({
        userId: order.userId,
        type: "reversal",
        status: "settled",
        coins: -take,
        orderId: order.id,
        note: "Pedido cancelado",
        seenAt: new Date(),
        settledAt: new Date(),
      });
    }
    if (order.redemptionId) {
      // The voucher goes back to the wallet; the shopper can use it on another order.
      await tx.update(rd).set({ status: "available", orderId: null }).where(and(eq(rd.id, order.redemptionId), eq(rd.status, "applied")));
    }
    return after;
  }

  const shouldSettle = status === "delivered" || (status === "confirmed" && loyalty.awardOn === "confirmed");
  if (shouldSettle) {
    const rows = await tx
      .update(ce)
      .set({ status: "settled", settledAt: new Date() })
      .where(and(eq(ce.orderId, order.id), eq(ce.type, "earn"), eq(ce.status, "pending")))
      .returning({ coins: ce.coins });
    const coins = rows.reduce((s, x) => s + x.coins, 0);
    if (coins > 0) {
      after.push(async () => {
        const balance = await getBalance(order.userId);
        publish({ type: "coins.credited", userId: order.userId, coins, balance, orderId: order.id, number: order.number, note: null, at: new Date().toISOString() });
      });
    }
  }
  if (status === "delivered" && order.redemptionId) {
    await tx.update(rd).set({ status: "used", usedAt: new Date() }).where(and(eq(rd.id, order.redemptionId), eq(rd.status, "applied")));
  }
  return after;
}

/** Admin: marks a counter-redeemed gift voucher as used (by id or code). */
export async function useGiftVoucher(idOrCode: string) {
  const isId = /^[0-9a-f-]{36}$/i.test(idOrCode);
  const match = isId ? eq(rd.id, idOrCode) : eq(rd.code, idOrCode.trim().toUpperCase());
  const [row] = await db.select().from(rd).where(match);
  if (!row) throw badRequest("Voucher não encontrado");
  const snap = row.snapshot as RewardSnapshot;
  // Discount/delivery/product vouchers are consumed by an order; marking them here would burn the coins.
  if (!isCounterVoucher(snap)) throw badRequest(`Este código é de "${snap.name}" e só vale dentro de um pedido no app`);
  if (row.status !== "available") throw badRequest("Este brinde já foi entregue ou cancelado");
  const [updated] = await db
    .update(rd)
    .set({ status: "used", usedAt: new Date() })
    .where(and(eq(rd.id, row.id), eq(rd.status, "available")))
    .returning();
  if (!updated) throw badRequest("Este brinde já foi entregue ou cancelado");
  return serializeRedemption(updated);
}

export { computeEarnedCoins };
