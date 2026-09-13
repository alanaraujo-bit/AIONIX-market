import { describe, expect, it, vi } from "vitest";
import type { LoyaltySettings } from "@aionix/shared";
import { applyReward, computeEarnedCoins, describeReward, rewardMinOrderCents, voucherCode, type RewardSnapshot } from "./loyalty-rules";

vi.mock("../db/client", () => ({ db: {}, schema: {} }));
vi.mock("./settings", () => ({ getSettings: vi.fn(), getLoyaltySettings: vi.fn() }));
vi.mock("./loyalty", () => ({ loadRedemptionForQuote: vi.fn() }));

const { buildQuote } = await import("./pricing");

const loyalty: LoyaltySettings = {
  enabled: true,
  coinName: "Moeda",
  coinNamePlural: "Moedas",
  coinEmoji: "🪙",
  earnCoins: 1,
  earnPerCents: 1000,
  minOrderCents: 0,
  awardOn: "delivered",
  clubBonusPercent: 0,
  signupBonusCoins: 0,
  firstOrderBonusCoins: 0,
  tagline: "",
};

const snap = (over: Partial<RewardSnapshot> = {}): RewardSnapshot => ({
  rewardId: "rw",
  name: "Prêmio",
  description: "",
  type: "discount_fixed",
  value: 1000,
  maxDiscountCents: null,
  productId: null,
  minOrderCents: 0,
  imageUrl: null,
  ...over,
});

describe("computeEarnedCoins", () => {
  it("earns whole steps only", () => {
    expect(computeEarnedCoins(4790, loyalty)).toBe(4);
    expect(computeEarnedCoins(999, loyalty)).toBe(0);
    expect(computeEarnedCoins(10_000, { ...loyalty, earnCoins: 3, earnPerCents: 2500 })).toBe(12);
  });
  it("is zero when the program is off, below the minimum or nothing was paid", () => {
    expect(computeEarnedCoins(5000, { ...loyalty, enabled: false })).toBe(0);
    expect(computeEarnedCoins(5000, { ...loyalty, minOrderCents: 6000 })).toBe(0);
    expect(computeEarnedCoins(0, loyalty)).toBe(0);
  });
  it("applies the club bonus and the first-order bonus", () => {
    expect(computeEarnedCoins(10_000, { ...loyalty, clubBonusPercent: 50 }, { clubMember: true })).toBe(15);
    expect(computeEarnedCoins(10_000, { ...loyalty, clubBonusPercent: 50 }, { clubMember: false })).toBe(10);
    expect(computeEarnedCoins(10_000, { ...loyalty, firstOrderBonusCoins: 20 }, { firstOrder: true })).toBe(30);
  });
});

