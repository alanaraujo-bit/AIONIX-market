"use client";

import { formatBRL } from "@aionix/shared";
import { Check, Crown, Gift, PiggyBank, UserRoundPlus } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { CartBar } from "@/components/cart-bar";
import { useClubSheet } from "@/components/club/club-sheet";
import { InfiniteProductGrid, SortChips } from "@/components/product/product-list";
import { Screen, TopBar } from "@/components/ui/screen";
import { useMe } from "@/lib/account";
import { useClub } from "@/lib/club";
import { haptic } from "@/lib/toast";

const PERKS = [
  { icon: UserRoundPlus, label: "Basta criar sua conta e comprar pelo app" },
  { icon: Crown, label: "Preço de membro nos produtos com a coroa" },
  { icon: PiggyBank, label: "Economia acumulada na sua conta" },
  { icon: Gift, label: "Grátis. Sem mensalidade, sem fidelidade" },
];

function formatSince(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function ClubScreen() {
  const [sort, setSort] = useState("");
  const { member, user } = useClub();
  const me = useMe(member);
  const saved = me.data?.stats.clubSavedCents ?? 0;
  const since = formatSince(user?.clubJoinedAt ?? null);

  return (
    <>
      <Screen
        header={
          <>
            <TopBar back title="Clube AIONIX" />
            <div className="shrink-0 bg-canvas pb-3">
              <SortChips value={sort} onChange={setSort} />
            </div>
          </>
        }
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className="club-surface grain relative mx-4 mb-5 overflow-hidden rounded-[28px] p-5 text-white"
        >
          <span className="grid size-14 place-items-center rounded-[20px] bg-white/12 ring-1 ring-white/20">
            <Crown className="size-7 text-club-gold-2 animate-twinkle" strokeWidth={2.4} fill="currentColor" />
          </span>
          {member ? (
            <>
              <p className="mt-4 text-[11.5px] font-bold tracking-[0.12em] text-club-gold-2 uppercase">
                Membro{since ? ` desde ${since}` : ""}
              </p>
              <h2 className="mt-1 font-display text-[26px] leading-[1.06] font-extrabold tracking-[-0.03em]">
                {user?.name.split(" ")[0]}, tudo aqui está <span className="club-gold-text">no seu preço</span>.
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <div className="rounded-[18px] bg-white/10 p-3 ring-1 ring-white/15">
                  <p className="text-[11px] font-bold tracking-[0.08em] text-white/60 uppercase">Economia no Clube</p>
                  <p className="tabular mt-0.5 font-display text-[22px] font-extrabold tracking-[-0.03em] club-gold-text">{formatBRL(saved)}</p>
                </div>
                <div className="rounded-[18px] bg-white/10 p-3 ring-1 ring-white/15">
                  <p className="text-[11px] font-bold tracking-[0.08em] text-white/60 uppercase">Mensalidade</p>
                  <p className="mt-0.5 font-display text-[22px] font-extrabold tracking-[-0.03em]">R$ 0</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="mt-4 text-[11.5px] font-bold tracking-[0.12em] text-club-gold-2 uppercase">Para quem compra pelo app</p>
              <h2 className="mt-1 font-display text-[26px] leading-[1.06] font-extrabold tracking-[-0.03em]">
                Cliente cadastrado <span className="club-gold-text">paga menos.</span>
              </h2>
              <ul className="mt-4 space-y-2">
                {PERKS.map((p, i) => (
                  <motion.li
                    key={p.label}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.06 }}
                    className="flex items-center gap-2.5 text-[13.5px] font-semibold text-white/90"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-club-gold text-club-2">
                      <Check className="size-3.5" strokeWidth={3.2} />
                    </span>
                    {p.label}
                  </motion.li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => (haptic(), useClubSheet.getState().show())}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-club-gold text-[15px] font-extrabold text-club-2 shadow-[0_12px_28px_-10px_rgb(228_181_74/0.8)] active:scale-[0.985] transition-transform"
              >
                <UserRoundPlus className="size-4" strokeWidth={2.4} /> Criar minha conta
              </button>
            </>
          )}
        </motion.div>

        <div className="pb-24">
          <InfiniteProductGrid query={{ club: true, sort }} emptyTitle="Nenhum produto do Clube no momento" />
        </div>
      </Screen>
      <CartBar className="bottom-[calc(env(safe-area-inset-bottom)+12px)]" />
    </>
  );
}
