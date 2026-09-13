import { formatBRL, type LoyaltySettings, type RewardType } from "@aionix/shared";

/**
 * Pure loyalty math. No I/O here so it can be unit-tested and reused by the
 * quote (preview) and the checkout (money) paths alike.
 */

/** Reward fields frozen into `redemptions.snapshot` at redemption time. */
export interface RewardSnapshot {
  rewardId: string | null;
  name: string;
  description: string;
  type: RewardType;
  value: number;
  maxDiscountCents: number | null;
  productId: string | null;
  minOrderCents: number;
  imageUrl: string | null;
}

/** Human summary of what a reward gives ("R$ 10,00 de desconto", "Frete grátis", …). */
export function describeReward(
  r: Pick<RewardSnapshot, "type" | "value" | "maxDiscountCents">,
  product?: { name: string } | null,
): string {
  switch (r.type) {
    case "discount_fixed":
      return `${formatBRL(r.value)} de desconto`;
    case "discount_percent":
      return r.maxDiscountCents ? `${r.value}% de desconto (até ${formatBRL(r.maxDiscountCents)})` : `${r.value}% de desconto`;
    case "free_delivery":
      return "Frete grátis";
    case "product":
      return product ? `${product.name} grátis` : "Produto grátis";
    case "gift":
      return "Brinde para retirar na loja";
  }
}

/** Minimum order (products, after promotions) a reward needs; fixed discounts never exceed the order. */
export function rewardMinOrderCents(r: Pick<RewardSnapshot, "type" | "value" | "minOrderCents">) {
  return r.type === "discount_fixed" ? Math.max(r.minOrderCents, r.value) : r.minOrderCents;
}

export interface RewardContext {
  /** Products total after promotions/club, before the reward. */
  netCents: number;
  deliveryFeeCents: number;
  /** Row for `product` rewards (already fetched by the caller). */
  product?: { id: string; name: string; priceCents: number; stock: number; active: boolean } | null;
  /** Units of the reward product already in the cart (stock must cover both). */
  productQtyInCart?: number;
}

export type RewardOutcome =
  | { ok: true; discountCents: number; freeDelivery: boolean; freeProduct: { id: string; name: string; priceCents: number } | null }
  | { ok: false; error: string };

/** Decides what a voucher does to an order. Never trusts client-supplied amounts. */
export function applyReward(r: RewardSnapshot, ctx: RewardContext): RewardOutcome {
  const min = rewardMinOrderCents(r);
  if (ctx.netCents < min) {
    return { ok: false, error: `Este prêmio vale em pedidos a partir de ${formatBRL(min)} em produtos` };
  }
  switch (r.type) {
    case "discount_fixed":
      return { ok: true, discountCents: Math.min(r.value, ctx.netCents), freeDelivery: false, freeProduct: null };
    case "discount_percent": {
      let discount = Math.round((ctx.netCents * r.value) / 100);
      if (r.maxDiscountCents) discount = Math.min(discount, r.maxDiscountCents);
      return { ok: true, discountCents: Math.min(discount, ctx.netCents), freeDelivery: false, freeProduct: null };
    }
    case "free_delivery":
      if (ctx.deliveryFeeCents === 0) return { ok: false, error: "Este pedido já tem frete grátis. Guarde o prêmio para o próximo!" };
      return { ok: true, discountCents: 0, freeDelivery: true, freeProduct: null };
    case "product": {
      const p = ctx.product;
      if (!p || !p.active) return { ok: false, error: "O produto deste prêmio não está disponível no momento" };
      if (p.stock < (ctx.productQtyInCart ?? 0) + 1) return { ok: false, error: `${p.name} está sem estoque no momento` };
      return { ok: true, discountCents: p.priceCents, freeDelivery: false, freeProduct: { id: p.id, name: p.name, priceCents: p.priceCents } };
    }
    case "gift":
      return { ok: false, error: "Este prêmio é retirado na loja e não se aplica ao pedido" };
  }
}

export interface EarnContext {
  clubMember?: boolean;
  /** True when the shopper has no previous non-cancelled order. */
  firstOrder?: boolean;
}

/**
 * Coins an order earns from the amount actually paid for products
 * (after promotions, club and reward). Whole steps only: R$ 47,90 at
 * "1 coin per R$ 10" earns 4.
 */
export function computeEarnedCoins(basisCents: number, s: LoyaltySettings, ctx: EarnContext = {}): number {
  if (!s.enabled || basisCents <= 0 || basisCents < s.minOrderCents) return 0;
  let coins = Math.floor(basisCents / s.earnPerCents) * s.earnCoins;
  if (ctx.clubMember && s.clubBonusPercent > 0) coins = Math.round(coins * (1 + s.clubBonusPercent / 100));
  if (ctx.firstOrder) coins += s.firstOrderBonusCoins;
  return coins;
}

/** Earned coins for a hypothetical basket total — used by the storefront ("este pedido rende N"). */
export function previewCoins(basisCents: number, s: Pick<LoyaltySettings, "enabled" | "earnCoins" | "earnPerCents" | "minOrderCents">) {
  if (!s.enabled || basisCents < s.minOrderCents) return 0;
  return Math.floor(basisCents / s.earnPerCents) * s.earnCoins;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Short human-friendly voucher code, e.g. "AX-7F3K-9QWD". */
export function voucherCode(random: (n: number) => number = (n) => Math.floor(Math.random() * n)) {
  const part = () => Array.from({ length: 4 }, () => CODE_ALPHABET[random(CODE_ALPHABET.length)]).join("");
  return `AX-${part()}-${part()}`;
}
