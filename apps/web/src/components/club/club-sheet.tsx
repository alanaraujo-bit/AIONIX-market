"use client";

import { formatBRL, type Product } from "@aionix/shared";
import { ArrowRight, Check, Crown, Gift, ShoppingBag, UserRoundPlus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { Button, cn } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { effectivePrice, useClub } from "@/lib/club";
import { haptic } from "@/lib/toast";

const PENDING_KEY = "club:pending-signup";

interface ClubSheetState {
  open: boolean;
  /** Product that triggered the sheet, to preview "your price" on it. */
  product: Product | null;
  celebrate: boolean;
  show: (product?: Product | null, opts?: { celebrate?: boolean }) => void;
  hide: () => void;
}

/** Any surface can open the club flow: `useClubSheet.getState().show(product)`. */
export const useClubSheet = create<ClubSheetState>((set) => ({
  open: false,
  product: null,
  celebrate: false,
  show: (product = null, opts = {}) => set({ open: true, product, celebrate: !!opts.celebrate }),
  hide: () => set({ open: false }),
}));

const BENEFITS = [
  { icon: UserRoundPlus, title: "Crie sua conta", text: "É isso. Todo cliente cadastrado que compra pelo app faz parte." },
  { icon: Crown, title: "Preço de Clube", text: "Produtos com a coroa saem pelo preço de membro, já no primeiro pedido." },
  { icon: Gift, title: "Sem mensalidade", text: "Nada é cobrado. Sua economia fica registrada na conta." },
];

/** Gold burst rendered once on enrollment. */
function Confetti() {
  const pieces = Array.from({ length: 22 }, (_, i) => {
    const angle = (i / 22) * Math.PI * 2 + (i % 3) * 0.2;
    const dist = 70 + (i % 5) * 22;
    return { i, x: Math.cos(angle) * dist, y: Math.sin(angle) * dist - 20, r: (i * 47) % 360, gold: i % 3 !== 0 };
  });
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
      {pieces.map((p) => (
        <motion.span
          key={p.i}
          className={cn("absolute size-2 rounded-[3px]", p.gold ? "bg-club-gold" : "bg-white")}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.4, rotate: 0 }}
          animate={{ x: p.x, y: p.y + 40, opacity: 0, scale: 1, rotate: p.r }}
          transition={{ duration: 1.1 + (p.i % 4) * 0.12, ease: [0.16, 1, 0.3, 1], delay: (p.i % 6) * 0.02 }}
        />
      ))}
    </span>
  );
}

