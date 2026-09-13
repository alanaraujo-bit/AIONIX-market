"use client";

import { formatBRL, formatOrderNumber, REDEMPTION_STATUS_LABEL, type CoinEntry, type Redemption, type Reward } from "@aionix/shared";
import { ArrowRight, Clock3, Crown, Gift, History, Info, LogIn, RotateCcw, ShoppingBag, Sparkles, Store, Ticket, UserRoundPlus, Volume2, VolumeX } from "lucide-react";
import { animate, AnimatePresence, motion, useMotionValue, useMotionValueEvent } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CartBar } from "@/components/cart-bar";
import { Coin, CoinAmount } from "@/components/coins/coin";
import { RewardArt, RewardCard } from "@/components/coins/reward-card";
import { RedeemSheet, useSelectedVoucher, VoucherCode } from "@/components/coins/redeem-sheet";
import { Button, EmptyState, Pressable, Skeleton, cn } from "@/components/ui/primitives";
import { Screen, TopBar } from "@/components/ui/screen";
import { Sheet } from "@/components/ui/sheet";
import { applicableVouchers, coinLabel, useLoyaltyMutations, useLoyaltyProgram, useWallet } from "@/lib/loyalty";
import { useSession } from "@/lib/session";
import { sfx, useSoundPrefs } from "@/lib/sound";
import { haptic, toast } from "@/lib/toast";

