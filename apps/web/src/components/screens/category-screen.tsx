"use client";

import { useMemo, useState } from "react";
import { CartBar } from "@/components/cart-bar";
import { InfiniteProductGrid, SortChips } from "@/components/product/product-list";
import { Screen, TopBar } from "@/components/ui/screen";
import { useInfiniteProducts } from "@/lib/products";
import type { Category } from "@/lib/types";

export function CategoryScreen({ slug, category }: { slug: string; category: Category | null }) {
  const [sort, setSort] = useState("");
  const query = useMemo(() => ({ category: slug, sort }), [slug, sort]);
  // Shares the grid's cache; the ISR'd category count can lag behind admin edits.
  const live = useInfiniteProducts(query).data?.pages[0]?.total;
  const count = live ?? category?.productCount;
  return (
    <>
      <Screen
        header={
          <>
            <TopBar
              back
              backFallback="/buscar"
              title={category?.name ?? "Categoria"}
              subtitle={count !== undefined ? `${count} ${count === 1 ? "produto" : "produtos"}` : undefined}
            />
            <div className="shrink-0 bg-canvas pb-3">
              <SortChips value={sort} onChange={setSort} />
            </div>
          </>
        }
      >
        {category && (
          <div className="grain relative mx-4 mb-4 flex h-[92px] items-center overflow-hidden rounded-[24px] px-5" style={{ background: category.color }}>
            <div className="relative z-10">
              <p className="text-[12px] font-bold tracking-[0.06em] text-ink/50 uppercase">Categoria</p>
              <p className="font-display text-[24px] leading-tight font-extrabold tracking-[-0.03em] text-ink">{category.name}</p>
            </div>
            <span className="absolute right-3 -bottom-4 text-[78px] leading-none drop-shadow-[0_10px_12px_rgb(0_0_0/0.14)]">{category.icon}</span>
          </div>
        )}
        <div className="pb-24">
          <InfiniteProductGrid query={query} emptyTitle="Categoria vazia" showCount={false} />
        </div>
      </Screen>
      <CartBar className="bottom-[calc(env(safe-area-inset-bottom)+12px)]" />
    </>
  );
}
