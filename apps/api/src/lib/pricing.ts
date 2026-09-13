import type { LoyaltySettings, Product, Quote, QuoteLine, StoreSettings } from "@aionix/shared";
import { and, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { db, schema } from "../db/client";
import { loadRedemptionForQuote, type QuoteReward } from "./loyalty";
import { applyReward, computeEarnedCoins, describeReward } from "./loyalty-rules";
import { getLoyaltySettings, getSettings } from "./settings";

export interface ActivePromotion {
  id: string;
  name: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  productIds: Set<string>;
  categoryIds: Set<string>;
}

let cache: { at: number; promos: ActivePromotion[] } | null = null;

export function invalidatePricing() {
  cache = null;
}

export async function getActivePromotions(): Promise<ActivePromotion[]> {
  if (cache && Date.now() - cache.at < 30_000) return cache.promos;
  const now = new Date();
  const rows = await db
    .select()
    .from(schema.promotions)
    .where(
      and(
        eq(schema.promotions.active, true),
        lte(schema.promotions.startsAt, now),
        gte(schema.promotions.endsAt, now),
      ),
    );
  const ids = rows.map((r) => r.id);
  const [prodLinks, catLinks] = ids.length
    ? await Promise.all([
        db.select().from(schema.promotionProducts).where(inArray(schema.promotionProducts.promotionId, ids)),
        db.select().from(schema.promotionCategories).where(inArray(schema.promotionCategories.promotionId, ids)),
      ])
    : [[], []];
  const promos = rows.map<ActivePromotion>((r) => ({
    id: r.id,
    name: r.name,
    discountType: r.discountType,
    discountValue: r.discountValue,
    productIds: new Set(prodLinks.filter((l) => l.promotionId === r.id).map((l) => l.productId)),
    categoryIds: new Set(catLinks.filter((l) => l.promotionId === r.id).map((l) => l.categoryId)),
  }));
  cache = { at: Date.now(), promos };
  return promos;
}

interface PriceableProduct {
  id: string;
  categoryId: string;
  priceCents: number;
  compareAtCents: number | null;
  clubPriceCents: number | null;
}

export interface PriceResult {
  finalPriceCents: number;
  compareAtCents: number | null;
  discountPercent: number;
  promotionId: string | null;
  promotionName: string | null;
  clubPriceCents: number | null;
  /** True when finalPriceCents is the club price (only possible for members). */
  viaClub: boolean;
}

export interface PriceOptions {
  /** Applies the club price when it beats promotions. Never set from cached catalog routes. */
  clubMember?: boolean;
}

export interface QuoteOptions extends PriceOptions {
  fulfillmentMethod?: "delivery" | "pickup";
  /** Loyalty program rules; omitted = program off (no coins, no reward). */
  loyalty?: LoyaltySettings;
  /** Voucher requested by the shopper (already checked to belong to them and be available). */
  reward?: QuoteReward | null;
  firstOrder?: boolean;
}

/** Maximum effective discount, whatever the campaign type (mirrors the 90% cap in `promotionInputSchema`). */
export const MAX_DISCOUNT_RATIO = 0.9;

export function applyDiscount(price: number, type: "percent" | "fixed", value: number) {
  const discounted = type === "percent" ? Math.round(price * (1 - value / 100)) : price - value;
  const floor = Math.max(1, Math.ceil(price * (1 - MAX_DISCOUNT_RATIO)));
  return Math.max(floor, discounted);
}

/** Club price with the same floor promotions get; null unless strictly below list price. */
export function effectiveClubPrice(p: Pick<PriceableProduct, "priceCents" | "clubPriceCents">) {
  if (!p.clubPriceCents || p.clubPriceCents >= p.priceCents) return null;
  return Math.max(Math.max(1, Math.ceil(p.priceCents * (1 - MAX_DISCOUNT_RATIO))), p.clubPriceCents);
}

/**
 * Picks the promotion that yields the lowest price for a product. Members pay
 * min(promotion, club price); everyone else pays the promotion price, but the
 * club price is still exposed so the storefront can advertise it.
 */
export function priceProduct(p: PriceableProduct, promos: ActivePromotion[], opts: PriceOptions = {}): PriceResult {
  let best: { price: number; promo: ActivePromotion } | null = null;
  for (const promo of promos) {
    if (!promo.productIds.has(p.id) && !promo.categoryIds.has(p.categoryId)) continue;
    const price = applyDiscount(p.priceCents, promo.discountType, promo.discountValue);
    if (!best || price < best.price) best = { price, promo };
  }
  const promoPrice = best && best.price < p.priceCents ? best.price : null;
  const club = effectiveClubPrice(p);
  // Only advertise the club price when it actually beats what the shelf already offers.
  const clubPriceCents = club !== null && club < (promoPrice ?? p.priceCents) ? club : null;

  if (opts.clubMember && clubPriceCents !== null) {
    return {
      finalPriceCents: clubPriceCents,
      compareAtCents: p.priceCents,
      discountPercent: Math.round(((p.priceCents - clubPriceCents) / p.priceCents) * 100),
      promotionId: null,
      promotionName: null,
      clubPriceCents,
      viaClub: true,
    };
  }
  if (promoPrice !== null) {
    return {
      finalPriceCents: promoPrice,
      compareAtCents: p.priceCents,
      discountPercent: Math.round(((p.priceCents - promoPrice) / p.priceCents) * 100),
      promotionId: best!.promo.id,
      promotionName: best!.promo.name,
      clubPriceCents,
      viaClub: false,
    };
  }
  const compareAt = p.compareAtCents && p.compareAtCents > p.priceCents ? p.compareAtCents : null;
  return {
    finalPriceCents: p.priceCents,
    compareAtCents: compareAt,
    discountPercent: compareAt ? Math.round(((compareAt - p.priceCents) / compareAt) * 100) : 0,
    promotionId: null,
    promotionName: null,
    clubPriceCents,
    viaClub: false,
  };
}

type ProductRow = typeof schema.products.$inferSelect;

export function serializeProduct(row: ProductRow, promos: ActivePromotion[], categorySlug?: string): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    brand: row.brand,
    categoryId: row.categoryId,
    categorySlug,
    priceCents: row.priceCents,
    ...priceProduct(row, promos),
    unit: row.unit,
    unitLabel: row.unitLabel,
    stock: row.stock,
    sku: row.sku,
    imageUrl: row.imageUrl,
    blurDataUrl: row.blurDataUrl,
    active: row.active,
    featured: row.featured,
    tags: row.tags,
  };
}

