"use client";

import { formatBRL, PAYMENT_METHOD_LABEL, type Address, type CheckoutInput, type Order, type PaymentMethod } from "@aionix/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Banknote, Check, ChevronRight, Clock3, CreditCard, MapPin, Plus, QrCode, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AddressForm } from "@/components/address-form";
import { ProductImage } from "@/components/product/product-image";
import { Button, Skeleton, cn } from "@/components/ui/primitives";
import { Screen, TopBar } from "@/components/ui/screen";
import { Sheet } from "@/components/ui/sheet";
import { api, ApiError } from "@/lib/api";
import { useAddresses } from "@/lib/account";
import { useCart, useHydrated } from "@/lib/cart";
import { useCartQuote } from "@/lib/quote";
import { useSession } from "@/lib/session";
import { haptic, toast } from "@/lib/toast";

const PAYMENTS: { id: PaymentMethod; icon: React.ReactNode; hint: string }[] = [
  { id: "pix", icon: <QrCode className="size-5" />, hint: "QR Code apresentado pelo entregador" },
  { id: "card_on_delivery", icon: <CreditCard className="size-5" />, hint: "Débito ou crédito na maquininha" },
  { id: "cash", icon: <Banknote className="size-5" />, hint: "Informe se precisa de troco" },
];

function buildSlots(etaMinutes: number) {
  const now = new Date();
  const slots: { id: string; label: string; sub: string }[] = [{ id: "asap", label: "O quanto antes", sub: `Chega em ~${etaMinutes} min` }];
  const startHour = Math.max(8, now.getHours() + 2);
  for (let h = startHour; h + 2 <= 22; h += 2) {
    slots.push({ id: `today-${h}`, label: `Hoje, ${h}h – ${h + 2}h`, sub: "Agendado" });
  }
  for (const h of [8, 10, 14, 18]) slots.push({ id: `tomorrow-${h}`, label: `Amanhã, ${h}h – ${h + 2}h`, sub: "Agendado" });
  return slots.slice(0, 6);
}

