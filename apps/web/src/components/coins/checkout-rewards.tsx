"use client";

import { type Quote, type Redemption } from "@aionix/shared";
import { Check, ChevronRight, Ticket, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { applicableVouchers, coinLabel, useLoyaltyProgram, useSelectedVoucher, useWallet } from "@/lib/loyalty";
import { useSession } from "@/lib/session";
import { sfx } from "@/lib/sound";
import { haptic } from "@/lib/toast";
import { Coin } from "./coin";
import { RewardArt } from "./reward-card";

/**
 * Loyalty pieces shared by the cart and the checkout: the "this order earns N
 * coins" chip, the voucher picker and the summary row. The server decides
 * everything (quote.reward / quote.coinsToEarn); these only render it.
 */

/** Drops a stale selection (voucher used on another order, returned, expired). */
function useVoucherHygiene() {
  const wallet = useWallet();
  const { redemptionId, select } = useSelectedVoucher();
  useEffect(() => {
    if (!redemptionId || !wallet.data) return;
    if (!applicableVouchers(wallet.data).some((v) => v.id === redemptionId)) select(null);
  }, [redemptionId, wallet.data, select]);
}

export function CoinsEarnChip({ quote, className, pickup = false }: { quote: Quote | undefined; className?: string; pickup?: boolean }) {
  const program = useLoyaltyProgram();
  const { user } = useSession();
  const p = program.data;
  if (!p?.enabled || !quote) return null;
  const coins = quote.coinsToEarn;
  return (
    <AnimatePresence initial={false}>
      {coins > 0 && (
        <motion.div
          key="earn"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className={cn("overflow-hidden", className)}
        >
          <div className="flex items-center gap-2.5 rounded-xl bg-coin-soft px-3 py-2 text-[12.5px] font-semibold text-coin-ink">
            <Coin size={18} />
            <span className="min-w-0 flex-1">
              {user ? "Este pedido rende " : "Com conta, este pedido rende "}
              <motion.span key={coins} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className="inline-block font-extrabold tabular text-coin-2">
                {coinLabel(coins, p)}
              </motion.span>
              {p.awardOn === "delivered" ? (pickup ? " na retirada" : " na entrega") : p.awardOn === "confirmed" ? " na confirmação" : ""}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function VoucherOption({ v, active, onPick }: { v: Redemption; active: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn("flex w-full items-center gap-3 rounded-[18px] bg-card p-3.5 text-left ring-2 transition-colors", active ? "ring-coin-3" : "ring-transparent shadow-card")}
    >
      <RewardArt reward={v.reward} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-bold">{v.reward.name}</span>
        <span className="block truncate text-[12.5px] text-muted">{v.reward.label}</span>
      </span>
      <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors", active ? "border-coin-3 bg-coin-3 text-coin-ink" : "border-line")}>
        {active && <Check className="size-3.5" strokeWidth={3.5} />}
      </span>
    </button>
  );
}

/**
 * Compact row: "Usar um prêmio" → sheet with the shopper's vouchers. Renders
 * nothing for guests or when the program is off; nudges to /moedas when the
 * wallet has no voucher but enough coins for one.
 */
export function VoucherPicker({ quote, className }: { quote: Quote | undefined; className?: string }) {
  useVoucherHygiene();
  const { user } = useSession();
  const program = useLoyaltyProgram();
  const wallet = useWallet();
  const { redemptionId, select } = useSelectedVoucher();
  const [open, setOpen] = useState(false);
  const p = program.data;
  if (!user || !p?.enabled || !wallet.data) return null;

  const vouchers = applicableVouchers(wallet.data);
  const affordable = p.rewards.some((r) => r.type !== "gift" && r.costCoins <= wallet.data!.balance);
  if (!vouchers.length && !affordable) return null;

  const selected = vouchers.find((v) => v.id === redemptionId) ?? null;
  const applied = quote?.reward && quote.reward.redemptionId === redemptionId ? quote.reward : null;
  const error = selected && quote && !quote.reward ? quote.rewardError : null;

  if (!vouchers.length) {
    return (
      <Link href="/moedas" className={cn("flex items-center gap-3 rounded-[20px] bg-coin-soft p-3.5 active:scale-[0.99] transition-transform", className)}>
        <Coin size={30} />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold text-coin-ink">Você tem {coinLabel(wallet.data.balance, p)}</span>
          <span className="block text-[12.5px] text-coin-ink/70">Troque por um desconto antes de finalizar</span>
        </span>
        <ChevronRight className="size-5 text-coin-2" />
      </Link>
    );
  }

  return (
    <>
      <div className={cn("overflow-hidden rounded-[20px] bg-card shadow-card", className)}>
        <button type="button" onClick={() => (haptic(), sfx.pop(), setOpen(true))} className="flex w-full items-center gap-3 p-3.5 text-left active:bg-line-2/60">
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-2xl", selected ? "bg-coin-3 text-coin-ink" : "bg-coin-soft text-coin-2")}>
            <Ticket className="size-5" strokeWidth={2.3} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-bold">{selected ? selected.reward.name : "Usar um prêmio"}</span>
            <span className={cn("block truncate text-[12.5px]", applied ? "font-semibold text-brand-2" : error ? "font-semibold text-sale" : "text-muted")}>
              {applied ? `Aplicado · ${applied.label}` : error ? error : selected ? "Calculando…" : `${vouchers.length} ${vouchers.length === 1 ? "voucher disponível" : "vouchers disponíveis"}`}
            </span>
          </span>
          {selected ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Remover prêmio"
              onClick={(e) => (e.stopPropagation(), haptic(), select(null))}
              className="grid size-8 place-items-center rounded-full bg-line-2 text-ink-2"
            >
              <X className="size-4" strokeWidth={2.6} />
            </span>
          ) : (
            <ChevronRight className="size-5 text-faint" />
          )}
        </button>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Seus prêmios">
        <ul className="space-y-2.5 pb-2">
          {vouchers.map((v) => (
            <li key={v.id}>
              <VoucherOption
                v={v}
                active={v.id === redemptionId}
                onPick={() => {
                  haptic([8, 30, 8]);
                  sfx.coin();
                  select(v.id === redemptionId ? null : v.id);
                  setOpen(false);
                }}
              />
            </li>
          ))}
        </ul>
        <Link href="/moedas" onClick={() => setOpen(false)} className="mt-2 mb-2 flex items-center justify-center gap-1.5 text-[13.5px] font-bold text-coin-2">
          <Coin size={16} /> Trocar {p.coinNamePlural.toLowerCase()} por mais prêmios
        </Link>
      </Sheet>
    </>
  );
}

/** Summary line for the applied voucher, matching the cart/checkout row styles. */
export function RewardSummaryRow({ quote }: { quote: Quote | undefined }) {
  if (!quote?.reward) return null;
  const value = quote.reward.freeDelivery ? "Frete grátis" : `− ${(quote.rewardDiscountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
  return (
    <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between text-[14px] font-semibold text-coin-2">
      <span className="flex min-w-0 items-center gap-1.5">
        <Coin size={15} /> <span className="truncate">{quote.reward.name}</span>
      </span>
      <span className="tabular shrink-0">{value}</span>
    </motion.div>
  );
}
