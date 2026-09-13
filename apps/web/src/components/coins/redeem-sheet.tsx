"use client";

import { formatBRL, type Redemption, type Reward } from "@aionix/shared";
import { ArrowRight, Check, Store, Wallet } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, cn } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { coinLabel, useLoyaltyMutations, useLoyaltyProgram, useSelectedVoucher } from "@/lib/loyalty";
import { sfx } from "@/lib/sound";
import { haptic, toast } from "@/lib/toast";
import { Coin } from "./coin";
import { RewardArt } from "./reward-card";

export { useSelectedVoucher };

/** Coins leaving the balance toward the reward. */
function SpendBurst({ n }: { n: number }) {
  const pieces = Array.from({ length: Math.max(5, Math.min(14, Math.round(Math.sqrt(n) + 3))) }, (_, i) => ({
    i,
    x: (i % 2 ? 1 : -1) * (20 + (i * 37) % 60),
    delay: i * 0.05,
  }));
  return (
    <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
      {pieces.map((p) => (
        <motion.span
          key={p.i}
          className="absolute"
          initial={{ y: 120, x: p.x, opacity: 0, scale: 0.5 }}
          animate={{ y: [120, 40, -10], x: [p.x, p.x * 0.4, 0], opacity: [0, 1, 0], scale: [0.5, 1, 0.4] }}
          transition={{ duration: 0.8, delay: p.delay, ease: [0.22, 1, 0.36, 1] }}
        >
          <Coin size={20} />
        </motion.span>
      ))}
    </span>
  );
}

export function VoucherCode({ code, className }: { code: string; className?: string }) {
  return (
    <span className={cn("selectable inline-flex items-center rounded-2xl border-2 border-dashed border-coin/40 bg-coin-soft px-4 py-2.5 font-display text-[22px] font-extrabold tracking-[0.12em] text-coin-2 tabular", className)}>
      {code}
    </span>
  );
}

