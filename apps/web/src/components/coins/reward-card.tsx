"use client";

import { formatBRL, type Reward, type RewardType } from "@aionix/shared";
import { Gift, Lock, Package, Percent, Ticket, Truck } from "lucide-react";
import { motion } from "motion/react";
import { ProductImage } from "@/components/product/product-image";
import { cn } from "@/components/ui/primitives";
import { Coin } from "./coin";

export const REWARD_ICON: Record<RewardType, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  discount_fixed: Ticket,
  discount_percent: Percent,
  free_delivery: Truck,
  product: Package,
  gift: Gift,
};

const TONE: Record<RewardType, string> = {
  discount_fixed: "bg-sale-soft text-sale",
  discount_percent: "bg-club-soft text-club",
  free_delivery: "bg-brand-soft text-brand",
  product: "bg-citrus-soft text-[#8a5a00]",
  gift: "bg-coin-soft text-coin-2",
};

export function RewardArt({ reward, size = "md" }: { reward: Pick<Reward, "type" | "imageUrl" | "name">; size?: "sm" | "md" | "lg" }) {
  const Icon = REWARD_ICON[reward.type];
  const box = size === "lg" ? "size-20 rounded-[24px]" : size === "sm" ? "size-11 rounded-2xl" : "size-14 rounded-[18px]";
  const icon = size === "lg" ? "size-9" : size === "sm" ? "size-5" : "size-6";
  if (reward.imageUrl) {
    return (
      <span className={cn("relative shrink-0 overflow-hidden bg-[#f6f5f1]", box)}>
        <ProductImage src={reward.imageUrl} alt={reward.name} sizes="96px" />
      </span>
    );
  }
  return (
    <span className={cn("grid shrink-0 place-items-center", box, TONE[reward.type])}>
      <Icon className={icon} strokeWidth={2.2} />
    </span>
  );
}

export function RewardCard({ reward, balance, onSelect, index = 0 }: { reward: Reward; balance: number; onSelect: (r: Reward) => void; index?: number }) {
  const affordable = balance >= reward.costCoins;
  const missing = reward.costCoins - balance;
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onSelect(reward)}
      className={cn("relative flex h-full w-full flex-col items-start rounded-[22px] bg-card p-3.5 text-left shadow-card ring-1 ring-transparent transition-shadow", affordable && "ring-coin-3/50 shadow-[0_8px_24px_-12px_rgb(217_138_18/0.45)]")}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <RewardArt reward={reward} />
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-extrabold tabular", affordable ? "bg-coin-soft text-coin-2" : "bg-line-2 text-muted")}>
          <Coin size={13} /> {reward.costCoins.toLocaleString("pt-BR")}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-[14px] leading-snug font-bold tracking-[-0.01em]">{reward.name}</p>
      <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-muted">{reward.description || reward.label}</p>
      {reward.minOrderCents > 0 && <p className="mt-1 truncate text-[11px] font-semibold text-faint">Pedido mín. {formatBRL(reward.minOrderCents)}</p>}
      <span className={cn("mt-auto pt-3 inline-flex h-11 items-center gap-1.5 text-[12.5px] font-bold")}>
        <span className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3", affordable ? "bg-coin-3 text-coin-ink" : "bg-line-2 text-ink-2")}>
        {affordable ? "Resgatar" : (<><Lock className="size-3.5" strokeWidth={2.6} /> Faltam {missing.toLocaleString("pt-BR")}</>)}
        </span>
      </span>
      {reward.stock !== null && reward.stock <= 5 && <span className="absolute top-3 right-3 translate-y-8 rounded-full bg-sale px-1.5 py-0.5 text-[10px] font-extrabold text-white">Últimos {reward.stock}</span>}
    </motion.button>
  );
}
