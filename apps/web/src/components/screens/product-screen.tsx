"use client";

import { formatBRL } from "@aionix/shared";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronRight, Crown, Minus, PackageX, Plus, Share2, ShoppingBag, Tag, Truck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ClubBadge, Price } from "@/components/product/price";
import { useClubSheet } from "@/components/club/club-sheet";
import { ProductRail } from "@/components/product/product-card";
import { ProductImage } from "@/components/product/product-image";
import { Badge, Button, EmptyState, Pressable, Skeleton, cn } from "@/components/ui/primitives";
import { BackButton, Screen } from "@/components/ui/screen";
import { api } from "@/lib/api";
import { cartCount, useCart, useCartQuantity, useHydrated } from "@/lib/cart";
import { effectivePrice, useClub } from "@/lib/club";
import { play } from "@/lib/sound";
import { haptic, toast } from "@/lib/toast";
import type { ProductDetail } from "@/lib/types";

function HeaderActions() {
  const hydrated = useHydrated();
  const count = useCart((s) => cartCount(s.items));
  return (
    <div className="flex gap-2">
      <Pressable
        aria-label="Compartilhar"
        onClick={async () => {
          const data = { title: document.title, url: window.location.href };
          try {
            if (navigator.share) await navigator.share(data);
            else {
              await navigator.clipboard.writeText(data.url);
              toast.success("Link copiado", { sound: "copy" });
            }
          } catch {
            /* dismissed */
          }
        }}
        className="grid size-10 place-items-center rounded-full bg-card text-ink shadow-card ring-1 ring-line/70"
      >
        <Share2 className="size-[18px]" />
      </Pressable>
      <Link href="/carrinho" aria-label="Carrinho" className="relative grid size-10 place-items-center rounded-full bg-card text-ink shadow-card ring-1 ring-line/70 active:scale-95">
        <ShoppingBag className="size-[18px]" />
        {hydrated && count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 0.4 }}
            animate={{ scale: 1 }}
            className="tabular absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-sale px-1 text-[10.5px] font-bold text-white ring-2 ring-canvas"
          >
            {count}
          </motion.span>
        )}
      </Link>
    </div>
  );
}

