"use client";

import type { Quote } from "@aionix/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useCart, useHydrated } from "./cart";

/** Authoritative server pricing for the current cart, debounced while the user edits quantities. */
export function useCartQuote() {
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const syncWithQuote = useCart((s) => s.syncWithQuote);
  const key = useMemo(() => items.map((i) => `${i.productId}:${i.quantity}`).sort().join(","), [items]);
  const [debounced, setDebounced] = useState(key);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(key), 350);
    return () => clearTimeout(t);
  }, [key]);

  const q = useQuery({
    queryKey: ["quote", debounced],
    enabled: hydrated && debounced.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    queryFn: () =>
      api<Quote>("/cart/quote", {
        body: {
          items: debounced.split(",").map((pair) => {
            const [productId, quantity] = pair.split(":");
            return { productId: productId!, quantity: Number(quantity) };
          }),
        },
      }),
  });

  useEffect(() => {
    if (q.data && !q.isPlaceholderData) syncWithQuote(q.data);
  }, [q.data, q.isPlaceholderData, syncWithQuote]);

  return { quote: q.data, loading: q.isFetching || key !== debounced, error: q.error };
}
