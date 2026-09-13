"use client";

import type { Product } from "@aionix/shared";
import Link from "next/link";
import { Skeleton, cn } from "../ui/primitives";
import { AddToCart } from "./add-to-cart";
import { Price } from "./price";
import { ProductImage } from "./product-image";

export function ProductCard({ product, priority, className }: { product: Product; priority?: boolean; className?: string }) {
  const href = `/produto/${product.slug}`;
  const soldOut = product.stock <= 0;
  return (
    <article className={cn("relative flex flex-col rounded-[22px] bg-card p-2 shadow-card", className)}>
      <div className="relative">
        <Link href={href} className="relative block aspect-square overflow-hidden rounded-[16px] bg-[#f6f5f1]" aria-label={product.name}>
          <ProductImage src={product.imageUrl} blur={product.blurDataUrl} alt={product.name} priority={priority} className={soldOut ? "opacity-40 grayscale" : undefined} />
          {product.discountPercent > 0 && (
            <span className="absolute top-2 left-2 rounded-full bg-sale px-2 py-0.5 text-[11px] leading-[18px] font-bold text-white">
              -{product.discountPercent}%
            </span>
          )}
        </Link>
        <div className="absolute right-1.5 bottom-1.5">
          <AddToCart product={product} />
        </div>
      </div>
      <Link href={href} className="block px-1.5 pt-2 pb-1">
        <Price cents={product.finalPriceCents} compareAt={product.compareAtCents} size="sm" />
        <p className="line-clamp-2 mt-0.5 min-h-[2.5em] text-[13px] leading-[1.25] font-medium text-ink-2">{product.name}</p>
        <p className="mt-0.5 truncate text-[11.5px] font-medium text-muted">{product.unitLabel || " "}</p>
      </Link>
    </article>
  );
}

export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-[22px] bg-card p-2 shadow-card", className)}>
      <Skeleton className="aspect-square w-full rounded-[16px]" />
      <div className="space-y-1.5 px-1.5 pt-2.5 pb-1">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

export function ProductRail({ products, loading, priority }: { products?: Product[]; loading?: boolean; priority?: boolean }) {
  return (
    <div className="scroll-x flex snap-x snap-mandatory scroll-px-5 gap-3 px-5 pb-2">
      {loading || !products
        ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} className="w-[152px] shrink-0" />)
        : products.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={priority && i < 3} className="w-[152px] shrink-0 snap-start" />
          ))}
    </div>
  );
}

export function ProductGrid({ products, loading, count = 6 }: { products?: Product[]; loading?: boolean; count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 px-4">
      {loading || !products
        ? Array.from({ length: count }).map((_, i) => <ProductCardSkeleton key={i} />)
        : products.map((p, i) => <ProductCard key={p.id} product={p} priority={i < 4} />)}
    </div>
  );
}
