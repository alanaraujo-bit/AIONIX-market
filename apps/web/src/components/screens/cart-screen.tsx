"use client";

import { formatBRL } from "@aionix/shared";
import { ArrowRight, Minus, Plus, ShoppingBag, Sparkles, Trash2, Truck } from "lucide-react";
import { AnimatePresence, motion, useAnimation, type PanInfo } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Price } from "@/components/product/price";
import { ProductImage } from "@/components/product/product-image";
import { Button, EmptyState, Pressable, Skeleton, cn } from "@/components/ui/primitives";
import { LargeTitle, Screen } from "@/components/ui/screen";
import { cartCount, cartSavings, cartTotal, useCart, useHydrated, type CartItem } from "@/lib/cart";
import { useCartQuote } from "@/lib/quote";
import { useSession } from "@/lib/session";
import { haptic, toast } from "@/lib/toast";

function CartRow({ item }: { item: CartItem }) {
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const restore = useCart((s) => s.restore);
  const controls = useAnimation();

  const removeWithUndo = () => {
    haptic([6, 20, 6]);
    const snapshot = item;
    remove(item.productId);
    toast(`${item.name} removido`, {
      action: {
        label: "Desfazer",
        onClick: () => restore(snapshot),
      },
    });
  };

  const onDragEnd = async (_: unknown, info: PanInfo) => {
    if (info.offset.x < -110 || info.velocity.x < -700) {
      await controls.start({ x: "-100%", opacity: 0, transition: { duration: 0.18 } });
      removeWithUndo();
    } else {
      void controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 36 } });
    }
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0, transition: { duration: 0.22 } }}
      className="relative mb-3 overflow-hidden rounded-[22px] bg-sale"
    >
      <div className="absolute inset-y-0 right-0 flex w-28 items-center justify-center text-white">
        <Trash2 className="size-5" />
      </div>
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -140, right: 0 }}
        dragElastic={{ left: 0.25, right: 0 }}
        animate={controls}
        onDragEnd={onDragEnd}
        className="relative flex gap-3 bg-card p-3"
      >
        <Link href={`/produto/${item.slug}`} className="relative size-[76px] shrink-0 overflow-hidden rounded-2xl bg-[#f6f5f1]">
          <ProductImage src={item.imageUrl} blur={item.blurDataUrl} alt={item.name} sizes="80px" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div>
            <p className="line-clamp-2 text-[14px] leading-snug font-semibold text-ink">{item.name}</p>
            <p className="mt-0.5 text-[12px] font-medium text-muted">{item.unitLabel}</p>
          </div>
          <div className="mt-1.5 flex items-end justify-between gap-2">
            <Price cents={item.priceCents * item.quantity} compareAt={item.compareAtCents ? item.compareAtCents * item.quantity : null} size="sm" />
            <div className="flex h-9 items-center rounded-full bg-canvas ring-1 ring-line">
              <Pressable
                aria-label="Diminuir"
                onClick={() => (item.quantity === 1 ? removeWithUndo() : (haptic(6), setQuantity(item.productId, item.quantity - 1)))}
                className="grid size-9 place-items-center text-ink-2"
              >
                {item.quantity === 1 ? <Trash2 className="size-[15px]" /> : <Minus className="size-4" strokeWidth={2.6} />}
              </Pressable>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={item.quantity} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} className="tabular w-6 text-center text-[14px] font-bold">
                  {item.quantity}
                </motion.span>
              </AnimatePresence>
              <Pressable
                aria-label="Aumentar"
                disabled={item.quantity >= item.stock}
                onClick={() => (haptic(), setQuantity(item.productId, item.quantity + 1))}
                className="grid size-9 place-items-center text-ink-2 disabled:text-faint"
              >
                <Plus className="size-4" strokeWidth={2.6} />
              </Pressable>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.li>
  );
}

function Row({ label, value, tone, loading }: { label: string; value: string; tone?: "sale" | "brand"; loading?: boolean }) {
  return (
    <div className="flex items-center justify-between text-[14px]">
      <span className="font-medium text-muted">{label}</span>
      {loading ? (
        <Skeleton className="h-4 w-16" />
      ) : (
        <span className={cn("tabular font-semibold", tone === "sale" ? "text-sale" : tone === "brand" ? "text-brand-2" : "text-ink")}>{value}</span>
      )}
    </div>
  );
}

