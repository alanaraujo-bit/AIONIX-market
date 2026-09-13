"use client";

import { formatBRL, formatOrderNumber, nextOrderStatus, orderFlow, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, type OrderStatus } from "@aionix/shared";
import { ArrowRight, Clock3, MapPin, Phone, Printer, User, Wallet, XCircle } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAdminMutation, useAdminOrder } from "@/lib/queries";
import { Breadcrumb } from "@/components/shell";
import { STATUS_ICON, StatusPill } from "@/components/order-status";
import { Button, Card, ConfirmDialog, Input, Skeleton, cn } from "@/components/ui";

export function OrderDetailScreen({ id }: { id: string }) {
  const { data: order, isPending } = useAdminOrder(id);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [note, setNote] = useState("");
  const update = useAdminMutation(
    ({ status, note }: { status: OrderStatus; note?: string }) => api(`/admin/orders/${id}/status`, { method: "PATCH", body: { status, note } }),
    { invalidate: [["admin", "order", id], ["admin", "orders"], ["admin", "dashboard"], ["admin", "products"]], success: "Pedido atualizado", onSuccess: () => setNote("") },
  );

  if (isPending || !order) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  const pickup = order.fulfillmentMethod === "pickup";
  const ORDER_FLOW = orderFlow(order.fulfillmentMethod);
  const next = nextOrderStatus(order.status, order.fulfillmentMethod);
  const final = order.status === "delivered" || order.status === "cancelled";
  const eventFor = (s: OrderStatus) => order.events?.filter((e) => e.status === s).at(-1);

  return (
    <>
      <Breadcrumb items={[{ label: "Pedidos", href: "/pedidos" }, { label: formatOrderNumber(order.number) }]} />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-[26px] font-bold tracking-[-0.03em]">Pedido {formatOrderNumber(order.number)}</h1>
            <StatusPill status={order.status} />
          </div>
          <p className="mt-1 text-[13.5px] text-muted">
            Recebido em {new Date(order.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })} · {order.deliverySlot}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer className="size-4" /> Imprimir</Button>
          {!final && <Button variant="danger" onClick={() => setCancelOpen(true)}><XCircle className="size-4" /> Cancelar</Button>}
          {next && (
            <Button loading={update.isPending} onClick={() => update.mutate({ status: next, note: note || undefined })}>
              {pickup && next === "delivered" ? "Confirmar retirada pelo cliente" : ORDER_STATUS_LABEL[next]} <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card title="Progresso">
            <ol className="flex flex-wrap gap-2">
              {(order.status === "cancelled" ? [...ORDER_FLOW.filter((s) => eventFor(s)), "cancelled" as const] : ORDER_FLOW).map((s, i, arr) => {
                const Icon = STATUS_ICON[s];
                const idx = ORDER_FLOW.indexOf(order.status);
                const done = s === "cancelled" || (order.status !== "cancelled" ? i <= idx : true);
                const active = s === order.status;
                const ev = eventFor(s);
                return (
                  <li key={s} className="flex items-center gap-2">
                    <div className={cn("flex items-center gap-2 rounded-xl px-3 py-2", active ? (s === "cancelled" ? "bg-sale text-white" : "bg-brand text-white") : done ? "bg-brand-soft text-brand" : "bg-line-2 text-faint")}>
                      <Icon className="size-4" strokeWidth={2.4} />
                      <span>
                        <span className="block text-[12.5px] font-bold">{pickup && s === "delivered" ? "Retirado na loja" : ORDER_STATUS_LABEL[s]}</span>
                        {ev && <span className={cn("block text-[11px]", active ? "text-white/70" : "text-muted")}>{new Date(ev.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}{ev.note ? ` · ${ev.note}` : ""}</span>}
                      </span>
                    </div>
                    {i < arr.length - 1 && <span className={cn("h-px w-4", done && !active ? "bg-brand-3" : "bg-line")} />}
                  </li>
                );
              })}
            </ol>
            {!final && (
              <div className="mt-4 flex flex-wrap items-end gap-2">
                <Input label="Observação para o cliente (opcional)" value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} placeholder="Ex.: Substituímos o leite por outra marca" className="min-w-[260px] flex-1" />
                {next && (
                  <p className="pb-2.5 text-[12.5px] text-muted">
                    A observação é enviada junto com <strong className="font-semibold text-ink">{pickup && next === "delivered" ? "Retirada concluída" : ORDER_STATUS_LABEL[next]}</strong>.
                  </p>
                )}
              </div>
            )}
          </Card>

          <Card title={`${order.itemCount} ${order.itemCount === 1 ? "item" : "itens"}`} padded={false}>
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b border-line-2 text-left text-[11.5px] font-bold tracking-[0.04em] text-muted uppercase">
                  <th className="px-5 py-2.5">Produto</th>
                  <th className="px-3 py-2.5 text-right">Qtd</th>
                  <th className="px-3 py-2.5 text-right">Unit.</th>
                  <th className="px-5 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-2">
                {order.items?.map((i) => (
                  <tr key={i.id}>
                    <td className="px-5 py-2.5">
                      <span className="flex items-center gap-3">
                        <span className="size-10 shrink-0 overflow-hidden rounded-lg bg-line-2">{i.imageUrl && <img src={i.imageUrl} alt="" className="size-full object-contain mix-blend-multiply" />}</span>
                        <span>
                          <span className="block font-medium">{i.name}</span>
                          <span className="block text-[12px] text-muted">{i.unitLabel}</span>
                        </span>
                      </span>
                    </td>
                    <td className="tabular px-3 py-2.5 text-right">{i.quantity}</td>
                    <td className="tabular px-3 py-2.5 text-right text-ink-2">{formatBRL(i.unitPriceCents)}</td>
                    <td className="tabular px-5 py-2.5 text-right font-bold">{formatBRL(i.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-line text-[13.5px]">
                <tr><td colSpan={3} className="px-5 pt-3 text-right text-muted">Subtotal</td><td className="tabular px-5 pt-3 text-right">{formatBRL(order.subtotalCents)}</td></tr>
                {order.discountCents > 0 && <tr><td colSpan={3} className="px-5 pt-1 text-right text-sale">Descontos</td><td className="tabular px-5 pt-1 text-right text-sale">− {formatBRL(order.discountCents)}</td></tr>}
                {order.reward && <tr><td colSpan={3} className="px-5 pt-1 text-right font-semibold text-coin-2">Prêmio {order.reward.name} <span className="font-mono text-[11.5px] text-muted">({order.reward.code})</span></td><td className="tabular px-5 pt-1 text-right font-semibold text-coin-2">{order.rewardDiscountCents ? `− ${formatBRL(order.rewardDiscountCents)}` : order.reward.label}</td></tr>}
                {order.coinsEarned > 0 && <tr><td colSpan={3} className="px-5 pt-1 text-right text-muted">Moedas do cliente</td><td className="tabular px-5 pt-1 text-right font-semibold text-coin-2">+{order.coinsEarned} {order.coinsStatus === "settled" ? "creditadas" : order.coinsStatus === "void" ? "(canceladas)" : "a caminho"}</td></tr>}
                <tr><td colSpan={3} className="px-5 pt-1 text-right text-muted">{pickup ? "Retirada" : "Entrega"}</td><td className="tabular px-5 pt-1 text-right">{order.deliveryFeeCents ? formatBRL(order.deliveryFeeCents) : "Grátis"}</td></tr>
                <tr><td colSpan={3} className="px-5 pt-2 pb-4 text-right text-[15px] font-bold">Total</td><td className="tabular px-5 pt-2 pb-4 text-right text-[18px] font-bold">{formatBRL(order.totalCents)}</td></tr>
              </tfoot>
            </table>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Cliente">
            <p className="flex items-center gap-2 text-[14px] font-semibold"><User className="size-4 text-brand-2" /> {order.customer?.name}</p>
            <p className="mt-1.5 text-[13px] text-ink-2">{order.customer?.email}</p>
            {order.customer?.phone && (
              <a href={`tel:${order.customer.phone.replace(/\D/g, "")}`} className="mt-1 flex items-center gap-2 text-[13px] font-semibold text-brand-2"><Phone className="size-3.5" /> {order.customer.phone}</a>
            )}
          </Card>
          <Card title={pickup ? "Retirada na loja" : "Entrega"}>
            <p className="flex items-start gap-2 text-[13.5px]"><MapPin className="mt-0.5 size-4 shrink-0 text-brand-2" /><span>{order.address.street}{order.address.number ? `, ${order.address.number}` : ""}{order.address.complement ? ` · ${order.address.complement}` : ""}{!pickup && <><br /><span className="text-muted">{order.address.district} · {order.address.city}/{order.address.state} · {order.address.zip}</span></>}{order.address.reference && <><br /><span className="text-muted">Ref.: {order.address.reference}</span></>}</span></p>
            <p className="mt-3 flex items-center gap-2 text-[13.5px]"><Clock3 className="size-4 text-brand-2" /> {order.deliverySlot}</p>
            <p className="mt-1 text-[12.5px] text-muted">{pickup ? "Local" : "Recebe"}: {order.address.recipient}</p>
          </Card>
          <Card title="Pagamento">
            <p className="flex items-center gap-2 text-[13.5px] font-semibold"><Wallet className="size-4 text-brand-2" /> {order.paymentMethod === "card_on_delivery" ? "Cartão" : PAYMENT_METHOD_LABEL[order.paymentMethod]} {pickup ? "na retirada" : "na entrega"}</p>
            {order.changeForCents ? <p className="mt-1 text-[13px] text-muted">Troco para {formatBRL(order.changeForCents)} (levar {formatBRL(order.changeForCents - order.totalCents)})</p> : null}
            {order.notes && <p className="mt-3 rounded-xl bg-citrus-soft px-3 py-2 text-[13px] text-[#6d4700]">“{order.notes}”</p>}
          </Card>
        </div>
      </div>

      <ConfirmDialog open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancelar este pedido?" description="O cliente será notificado e os itens voltam ao estoque. Esta ação não pode ser desfeita." confirmLabel="Cancelar pedido" loading={update.isPending} onConfirm={() => update.mutate({ status: "cancelled", note: note || "Cancelado pela loja" }, { onSuccess: () => setCancelOpen(false) })} />
    </>
  );
}