function Section({ step, title, children, action }: { step: number; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="px-4">
      <div className="mb-2.5 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 text-[13px] font-bold tracking-[0.04em] text-muted uppercase">
          <span className="grid size-5 place-items-center rounded-full bg-ink text-[11px] text-white">{step}</span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function CheckoutScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const hydrated = useHydrated();
  const { user, loading: sessionLoading } = useSession();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const { quote, loading: quoteLoading } = useCartQuote();
  const addresses = useAddresses(!!user);

  const [addressId, setAddressId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"none" | "address" | "new-address" | "change">("none");
  const [payment, setPayment] = useState<PaymentMethod>("pix");
  const [changeFor, setChangeFor] = useState("");
  const [slot, setSlot] = useState("asap");
  const [notes, setNotes] = useState("");
  const [placed, setPlaced] = useState<Order | null>(null);

  useEffect(() => {
    if (!sessionLoading && !user) router.replace("/entrar?next=/checkout");
  }, [user, sessionLoading, router]);
  useEffect(() => {
    if (hydrated && items.length === 0 && !placed) router.replace("/carrinho");
  }, [hydrated, items.length, placed, router]);
  useEffect(() => {
    if (!addressId && addresses.data?.length) setAddressId((addresses.data.find((a) => a.isDefault) ?? addresses.data[0])!.id);
  }, [addresses.data, addressId]);

  const address = addresses.data?.find((a) => a.id === addressId) ?? null;
  const slots = useMemo(() => buildSlots(45), []);
  const slotLabel = slots.find((s) => s.id === slot)?.label ?? slot;

  const place = useMutation({
    mutationFn: (input: CheckoutInput) => api<{ order: Order }>("/me/orders", { body: input }),
    onSuccess: ({ order }) => {
      haptic([10, 40, 10, 40, 30]);
      setPlaced(order);
      clear();
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void qc.invalidateQueries({ queryKey: ["catalog"] });
    },
    onError: (err) => {
      haptic([30, 50, 30]);
      toast.error(err.message);
      if (err instanceof ApiError && err.code === "OUT_OF_STOCK") router.replace("/carrinho");
    },
  });

  const changeCents = Math.round(Number(changeFor.replace(/\./g, "").replace(",", ".")) * 100) || 0;
  const canSubmit = !!address && !!quote && quote.lines.every((l) => l.available) && !quoteLoading && (payment !== "cash" || changeFor === "" || changeCents >= quote.totalCents);

  const submit = () => {
    if (!address || !quote) return;
    place.mutate({
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      addressId: address.id,
      paymentMethod: payment,
      changeForCents: payment === "cash" && changeCents ? changeCents : undefined,
      deliverySlot: slotLabel,
      notes,
    });
  };

  if (placed) return <SuccessScreen order={placed} />;

  return (
    <Screen
      header={<TopBar back backFallback="/carrinho" title="Finalizar compra" />}
      footer={
        <div className="pb-safe relative z-20 shrink-0 border-t border-line bg-card/95 backdrop-blur-xl">
          <div className="px-4 pt-3 pb-3">
            <Button size="lg" block disabled={!canSubmit} loading={place.isPending} onClick={submit}>
              <span className="flex w-full items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="size-5" /> Confirmar pedido
                </span>
                <span className="tabular font-display">{quote ? formatBRL(quote.totalCents) : "—"}</span>
              </span>
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-7 pt-2 pb-8">
        <Section
          step={1}
          title="Entrega"
          action={
            addresses.data && addresses.data.length > 0 ? (
              <button type="button" onClick={() => setSheet("change")} className="text-[13px] font-semibold text-brand-2">
                Trocar
              </button>
            ) : undefined
          }
        >
          {addresses.isPending ? (
            <Skeleton className="h-[84px] rounded-[20px]" />
          ) : address ? (
            <div className="flex items-start gap-3 rounded-[20px] bg-card p-4 shadow-card">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
                <MapPin className="size-5" strokeWidth={2.3} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-bold">
                  {address.label} · <span className="font-medium text-muted">{address.recipient}</span>
                </p>
                <p className="mt-0.5 text-[13.5px] leading-snug text-ink-2">
                  {address.street}, {address.number}
                  {address.complement ? ` · ${address.complement}` : ""}
                </p>
                <p className="text-[13px] text-muted">
                  {address.district} · {address.city}/{address.state}
                </p>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setSheet("new-address")} className="flex w-full items-center gap-3 rounded-[20px] border-2 border-dashed border-line bg-card/50 p-4 text-left active:bg-line-2">
              <span className="grid size-10 place-items-center rounded-2xl bg-brand text-white">
                <Plus className="size-5" strokeWidth={2.6} />
              </span>
              <span>
                <span className="block text-[14.5px] font-bold">Adicionar endereço de entrega</span>
                <span className="block text-[13px] text-muted">Buscamos pelo CEP automaticamente</span>
              </span>
              <ChevronRight className="ml-auto size-5 text-faint" />
            </button>
          )}
        </Section>

        <Section step={2} title="Quando">
          <div className="scroll-x -mx-4 flex gap-2.5 px-4 pb-1">
            {slots.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => (haptic(), setSlot(s.id))}
                className={cn(
                  "shrink-0 rounded-[18px] px-4 py-3 text-left transition-colors",
                  slot === s.id ? "bg-ink text-white" : "bg-card text-ink ring-1 ring-line",
                )}
              >
                <span className="flex items-center gap-1.5 text-[13.5px] font-bold">
                  <Clock3 className="size-3.5" /> {s.label}
                </span>
                <span className={cn("mt-0.5 block text-[11.5px] font-medium", slot === s.id ? "text-white/65" : "text-muted")}>{s.sub}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section step={3} title="Pagamento na entrega">
          <div className="overflow-hidden rounded-[20px] bg-card shadow-card">
            {PAYMENTS.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => (haptic(), setPayment(p.id))}
                className={cn("flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-line-2/60", i > 0 && "border-t border-line-2")}
              >
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-2xl transition-colors", payment === p.id ? "bg-brand text-white" : "bg-line-2 text-ink-2")}>{p.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-bold">{PAYMENT_METHOD_LABEL[p.id]}</span>
                  <span className="block text-[12.5px] text-muted">{p.hint}</span>
                </span>
                <span className={cn("grid size-6 place-items-center rounded-full border-2 transition-colors", payment === p.id ? "border-brand bg-brand text-white" : "border-line")}>
                  {payment === p.id && <Check className="size-3.5" strokeWidth={3.5} />}
                </span>
              </button>
            ))}
            <AnimatePresence initial={false}>
              {payment === "cash" && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-line-2">
                  <label className="flex items-center gap-3 px-4 py-3">
                    <span className="text-[13.5px] font-semibold text-ink-2">Troco para</span>
                    <span className="flex h-10 flex-1 items-center rounded-xl bg-canvas px-3 ring-1 ring-line focus-within:ring-brand-3">
                      <span className="mr-1 text-[14px] font-semibold text-muted">R$</span>
                      <input inputMode="decimal" value={changeFor} onChange={(e) => setChangeFor(e.target.value.replace(/[^\d,.]/g, ""))} placeholder="sem troco" className="w-full bg-transparent text-[15px] font-semibold outline-none placeholder:font-medium placeholder:text-faint" />
                    </span>
                  </label>
                  {changeFor && quote && changeCents < quote.totalCents && <p className="px-4 pb-3 text-[12.5px] font-semibold text-sale">O troco deve ser maior que {formatBRL(quote.totalCents)}</p>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Section>

        <Section step={4} title="Resumo">
          <div className="rounded-[20px] bg-card p-4 shadow-card">
            <ul className="space-y-3">
              {items.map((i) => (
                <li key={i.productId} className="flex items-center gap-3">
                  <span className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-[#f6f5f1]">
                    <ProductImage src={i.imageUrl} blur={i.blurDataUrl} alt="" sizes="48px" />
                    <span className="tabular absolute -right-0 -bottom-0 rounded-tl-lg bg-ink px-1.5 text-[10.5px] font-bold text-white">{i.quantity}×</span>
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{i.name}</span>
                  <span className="tabular text-[13.5px] font-semibold">{formatBRL(i.priceCents * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 300))}
              rows={2}
              placeholder="Observações para a entrega (portaria, campainha, substituições…)"
              className="mt-4 w-full resize-none rounded-2xl bg-canvas px-4 py-3 text-[14px] font-medium ring-1 ring-line outline-none placeholder:text-faint focus:ring-brand-3"
            />
            <div className="mt-4 space-y-2 border-t border-line pt-3 text-[14px]">
              <div className="flex justify-between text-muted"><span>Subtotal</span><span className="tabular">{quote ? formatBRL(quote.subtotalCents) : "—"}</span></div>
              {!!quote?.discountCents && <div className="flex justify-between text-sale"><span>Descontos</span><span className="tabular">− {formatBRL(quote.discountCents)}</span></div>}
              <div className="flex justify-between text-muted"><span>Entrega</span><span className={cn("tabular", quote?.deliveryFeeCents === 0 && "font-semibold text-brand-2")}>{quote ? (quote.deliveryFeeCents ? formatBRL(quote.deliveryFeeCents) : "Grátis") : "—"}</span></div>
              <div className="flex items-baseline justify-between pt-1"><span className="text-[15px] font-bold">Total</span><span className="tabular font-display text-[22px] font-bold tracking-[-0.02em]">{quote ? formatBRL(quote.totalCents) : "—"}</span></div>
            </div>
          </div>
        </Section>
      </div>

      <Sheet open={sheet === "change"} onClose={() => setSheet("none")} title="Endereço de entrega">
        <ul className="space-y-2.5 pb-2">
          {addresses.data?.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => (setAddressId(a.id), setSheet("none"), haptic())} className={cn("flex w-full items-start gap-3 rounded-[18px] bg-card p-4 text-left ring-2 transition-colors", a.id === addressId ? "ring-brand" : "ring-transparent shadow-card")}>
                <MapPin className={cn("mt-0.5 size-5 shrink-0", a.id === addressId ? "text-brand" : "text-muted")} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold">{a.label}</span>
                  <span className="block text-[13px] text-ink-2">{a.street}, {a.number} · {a.district}</span>
                </span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setSheet("new-address")} className="flex w-full items-center gap-2 rounded-[18px] border-2 border-dashed border-line p-4 text-[14px] font-bold text-brand-2">
              <Plus className="size-4" strokeWidth={2.6} /> Novo endereço
            </button>
          </li>
        </ul>
      </Sheet>
      <Sheet open={sheet === "new-address"} onClose={() => setSheet("none")} title="Novo endereço">
        <AddressForm onDone={(a: Address) => (setAddressId(a.id), setSheet("none"))} />
      </Sheet>
    </Screen>
  );
}

function SuccessScreen({ order }: { order: Order }) {
  const router = useRouter();
  return (
    <div className="grain relative flex min-h-0 flex-1 flex-col items-center justify-center bg-brand px-8 text-center text-white">
      <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18 }} className="grid size-24 place-items-center rounded-full bg-white/15 ring-8 ring-white/10">
        <motion.svg viewBox="0 0 24 24" className="size-12" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.25, duration: 0.5, ease: "easeOut" }} />
        </motion.svg>
      </motion.div>
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35 }}>
        <h1 className="mt-7 font-display text-[30px] leading-tight font-extrabold tracking-[-0.03em]">Pedido confirmado!</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-white/80">
          Pedido <span className="tabular font-bold text-white">#{String(order.number).padStart(5, "0")}</span> · {formatBRL(order.totalCents)}
          <br />
          Você acompanha cada etapa em tempo real.
        </p>
      </motion.div>
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="mt-9 flex w-full flex-col gap-3">
        <Button size="lg" block className="!bg-white !text-brand" onClick={() => router.replace(`/pedidos/${order.id}`)}>
          Acompanhar pedido
        </Button>
        <Button size="lg" block variant="ghost" className="!text-white/85" onClick={() => router.replace("/")}>
          Voltar ao início
        </Button>
      </motion.div>
    </div>
  );
}
