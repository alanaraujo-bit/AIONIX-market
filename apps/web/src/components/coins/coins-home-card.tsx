"use client";

import { ChevronRight, Gift } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { coinLabel, useLoyaltyProgram, useWallet } from "@/lib/loyalty";
import { useSession } from "@/lib/session";
import { formatBRL } from "@aionix/shared";
import { Coin } from "./coin";

/**
 * Home entry point to the coin wallet. Guests see the pitch ("R$ 1 = 1 moeda"),
 * shoppers see their balance and how close the next reward is.
 */
export function CoinsHomeCard() {
  const { user } = useSession();
  const program = useLoyaltyProgram();
  const wallet = useWallet();
  const p = program.data;
  if (!p?.enabled) return null;

  const w = wallet.data;
  const next = w?.nextReward ?? null;
  const pct = next ? Math.min(100, ((w?.balance ?? 0) / next.costCoins) * 100) : 100;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 28 }} className="mx-5">
      <Link href="/moedas" className="coin-surface grain flex items-center gap-4 rounded-[24px] p-4 active:scale-[0.99] transition-transform">
        <span className="animate-float">
          <Coin size={50} spin />
        </span>
        <span className="min-w-0 flex-1">
          {user && w ? (
            <>
              <span className="block text-[11px] font-bold tracking-[0.12em] text-coin-ink/70 uppercase">Suas {p.coinNamePlural.toLowerCase()}</span>
              <span className="block font-display text-[24px] leading-tight font-extrabold tracking-[-0.03em] text-coin-ink tabular">
                {w.balance.toLocaleString("pt-BR")}
                {!!w.pending && <span className="ml-1.5 text-[13px] font-bold text-coin-ink/60">+{w.pending.toLocaleString("pt-BR")} a caminho</span>}
              </span>
              {next ? (
                <>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-coin-ink/10">
                    <motion.span className="block h-full rounded-full bg-coin-ink/80" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 90, damping: 20, delay: 0.2 }} />
                  </span>
                  <span className="mt-1 block truncate text-[12px] font-semibold text-coin-ink/75">
                    Faltam {next.missing.toLocaleString("pt-BR")} para {next.name}
                  </span>
                </>
              ) : (
                <span className="mt-0.5 flex items-center gap-1 text-[12.5px] font-bold text-coin-ink/80">
                  <Gift className="size-3.5" /> Você já pode trocar por prêmios
                </span>
              )}
            </>
          ) : (
            <>
              <span className="block font-display text-[18px] leading-tight font-extrabold tracking-[-0.02em] text-coin-ink">
                Compre e ganhe {p.coinNamePlural.toLowerCase()}
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-snug font-medium text-coin-ink/75">
                {formatBRL(p.earnPerCents)} em compras = {coinLabel(p.earnCoins, p)}. Troque por descontos e brindes.
              </span>
            </>
          )}
        </span>
        <ChevronRight className="size-5 shrink-0 text-coin-ink/60" />
      </Link>
    </motion.div>
  );
}
