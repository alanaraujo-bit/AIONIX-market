"use client";

import { formatBRL, type Address } from "@aionix/shared";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Clock3, Crown, MapPin, Search, Truck } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BannerCarousel, BannerSkeleton } from "@/components/banner-carousel";
import { CartBar } from "@/components/cart-bar";
import { ClubHero } from "@/components/club/club-hero";
import { CoinsHomeCard } from "@/components/coins/coins-home-card";
import { ProductGrid, ProductRail } from "@/components/product/product-card";
import { Screen } from "@/components/ui/screen";
import { SectionHeader, Skeleton, cn } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { cartTotal, useCart, useHydrated } from "@/lib/cart";
import { useSession } from "@/lib/session";
import type { HomeData } from "@/lib/types";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function useCountdownToMidnight() {
  const [left, setLeft] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = new Date(now);
      end.setHours(24, 0, 0, 0);
      const s = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
      const hh = String(Math.floor(s / 3600)).padStart(2, "0");
      const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      setLeft(`${hh}:${mm}:${ss}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return left;
}

function HomeHeader({ data }: { data?: HomeData }) {
  const { user } = useSession();
  const addresses = useQuery({
    queryKey: ["addresses"],
    queryFn: () => api<{ items: Address[] }>("/me/addresses"),
    enabled: !!user,
  });
  const address = addresses.data?.items.find((a) => a.isDefault) ?? addresses.data?.items[0];
  const [hello, setHello] = useState("Olá");
  useEffect(() => setHello(greeting()), []);

  return (
    <header className="pt-safe relative z-20 shrink-0 bg-canvas">
      <div className="flex items-center gap-3 px-5 pt-3">
        <Link
          href={user ? "/conta/enderecos" : "/entrar?next=/"}
          className="flex min-w-0 flex-1 items-center gap-2.5 active:opacity-70"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand text-white">
            <MapPin className="size-[18px]" strokeWidth={2.4} />
          </span>
          <span className="min-w-0">
            <span className="block text-[11.5px] font-semibold tracking-[0.02em] text-muted uppercase">
              {user ? `${hello}, ${user.name.split(" ")[0]}` : "Entregar em"}
            </span>
            <span className="flex items-center gap-1 text-[15px] font-bold tracking-[-0.01em]">
              <span className="truncate">
                {address ? `${address.street}, ${address.number}` : user ? "Adicionar endereço" : "Entre para escolher o endereço"}
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted" strokeWidth={2.6} />
            </span>
          </span>
        </Link>
        {data ? (
          <span
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11.5px] font-bold",
              data.store.open ? "bg-brand-soft text-brand" : "bg-sale-soft text-sale",
            )}
          >
            <span className={cn("size-1.5 rounded-full", data.store.open ? "bg-brand-3 animate-pulse" : "bg-sale")} />
            {data.store.open ? `${data.store.etaMinutes} min` : "Fechado"}
          </span>
        ) : (
          <Skeleton className="h-7 w-16 rounded-full" />
        )}
      </div>
      <div className="px-5 pt-3 pb-3">
        <Link
          href="/buscar?focus=1"
          className="flex h-12 items-center gap-3 rounded-2xl bg-card px-4 text-muted shadow-card ring-1 ring-line/70 active:scale-[0.99] transition-transform"
        >
          <Search className="size-[18px]" strokeWidth={2.4} />
          <span className="text-[15px] font-medium">Buscar arroz, frutas, café…</span>
        </Link>
      </div>
    </header>
  );
}

function FreeDeliveryCard({ threshold }: { threshold: number }) {
  const hydrated = useHydrated();
  const total = useCart((s) => cartTotal(s.items));
  const pct = Math.min(100, (total / threshold) * 100);
  const left = Math.max(0, threshold - total);
  return (
    <div className="mx-5 flex items-center gap-3.5 rounded-[22px] bg-card p-4 shadow-card">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-citrus-soft text-[#9a6400]">
        <Truck className="size-5" strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold tracking-[-0.01em]">
          {!hydrated || total === 0
            ? `Frete grátis acima de ${formatBRL(threshold)}`
            : left > 0
              ? `Faltam ${formatBRL(left)} para o frete grátis`
              : "Você ganhou frete grátis! 🎉"}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line-2">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-brand-3 to-brand"
            initial={false}
            animate={{ width: `${hydrated ? pct : 0}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
      </div>
    </div>
  );
}

