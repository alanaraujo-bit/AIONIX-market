"use client";

import type { Product } from "@aionix/shared";
import { Minus, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCart, useCartQuantity, useHydrated } from "@/lib/cart";
import { haptic, toast } from "@/lib/toast";
import { cn } from "../ui/primitives";

/** Compact "+" that expands into a quantity stepper. */
export function AddToCart({ product, size = "md" }: { product: Product; size?: "md" | "lg" }) {
  const hydrated = useHydrated();
  const qty = useCartQuantity(product.id);
  const add = useCart((s) => s.add);
  const setQuantity = useCart((s) => s.setQuantity);
  const quantity = hydrated ? qty : 0;
  const soldOut = product.stock <= 0;
  const h = size === "lg" ? "h-11" : "h-9";
  const w = size === "lg" ? "w-11" : "w-9";

  if (soldOut) {
    return (
      <span className="rounded-full bg-card/95 px-2.5 py-1.5 text-[11px] font-bold text-muted shadow-card ring-1 ring-line">
        Esgotado
      </span>
    );
  }

  const inc = () => {
    if (quantity >= product.stock) {
      toast.error("Quantidade máxima em estoque");
      return;
    }
    haptic();
    if (quantity === 0) add(product, 1);
    else setQuantity(product.id, quantity + 1);
  };
  const dec = () => {
    haptic(6);
    setQuantity(product.id, quantity - 1);
  };

  return (
    <motion.div
      layout
      transition={{ type: "spring", stiffness: 600, damping: 40 }}
      className={cn(
        "flex items-center overflow-hidden rounded-full shadow-[0_6px_16px_-6px_rgb(12_90_62/0.55)]",
        h,
        quantity > 0 ? "bg-brand text-white" : "bg-brand text-white",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {quantity > 0 && (
          <motion.button
            key="dec"
            type="button"
            aria-label={quantity === 1 ? "Remover" : "Diminuir"}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            whileTap={{ scale: 0.8 }}
            onClick={dec}
            className={cn("grid shrink-0 place-items-center", h, w)}
          >
            {quantity === 1 ? <Trash2 className="size-[15px]" /> : <Minus className="size-4" strokeWidth={2.6} />}
          </motion.button>
        )}
        {quantity > 0 && (
          <motion.span
            key={`q-${quantity}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16 }}
            className="tabular min-w-5 text-center text-[14px] font-bold"
          >
            {quantity}
          </motion.span>
        )}
      </AnimatePresence>
      <motion.button
        layout="position"
        type="button"
        aria-label="Adicionar ao carrinho"
        whileTap={{ scale: 0.8 }}
        onClick={inc}
        className={cn("grid shrink-0 place-items-center", h, w)}
      >
        <Plus className={size === "lg" ? "size-5" : "size-[18px]"} strokeWidth={2.6} />
      </motion.button>
    </motion.div>
  );
}
