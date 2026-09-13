"use client";

import { formatBRL, formatOrderNumber, PAYMENT_METHOD_LABEL, type Order } from "@aionix/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock3, MapPin, PackageX, RotateCcw, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OrderTimeline, StatusPill } from "@/components/order-status";
import { ProductImage } from "@/components/product/product-image";
import { Button, EmptyState, Skeleton, cn } from "@/components/ui/primitives";
import { Screen, TopBar } from "@/components/ui/screen";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { useOrder } from "@/lib/account";
import { useCart } from "@/lib/cart";
import { haptic, toast } from "@/lib/toast";

export function OrderDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: order, isPending, isError } = useOrder(id);
  const replace = useCart((s) => s.replace);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const cancel = useMutation({
    mutationFn: () => api<{ order: Order }>(`/me/orders/${id}/cancel`, { method: "POST" }),
    onSuccess: ({ order }) => {
      qc.setQueryData(["order", id], { order });
      void qc.invalidateQueries({ queryKey: ["orders"] });
      setConfirmCancel(false);
      haptic([10, 30, 10]);
      toast("Pedido cancelado", { description: "O estoque foi devolvido à loja." });
    },
    onError: (e) => toast.error(e.message),
  });

  const reorder = useMutation({
    mutationFn: async () => {
      const { items } = await api<{ items: { productId: string; quantity: number }[] }>(`/me/orders/${id}/reorder`);
      if (!items.length) throw new Error("Nenhum item deste pedido está disponível agora");
      const quote = await api<{ lines: { productId: string; name: string; imageUrl: string | null; unitLabel: string; unitPriceCents: number; originalUnitPriceCents: number; stock: number; quantity: number; viaClub: boolean }[] }>("/cart/quote", { body: { items } });
      replace(
        quote.lines.map((l) => ({
          productId: l.productId,
          slug: "",
          name: l.name,
          imageUrl: l.imageUrl,
          blurDataUrl: null,
          unitLabel: l.unitLabel,
          priceCents: l.unitPriceCents,
          compareAtCents: l.originalUnitPriceCents > l.unitPriceCents ? l.originalUnitPriceCents : null,
          viaClub: l.viaClub,
          stock: l.stock,
          quantity: l.quantity,
        })),
      );
      return quote.lines.length;
    },
    onSuccess: (n) => {
      haptic([8, 30, 8]);
      toast.success(`${n} ${n === 1 ? "item adicionado" : "itens adicionados"} ao carrinho`);
      router.push("/carrinho");
    },
    onError: (e) => toast.error(e.message),
  });

  if (isError) {
    return (
      <Screen header={<TopBar back backFallback="/pedidos" title="Pedido" />}>
        <EmptyState icon={<PackageX className="size-9" />} title="Pedido não encontrado" action={<Link href="/pedidos" className="font-semibold text-brand">Ver meus pedidos</Link>} />
      </Screen>
    );
  }

  const done = order?.status === "delivered" || order?.status === "cancelled";

  return (
    <Screen
      header={<TopBar back backFallback="/pedidos" title={order ? formatOrderNumber(order.number) : "Pedido"} subtitle={order ? new Date(order.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" }) : undefined} />}
      footer={
        order && (
          <div className="pb-safe relative z-20 shrink-0 border-t border-line bg-card/95 px-4 pt-3 pb-3 backdrop-blur-xl">
            {order.status === "pending" ? (
              <div className="flex gap-3">
                <Button variant="danger" size="lg" className="flex-1" onClick={() => setConfirmCancel(true)}>Cancelar pedido</Button>
                <Button size="lg" className="flex-1" onClick={() => reorder.mutate()} loading={reorder.isPending}><RotateCcw className="size-4" /> Repetir</Button>
              </div>
            ) : (
              <Button size="lg" block onClick={() => reorder.mutate()} loading={reorder.isPending}>
                <RotateCcw className="size-4" /> Repetir pedido
              </Button>
            )}
          </div>
        )
      }
    >
      {isPending || !order ? (
        <div className="space-y-4 px-4 pt-2">
          <Skeleton className="h-40 rounded-[22px]" />
          <Skeleton className="h-64 rounded-[22px]" />
        </div>
      ) : (
        <div className="space-y-4 px-4 pt-2 pb-8">
          <section className={cn("grain relative overflow-hidden rounded-[24px] p-5", done ? "bg-card shadow-card" : "bg-brand text-white")}>
            <div className="flex items-center justify-between">
              <StatusPill status={order.status} size="md" />
              {!done && (
                <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white/80">
                  <Clock3 className="size-3.5" /> {order.deliverySlot}
                </span>
              )}
            </div>
            <p className={cn("mt-4 font-display text-[24px] leading-tight font-extrabold tracking-[-0.03em]", !done && "text-white")}>
              {order.status === "pending" && "Recebemos seu pedido"}
              {order.status === "confirmed" && "Pedido confirmado pela loja"}
              {order.status === "picking" && "Separando seus produtos"}
              {order.status === "out_for_delivery" && "Saiu para entrega!"}
              {order.status === "delivered" && (order.fulfillmentMethod === "pickup" ? "Retirado. Bom apetite!" : "Entregue. Bom apetite!")}
              {order.status === "cancelled" && "Pedido cancelado"}
            </p>
            <p className={cn("mt-1 text-[13.5px]", done ? "text-muted" : "text-white/75")}>
              {order.status === "out_for_delivery" ? "O entregador está a caminho do seu endereço." : order.status === "delivered" ? "Obrigado por comprar na AIONIX Market." : order.status === "cancelled" ? "Nenhum valor foi cobrado." : "Atualizamos o status em tempo real."}
            </p>
            {!done && <span aria-hidden className="absolute -right-10 -bottom-14 size-44 rounded-full bg-white/10" />}
          </section>

          <section className="rounded-[22px] bg-card p-5 shadow-card">
            <h2 className="mb-5 text-[13px] font-bold tracking-[0.04em] text-muted uppercase">Acompanhamento</h2>
            <OrderTimeline status={order.status} events={order.events} fulfillmentMethod={order.fulfillmentMethod} />
          </section>

          <section className="rounded-[22px] bg-card p-4 shadow-card">
            <h2 className="mb-3 px-1 text-[13px] font-bold tracking-[0.04em] text-muted uppercase">{order.itemCount} {order.itemCount === 1 ? "item" : "itens"}</h2>
            <ul className="space-y-3">
              {order.items?.map((i) => (
                <li key={i.id} className="flex items-center gap-3">
                  <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-[#f6f5f1]">
                    <ProductImage src={i.imageUrl} alt="" sizes="48px" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{i.name}</span>
                    <span className="block text-[12.5px] text-muted">{i.quantity} × {formatBRL(i.unitPriceCents)}{i.unitLabel ? ` · ${i.unitLabel}` : ""}</span>
                  </span>
                  <span className="tabular text-[14px] font-bold">{formatBRL(i.totalCents)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-2 border-t border-line pt-3 text-[14px]">
              <div className="flex justify-between text-muted"><span>Subtotal</span><span className="tabular">{formatBRL(order.subtotalCents)}</span></div>
              {order.discountCents > 0 && <div className="flex justify-between text-sale"><span>Descontos</span><span className="tabular">− {formatBRL(order.discountCents)}</span></div>}
              <div className="flex justify-between text-muted"><span>{order.fulfillmentMethod === "pickup" ? "Retirada na loja" : "Entrega"}</span><span className="tabular">{order.deliveryFeeCents ? formatBRL(order.deliveryFeeCents) : "Grátis"}</span></div>
              <div className="flex items-baseline justify-between pt-1"><span className="text-[15px] font-bold">Total</span><span className="tabular font-display text-[22px] font-bold tracking-[-0.02em]">{formatBRL(order.totalCents)}</span></div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3">
            <div className="flex gap-3 rounded-[20px] bg-card p-4 shadow-card">
              <MapPin className="mt-0.5 size-5 shrink-0 text-brand-2" />
              <div className="text-[13.5px]">
                <p className="font-bold">{order.address.recipient}</p>
                <p className="text-ink-2">{order.address.street}{order.address.number ? `, ${order.address.number}` : ""}{order.address.complement ? ` · ${order.address.complement}` : ""}</p>
                {order.fulfillmentMethod !== "pickup" && <p className="text-muted">{order.address.district} · {order.address.city}/{order.address.state} · {order.address.zip}</p>}
              </div>
            </div>
            <div className="flex gap-3 rounded-[20px] bg-card p-4 shadow-card">
              <Wallet className="mt-0.5 size-5 shrink-0 text-brand-2" />
              <div className="text-[13.5px]">
                <p className="font-bold">{order.paymentMethod === "card_on_delivery" ? "Cartão" : PAYMENT_METHOD_LABEL[order.paymentMethod]} {order.fulfillmentMethod === "pickup" ? "na retirada" : "na entrega"}</p>
                {order.changeForCents ? <p className="text-muted">Troco para {formatBRL(order.changeForCents)}</p> : null}
                {order.notes && <p className="mt-1 text-ink-2">“{order.notes}”</p>}
              </div>
            </div>
          </section>
        </div>
      )}

      <Sheet open={confirmCancel} onClose={() => setConfirmCancel(false)} title="Cancelar pedido?">
        <p className="text-[15px] leading-relaxed text-ink-2">Seu pedido ainda não foi confirmado pela loja, então pode ser cancelado sem custo. Os itens voltam ao estoque.</p>
        <div className="mt-6 flex gap-3 pb-2">
          <Button variant="secondary" size="lg" className="flex-1" onClick={() => setConfirmCancel(false)}>Manter</Button>
          <Button variant="danger" size="lg" className="flex-1" loading={cancel.isPending} onClick={() => cancel.mutate()}>Cancelar pedido</Button>
        </div>
      </Sheet>
    </Screen>
  );
}
