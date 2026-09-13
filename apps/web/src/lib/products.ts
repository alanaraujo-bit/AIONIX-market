"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api } from "./api";
import type { ProductPage } from "./types";

export interface ProductQuery {
  q?: string;
  category?: string;
  onSale?: boolean;
  club?: boolean;
  sort?: string;
}

export function useInfiniteProducts(query: ProductQuery, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["catalog", "products", query],
    enabled,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ page: String(pageParam), pageSize: "20" });
      if (query.q) params.set("q", query.q);
      if (query.category) params.set("category", query.category);
      if (query.onSale) params.set("onSale", "1");
      if (query.club) params.set("club", "1");
      if (query.sort) params.set("sort", query.sort);
      return api<ProductPage>(`/products?${params}`, { signal });
    },
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  });
}

/** Calls `onVisible` when the returned ref scrolls into view (infinite lists). */
export function useSentinel(onVisible: () => void, active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onVisible);
  cb.current = onVisible;
  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && cb.current(), { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [active]);
  return ref;
}
