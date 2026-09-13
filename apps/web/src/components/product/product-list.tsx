"use client";

import { SearchX } from "lucide-react";
import { useInfiniteProducts, useSentinel, type ProductQuery } from "@/lib/products";
import { EmptyState, cn } from "../ui/primitives";
import { ProductCardSkeleton, ProductGrid } from "./product-card";

const SORTS = [
  { id: "", label: "Relevância" },
  { id: "price_asc", label: "Menor preço" },
  { id: "price_desc", label: "Maior preço" },
  { id: "name", label: "A–Z" },
];

export function SortChips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="scroll-x flex gap-2 px-4 pb-1">
      {SORTS.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(s.id)}
          className={cn(
            "h-9 shrink-0 rounded-full px-4 text-[13px] font-semibold transition-colors duration-200 active:scale-95",
            value === s.id ? "bg-ink text-white" : "bg-card text-ink-2 ring-1 ring-line",
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

export function InfiniteProductGrid({ query, emptyTitle = "Nada por aqui" }: { query: ProductQuery; emptyTitle?: string }) {
  const q = useInfiniteProducts(query);
  const items = q.data?.pages.flatMap((p) => p.items);
  const total = q.data?.pages[0]?.total ?? 0;
  const sentinel = useSentinel(() => {
    if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
  }, !!q.hasNextPage);

  if (q.isPending) return <ProductGrid loading count={8} />;
  if (!items?.length) {
    return (
      <EmptyState
        icon={<SearchX className="size-9" strokeWidth={1.8} />}
        title={emptyTitle}
        description="Tente outra busca ou explore as categorias."
      />
    );
  }
  return (
    <>
      <p className="px-5 pb-3 text-[12.5px] font-semibold text-muted">
        {total} {total === 1 ? "produto" : "produtos"}
      </p>
      <ProductGrid products={items} />
      {q.hasNextPage && (
        <div ref={sentinel} className="mt-3 grid grid-cols-2 gap-3 px-4">
          <ProductCardSkeleton />
          <ProductCardSkeleton />
        </div>
      )}
    </>
  );
}
