"use client";

import type { Product, Quote } from "@aionix/shared";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  blurDataUrl: string | null;
  unitLabel: string;
  priceCents: number;
  compareAtCents: number | null;
  stock: number;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  add: (p: Product, qty?: number) => void;
  setQuantity: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  /** Puts a previously removed line back (undo). */
  restore: (item: CartItem) => void;
  clear: () => void;
  /** Reconciles prices/stock with the authoritative server quote. */
  syncWithQuote: (quote: Quote) => void;
  replace: (items: CartItem[]) => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (p, qty = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.productId === p.id);
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.productId === p.id ? { ...i, quantity: Math.min(i.quantity + qty, p.stock, 99) } : i,
              ),
            };
          }
          const item: CartItem = {
            productId: p.id,
            slug: p.slug,
            name: p.name,
            imageUrl: p.imageUrl,
            blurDataUrl: p.blurDataUrl,
            unitLabel: p.unitLabel,
            priceCents: p.finalPriceCents,
            compareAtCents: p.compareAtCents,
            stock: p.stock,
            quantity: Math.min(qty, p.stock, 99),
          };
          return { items: [...s.items, item] };
        }),
      setQuantity: (productId, qty) =>
        set((s) => ({
          items:
            qty <= 0
              ? s.items.filter((i) => i.productId !== productId)
              : s.items.map((i) => (i.productId === productId ? { ...i, quantity: Math.min(qty, i.stock, 99) } : i)),
        })),
      remove: (productId) => set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      restore: (item) =>
        set((s) => (s.items.some((i) => i.productId === item.productId) ? s : { items: [...s.items, item] })),
      clear: () => set({ items: [] }),
      replace: (items) => set({ items }),
      syncWithQuote: (quote) =>
        set((s) => {
          const byId = new Map(quote.lines.map((l) => [l.productId, l]));
          let changed = false;
          const items = s.items
            .filter((i) => {
              const keep = byId.has(i.productId);
              if (!keep) changed = true;
              return keep;
            })
            .map((i) => {
              const l = byId.get(i.productId)!;
              const compareAt = l.originalUnitPriceCents > l.unitPriceCents ? l.originalUnitPriceCents : i.compareAtCents;
              if (l.unitPriceCents === i.priceCents && l.stock === i.stock) return i;
              changed = true;
              return { ...i, priceCents: l.unitPriceCents, compareAtCents: compareAt, stock: l.stock };
            });
          return changed ? { items } : s;
        }),
    }),
    { name: "aionix-cart-v1", storage: createJSONStorage(() => localStorage), version: 1 },
  ),
);

export const cartCount = (items: CartItem[]) => items.reduce((s, i) => s + i.quantity, 0);
export const cartTotal = (items: CartItem[]) => items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
export const cartSavings = (items: CartItem[]) =>
  items.reduce((s, i) => s + (i.compareAtCents && i.compareAtCents > i.priceCents ? (i.compareAtCents - i.priceCents) * i.quantity : 0), 0);

/** True after the persisted cart has been read on the client (avoids SSR mismatches). */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

export function useCartQuantity(productId: string) {
  return useCart((s) => s.items.find((i) => i.productId === productId)?.quantity ?? 0);
}
