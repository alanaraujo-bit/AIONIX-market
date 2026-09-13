import type { Achievement, AchievementAward, AchievementInput, MyAchievements } from "@aionix/shared";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema, type DB } from "../db/client";
import { achievements, achievementAwards } from "../db/achievement-schema";
import { achievementLevel, achievementProgress, defaultAchievements, type AchievementFacts } from "./achievement-rules";
import { getSettings } from "./settings";

type Tx = Pick<DB, "select" | "insert" | "update" | "execute">;
export function serializeAchievement(row: typeof achievements.$inferSelect): Achievement { return { ...row.definition, id: row.id, slug: row.slug, active: row.active, sortOrder: row.sortOrder }; }
export function serializeAchievementAward(row: typeof achievementAwards.$inferSelect): AchievementAward { return { id: row.id, achievementId: row.achievementId, snapshot: row.snapshot, awardedAt: row.awardedAt.toISOString(), seenAt: row.seenAt?.toISOString() ?? null }; }

let seeded: Promise<void> | undefined;
export function ensureAchievementDefaults() {
  seeded ??= db.insert(achievements).values(defaultAchievements.map(definition => ({ slug: definition.slug, definition, active: definition.active, sortOrder: definition.sortOrder }))).onConflictDoNothing().then(() => {}).catch(error => { seeded = undefined; throw error; });
  return seeded;
}

async function factsFor(tx: Tx, userId: string, rule?: AchievementInput["rule"]): Promise<AchievementFacts> {
  const o = schema.orders;
  const qualifyingOrder = and(eq(o.userId, userId), eq(o.status, "delivered"),
    rule?.minOrderCents !== undefined ? sql`${o.totalCents} - ${o.deliveryFeeCents} >= ${rule.minOrderCents}` : undefined,
    rule?.paymentMethod ? eq(o.paymentMethod, rule.paymentMethod) : undefined,
    rule?.productId || rule?.categoryId ? sql`exists (select 1 from ${schema.orderItems} ai left join ${schema.products} ap on ap.id = ai.product_id where ai.order_id = ${o.id} ${rule.productId ? sql`and ai.product_id = ${rule.productId}` : sql``} ${rule.categoryId ? sql`and ap.category_id = ${rule.categoryId}` : sql``})` : undefined,
  );
  const [purchases] = await tx.select({
    count: sql<number>`count(*)::int`, single: sql<number>`coalesce(max(${o.totalCents} - ${o.deliveryFeeCents}), 0)::int`, total: sql<number>`coalesce(sum(${o.totalCents} - ${o.deliveryFeeCents}), 0)::float8`,
    days: sql<number>`count(distinct (${o.createdAt} at time zone 'America/Sao_Paulo')::date)::int`,
    months: sql<number>`count(distinct to_char(${o.createdAt} at time zone 'America/Sao_Paulo', 'YYYY-MM'))::int`,
    pickup: sql<number>`count(*) filter (where ${o.fulfillmentMethod} = 'pickup')::int`,
  }).from(o).where(qualifyingOrder);
  const [variety] = await tx.select({ products: sql<number>`count(distinct ${schema.orderItems.productId})::int`, categories: sql<number>`count(distinct ${schema.products.categoryId})::int` }).from(schema.orderItems).innerJoin(o, eq(o.id, schema.orderItems.orderId)).leftJoin(schema.products, eq(schema.products.id, schema.orderItems.productId)).where(and(qualifyingOrder, rule?.productId ? eq(schema.orderItems.productId, rule.productId) : undefined, rule?.categoryId ? eq(schema.products.categoryId, rule.categoryId) : undefined));
  const [redemptions] = await tx.select({ count: sql<number>`count(*)::int` }).from(schema.redemptions).where(and(eq(schema.redemptions.userId, userId), sql`${schema.redemptions.status} <> 'cancelled'`));
  // Bonuses never feed back into achievement rules. Reversed purchases do not count.
  const [coins] = await tx.select({ total: sql<number>`coalesce(sum(${schema.coinEntries.coins}), 0)::float8` }).from(schema.coinEntries).innerJoin(o, eq(o.id, schema.coinEntries.orderId)).where(and(eq(schema.coinEntries.userId, userId), eq(schema.coinEntries.type, "earn"), eq(schema.coinEntries.status, "settled"), qualifyingOrder));
  const [profile] = await tx.select({ complete: sql<number>`case when length(trim(${schema.users.name})) > 0 and length(trim(coalesce(${schema.users.phone}, ''))) > 0 and exists (select 1 from ${schema.addresses} where ${schema.addresses.userId} = ${userId}) then 1 else 0 end` }).from(schema.users).where(eq(schema.users.id, userId));
  return { orders_count: purchases?.count ?? 0, single_spend: purchases?.single ?? 0, total_spend: purchases?.total ?? 0, distinct_products: variety?.products ?? 0, distinct_categories: variety?.categories ?? 0, redemptions_count: redemptions?.count ?? 0, coins_earned: coins?.total ?? 0, shopping_days: purchases?.days ?? 0, shopping_months: purchases?.months ?? 0, profile_complete: profile?.complete ?? 0, pickup_count: purchases?.pickup ?? 0 };
}