export function HomeScreen({ initial }: { initial: HomeData | null }) {
  const { data, isPending } = useQuery({
    queryKey: ["catalog", "home"],
    queryFn: () => api<HomeData>("/catalog/home"),
    initialData: initial ?? undefined,
    staleTime: 30_000,
  });
  const countdown = useCountdownToMidnight();
  const loading = isPending && !data;

  return (
    <>
      <Screen header={<HomeHeader data={data} />}>
        <div className="space-y-7 pt-1 pb-28">
          {loading ? <BannerSkeleton /> : <BannerCarousel banners={data?.banners ?? []} />}

          <section>
            <SectionHeader
              title="Categorias"
              action={
                <Link href="/buscar" className="flex items-center text-[13px] font-semibold text-brand-2">
                  Ver todas <ChevronRight className="size-4" />
                </Link>
              }
            />
            <div className="scroll-x flex gap-2.5 px-5 pb-1">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[92px] w-[78px] shrink-0 rounded-[20px]" />)
                : data?.categories.map((c, i) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 8) * 0.03 }}
                    >
                      <Link
                        href={`/categoria/${c.slug}`}
                        className="flex w-[78px] shrink-0 flex-col items-center gap-2 active:scale-95 transition-transform"
                      >
                        <span
                          className="grain grid size-[64px] place-items-center rounded-[22px] text-[30px] shadow-[inset_0_-2px_0_rgb(0_0_0/0.04)]"
                          style={{ background: c.color }}
                        >
                          {c.icon}
                        </span>
                        <span className="line-clamp-2 text-center text-[12px] leading-tight font-semibold text-ink-2">{c.name}</span>
                      </Link>
                    </motion.div>
                  ))}
            </div>
          </section>

          {(loading || (data?.deals.length ?? 0) > 0) && (
            <section>
              <div className="mb-3 flex items-end justify-between px-5">
                <div>
                  <h2 className="font-display text-[19px] font-bold tracking-[-0.025em]">Ofertas do dia</h2>
                  {countdown && (
                    <p className="mt-0.5 flex items-center gap-1 text-[12px] font-semibold text-sale">
                      <Clock3 className="size-3.5" strokeWidth={2.4} />
                      Termina em <span className="tabular">{countdown}</span>
                    </p>
                  )}
                </div>
                <Link href="/ofertas" className="flex items-center text-[13px] font-semibold text-brand-2">
                  Ver tudo <ChevronRight className="size-4" />
                </Link>
              </div>
              <ProductRail products={data?.deals} loading={loading} priority />
            </section>
          )}

          {(loading || (data?.club?.length ?? 0) > 0) && (
            <section>
              <div className="mb-3 flex items-end justify-between px-5">
                <h2 className="flex items-center gap-2 font-display text-[19px] font-bold tracking-[-0.025em]">
                  <Crown className="size-[18px] text-club-gold" strokeWidth={2.6} fill="currentColor" /> Clube AIONIX
                </h2>
                <Link href="/clube" className="flex items-center text-[13px] font-semibold text-club">
                  Ver tudo <ChevronRight className="size-4" />
                </Link>
              </div>
              {loading ? <Skeleton className="mx-5 h-[196px] rounded-[26px]" /> : <ClubHero products={data?.club ?? []} />}
              <div className="mt-3">
                <ProductRail products={data?.club} loading={loading} />
              </div>
            </section>
          )}

          <CoinsHomeCard />

          <FreeDeliveryCard threshold={data?.store.freeDeliveryThresholdCents ?? 15000} />

          {(loading || (data?.featured.length ?? 0) > 0) && (
            <section>
              <SectionHeader title="Seleção da semana" />
              <ProductRail products={data?.featured} loading={loading} />
            </section>
          )}

          <section>
            <SectionHeader title="Mais vendidos" />
            <ProductGrid products={data?.bestSellers} loading={loading} />
          </section>
        </div>
      </Screen>
      <CartBar className="bottom-3" />
    </>
  );
}