export function RedeemSheet({ reward, balance, onClose }: { reward: Reward | null; balance: number; onClose: () => void }) {
  const program = useLoyaltyProgram();
  const { redeem } = useLoyaltyMutations();
  const router = useRouter();
  const select = useSelectedVoucher((s) => s.select);
  const [done, setDone] = useState<Redemption | null>(null);
  const [spending, setSpending] = useState(false);

  useEffect(() => {
    if (!reward) {
      setDone(null);
      setSpending(false);
    }
  }, [reward]);

  const p = program.data;
  const affordable = !!reward && balance >= reward.costCoins;

  const confirm = () => {
    if (!reward) return;
    haptic([8, 30, 8]);
    setSpending(true);
    sfx.whoosh();
    redeem.mutate(reward.id, {
      onSuccess: ({ redemption }) => {
        setTimeout(() => {
          setDone(redemption);
          setSpending(false);
          haptic([10, 40, 10, 40, 30]);
          sfx.success();
        }, 650);
      },
      onError: (e) => {
        setSpending(false);
        haptic([30, 50, 30]);
        toast.error(e.message);
      },
    });
  };

  const useNext = () => {
    if (!done) return;
    select(done.id);
    sfx.pop();
    onClose();
    router.push("/carrinho");
  };

  return (
    <Sheet
      open={!!reward}
      onClose={onClose}
      footer={
        reward && (
          <AnimatePresence mode="wait" initial={false}>
            {done ? (
              <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2.5">
                {done.reward.type === "gift" ? (
                  <Button size="lg" block className="!bg-coin-3 !text-coin-ink" onClick={onClose}>
                    <Check className="size-4" strokeWidth={3} /> Entendi
                  </Button>
                ) : (
                  <Button size="lg" block className="!bg-coin-3 !text-coin-ink" onClick={useNext}>
                    Usar no próximo pedido <ArrowRight className="size-4" />
                  </Button>
                )}
                <Button size="lg" block variant="secondary" onClick={onClose}>
                  <Wallet className="size-4" /> Guardar na carteira
                </Button>
              </motion.div>
            ) : (
              <motion.div key="confirm" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Button size="lg" block disabled={!affordable} loading={spending || redeem.isPending} className="!bg-coin-3 !text-coin-ink disabled:!bg-line" onClick={confirm}>
                  <span className="flex w-full items-center justify-between">
                    <span>Trocar por este prêmio</span>
                    <span className="inline-flex items-center gap-1.5 tabular"><Coin size={16} /> {reward.costCoins.toLocaleString("pt-BR")}</span>
                  </span>
                </Button>
                {!affordable && <p className="mt-2 text-center text-[12.5px] font-semibold text-muted">Faltam {coinLabel(reward.costCoins - balance, p)} para este prêmio.</p>}
              </motion.div>
            )}
          </AnimatePresence>
        )
      }
    >
      {reward && (
        <div className="relative pb-2">
          <AnimatePresence>{spending && <SpendBurst n={reward.costCoins} />}</AnimatePresence>
          <AnimatePresence mode="wait" initial={false}>
            {done ? (
              <motion.div key="voucher" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center pt-2 text-center">
                <motion.span initial={{ scale: 0.5, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 340, damping: 16 }}>
                  <RewardArt reward={done.reward} size="lg" />
                </motion.span>
                <p className="mt-4 text-[11.5px] font-bold tracking-[0.12em] text-coin-2 uppercase">Prêmio resgatado</p>
                <h2 className="mt-1 font-display text-[24px] leading-tight font-extrabold tracking-[-0.03em]">{done.reward.name}</h2>
                <p className="mt-1 text-[14px] text-muted">{done.reward.label}</p>
                <VoucherCode code={done.code} className="mt-5" />
                <p className="mt-3 max-w-[280px] text-[13px] leading-relaxed text-muted">
                  {done.reward.type === "gift" ? (
                    <>
                      <Store className="mr-1 inline size-3.5 -translate-y-px" /> Mostre este código na loja ou ao entregador para retirar seu brinde.
                    </>
                  ) : (
                    "Seu voucher está guardado na carteira. Aplique na hora de finalizar um pedido."
                  )}
                </p>
              </motion.div>
            ) : (
              <motion.div key="details" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }}>
                <div className="flex items-start gap-4">
                  <RewardArt reward={reward} size="lg" />
                  <div className="min-w-0 flex-1 pt-1">
                    <h2 className="font-display text-[22px] leading-tight font-extrabold tracking-[-0.03em]">{reward.name}</h2>
                    <p className="mt-1 text-[14px] font-semibold text-coin-2">{reward.label}</p>
                    {reward.description && <p className="mt-1.5 text-[13.5px] leading-snug text-muted">{reward.description}</p>}
                  </div>
                </div>
                <ul className="mt-5 space-y-2 rounded-[20px] bg-card p-4 text-[13.5px] shadow-card">
                  <li className="flex items-center justify-between">
                    <span className="text-muted">Seu saldo</span>
                    <span className="inline-flex items-center gap-1.5 font-bold tabular"><Coin size={14} /> {balance.toLocaleString("pt-BR")}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-muted">Custo do prêmio</span>
                    <span className="inline-flex items-center gap-1.5 font-bold text-sale tabular">− {reward.costCoins.toLocaleString("pt-BR")}</span>
                  </li>
                  <li className="flex items-center justify-between border-t border-line pt-2">
                    <span className="font-semibold">Depois do resgate</span>
                    <span className={cn("inline-flex items-center gap-1.5 font-extrabold tabular", affordable ? "text-ink" : "text-sale")}>
                      <Coin size={14} /> {(balance - reward.costCoins).toLocaleString("pt-BR")}
                    </span>
                  </li>
                </ul>
                <ul className="mt-4 space-y-1.5 px-1 text-[12.5px] text-muted">
                  {reward.minOrderCents > 0 && <li>• Vale em pedidos a partir de {formatBRL(reward.minOrderCents)} em produtos.</li>}
                  {reward.type === "free_delivery" && <li>• Use em um pedido com taxa de entrega.</li>}
                  {reward.type === "product" && <li>• O produto é adicionado grátis ao seu pedido.</li>}
                  {reward.type === "gift" && <li>• Você recebe um código para apresentar na loja.</li>}
                  <li>• Voucher sem uso pode ser devolvido e as {p?.coinNamePlural.toLowerCase() ?? "moedas"} voltam para você.</li>
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </Sheet>
  );
}