/** Reconciliation and optional wallet credit share the loyalty row lock and transaction. */
export async function getMyAchievements(userId: string): Promise<MyAchievements> {
  await ensureAchievementDefaults();
  const settings = await getSettings();
  return db.transaction(async tx => {
    await tx.execute(sql`select 1 from ${schema.users} where ${schema.users.id} = ${userId} for update`);
    const definitions = await tx.select().from(achievements).orderBy(asc(achievements.sortOrder), asc(achievements.createdAt));
    const facts = await factsFor(tx, userId);
    const factSets = new Map<string, AchievementFacts>();
    const factsForRule = async (rule: AchievementInput["rule"]) => {
      const { metric: _metric, target: _target, ...filters } = rule;
      if (!Object.keys(filters).length) return facts;
      const key = JSON.stringify([filters.minOrderCents, filters.productId, filters.categoryId, filters.paymentMethod]);
      let scoped = factSets.get(key);
      if (!scoped) { scoped = await factsFor(tx, userId, rule); factSets.set(key, scoped); }
      return scoped;
    };
    const existing = await tx.select().from(achievementAwards).where(eq(achievementAwards.userId, userId));
    const owned = new Map(existing.map(award => [award.achievementId, award]));
    for (const row of definitions) {
      const definition = serializeAchievement(row);
      if (!row.active || owned.has(row.id) || !achievementProgress(definition.rule, await factsForRule(definition.rule)).complete) continue;
      const [award] = await tx.insert(achievementAwards).values({ userId, achievementId: row.id, snapshot: definition }).onConflictDoNothing().returning();
      if (!award) continue;
      if (definition.bonusCoins > 0) await tx.insert(schema.coinEntries).values({ userId, type: "bonus", status: "settled", coins: definition.bonusCoins, note: `Conquista: ${definition.title}`, settledAt: new Date(), seenAt: new Date() });
      owned.set(row.id, award);
    }
    const awards = [...owned.values()];
    const visible = definitions.filter(row => owned.has(row.id) || row.active && (settings.pickupEnabled || row.definition.rule.metric !== "pickup_count"));
    return {
      achievements: await Promise.all(visible.map(async row => {
        const award = owned.get(row.id);
        const definition = award ? award.snapshot : serializeAchievement(row);
        const progress = achievementProgress(definition.rule, await factsForRule(definition.rule));
        return { ...definition, current: award ? Math.max(progress.current, definition.rule.target) : progress.current, target: definition.rule.target, percent: award ? 100 : progress.percent, unlocked: !!award, unlockedAt: award?.awardedAt.toISOString() ?? null, awardId: award?.id ?? null };
      })),
      summary: { ...achievementLevel(awards.reduce((sum, award) => sum + award.snapshot.xp, 0)), unlocked: awards.length, total: visible.length },
      celebrations: awards.filter(award => !award.seenAt).map(serializeAchievementAward),
      capabilities: { pickup: settings.pickupEnabled },
    };
  });
}

export async function acknowledgeAchievements(userId: string, ids: string[]) {
  if (ids.length) await db.update(achievementAwards).set({ seenAt: new Date() }).where(and(eq(achievementAwards.userId, userId), inArray(achievementAwards.id, ids), isNull(achievementAwards.seenAt)));
}
