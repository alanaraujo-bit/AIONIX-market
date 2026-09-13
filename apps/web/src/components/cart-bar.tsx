"use client";

import { formatBRL } from "@aionix/shared";
import { ChevronRight, ShoppingBag } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { cartCount, cartTotal, useCart, useHydrated } from "@/lib/cart";
import { cn } from "./ui/primitives";

/** Floating mini-cart that surfaces the checkout path while browsing. */
export function CartBar({ className }: { className?: string }) {
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const count = cartCount(items);
  const total = cartTotal(items);

  return (
    <div className={cn("pointer-events-none absolute inset-x-0 z-20 px-4", className)}>
      <AnimatePresence>
        {hydrated && count > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="pointer-events-auto"
          >
            <Link
              href="/carrinho"
              className="flex h-14 items-center gap-3 rounded-[20px] bg-brand pr-3 pl-2 text-white shadow-float active:scale-[0.985] transition-transform"
            >
              <span className="relative grid size-10 place-items-center rounded-2xl bg-white/12">
                <ShoppingBag className="size-5" />
                <motion.span
                  key={count}
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 600, damping: 14 }}
                  className="tabular absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-citrus px-1 text-[11px] font-bold text-ink"
                >
                  {count}
                </motion.span>
              </span>
              <span className="flex-1 text-[15px] font-semibold">Ver carrinho</span>
              <motion.span key={total} initial={{ opacity: 0.4, y: -3 }} animate={{ opacity: 1, y: 0 }} className="tabular font-display text-[16px] font-bold">
                {formatBRL(total)}
              </motion.span>
              <ChevronRight className="size-5 opacity-70" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
