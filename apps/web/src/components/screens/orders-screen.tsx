"use client";

import { formatBRL, formatOrderNumber } from "@aionix/shared";
import { ChevronRight, LogIn, Receipt } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { StatusPill } from "@/components/order-status";
import { ProductImage } from "@/components/product/product-image";
import { Button, EmptyState, Skeleton, cn } from "@/components/ui/primitives";
import { LargeTitle, Screen } from "@/components/ui/screen";
import { useOrders } from "@/lib/account";
import { useSession } from "@/lib/session";
import type { OrderListItem } from "@/lib/types";

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Hoje, ${time}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "")}, ${time}`;
};

function OrderCard({ order, index }: { order: OrderListItem; index: number }) {
  const active = order.status !== "delivered" && order.status !== "cancelled";
  return (
    <motion.li initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 6) * 0.04 }}>
      <Link href={`/pedidos/${order.id}`} className={cn("block rounded-[22px] bg-card p-4 shadow-card active:scale-[0.985] transition-transform", active && "ring-1 ring-brand-3/40")}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="tabular text-[15px] font-bold tracking-[-0.01em]">{formatOrderNumber(order.number)}</p>
            <p className="text-[12.5px] font-medium text-muted">{fmtDate(order.createdAt)}{order.fulfillmentMethod === "pickup" ? " · Retirada na loja" : ""}</p>
          </div>
          <StatusPill status={order.status} />
        </div>
        <div className="mt-3.5 flex items-center gap-3">
          <div className="flex -space-x-2.5">
            {order.previews.map((p, i) => (
              <span key={i} className="relative size-11 overflow-hidden rounded-xl bg-[#f6f5f1] ring-2 ring-card">
                <ProductImage src={p.imageUrl} alt={p.name} sizes="44px" />
              </span>
            ))}
            {order.itemCount > order.previews.length && (
              <span className="grid size-11 place-items-center rounded-xl bg-line-2 text-[12px] font-bold text-ink-2 ring-2 ring-card">+{order.itemCount - order.previews.length}</span>
            )}
          </div>
          <div className="ml-auto text-right">
            <p className="tabular font-display text-[17px] font-bold">{formatBRL(order.totalCents)}</p>
            <p className="text-[12px] text-muted">{order.itemCount} {order.itemCount === 1 ? "item" : "itens"}</p>
          </div>
          <ChevronRight className="size-5 text-faint" />
        </div>
      </Link>
    </motion.li>
  );
}

export function OrdersScreen() {
  const { user, loading } = useSession();
  const orders = useOrders(!!user);

  if (!loading && !user) {
    return (
      <Screen header={<LargeTitle title="Pedidos" />}>
        <EmptyState
          icon={<LogIn className="size-9" strokeWidth={1.8} />}
          title="Entre para ver seus pedidos"
          description="Acompanhe entregas em tempo real e repita compras em um toque."
          action={
            <Link href="/entrar?next=/pedidos">
              <Button>Entrar ou criar conta</Button>
            </Link>
          }
        />
      </Screen>
    );
  }

  const items = orders.data?.items ?? [];
  const active = items.filter((o) => o.status !== "delivered" && o.status !== "cancelled");
  const past = items.filter((o) => o.status === "delivered" || o.status === "cancelled");

  return (
    <Screen header={<LargeTitle title="Pedidos" subtitle={items.length ? `${items.length} ${items.length === 1 ? "pedido" : "pedidos"}` : undefined} />}>
      <div className="px-4 pt-1 pb-8">
        {loading || orders.isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[124px] rounded-[22px]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Receipt className="size-9" strokeWidth={1.8} />}
            title="Nenhum pedido ainda"
            description="Quando você fizer sua primeira compra, ela aparece aqui com o status em tempo real."
            action={
              <Link href="/">
                <Button>Ver ofertas</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-6">
            {active.length > 0 && (
              <section>
                <h2 className="mb-2.5 px-1 text-[13px] font-bold tracking-[0.04em] text-muted uppercase">Em andamento</h2>
                <ul className="space-y-3">
                  {active.map((o, i) => (
                    <OrderCard key={o.id} order={o} index={i} />
                  ))}
                </ul>
              </section>
            )}
            {past.length > 0 && (
              <section>
                <h2 className="mb-2.5 px-1 text-[13px] font-bold tracking-[0.04em] text-muted uppercase">Anteriores</h2>
                <ul className="space-y-3">
                  {past.map((o, i) => (
                    <OrderCard key={o.id} order={o} index={i + active.length} />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </Screen>
  );
}