export function CartScreen() {
  const hydrated = useHydrated();
  const router = useRouter();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const { user } = useSession();
  const { quote, loading } = useCartQuote();
  const count = cartCount(items);
  const localTotal = cartTotal(items);
  const savings = quote ? quote.discountCents : cartSavings(items);

  if (!hydrated) {
    return (
      <Screen header={<LargeTitle title="Carrinho" />}>
        <div className="space-y-3 px-4 pt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-[22px]" />
          ))}
        </div>
      </Screen>
    );
  }

  if (count === 0) {
    return (
      <Screen header={<LargeTitle title="Carrinho" />}>
        <EmptyState
          icon={<ShoppingBag className="size-9" strokeWidth={1.8} />}
          title="Seu carrinho está vazio"
          description="Explore as ofertas do dia e encha o carrinho com o que há de melhor."
          action={
            <Link href="/">
              <Button>
                Começar a comprar <ArrowRight className="size-4" />
              </Button>
            </Link>
          }
        />
      </Screen>
    );
  }

  const net = quote ? quote.subtotalCents - quote.discountCents : localTotal;
  const threshold = quote?.freeDeliveryThresholdCents ?? 15000;
  const minimum = quote?.minimumOrderCents ?? 0;
  const belowMinimum = net < minimum;
  const leftForFree = Math.max(0, threshold - net);
  const unavailable = quote?.lines.filter((l) => !l.available) ?? [];

  const checkout = () => {
    haptic();
    router.push(user ? "/checkout" : "/entrar?next=/checkout");
  };

  return (
    <Screen
      header={
        <LargeTitle
          title="Carrinho"
          subtitle={`${count} ${count === 1 ? "item" : "itens"}`}
          right={
            <button type="button" onClick={() => (haptic(), clear())} className="mb-1 text-[13.5px] font-semibold text-sale active:opacity-60">
              Limpar
            </button>
          }
        />
      }
      footer={
        <div className="relative z-20 shrink-0 border-t border-line bg-card/95 px-4 pt-3 pb-3 backdrop-blur-xl">
          <Button size="lg" block disabled={belowMinimum || unavailable.length > 0} onClick={checkout}>
            <span className="flex w-full items-center justify-between">
              <span>Finalizar compra</span>
              <span className="tabular font-display">{formatBRL(quote?.totalCents ?? localTotal)}</span>
            </span>
          </Button>
        </div>
      }
    >
      <div className="px-4 pt-1 pb-6">
        <motion.div layout className="mb-4 overflow-hidden rounded-[20px] bg-card p-3.5 shadow-card">
          <div className="flex items-center gap-2.5">
            <Truck className={cn("size-[18px] shrink-0", leftForFree === 0 ? "text-brand-2" : "text-[#9a6400]")} />
            <p className="text-[13.5px] font-semibold">
              {leftForFree === 0 ? (
                <span className="text-brand-2">Frete grátis garantido!</span>
              ) : (
                <>
                  Adicione <span className="tabular font-bold">{formatBRL(leftForFree)}</span> para frete grátis
                </>
              )}
            </p>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line-2">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-brand-3 to-brand" animate={{ width: `${Math.min(100, (net / threshold) * 100)}%` }} />
          </div>
        </motion.div>

        <p className="mb-2 px-1 text-[12px] font-medium text-faint">Deslize um item para a esquerda para remover</p>
        <ul>
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <CartRow key={item.productId} item={item} />
            ))}
          </AnimatePresence>
        </ul>

        {unavailable.length > 0 && (
          <div className="mt-1 rounded-2xl bg-sale-soft p-3.5 text-[13px] font-semibold text-sale">
            Estoque insuficiente: {unavailable.map((l) => `${l.name} (disp. ${l.stock})`).join(", ")}
          </div>
        )}

        <div className="mt-3 space-y-2.5 rounded-[22px] bg-card p-4 shadow-card">
          <Row label="Subtotal" value={formatBRL(quote?.subtotalCents ?? localTotal + savings)} loading={!quote} />
          {savings > 0 && <Row label="Descontos" value={`− ${formatBRL(savings)}`} tone="sale" loading={!quote} />}
          <Row
            label="Entrega"
            value={quote ? (quote.deliveryFeeCents === 0 ? "Grátis" : formatBRL(quote.deliveryFeeCents)) : ""}
            tone={quote?.deliveryFeeCents === 0 ? "brand" : undefined}
            loading={!quote}
          />
          <div className="my-1 h-px bg-line" />
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-bold">Total</span>
            {quote ? (
              <motion.span key={quote.totalCents} initial={{ opacity: 0.4 }} animate={{ opacity: loading ? 0.5 : 1 }} className="tabular font-display text-[22px] font-bold tracking-[-0.02em]">
                {formatBRL(quote.totalCents)}
              </motion.span>
            ) : (
              <Skeleton className="h-7 w-24" />
            )}
          </div>
          {savings > 0 && (
            <p className="flex items-center gap-1.5 rounded-xl bg-brand-soft px-3 py-2 text-[12.5px] font-semibold text-brand">
              <Sparkles className="size-3.5" /> Você está economizando {formatBRL(savings)} nesta compra
            </p>
          )}
          {belowMinimum && (
            <p className="rounded-xl bg-citrus-soft px-3 py-2 text-[12.5px] font-semibold text-[#8a5a00]">
              Pedido mínimo de {formatBRL(minimum)}. Faltam {formatBRL(minimum - net)}.
            </p>
          )}
        </div>
      </div>
    </Screen>
  );
}
