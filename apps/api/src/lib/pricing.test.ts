import { describe, expect, it, vi } from "vitest";

vi.mock("../db/client", () => ({ db: {}, schema: {} }));
vi.mock("./settings", () => ({ getSettings: vi.fn() }));

const { applyDiscount, buildQuote, mergeCartItems, priceProduct } = await import("./pricing");
type Promo = import("./pricing").ActivePromotion;

const promo = (over: Partial<Promo>): Promo => ({
  id: "promo",
  name: "Promo",
  discountType: "percent",
  discountValue: 10,
  productIds: new Set(),
  categoryIds: new Set(),
  ...over,
});

const product = (over: Partial<Parameters<typeof buildQuote>[1][number]> = {}) => ({
  id: "p1",
  categoryId: "c1",
  name: "Produto",
  imageUrl: null,
  unitLabel: "un",
  stock: 10,
  priceCents: 1000,
  compareAtCents: null,
  ...over,
});

const settings = { deliveryFeeCents: 990, freeDeliveryThresholdCents: 15000, minimumOrderCents: 3000 };

describe("applyDiscount", () => {
  it("rounds percentages to the cent", () => {
    expect(applyDiscount(329, "percent", 15)).toBe(280);
  });
  it("subtracts fixed amounts", () => {
    expect(applyDiscount(1000, "fixed", 250)).toBe(750);
  });
  it("never discounts more than 90% of the list price", () => {
    expect(applyDiscount(329, "fixed", 500)).toBe(33);
    expect(applyDiscount(1000, "fixed", 1000)).toBe(100);
    expect(applyDiscount(5, "fixed", 5)).toBe(1);
  });
});

describe("priceProduct", () => {
  it("returns list price when no promotion targets the product", () => {
    const r = priceProduct(product(), [promo({ productIds: new Set(["other"]) })]);
    expect(r).toMatchObject({ finalPriceCents: 1000, compareAtCents: null, discountPercent: 0, promotionId: null });
  });
  it("applies a category promotion", () => {
    const r = priceProduct(product(), [promo({ id: "cat", categoryIds: new Set(["c1"]), discountValue: 20 })]);
    expect(r).toMatchObject({ finalPriceCents: 800, compareAtCents: 1000, discountPercent: 20, promotionId: "cat" });
  });
  it("picks the lowest price among overlapping promotions", () => {
    const promos = [
      promo({ id: "a", categoryIds: new Set(["c1"]), discountValue: 15 }),
      promo({ id: "b", productIds: new Set(["p1"]), discountType: "fixed", discountValue: 300 }),
      promo({ id: "c", productIds: new Set(["p1"]), discountValue: 5 }),
    ];
    expect(priceProduct(product(), promos)).toMatchObject({ finalPriceCents: 700, promotionId: "b" });
  });
  it("ignores compareAt below the list price", () => {
    expect(priceProduct(product({ compareAtCents: 900 }), [])).toMatchObject({ compareAtCents: null, discountPercent: 0 });
  });
  it("uses compareAt as a strike price when there is no promotion", () => {
    expect(priceProduct(product({ compareAtCents: 1250 }), [])).toMatchObject({
      finalPriceCents: 1000,
      compareAtCents: 1250,
      discountPercent: 20,
    });
  });
  it("a promotion that does not lower the price is not reported", () => {
    const r = priceProduct(product({ priceCents: 1 }), [promo({ productIds: new Set(["p1"]), discountValue: 50 })]);
    expect(r.promotionId).toBeNull();
    expect(r.finalPriceCents).toBe(1);
  });
});

describe("mergeCartItems", () => {
  it("sums duplicates and caps at 99", () => {
    const m = mergeCartItems([
      { productId: "a", quantity: 2 },
      { productId: "b", quantity: 1 },
      { productId: "a", quantity: 98 },
    ]);
    expect([...m]).toEqual([
      ["a", 99],
      ["b", 1],
    ]);
  });
});

describe("buildQuote", () => {
  it("drops unknown products and keeps totals consistent", () => {
    const q = buildQuote(mergeCartItems([{ productId: "p1", quantity: 2 }, { productId: "ghost", quantity: 1 }]), [product()], [], settings);
    expect(q.lines).toHaveLength(1);
    expect(q.itemCount).toBe(2);
    expect(q.subtotalCents).toBe(2000);
    expect(q.discountCents).toBe(0);
    expect(q.deliveryFeeCents).toBe(990);
    expect(q.totalCents).toBe(q.subtotalCents - q.discountCents + q.deliveryFeeCents);
  });
  it("charges no delivery fee for an empty cart", () => {
    const q = buildQuote(new Map(), [], [], settings);
    expect(q).toMatchObject({ deliveryFeeCents: 0, totalCents: 0, itemCount: 0 });
  });
  it("grants free delivery at exactly the threshold, computed after discounts", () => {
    const rows = [product({ priceCents: 7500 })];
    const at = buildQuote(mergeCartItems([{ productId: "p1", quantity: 2 }]), rows, [], settings);
    expect(at.deliveryFeeCents).toBe(0);
    // 10% off drops the net below the threshold → fee applies again
    const under = buildQuote(
      mergeCartItems([{ productId: "p1", quantity: 2 }]),
      rows,
      [promo({ productIds: new Set(["p1"]), discountValue: 10 })],
      settings,
    );
    expect(under).toMatchObject({ subtotalCents: 15000, discountCents: 1500, deliveryFeeCents: 990, totalCents: 14490 });
  });
  it("reports promotion per line and marks unavailable stock", () => {
    const q = buildQuote(
      mergeCartItems([{ productId: "p1", quantity: 3 }]),
      [product({ stock: 2 })],
      [promo({ id: "x", productIds: new Set(["p1"]), discountType: "fixed", discountValue: 100 })],
      settings,
    );
    expect(q.lines[0]).toMatchObject({
      unitPriceCents: 900,
      originalUnitPriceCents: 1000,
      totalCents: 2700,
      available: false,
      promotionId: "x",
    });
    expect(q.discountCents).toBe(300);
  });
  it("passes store thresholds through for the client", () => {
    const q = buildQuote(new Map(), [], [], settings);
    expect(q.minimumOrderCents).toBe(3000);
    expect(q.freeDeliveryThresholdCents).toBe(15000);
  });
});