function Rolling({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const [n, setN] = useState(0);
  useMotionValueEvent(mv, "change", (v) => setN(Math.round(v)));
  useEffect(() => {
    const ctrl = animate(mv, value, { duration: 1.1, ease: [0.16, 1, 0.3, 1] });
    return () => ctrl.stop();
  }, [mv, value]);
  return <>{n.toLocaleString("pt-BR")}</>;
}

const ENTRY_LABEL: Record<CoinEntry["type"], string> = {
  earn: "Compra",
  bonus: "Bônus",
  redeem: "Resgate",
  refund: "Devolução",
  adjust: "Ajuste da loja",
  reversal: "Estorno",
};

function EntryRow({ e }: { e: CoinEntry }) {
  const pending = e.status === "pending";
  const voided = e.status === "void";
  const title = e.type === "earn" && e.orderNumber != null ? `Pedido ${formatOrderNumber(e.orderNumber)}` : e.type === "redeem" || e.type === "refund" ? (e.rewardName ?? ENTRY_LABEL[e.type]) : (e.note ?? ENTRY_LABEL[e.type]);
  return (
    <li className={cn("flex items-center gap-3 py-3", voided && "opacity-50")}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-2xl", e.coins > 0 ? "bg-coin-soft text-coin-2" : "bg-line-2 text-ink-2")}>
        {e.type === "redeem" || e.type === "refund" ? <Ticket className="size-[18px]" strokeWidth={2.2} /> : e.type === "earn" ? <ShoppingBag className="size-[18px]" strokeWidth={2.2} /> : <Sparkles className="size-[18px]" strokeWidth={2.2} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold">{title}</span>
        <span className="block text-[12px] text-muted">
          {ENTRY_LABEL[e.type]} · {new Date(e.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "")}
          {pending && " · a caminho"}
          {voided && " · cancelado"}
        </span>
      </span>
      <CoinAmount coins={e.coins} signed className={cn("text-[14.5px]", e.coins > 0 ? (pending ? "text-muted" : "text-coin-2") : "text-ink-2", voided && "line-through")} />
    </li>
  );
}

function VoucherCard({ v, onUse, onReturn, onShow }: { v: Redemption; onUse: () => void; onReturn: () => void; onShow: () => void }) {
  const available = v.status === "available";
  const gift = v.reward.type === "gift";
  return (
    <motion.li layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("rounded-[22px] bg-card p-4 shadow-card", !available && "opacity-70")}>
      <div className="flex items-center gap-3">
        <RewardArt reward={v.reward} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-bold">{v.reward.name}</p>
          <p className="truncate text-[12.5px] text-muted">{v.reward.label}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", available ? "bg-brand-soft text-brand" : v.status === "used" ? "bg-line-2 text-muted" : "bg-citrus-soft text-[#8a5a00]")}>
          {v.status === "applied" && v.orderNumber != null ? `Pedido ${formatOrderNumber(v.orderNumber)}` : REDEMPTION_STATUS_LABEL[v.status]}
        </span>
      </div>
      {available && (
        <div className="mt-3 flex gap-2">
          {gift ? (
            <Button size="sm" className="flex-1 !bg-coin-3 !text-coin-ink" onClick={onShow}>
              <Store className="size-4" /> Mostrar código
            </Button>
          ) : (
            <Button size="sm" className="flex-1 !bg-coin-3 !text-coin-ink" onClick={onUse}>
              <ShoppingBag className="size-4" /> Usar no pedido
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={onReturn} aria-label="Devolver voucher">
            <RotateCcw className="size-4" /> Devolver
          </Button>
        </div>
      )}
    </motion.li>
  );
}

export function WalletScreen() {
  const { user, loading: sessionLoading } = useSession();
  const program = useLoyaltyProgram();
  const wallet = useWallet(!!user);
  const { cancel } = useLoyaltyMutations();
  const router = useRouter();
  const select = useSelectedVoucher((s) => s.select);
  const sound = useSoundPrefs();
  const [selected, setSelected] = useState<Reward | null>(null);
  const [showCode, setShowCode] = useState<Redemption | null>(null);
  const [returning, setReturning] = useState<Redemption | null>(null);
  const [tab, setTab] = useState<"rewards" | "history">("rewards");

  const p = program.data;
  const w = wallet.data;
  const balance = w?.balance ?? 0;
  const title = p?.coinNamePlural ?? "Moedas";

  const soundToggle = (
    <Pressable
      aria-label={sound.enabled ? "Desativar sons" : "Ativar sons"}
      onClick={() => {
        sound.setEnabled(!sound.enabled);
        if (!sound.enabled) setTimeout(() => sfx.coin(), 50);
        haptic();
      }}
      className="grid size-10 place-items-center rounded-full bg-card text-ink shadow-card ring-1 ring-line/70"
    >
      {sound.enabled ? <Volume2 className="size-[18px]" strokeWidth={2.3} /> : <VolumeX className="size-[18px] text-muted" strokeWidth={2.3} />}
    </Pressable>
  );

  if (p && !p.enabled) {
    return (
      <Screen header={<TopBar back backFallback="/conta" title={title} />}>
        <EmptyState icon={<Coin size={40} />} title="Programa em pausa" description="A loja pausou o programa de fidelidade por enquanto. Suas moedas continuam guardadas." />
      </Screen>
    );
  }

  if (!sessionLoading && !user) {
    return (
      <Screen header={<TopBar back backFallback="/" title={title} right={soundToggle} />}>
        <div className="px-4 pt-2 pb-8">
          <div className="coin-surface grain relative overflow-hidden rounded-[28px] p-6">
            <Coin size={56} spin />
            <h2 className="mt-4 font-display text-[27px] leading-[1.05] font-extrabold tracking-[-0.035em]">
              Compre pelo app e <span className="text-coin-2">ganhe {title.toLowerCase()}.</span>
            </h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-coin-ink/80">
              {p ? `A cada ${formatBRL(p.earnPerCents)} em compras você ganha ${coinLabel(p.earnCoins, p)}. Junte e troque por descontos, frete grátis e brindes.` : "Junte e troque por descontos, frete grátis e brindes."}
            </p>
            {p && p.signupBonusCoins > 0 && (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/60 px-3 py-1.5 text-[12.5px] font-bold text-coin-ink">
                <Sparkles className="size-3.5" /> Ganhe {coinLabel(p.signupBonusCoins, p)} só por criar sua conta
              </p>
            )}
            <div className="mt-6 flex gap-3">
              <Link href="/entrar?next=/moedas&mode=cadastro" className="flex-1">
                <Button block className="!bg-coin-ink !text-white"><UserRoundPlus className="size-4" /> Criar conta</Button>
              </Link>
              <Link href="/entrar?next=/moedas" className="flex-1">
                <Button block variant="ghost" className="!text-coin-ink ring-1 ring-coin-ink/30"><LogIn className="size-4" /> Entrar</Button>
              </Link>
            </div>
          </div>
          {p && p.rewards.length > 0 && (
            <section className="mt-7">
              <h3 className="mb-3 px-1 font-display text-[19px] font-bold tracking-[-0.025em]">Prêmios que você pode trocar</h3>
              <div className="grid grid-cols-2 gap-3">
                {p.rewards.map((r, i) => <RewardCard key={r.id} reward={r} balance={0} index={i} onSelect={() => router.push("/entrar?next=/moedas&mode=cadastro")} />)}
              </div>
            </section>
          )}
        </div>
      </Screen>
    );
  }

  const vouchers = w?.vouchers ?? [];
  const activeVouchers = vouchers.filter((v) => v.status === "available" || v.status === "applied");
  const pastVouchers = vouchers.filter((v) => v.status === "used");
  const next = w?.nextReward ?? null;
  const progress = next ? Math.min(100, (balance / next.costCoins) * 100) : 100;

  return (
    <>
      <Screen header={<TopBar back backFallback="/conta" title={title} right={soundToggle} />}>
        <div className="space-y-6 px-4 pt-1 pb-28">
          {/* Hero */}
          <motion.section initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="coin-surface grain relative overflow-hidden rounded-[28px] p-5">
            <div className="flex items-start justify-between">
              <span className="text-[11.5px] font-bold tracking-[0.12em] text-coin-ink/70 uppercase">Seu saldo</span>
              {!!w?.pending && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/55 px-2.5 py-1 text-[11.5px] font-bold text-coin-ink">
                  <Clock3 className="size-3.5" strokeWidth={2.6} /> +{w.pending.toLocaleString("pt-BR")} a caminho
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-4">
              <span className="animate-float"><Coin size={72} spin /></span>
              <div className="min-w-0">
                <p className="font-display text-[52px] leading-none font-extrabold tracking-[-0.05em] text-coin-ink tabular">{w ? <Rolling value={balance} /> : "…"}</p>
                <p className="mt-1 text-[14px] font-bold text-coin-ink/75">{balance === 1 ? p?.coinName ?? "Moeda" : title}</p>
              </div>
            </div>
            <div className="mt-5 rounded-[18px] bg-white/55 p-3.5 ring-1 ring-white/60">
              {next ? (
                <>
                  <div className="flex items-center justify-between text-[13px] font-bold text-coin-ink">
                    <span className="flex items-center gap-1.5"><Gift className="size-4" strokeWidth={2.4} /> {next.name}</span>
                    <span className="tabular">faltam {next.missing.toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-coin-ink/10">
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-coin-2 to-coin-ink" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ type: "spring", stiffness: 90, damping: 20, delay: 0.3 }} />
                  </div>
                  <p className="mt-1.5 text-[11.5px] font-medium text-coin-ink/70">
                    {p ? `Mais ${formatBRL(Math.ceil(next.missing / p.earnCoins) * p.earnPerCents)} em compras e é seu.` : ""}
                  </p>
                </>
              ) : (
                <p className="flex items-center gap-1.5 text-[13px] font-bold text-coin-ink"><Sparkles className="size-4" /> {p?.rewards.length ? "Você pode resgatar qualquer prêmio!" : "Em breve, prêmios para trocar."}</p>
              )}
            </div>
            {!!w?.earnedTotal && <p className="mt-3 text-[12px] font-medium text-coin-ink/65">Você já juntou {coinLabel(w.earnedTotal, p)} com a AIONIX.</p>}
          </motion.section>

          {/* How it works */}
          {p && (
            <section className="flex items-center gap-3 rounded-[20px] bg-card p-4 shadow-card">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-coin-soft text-coin-2"><Info className="size-5" strokeWidth={2.2} /></span>
              <p className="text-[13px] leading-snug text-ink-2">
                A cada <span className="font-bold text-ink">{formatBRL(p.earnPerCents)}</span> em produtos você ganha <span className="font-bold text-ink">{coinLabel(p.earnCoins, p)}</span>
                {p.awardOn === "delivered" ? ", creditadas na entrega" : p.awardOn === "confirmed" ? ", creditadas quando a loja confirma" : ", na hora"}.
                {p.clubBonusPercent > 0 && user?.clubMember && (
                  <> <Crown className="inline size-3.5 -translate-y-px text-club-gold" fill="currentColor" /> Membro do Clube: <span className="font-bold text-club">+{p.clubBonusPercent}%</span>.</>
                )}
              </p>
            </section>
          )}

          {/* Vouchers */}
          {activeVouchers.length > 0 && (
            <section>
              <h2 className="mb-3 px-1 font-display text-[19px] font-bold tracking-[-0.025em]">Seus vouchers</h2>
              <ul className="space-y-2.5">
                <AnimatePresence initial={false}>
                  {activeVouchers.map((v) => (
                    <VoucherCard
                      key={v.id}
                      v={v}
                      onUse={() => { select(v.id); sfx.pop(); haptic(); router.push("/carrinho"); }}
                      onReturn={() => setReturning(v)}
                      onShow={() => setShowCode(v)}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          )}

          {/* Tabs */}
          <div className="flex gap-1 rounded-full bg-line-2 p-1">
            {(["rewards", "history"] as const).map((t) => (
              <button key={t} type="button" onClick={() => (setTab(t), haptic())} className={cn("relative flex-1 rounded-full py-2 text-[13.5px] font-bold transition-colors", tab === t ? "text-ink" : "text-muted")}>
                {tab === t && <motion.span layoutId="wallet-tab" className="absolute inset-0 rounded-full bg-card shadow-card" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
                <span className="relative">{t === "rewards" ? "Prêmios" : "Histórico"}</span>
              </button>
            ))}
          </div>

          {tab === "rewards" ? (
            program.isPending ? (
              <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[190px] rounded-[22px]" />)}</div>
            ) : p?.rewards.length ? (
              <div className="grid grid-cols-2 gap-3">
                {p.rewards.map((r, i) => <RewardCard key={r.id} reward={r} balance={balance} index={i} onSelect={(x) => (haptic(), sfx.pop(), setSelected(x))} />)}
              </div>
            ) : (
              <EmptyState icon={<Gift className="size-9" />} title="Prêmios em breve" description="A loja ainda está montando a vitrine de prêmios. Suas moedas continuam valendo." />
            )
          ) : (
            <section className="rounded-[22px] bg-card px-4 shadow-card">
              {wallet.isPending ? (
                <div className="space-y-3 py-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
              ) : w?.history.length ? (
                <ul className="divide-y divide-line-2">{w.history.map((e) => <EntryRow key={e.id} e={e} />)}</ul>
              ) : (
                <EmptyState icon={<History className="size-8" />} title="Nada por aqui ainda" description="Sua primeira compra pelo app já rende moedas." action={<Link href="/" className="font-semibold text-brand">Ver produtos <ArrowRight className="inline size-4" /></Link>} />
              )}
              {pastVouchers.length > 0 && (
                <div className="border-t border-line-2 py-3">
                  <p className="mb-2 text-[11.5px] font-bold tracking-[0.04em] text-muted uppercase">Vouchers usados</p>
                  <ul className="space-y-1.5">
                    {pastVouchers.map((v) => (
                      <li key={v.id} className="flex items-center justify-between text-[13px] text-muted">
                        <span className="truncate">{v.reward.name}</span>
                        <span className="tabular">{v.usedAt ? new Date(v.usedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "") : "—"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </div>
      </Screen>
      <CartBar className="bottom-3" />

      <RedeemSheet reward={selected} balance={balance} onClose={() => setSelected(null)} />

      <Sheet open={!!showCode} onClose={() => setShowCode(null)} title="Seu brinde">
        {showCode && (
          <div className="flex flex-col items-center pb-3 text-center">
            <RewardArt reward={showCode.reward} size="lg" />
            <p className="mt-3 font-display text-[20px] font-extrabold tracking-[-0.02em]">{showCode.reward.name}</p>
            <VoucherCode code={showCode.code} className="mt-4 !text-[26px]" />
            <p className="mt-3 max-w-[280px] text-[13.5px] leading-relaxed text-muted">Mostre este código na loja ou ao entregador. Ele vale uma única vez.</p>
          </div>
        )}
      </Sheet>

      <Sheet open={!!returning} onClose={() => setReturning(null)} title="Devolver voucher?">
        {returning && (
          <>
            <p className="text-[15px] leading-relaxed text-ink-2">
              Você recebe <span className="font-bold text-ink">{coinLabel(returning.coins, p)}</span> de volta e o voucher <span className="font-semibold">{returning.reward.name}</span> deixa de valer.
            </p>
            <div className="mt-6 flex gap-3 pb-2">
              <Button variant="secondary" size="lg" className="flex-1" onClick={() => setReturning(null)}>Manter</Button>
              <Button size="lg" className="flex-1 !bg-coin-3 !text-coin-ink" loading={cancel.isPending} onClick={() => cancel.mutate(returning.id, { onSuccess: () => { setReturning(null); haptic([8, 30, 8]); sfx.coin(); toast.success(`${coinLabel(returning.coins, p)} devolvidas`); }, onError: (e) => toast.error(e.message) })}>
                Devolver
              </Button>
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}
