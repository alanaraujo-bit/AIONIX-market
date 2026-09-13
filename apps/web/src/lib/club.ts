"use client";

import type { Product } from "@aionix/shared";
import { useSession } from "./session";

/**
 * Club rule: every registered customer who buys through the app is a member
 * (admin can revoke). Catalog payloads are cached and user-agnostic: they carry
 * `clubPriceCents` for everyone. Which price the shopper actually pays is
 * resolved here from the session (for display) and by the server in
 * quote/checkout (for money).
 */
export function useClub() {
  const { user, loading } = useSession();
  return { member: !!user?.clubMember, user, loading };
}

export interface EffectivePrice {
  /** What this shopper pays per unit. */
  cents: number;
  /** Strike-through reference, if any. */
  compareAt: number | null;
  /** True when `cents` is the club price. */
  viaClub: boolean;
  /** Club price on offer for a non-member (null when member or absent). */
  clubOffer: number | null;
  discountPercent: number;
}

/** Resolves the price a shopper sees for a product given club membership. */
export function effectivePrice(p: Pick<Product, "priceCents" | "finalPriceCents" | "compareAtCents" | "clubPriceCents" | "discountPercent">, member: boolean): EffectivePrice {
  if (member && p.clubPriceCents !== null && p.clubPriceCents < p.finalPriceCents) {
    return {
      cents: p.clubPriceCents,
      compareAt: p.priceCents,
      viaClub: true,
      clubOffer: null,
      discountPercent: Math.round(((p.priceCents - p.clubPriceCents) / p.priceCents) * 100),
    };
  }
  return {
    cents: p.finalPriceCents,
    compareAt: p.compareAtCents,
    viaClub: false,
    clubOffer: p.clubPriceCents !== null && p.clubPriceCents < p.finalPriceCents ? p.clubPriceCents : null,
    discountPercent: p.discountPercent,
  };
}

export function useEffectivePrice(p: Parameters<typeof effectivePrice>[0]) {
  const { member } = useClub();
  return effectivePrice(p, member);
}