describe("applyReward", () => {
  it("fixed discount never exceeds the products total and needs the order to cover it", () => {
    expect(applyReward(snap({ value: 1000 }), { netCents: 2500, deliveryFeeCents: 990 })).toEqual({ ok: true, discountCents: 1000, freeDelivery: false, freeProduct: null });
    expect(rewardMinOrderCents(snap({ value: 1000, minOrderCents: 500 }))).toBe(1000);
    expect(applyReward(snap({ value: 1000 }), { netCents: 900, deliveryFeeCents: 990 }).ok).toBe(false);
  });
  it("percent discount rounds and respects the cap", () => {
    expect(applyReward(snap({ type: "discount_percent", value: 15 }), { netCents: 3333, deliveryFeeCents: 0 })).toMatchObject({ ok: true, discountCents: 500 });
    expect(applyReward(snap({ type: "discount_percent", value: 50, maxDiscountCents: 800 }), { netCents: 10_000, deliveryFeeCents: 0 })).toMatchObject({ discountCents: 800 });
  });
  it("free delivery refuses when delivery is already free", () => {
    expect(applyReward(snap({ type: "free_delivery" }), { netCents: 5000, deliveryFeeCents: 990 })).toMatchObject({ ok: true, freeDelivery: true, discountCents: 0 });
    expect(applyReward(snap({ type: "free_delivery" }), { netCents: 20_000, deliveryFeeCents: 0 }).ok).toBe(false);
  });
  it("product reward needs stock beyond what is already in the cart", () => {
    const product = { id: "p9", name: "Café", priceCents: 1890, stock: 2, active: true };
    expect(applyReward(snap({ type: "product", productId: "p9" }), { netCents: 5000, deliveryFeeCents: 0, product, productQtyInCart: 1 })).toMatchObject({ ok: true, discountCents: 1890, freeProduct: { id: "p9" } });
    expect(applyReward(snap({ type: "product", productId: "p9" }), { netCents: 5000, deliveryFeeCents: 0, product, productQtyInCart: 2 }).ok).toBe(false);
    expect(applyReward(snap({ type: "product", productId: "p9" }), { netCents: 5000, deliveryFeeCents: 0, product: { ...product, active: false } }).ok).toBe(false);
  });
  it("gift rewards are not applied to orders", () => {
    expect(applyReward(snap({ type: "gift" }), { netCents: 5000, deliveryFeeCents: 0 }).ok).toBe(false);
  });
  it("describes rewards in plain Portuguese", () => {
    expect(describeReward(snap({ value: 1500 }))).toBe("R$ 15,00 de desconto");
    expect(describeReward(snap({ type: "discount_percent", value: 10, maxDiscountCents: 2000 }))).toBe("10% de desconto (até R$ 20,00)");
    expect(describeReward(snap({ type: "product" }), { name: "Café" })).toBe("Café grátis");
  });
  it("voucher codes are short and unambiguous", () => {
    expect(voucherCode(() => 0)).toBe("AX-AAAA-AAAA");
    expect(voucherCode()).toMatch(/^AX-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });
});

describe("buildQuote with loyalty", () => {
  const product = (over: Partial<Parameters<typeof buildQuote>[1][number]> = {}) => ({
    id: "p1",
    categoryId: "c1",
    name: "Produto",
    imageUrl: null,
    unitLabel: "un",
    stock: 10,
    priceCents: 1000,
    compareAtCents: null,
    clubPriceCents: null,
    ...over,
  });
  const settings = { deliveryFeeCents: 990, freeDeliveryThresholdCents: 15000, minimumOrderCents: 3000 };
  const cart = (qty: number) => new Map([["p1", qty]]);

  it("is byte-identical to a plain quote when no loyalty options are passed", () => {
    const q = buildQuote(cart(5), [product()], [], settings);
    expect(q).toMatchObject({ totalCents: 5990, coinsToEarn: 0, reward: null, rewardDiscountCents: 0, rewardError: null });
  });

  it("previews coins for the amount paid on products (after promotions)", () => {
    const q = buildQuote(cart(5), [product()], [], settings, { loyalty });
    expect(q.coinsToEarn).toBe(5);
    const promo = { id: "x", name: "x", discountType: "percent" as const, discountValue: 50, productIds: new Set(["p1"]), categoryIds: new Set<string>() };
    expect(buildQuote(cart(5), [product()], [promo], settings, { loyalty }).coinsToEarn).toBe(2);
  });

  it("applies a fixed voucher after promotions and earns coins on what is actually paid", () => {
    const q = buildQuote(cart(5), [product()], [], settings, { loyalty, reward: { redemptionId: "rd", snapshot: snap({ value: 1500 }), product: null } });
    expect(q.rewardDiscountCents).toBe(1500);
    expect(q.totalCents).toBe(5000 - 1500 + 990);
    expect(q.reward).toMatchObject({ redemptionId: "rd", label: "R$ 15,00 de desconto", freeDelivery: false });
    expect(q.coinsToEarn).toBe(3);
  });

  it("free delivery voucher zeroes the fee", () => {
    const q = buildQuote(cart(5), [product()], [], settings, { loyalty, reward: { redemptionId: "rd", snapshot: snap({ type: "free_delivery" }), product: null } });
    expect(q.deliveryFeeCents).toBe(0);
    expect(q.totalCents).toBe(5000);
    expect(q.reward?.freeDelivery).toBe(true);
  });

  it("product voucher adds a free line that does not count as an item or as coins", () => {
    const free = { ...product({ id: "p2", name: "Café", priceCents: 1890, stock: 3 }), slug: "cafe", description: "", brand: null, unit: "un", sku: null, blurDataUrl: null, active: true, featured: false, tags: [], soldCount: 0, createdAt: new Date(), updatedAt: new Date() };
    const q = buildQuote(cart(5), [product()], [], settings, { loyalty, reward: { redemptionId: "rd", snapshot: snap({ type: "product", productId: "p2" }), product: free } });
    expect(q.lines).toHaveLength(2);
    expect(q.lines[1]).toMatchObject({ productId: "p2", quantity: 1, unitPriceCents: 0, originalUnitPriceCents: 1890, viaReward: true });
    expect(q.subtotalCents).toBe(5000 + 1890);
    expect(q.rewardDiscountCents).toBe(1890);
    expect(q.totalCents).toBe(5000 + 990);
    expect(q.itemCount).toBe(5);
    expect(q.coinsToEarn).toBe(5);
  });

  it("reports why a voucher could not be applied instead of applying it", () => {
    const q = buildQuote(cart(1), [product()], [], settings, { loyalty, reward: { redemptionId: "rd", snapshot: snap({ value: 5000 }), product: null } });
    expect(q.reward).toBeNull();
    expect(q.rewardDiscountCents).toBe(0);
    expect(q.rewardError).toMatch(/a partir de R\$ 50,00/);
    expect(q.totalCents).toBe(1990);
  });

  it("ignores vouchers and coins when the program is disabled", () => {
    const q = buildQuote(cart(5), [product()], [], settings, { loyalty: { ...loyalty, enabled: false }, reward: { redemptionId: "rd", snapshot: snap(), product: null } });
    expect(q.reward).toBeNull();
    expect(q.rewardError).toMatch(/pausado/);
    expect(q.coinsToEarn).toBe(0);
    expect(q.totalCents).toBe(5990);
  });
});
