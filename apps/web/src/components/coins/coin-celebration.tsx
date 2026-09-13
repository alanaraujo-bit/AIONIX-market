"use client";

import { animate, AnimatePresence, motion, useMotionValue, useMotionValueEvent } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";
import { Button, cn } from "@/components/ui/primitives";
import { coinLabel, useLoyaltyMutations, useLoyaltyProgram } from "@/lib/loyalty";
import { sfx } from "@/lib/sound";
import { haptic } from "@/lib/toast";
import { Coin } from "./coin";

interface Celebration {
  coins: number;
  title?: string;
  subtitle?: string;
  /** Ledger entries to mark as seen when dismissed. */
  entryIds?: string[];
  /** Balance after the credit, for the "agora você tem" line. */
  balance?: number | null;
}

interface CelebrationState {
  current: Celebration | null;
  queue: Celebration[];
  show: (c: Celebration) => void;
  next: () => void;
}

/** Any surface can trigger the coin shower: `useCoinCelebration.getState().show({ coins })`. */
export const useCoinCelebration = create<CelebrationState>((set, get) => ({
  current: null,
  queue: [],
  show: (c) => {
    if (c.coins <= 0) return;
    if (get().current) set((s) => ({ queue: [...s.queue, c] }));
    else set({ current: c });
  },
  next: () => set((s) => ({ current: s.queue[0] ?? null, queue: s.queue.slice(1) })),
}));

const FLIGHT = 1.15;

/** Coins that fly from the bottom edge into the wallet pill along individual arcs. */
function CoinShower({ count, onArrive }: { count: number; onArrive: (i: number) => void }) {
  const pieces = useMemo(() => {
    const n = Math.max(6, Math.min(22, Math.round(6 + Math.sqrt(count) * 2)));
    return Array.from({ length: n }, (_, i) => {
      const seed = (i * 9301 + 49297) % 233280;
      const rnd = (k: number) => ((seed * (k + 1)) % 1000) / 1000;
      const x0 = (rnd(1) - 0.5) * 300;
      const xm = x0 * 0.55 + (rnd(2) - 0.5) * 120;
      return { i, x0, xm, y0: 260 + rnd(3) * 120, ym: -40 - rnd(4) * 90, delay: (i / n) * 0.7 + rnd(5) * 0.08, size: 22 + Math.round(rnd(6) * 14), spin: 360 + Math.round(rnd(7) * 3) * 180 };
    });
  }, [count]);

  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
      {pieces.map((p) => (
        <motion.span
          key={p.i}
          className="absolute preserve-3d"
          initial={{ x: p.x0, y: p.y0, scale: 0.3, opacity: 0, rotateY: 0 }}
          animate={{ x: [p.x0, p.xm, 0], y: [p.y0, p.ym, 0], scale: [0.3, 1.15, 0.45], opacity: [0, 1, 1, 0], rotateY: [0, p.spin] }}
          transition={{ duration: FLIGHT, delay: p.delay, ease: [0.22, 1, 0.36, 1], times: [0, 0.55, 1], opacity: { times: [0, 0.15, 0.85, 1], duration: FLIGHT, delay: p.delay } }}
          onAnimationComplete={() => onArrive(p.i)}
        >
          <Coin size={p.size} />
        </motion.span>
      ))}
    </span>
  );
}

function CountUp({ to, duration }: { to: number; duration: number }) {
  const mv = useMotionValue(0);
  const [n, setN] = useState(0);
  useMotionValueEvent(mv, "change", (v) => setN(Math.round(v)));
  useEffect(() => {
    const ctrl = animate(mv, to, { duration, ease: [0.16, 1, 0.3, 1], delay: 0.35 });
    return () => ctrl.stop();
  }, [mv, to, duration]);
  return <>{n.toLocaleString("pt-BR")}</>;
}

export function CoinCelebration() {
  const { current, next } = useCoinCelebration();
  const program = useLoyaltyProgram();
  const { seen } = useLoyaltyMutations();
  const router = useRouter();
  const [pulse, setPulse] = useState(0);
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    if (!current) return;
    setLanded(false);
    setPulse(0);
    haptic([12, 40, 12, 40, 12, 80, 40]);
    sfx.cascade(current.coins);
    const t = setTimeout(() => setLanded(true), (FLIGHT + 0.8) * 1000);
    return () => clearTimeout(t);
  }, [current]);

  const close = () => {
    if (!current) return;
    if (current.entryIds?.length) seen.mutate(current.entryIds);
    next();
  };

  const host = typeof document !== "undefined" ? document.getElementById("app") : null;
  if (!host) return null;
  const p = program.data;

  return createPortal(
    <AnimatePresence>
      {current && (
        <motion.div
          key="coin-celebration"
          className="absolute inset-0 z-[70] flex flex-col items-center justify-center overflow-hidden px-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          role="dialog"
          aria-modal="true"
          aria-label={`Você ganhou ${coinLabel(current.coins, p)}`}
        >
          <motion.div className="absolute inset-0 bg-[#1a1006]/85 backdrop-blur-md" onClick={landed ? close : undefined} />
          {/* Warm glow behind the wallet */}
          <motion.span
            aria-hidden
            className="absolute size-[340px] rounded-full bg-coin-3/30 blur-3xl"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: [0.4, 1.2, 1], opacity: [0, 0.9, 0.6] }}
            transition={{ duration: 1.6, ease: "easeOut" }}
          />

          <div className="relative flex w-full max-w-[320px] flex-col items-center text-center text-white">
            <CoinShower count={current.coins} onArrive={() => setPulse((n) => n + 1)} />

            <motion.div
              key={pulse}
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.07, 1] }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="coin-surface grain relative grid size-[112px] place-items-center rounded-[36px] shadow-[0_20px_60px_-16px_rgb(245_176_58/0.7)] ring-4 ring-white/15"
            >
              <Coin size={64} spin />
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mt-7 font-display text-[44px] leading-none font-extrabold tracking-[-0.04em]"
            >
              <span className="coin-gold-text">
                +<CountUp to={current.coins} duration={FLIGHT + 0.5} />
              </span>
            </motion.p>
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-1.5 text-[15px] font-bold tracking-[0.06em] text-coin-3 uppercase">
              {current.coins === 1 ? (p?.coinName ?? "Moeda") : (p?.coinNamePlural ?? "Moedas")}
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="mt-5 font-display text-[24px] leading-tight font-extrabold tracking-[-0.03em]"
            >
              {current.title ?? "Você ganhou!"}
            </motion.h2>
            {(current.subtitle || current.balance != null) && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-2 text-[14.5px] leading-relaxed text-white/75">
                {current.subtitle}
                {current.subtitle && current.balance != null && <br />}
                {current.balance != null && (
                  <>
                    Agora você tem <span className="tabular font-bold text-white">{coinLabel(current.balance, p)}</span>.
                  </>
                )}
              </motion.p>
            )}

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: landed ? 1 : 0, y: landed ? 0 : 16 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className={cn("mt-8 flex w-full flex-col gap-2.5", !landed && "pointer-events-none")}
            >
              <Button
                size="lg"
                block
                className="!bg-coin-3 !text-coin-ink shadow-[0_12px_32px_-10px_rgb(245_176_58/0.8)]"
                onClick={() => {
                  sfx.pop();
                  close();
                  router.push("/moedas");
                }}
              >
                Ver meus prêmios
              </Button>
              <Button size="lg" block variant="ghost" className="!text-white/80" onClick={close}>
                Continuar
              </Button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    host,
  );
}