export interface PricedLine extends QuoteLine {
  promotionId: string | null;
}

export type PricedQuote = Omit<Quote, "lines"> & { lines: PricedLine[] };

export const MAX_LINE_QUANTITY = 99;

/** Merges duplicate lines and caps quantities; order of first appearance is kept. */
export function mergeCartItems(items: { productId: string; quantity: number }[]) {
  const merged = new Map<string, number>();
  for (const i of items) {
    merged.set(i.productId, Math.min(MAX_LINE_QUANTITY, (merged.get(i.productId) ?? 0) + i.quantity));
  }
  return merged;
}

export type QuotableProduct = PriceableProduct & Pick<ProductRow, "name" | "imageUrl" | "unitLabel" | "stock">;
type QuoteSettings = Pick<StoreSettings, "deliveryFeeCents" | "freeDeliveryThresholdCents" | "minimumOrderCents">;

/** Whether a user (by id) currently gets club prices. Anonymous callers never do. */
export async function isClubMember(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const [row] = await db.select({ clubMember: schema.users.clubMember }).from(schema.users).where(eq(schema.users.id, userId));
  return row?.clubMember ?? false;
}

/** True when the user has no non-cancelled order yet (first-order bonus). */
export async function isFirstOrder(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.orders)
    .where(and(eq(schema.orders.userId, userId), ne(schema.orders.status, "cancelled")));
  return (row?.n ?? 0) === 0;
}

/** Authoritative cart pricing. Unknown/inactive products are dropped. */
export async function quoteCart(
  items: { productId: string; quantity: number }[],
  opts: { userId?: string | null; redemptionId?: string | null; fulfillmentMethod?: "delivery" | "pickup" } = {},
): Promise<PricedQuote> {
  const merged = mergeCartItems(items);
  const ids = [...merged.keys()];
  const [settings, loyalty, rows, promos, clubMember, firstOrder, reward] = await Promise.all([
    getSettings(),
    getLoyaltySettings(),
    ids.length
      ? db
          .select()
          .from(schema.products)
          .where(and(inArray(schema.products.id, ids), eq(schema.products.active, true)))
      : Promise.resolve([] as ProductRow[]),
    getActivePromotions(),
    isClubMember(opts.userId),
    isFirstOrder(opts.userId),
    opts.redemptionId && opts.userId ? loadRedemptionForQuote(opts.redemptionId, opts.userId) : Promise.resolve(null),
  ]);
  return buildQuote(merged, rows, promos, settings, { clubMember, firstOrder, loyalty, reward, fulfillmentMethod: opts.fulfillmentMethod });
}

