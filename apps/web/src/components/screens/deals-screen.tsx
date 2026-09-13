"use client";

import { Percent } from "lucide-react";
import { useState } from "react";
import { CartBar } from "@/components/cart-bar";
import { InfiniteProductGrid, SortChips } from "@/components/product/product-list";
import { Screen, TopBar } from "@/components/ui/screen";

export function DealsScreen() {
  const [sort, setSort] = useState("");
  return (
    <>
      <Screen
        header={
          <>
            <TopBar back title="Ofertas" />
            <div className="shrink-0 bg-canvas pb-3">
              <SortChips value={sort} onChange={setSort} />
            </div>
          </>
        }
      >
        <div
          className="grain relative mx-4 mb-4 flex h-[104px] items-center gap-4 overflow-hidden rounded-[24px] px-5 text-white"
          style={{ background: "linear-gradient(135deg,#b8322a 0%,#e14b3b 60%,#f2785f 100%)" }}
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/15">
            <Percent className="size-6" strokeWidth={2.6} />
          </span>
          <div>
            <p className="font-display text-[22px] leading-tight font-extrabold tracking-[-0.03em]">Ofertas imperdíveis</p>
            <p className="text-[13px] font-medium text-white/80">Preços especiais por tempo limitado</p>
          </div>
          <span aria-hidden className="absolute -right-8 -bottom-12 size-36 rounded-full bg-white/10" />
        </div>
        <div className="pb-24">
          <InfiniteProductGrid query={{ onSale: true, sort }} emptyTitle="Sem ofertas no momento" />
        </div>
      </Screen>
      <CartBar className="bottom-[calc(env(safe-area-inset-bottom)+12px)]" />
    </>
  );
}
