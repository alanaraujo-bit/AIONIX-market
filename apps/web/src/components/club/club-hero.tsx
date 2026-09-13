"use client";

import { formatBRL, type Product } from "@aionix/shared";
import { ChevronRight, Crown, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useMe } from "@/lib/account";
import { useClub } from "@/lib/club";
import { haptic } from "@/lib/toast";
import { useClubSheet } from "./club-sheet";

/**
 * Home-page club card. Non-members get a concrete, product-anchored pitch
 * ("pay X instead of Y"); members get their running savings.
 */
export function ClubHero({ products }: { products: Product[] }) {
  const { member, user } = useClub();
  const me = useMe(member);
  const sample = products.find((p) => p.clubPriceCents !== null);
  const saved = me.data?.stats.clubSavedCents ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="club-surface grain mx-5 rounded-[26px] p-5 text-white"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-[18px] bg-white/12 ring-1 ring-white/20">
          <Crown className="size-6 text-club-gold-2 animate-twinkle" strokeWidth={2.4} fill="currentColor" />
        </span>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold tracking-[0.1em] text-club-gold-2 uppercase ring-1 ring-white/15">
          {member ? "Membro" : "Grátis"}
        </span>
      </div>

      {member ? (
        <>
          <h2 className="mt-4 font-display text-[23px] leading-[1.08] font-extrabold tracking-[-0.03em]">
            Olá, {user?.name.split(" ")[0]}. <span className="club-gold-text">Seus preços de Clube</span> estão valendo.
          </h2>
          <p className="mt-2 text-[13.5px] leading-snug text-white/75">
            {saved > 0 ? (
              <>
                Você já economizou <span className="tabular font-bold text-white">{formatBRL(saved)}</span> com o Clube.
              </>
            ) : (
              "Procure a coroa nos produtos: é o seu preço de membro."
            )}
          </p>
          <Link href="/clube" className="mt-4 inline-flex h-11 items-center gap-1.5 rounded-2xl bg-white/12 px-4 text-[14px] font-bold ring-1 ring-white/20 active:scale-[0.98] transition-transform">
            Ver produtos do Clube <ChevronRight className="size-4" />
          </Link>
        </>
      ) : (
        <>
          <h2 className="mt-4 font-display text-[23px] leading-[1.08] font-extrabold tracking-[-0.03em]">
            Clube AIONIX: <span className="club-gold-text">preço de membro</span>, sem mensalidade.
          </h2>
          <p className="mt-2 text-[13.5px] leading-snug text-white/75">
            {sample ? (
              <>
                {sample.name.split(" ").slice(0, 3).join(" ")} por <span className="tabular font-bold text-white">{formatBRL(sample.clubPriceCents!)}</span>{" "}
                <span className="tabular line-through opacity-70">{formatBRL(sample.finalPriceCents)}</span>. E tem mais.
              </>
            ) : (
              "Produtos selecionados com preço exclusivo para quem é do Clube."
            )}
          </p>
          <button
            type="button"
            onClick={() => (haptic(), useClubSheet.getState().show(sample ?? null))}
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-2xl bg-club-gold px-4 text-[14px] font-extrabold text-club-2 shadow-[0_10px_24px_-8px_rgb(228_181_74/0.7)] active:scale-[0.98] transition-transform"
          >
            <Sparkles className="size-4" strokeWidth={2.4} /> Quero fazer parte
          </button>
        </>
      )}
    </motion.div>
  );
}