function PricePreview({ product, member }: { product: Product; member: boolean }) {
  const now = effectivePrice(product, member);
  const club = effectivePrice(product, true);
  if (club.cents >= now.cents && !member) return null;
  const save = now.compareAt && member ? now.compareAt - now.cents : now.cents - club.cents;
  return (
    <div className="mt-4 flex items-center gap-3 rounded-[20px] bg-white/10 p-3 ring-1 ring-white/15">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold text-white/75">{product.name}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={member ? "club" : "shelf"}
              initial={{ y: 12, opacity: 0, filter: "blur(4px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ y: -12, opacity: 0, filter: "blur(4px)" }}
              className={cn("tabular font-display text-[24px] font-extrabold tracking-[-0.03em]", member ? "club-gold-text" : "text-white")}
            >
              {formatBRL(member ? club.cents : now.cents)}
            </motion.span>
          </AnimatePresence>
          {!member && <span className="tabular text-[13px] font-semibold text-white/60">→ {formatBRL(club.cents)} com conta</span>}
          {member && now.compareAt && <span className="tabular text-[13px] text-white/50 line-through">{formatBRL(now.compareAt)}</span>}
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-club-gold px-2.5 py-1 text-[11.5px] font-extrabold text-club-2">−{formatBRL(save)}</span>
    </div>
  );
}

export function ClubSheet() {
  const { open, product, celebrate, hide } = useClubSheet();
  const { member, user, loading } = useClub();
  const router = useRouter();
  const pathname = usePathname();
  const [burst, setBurst] = useState(false);

  // Back from signup with a pending intent → celebrate the new membership.
  useEffect(() => {
    if (!user || loading) return;
    try {
      if (sessionStorage.getItem(PENDING_KEY)) {
        sessionStorage.removeItem(PENDING_KEY);
        if (user.clubMember) {
          haptic([10, 40, 20, 60]);
          useClubSheet.getState().show(null, { celebrate: true });
        }
      }
    } catch {
      /* storage unavailable */
    }
  }, [user, loading]);

  useEffect(() => {
    if (open && celebrate) {
      setBurst(true);
      const t = setTimeout(() => setBurst(false), 1600);
      return () => clearTimeout(t);
    }
  }, [open, celebrate]);

  const signup = () => {
    haptic([8, 30, 8]);
    try {
      sessionStorage.setItem(PENDING_KEY, "1");
    } catch {
      /* ignore */
    }
    hide();
    router.push(`/entrar?next=${encodeURIComponent(pathname)}&mode=cadastro`);
  };

  const firstName = user?.name.split(" ")[0];
  const revoked = !!user && !member;

  const footer = member ? (
    <div className="space-y-2.5">
      <Button size="lg" block className="!bg-club" onClick={() => (hide(), router.push("/clube"))}>
        Ver produtos do Clube <ArrowRight className="size-4" />
      </Button>
      <Button size="lg" block variant="secondary" onClick={hide}>
        Continuar comprando
      </Button>
    </div>
  ) : revoked ? (
    <Button size="lg" block variant="secondary" onClick={hide}>
      Entendi
    </Button>
  ) : (
    <>
      <Button size="lg" block onClick={signup} className="!bg-club shadow-[0_12px_32px_-10px_rgb(74_45_143/0.6)]">
        <UserRoundPlus className="size-4 text-club-gold-2" /> Criar conta e entrar no Clube
      </Button>
      <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-[12px] font-medium text-muted">
        <Check className="size-3.5 text-brand-3" strokeWidth={3} /> Grátis. Já tem conta?{" "}
        <button type="button" onClick={() => (hide(), router.push(`/entrar?next=${encodeURIComponent(pathname)}`))} className="font-bold text-club">
          Entrar
        </button>
      </p>
    </>
  );

  return (
    <Sheet open={open} onClose={hide} footer={footer}>
      <div className="club-surface grain -mx-5 -mt-2 rounded-[26px] px-5 pt-5 pb-5 text-white">
        <div className="relative">
          <AnimatePresence>{burst && <Confetti />}</AnimatePresence>
          <motion.span
            key={member ? "member" : "guest"}
            initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 18 }}
            className="relative grid size-14 place-items-center rounded-[20px] bg-white/12 ring-1 ring-white/20"
          >
            <Crown className="size-7 text-club-gold-2 animate-twinkle" strokeWidth={2.4} fill="currentColor" />
          </motion.span>
          <AnimatePresence mode="wait" initial={false}>
            {member ? (
              <motion.div key="welcome" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <p className="mt-4 text-[12px] font-bold tracking-[0.12em] text-club-gold-2 uppercase">{celebrate ? "Bem-vindo ao Clube" : "Clube AIONIX"}</p>
                <h2 className="mt-1 font-display text-[28px] leading-[1.05] font-extrabold tracking-[-0.03em]">
                  {celebrate ? `Pronto, ${firstName}!` : `Você é do Clube, ${firstName}.`}
                </h2>
                <p className="mt-2 text-[14.5px] leading-relaxed text-white/80">
                  {celebrate
                    ? product
                      ? "Sua conta já vale preço de membro. Olha só a diferença:"
                      : "Sua conta já vale preço de membro: os produtos com a coroa mudaram de preço em toda a loja."
                    : "Cliente cadastrado que compra pelo app tem preço de membro em toda a loja."}
                </p>
              </motion.div>
            ) : revoked ? (
              <motion.div key="revoked" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <p className="mt-4 text-[12px] font-bold tracking-[0.12em] text-club-gold-2 uppercase">Clube AIONIX</p>
                <h2 className="mt-1 font-display text-[28px] leading-[1.05] font-extrabold tracking-[-0.03em]">Sua conta está fora do Clube.</h2>
                <p className="mt-2 text-[14.5px] leading-relaxed text-white/80">Fale com a loja para reativar seus preços de membro.</p>
              </motion.div>
            ) : (
              <motion.div key="pitch" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <p className="mt-4 text-[12px] font-bold tracking-[0.12em] text-club-gold-2 uppercase">Clube AIONIX</p>
                <h2 className="mt-1 font-display text-[28px] leading-[1.05] font-extrabold tracking-[-0.03em]">
                  Quem compra pelo app <span className="club-gold-text">paga menos.</span>
                </h2>
                <p className="mt-2 text-[14.5px] leading-relaxed text-white/80">Crie sua conta e os produtos com a coroa saem pelo preço de membro.</p>
              </motion.div>
            )}
          </AnimatePresence>
          {product && <PricePreview product={product} member={member} />}
        </div>
      </div>

      {!member && !revoked && (
        <ul className="space-y-3 pt-5 pb-1">
          {BENEFITS.map((b, i) => (
            <motion.li
              key={b.title}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.12 + i * 0.06 }}
              className="flex items-start gap-3.5"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-club-soft text-club">
                <b.icon className="size-5" strokeWidth={2.2} />
              </span>
              <span>
                <span className="block text-[14.5px] font-bold">{b.title}</span>
                <span className="block text-[13px] leading-snug text-muted">{b.text}</span>
              </span>
            </motion.li>
          ))}
        </ul>
      )}
      {member && celebrate && product && (
        <p className="flex items-center gap-2 pt-4 pb-1 text-[13px] font-semibold text-club">
          <ShoppingBag className="size-4" strokeWidth={2.4} /> Seus preços já mudaram em toda a loja.
        </p>
      )}
    </Sheet>
  );
}
