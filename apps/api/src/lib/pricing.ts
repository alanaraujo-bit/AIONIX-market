import type { Product, Quote, QuoteLine } from "@aionix/shared";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db, schema } from "../db/client";
import { getSettings } from "./settings";

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
}

export interface PriceResult {
  finalPriceCents: number;
  compareAtCents: number | null;
  discountPercent: number;
  promotionId: string | null;
  promotionName: string | null;
}

export function applyDiscount(price: number, type: "percent" | "fixed", value: number) {
  const discounted = type === "percent" ? Math.round(price * (1 - value / 100)) : price - value;
  return Math.max(1, discounted);
}

/** Picks the promotion that yields the lowest price for a product. */
export function priceProduct(p: PriceableProduct, promos: ActivePromotion[]): PriceResult {
  let best: { price: number; promo: ActivePromotion } | null = null;
  for (const promo of promos) {
    if (!promo.productIds.has(p.id) && !promo.categoryIds.has(p.categoryId)) continue;
    const price = applyDiscount(p.priceCents, promo.discountType, promo.discountValue);
    if (!best || price < best.price) best = { price, promo };
  }
  if (best && best.price < p.priceCents) {
    return {
      finalPriceCents: best.price,
      compareAtCents: p.priceCents,
      discountPercent: Math.round(((p.priceCents - best.price) / p.priceCents) * 100),
      promotionId: best.promo.id,
      promotionName: best.promo.name,
    };
  }
  const compareAt = p.compareAtCents && p.compareAtCents > p.priceCents ? p.compareAtCents : null;
  return {
    finalPriceCents: p.priceCents,
    compareAtCents: compareAt,
    discountPercent: compareAt ? Math.round(((compareAt - p.priceCents) / compareAt) * 100) : 0,
    promotionId: null,
    promotionName: null,
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

/** Authoritative cart pricing. Unknown/inactive products are dropped. */
export async function quoteCart(items: { productId: string; quantity: number }[]) {
  const settings = await getSettings();
  const merged = new Map<string, number>();
  for (const i of items) merged.set(i.productId, Math.min(99, (merged.get(i.productId) ?? 0) + i.quantity));
  const ids = [...merged.keys()];
  const [rows, promos] = await Promise.all([
    ids.length
      ? db
          .select()
          .from(schema.products)
          .where(and(inArray(schema.products.id, ids), eq(schema.products.active, true)))
      : Promise.resolve([] as ProductRow[]),
    getActivePromotions(),
  ]);
  const byId = new Map(rows.map((r) => [r.id, r]));

  const lines: PricedLine[] = [];
  for (const [productId, quantity] of merged) {
    const row = byId.get(productId);
    if (!row) continue;
    const price = priceProduct(row, promos);
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
    });
  }

  const subtotalCents = lines.reduce((s, l) => s + l.originalUnitPriceCents * l.quantity, 0);
  const discountCents = lines.reduce((s, l) => s + (l.originalUnitPriceCents - l.unitPriceCents) * l.quantity, 0);
  const net = subtotalCents - discountCents;
  const deliveryFeeCents =
    lines.length === 0 || net >= settings.freeDeliveryThresholdCents ? 0 : settings.deliveryFeeCents;

  const quote: Omit<Quote, "lines"> & { lines: PricedLine[] } = {
    lines,
    subtotalCents,
    discountCents,
    deliveryFeeCents,
    totalCents: net + deliveryFeeCents,
    freeDeliveryThresholdCents: settings.freeDeliveryThresholdCents,
    minimumOrderCents: settings.minimumOrderCents,
    itemCount: lines.reduce((s, l) => s + l.quantity, 0),
  };
  return quote;
}