export function ProductScreen({ slug, initial }: { slug: string; initial: ProductDetail | null }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ["catalog", "product", slug],
    queryFn: () => api<ProductDetail>(`/products/${slug}`),
    initialData: initial ?? undefined,
  });
  const hydrated = useHydrated();
  const inCart = useCartQuantity(data?.product.id ?? "");
  const add = useCart((s) => s.add);
  const setQuantity = useCart((s) => s.setQuantity);
  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const { member } = useClub();

  useEffect(() => {
    if (hydrated && inCart > 0) setQty(inCart);
  }, [hydrated, inCart]);

  const header = (
    <header className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-20">
      <div className="pointer-events-auto flex h-[60px] items-center justify-between px-4">
        <BackButton />
        <HeaderActions />
      </div>
    </header>
  );

  if (isError || (!isPending && !data)) {
    return (
      <Screen header={<div className="pt-safe px-4 pt-3"><BackButton /></div>}>
        <EmptyState icon={<PackageX className="size-9" />} title="Produto indisponível" description="Ele pode ter saído do catálogo." action={<Link href="/" className="font-semibold text-brand">Voltar ao início</Link>} />
      </Screen>
    );
  }

  const p = data?.product;
  const soldOut = !!p && p.stock <= 0;
  const maxQty = p ? Math.min(p.stock, 99) : 1;
  const price = p ? effectivePrice(p, member) : null;
  const cta = () => {
    if (!p) return;
    haptic([8, 30, 8]);
    play("addToCart", { level: Math.max(0, qty - 1) });
    if (inCart > 0) setQuantity(p.id, qty);
    else add(p, qty, price ? { cents: price.cents, compareAt: price.compareAt, viaClub: price.viaClub } : undefined);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1400);
    toast.success(inCart > 0 ? "Carrinho atualizado" : "Adicionado ao carrinho", {
      description: `${qty}× ${p.name}`,
      action: { label: "Ver", href: "/carrinho" },
    });
  };

  const footer = p && (
    <div className="pb-safe relative z-20 shrink-0 border-t border-line bg-card/95 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 pt-3 pb-3">
        <div className="flex h-14 items-center rounded-[20px] bg-canvas ring-1 ring-line">
          <Pressable aria-label="Diminuir" disabled={qty <= 1 || soldOut} onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid size-12 place-items-center text-ink disabled:text-faint">
            <Minus className="size-[18px]" strokeWidth={2.6} />
          </Pressable>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={qty} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} className="tabular w-7 text-center text-[17px] font-bold">
              {qty}
            </motion.span>
          </AnimatePresence>
          <Pressable aria-label="Aumentar" disabled={qty >= maxQty || soldOut} onClick={() => setQty((q) => Math.min(maxQty, q + 1))} className="grid size-12 place-items-center text-ink disabled:text-faint">
            <Plus className="size-[18px]" strokeWidth={2.6} />
          </Pressable>
        </div>
        <Button size="lg" className="flex-1" disabled={soldOut} onClick={cta}>
          <AnimatePresence mode="wait" initial={false}>
            {justAdded ? (
              <motion.span key="ok" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                <Check className="size-5" strokeWidth={3} /> Pronto!
              </motion.span>
            ) : (
              <motion.span key="cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex w-full items-center justify-between gap-3">
                <span>{soldOut ? "Esgotado" : inCart > 0 ? "Atualizar" : "Adicionar"}</span>
                {!soldOut && <span className="tabular font-display">{formatBRL((price?.cents ?? p.finalPriceCents) * qty)}</span>}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {header}
      <Screen footer={footer}>
        <div className="grain relative aspect-[1/0.92] w-full bg-[linear-gradient(180deg,#efece4_0%,#f6f4ee_100%)]">
          {p ? (
            <motion.div className="absolute inset-0 pt-[calc(env(safe-area-inset-top)+44px)]" initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 30 }}>
              <div className="relative size-full">
                <ProductImage src={p.imageUrl} blur={p.blurDataUrl} alt={p.name} sizes="480px" priority className={soldOut ? "opacity-40 grayscale" : undefined} />
              </div>
            </motion.div>
          ) : (
            <Skeleton className="absolute inset-10 rounded-[32px]" />
          )}
        </div>

        <div className="relative -mt-6 rounded-t-[30px] bg-canvas px-5 pt-6 pb-8">
          {p ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {price?.viaClub ? (
                  <ClubBadge label={`Preço de Clube · −${price.discountPercent}%`} />
                ) : (
                  p.discountPercent > 0 && <Badge tone="sale">-{p.discountPercent}%</Badge>
                )}
                {!price?.viaClub && p.promotionName && (
                  <Badge tone="citrus">
                    <Tag className="size-3" strokeWidth={2.6} /> {p.promotionName}
                  </Badge>
                )}
                {data?.category && (
                  <Link href={`/categoria/${data.category.slug}`}>
                    <Badge tone="neutral">{data.category.name}</Badge>
                  </Link>
                )}
              </div>
              <h1 className="mt-3 font-display text-[25px] leading-[1.12] font-bold tracking-[-0.03em]">{p.name}</h1>
              <p className="mt-1 text-[14px] font-medium text-muted">
                {[p.brand, p.unitLabel].filter(Boolean).join(" · ")}
              </p>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={price?.viaClub ? "club" : "shelf"}
                  initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                >
                  <Price cents={price?.cents ?? p.finalPriceCents} compareAt={price?.compareAt} size="xl" tone={price?.viaClub ? "club" : "auto"} className="mt-4" />
                  {price?.viaClub ? (
                    <p className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-club">
                      <Crown className="size-3.5 text-club-gold" strokeWidth={2.8} fill="currentColor" />
                      Seu preço de membro · você economiza {formatBRL((price.compareAt ?? p.priceCents) - price.cents)} por unidade
                    </p>
                  ) : (
                    price?.compareAt &&
                    price.compareAt > price.cents && (
                      <p className="mt-1 text-[13px] font-semibold text-brand-2">Você economiza {formatBRL(price.compareAt - price.cents)} por unidade</p>
                    )
                  )}
                </motion.div>
              </AnimatePresence>

              {price?.clubOffer !== null && price?.clubOffer !== undefined && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => (haptic(), useClubSheet.getState().show(p))}
                  className="club-surface grain mt-4 flex w-full items-center gap-3.5 rounded-[22px] p-4 text-left text-white"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/12 ring-1 ring-white/20">
                    <Crown className="size-5 text-club-gold-2 animate-twinkle" strokeWidth={2.4} fill="currentColor" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-bold tracking-[0.1em] text-club-gold-2 uppercase">No Clube AIONIX</span>
                    <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                      <span className="tabular font-display text-[22px] leading-none font-extrabold tracking-[-0.03em] whitespace-nowrap">{formatBRL(price.clubOffer)}</span>
                      <span className="text-[12.5px] font-semibold whitespace-nowrap text-white/70">−{formatBRL(price.cents - price.clubOffer)}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-club-gold px-3 py-1.5 text-[12.5px] font-extrabold text-club-2">
                    Entrar <ChevronRight className="size-3.5" strokeWidth={3} />
                  </span>
                </motion.button>
              )}

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-[18px] bg-card p-3.5 shadow-card">
                  <Truck className="size-[18px] text-brand-2" />
                  <p className="mt-2 text-[13px] leading-snug font-semibold">Entrega no mesmo dia</p>
                </div>
                <div className={cn("rounded-[18px] bg-card p-3.5 shadow-card", p.stock <= 5 && !soldOut && "ring-1 ring-citrus")}>
                  <span className={cn("block size-[18px] rounded-full border-[5px]", soldOut ? "border-sale/40" : p.stock <= 5 ? "border-citrus" : "border-brand-3/50")} />
                  <p className="mt-2 text-[13px] leading-snug font-semibold">
                    {soldOut ? "Sem estoque" : p.stock <= 5 ? `Últimas ${p.stock} unidades` : "Em estoque"}
                  </p>
                </div>
              </div>

              {p.description && (
                <section className="mt-6">
                  <h2 className="mb-2 text-[13px] font-bold tracking-[0.04em] text-muted uppercase">Sobre o produto</h2>
                  <p className="text-[15px] leading-relaxed text-ink-2">{p.description}</p>
                </section>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-8 w-4/5" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-10 w-32" />
            </div>
          )}
        </div>

        {!!data?.related.length && (
          <section className="pb-8">
            <h2 className="mb-3 px-5 font-display text-[19px] font-bold tracking-[-0.025em]">Você também pode gostar</h2>
            <ProductRail products={data.related} />
          </section>
        )}
      </Screen>
    </div>
  );
}
