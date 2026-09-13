"use client";

import type { LoyaltyProgram, Redemption, Wallet } from "@aionix/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { api } from "./api";
import { useSession } from "./session";

/**
 * Loyalty (coins) client state. The program description is public and
 * user-agnostic; the wallet is per-shopper. Coin names, emoji and rules all
 * come from the store owner's settings — nothing about the currency is
 * hardcoded in the UI.
 */

export function useLoyaltyProgram() {
  return useQuery({
    queryKey: ["loyalty", "program"],
    queryFn: () => api<LoyaltyProgram>("/loyalty/program"),
    staleTime: 60_000,
  });
}

export function useWallet(enabled = true) {
  const { user } = useSession();
  return useQuery({
    queryKey: ["loyalty", "wallet"],
    queryFn: () => api<Wallet>("/me/loyalty"),
    enabled: enabled && !!user,
    staleTime: 20_000,
  });
}

export function useLoyaltyMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["loyalty", "wallet"] });
    void qc.invalidateQueries({ queryKey: ["loyalty", "program"] });
    void qc.invalidateQueries({ queryKey: ["me"] });
  };
  const redeem = useMutation({
    mutationFn: (rewardId: string) => api<{ redemption: Redemption }>("/me/loyalty/redeem", { body: { rewardId } }),
    onSuccess: invalidate,
  });
  const cancel = useMutation({
    mutationFn: (redemptionId: string) => api<{ redemption: Redemption }>(`/me/loyalty/redemptions/${redemptionId}/cancel`, { method: "POST" }),
    onSuccess: invalidate,
  });
  const seen = useMutation({
    mutationFn: (ids: string[]) => api("/me/loyalty/seen", { body: { ids } }),
  });
  return { redeem, cancel, seen, invalidate };
}

/** "12 Moedas" / "1 Moeda", using the store's configured names. */
export function coinLabel(n: number, p: Pick<LoyaltyProgram, "coinName" | "coinNamePlural"> | undefined) {
  const one = p?.coinName ?? "Moeda";
  const many = p?.coinNamePlural ?? "Moedas";
  return `${n.toLocaleString("pt-BR")} ${Math.abs(n) === 1 ? one : many}`;
}

/** Coins a basket total would earn, mirroring the server's whole-step rule (no bonuses). */
export function previewCoins(basisCents: number, p: Pick<LoyaltyProgram, "enabled" | "earnCoins" | "earnPerCents" | "minOrderCents"> | undefined) {
  if (!p?.enabled || basisCents < p.minOrderCents) return 0;
  return Math.floor(basisCents / p.earnPerCents) * p.earnCoins;
}

/** Vouchers that can be applied to an order right now. */
export function applicableVouchers(w: Wallet | undefined) {
  return (w?.vouchers ?? []).filter((v) => v.status === "available" && v.reward.type !== "gift");
}

/** Voucher the shopper chose to apply on the next checkout (survives navigation, not the session). */
export const useSelectedVoucher = create<{ redemptionId: string | null; select: (id: string | null) => void }>()(
  persist((set) => ({ redemptionId: null, select: (redemptionId) => set({ redemptionId }) }), {
    name: "aionix-voucher-v1",
    storage: createJSONStorage(() => sessionStorage),
  }),
);