/** Pure quote math: subtotal at list price, discount from promotions/club, delivery fee from settings. */
export function buildQuote(
  merged: Map<string, number>,
  rows: QuotableProduct[],
  promos: ActivePromotion[],
  settings: QuoteSettings,
  opts: QuoteOptions = {},
): PricedQuote {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const clubMember = !!opts.clubMember;

  const lines: PricedLine[] = [];
  let clubDiscountCents = 0;
  let clubPotentialCents = 0;
  for (const [productId, quantity] of merged) {
    const row = byId.get(productId);
    if (!row) continue;
    const price = priceProduct(row, promos, opts);
    if (price.viaClub) {
      // What the member saved beyond what the shelf already offered.
      const shelf = priceProduct(row, promos).finalPriceCents;
      clubDiscountCents += (shelf - price.finalPriceCents) * quantity;
    } else if (price.clubPriceCents !== null) {
      clubPotentialCents += (price.finalPriceCents - price.clubPriceCents) * quantity;
    }
    lines.push({
      productId,
      name: row.name,
      imageUrl: row.imageUrl,
      unitLabel: row.unitLabel,
      quantity,
      unitPriceCents: price.finalPriceCents,
      originalUnitPriceCents: row.priceCents,
      totalCents: price.finalPriceCents * quantity,
      available: row.stock >= quantity,
      stock: row.stock,
      promotionId: price.promotionId,
      clubPriceCents: price.clubPriceCents,
      viaClub: price.viaClub,
      viaReward: false,
    });
  }

  // Promotions and club first; the voucher is a final reduction on the net.
  let subtotalCents = lines.reduce((s, l) => s + l.originalUnitPriceCents * l.quantity, 0);
  const discountCents = lines.reduce((s, l) => s + (l.originalUnitPriceCents - l.unitPriceCents) * l.quantity, 0);
  let net = subtotalCents - discountCents;
  let deliveryFeeCents =
    opts.fulfillmentMethod === "pickup" || lines.length === 0 || net >= settings.freeDeliveryThresholdCents ? 0 : settings.deliveryFeeCents;

  let reward: Quote["reward"] = null;
  let rewardDiscountCents = 0;
  let rewardError: string | null = null;
  const loyalty = opts.loyalty;
  if (opts.reward && loyalty?.enabled && lines.length > 0) {
    const snap = opts.reward.snapshot;
    const outcome = applyReward(snap, {
      netCents: net,
      deliveryFeeCents,
      product: opts.reward.product,
      productQtyInCart: snap.productId ? (merged.get(snap.productId) ?? 0) : 0,
    });
    if (!outcome.ok) rewardError = outcome.error;
    else {
      rewardDiscountCents = outcome.discountCents;
      if (outcome.freeDelivery) deliveryFeeCents = 0;
      if (outcome.freeProduct) {
        // The free unit enters the subtotal at list price and leaves through rewardDiscountCents.
        const fp = opts.reward.product!;
        subtotalCents += fp.priceCents;
        net += fp.priceCents;
        lines.push({
          productId: fp.id,
          name: fp.name,
          imageUrl: fp.imageUrl,
          unitLabel: fp.unitLabel,
          quantity: 1,
          unitPriceCents: 0,
          originalUnitPriceCents: fp.priceCents,
          totalCents: 0,
          available: true,
          stock: fp.stock,
          promotionId: null,
          clubPriceCents: null,
          viaClub: false,
          viaReward: true,
        });
      }
      reward = {
        redemptionId: opts.reward.redemptionId,
        rewardId: snap.rewardId,
        name: snap.name,
        type: snap.type,
        label: describeReward(snap, outcome.freeProduct),
        freeDelivery: outcome.freeDelivery,
        productId: outcome.freeProduct?.id ?? null,
      };
    }
  } else if (opts.reward && lines.length > 0) {
    rewardError = "O programa de fidelidade está pausado no momento";
  }

  const paidForProducts = net - rewardDiscountCents;
  const coinsToEarn = loyalty && lines.length > 0 ? computeEarnedCoins(paidForProducts, loyalty, { clubMember, firstOrder: opts.firstOrder }) : 0;

  return {
    lines,
    subtotalCents,
    discountCents,
    clubDiscountCents,
    clubPotentialCents,
    clubMember,
    deliveryFeeCents,
    totalCents: paidForProducts + deliveryFeeCents,
    freeDeliveryThresholdCents: settings.freeDeliveryThresholdCents,
    minimumOrderCents: settings.minimumOrderCents,
    itemCount: lines.reduce((s, l) => s + (l.viaReward ? 0 : l.quantity), 0),
    reward,
    rewardDiscountCents,
    rewardError,
    coinsToEarn,
  };
}
