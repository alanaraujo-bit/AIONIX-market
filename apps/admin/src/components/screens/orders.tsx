"use client";

import { formatBRL, formatOrderNumber, nextOrderStatus, ORDER_STATUS_LABEL, orderStatusLabel, PAYMENT_METHOD_LABEL, type OrderStatus } from "@aionix/shared";
import { ArrowRight, ChevronLeft, ChevronRight, Receipt, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAdminMutation, useAdminOrders } from "@/lib/queries";
import { StatusPill } from "@/components/order-status";
import { Button, Card, EmptyState, PageHeader, Skeleton, cn } from "@/components/ui";

const TABS: { id: string; label: string }[] = [
  { id: "active", label: "Em aberto" },
  { id: "pending", label: "Pendentes" },
  { id: "confirmed", label: "Confirmados" },
  { id: "picking", label: "Separando" },
  { id: "out_for_delivery", label: "Em rota" },
  { id: "delivered", label: "Entregues" },
  { id: "cancelled", label: "Cancelados" },
  { id: "", label: "Todos" },
];

const fmt = (iso: string) => {
  const d = new Date(iso);
  const today = d.toDateString() === new Date().toDateString();
  const t = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return today ? `Hoje ${t}` : `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${t}`;
};

export function OrdersScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const status = sp.get("status") ?? "active";
  const page = Number(sp.get("page") ?? 1);
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [debounced, setDebounced] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const set = (patch: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) (v === undefined || v === "" ? next.delete(k) : next.set(k, String(v)));
    router.replace(`${pathname}?${next}`);
  };

  const { data, isPending, isFetching } = useAdminOrders({ status, q: debounced, page, pageSize: 25 });
  const advance = useAdminMutation(
    ({ id, status }: { id: string; status: OrderStatus }) => api(`/admin/orders/${id}/status`, { method: "PATCH", body: { status } }),
    { invalidate: [["admin", "orders"], ["admin", "dashboard"]], success: "Status atualizado" },
  );

  const counts = data?.counts ?? {};
  const activeCount = ["pending", "confirmed", "picking", "out_for_delivery"].reduce((s, k) => s + (counts[k] ?? 0), 0);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader title="Pedidos" description="Fila operacional em tempo real" />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="scroll-x flex gap-1 rounded-xl bg-line-2 p-1">
          {TABS.map((t) => {
            const n = t.id === "active" ? activeCount : t.id ? (counts[t.id] ?? 0) : undefined;
            return (
              <button key={t.id} type="button" onClick={() => set({ status: t.id, page: undefined })} className={cn("flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold whitespace-nowrap transition-colors", status === t.id ? "bg-card text-ink shadow-card" : "text-muted hover:text-ink")}>
                {t.label}
                {n !== undefined && n > 0 && <span className={cn("tabular rounded-full px-1.5 text-[11px]", status === t.id ? "bg-brand-soft text-brand" : "bg-line text-ink-2")}>{n}</span>}
              </button>
            );
          })}
        </div>
        <label className="ml-auto flex h-10 w-full items-center gap-2 rounded-xl bg-card px-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-brand-3 sm:w-72">
          <Search className="size-4 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nº do pedido, cliente ou e-mail" className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-faint" />
        </label>
      </div>

      <Card padded={false} className={cn("transition-opacity", isFetching && !isPending && "opacity-70")}>
        {isPending ? (
          <div className="space-y-2 p-5">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !data?.items.length ? (
          <EmptyState icon={<Receipt className="size-6" />} title="Nenhum pedido aqui" description={status === "active" ? "Quando chegar um pedido novo, ele aparece nesta fila com um alerta sonoro." : "Ajuste o filtro ou a busca."} />
        ) : (
          <div className="scroll-x">
            <table className="w-full min-w-[820px] text-[13.5px]">
              <thead>
                <tr className="border-b border-line-2 text-left text-[11.5px] font-bold tracking-[0.04em] text-muted uppercase">
                  <th className="px-5 py-3">Pedido</th>
                  <th className="px-3 py-3">Cliente</th>
                  <th className="px-3 py-3">Entrega</th>
                  <th className="px-3 py-3">Pagamento</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-2">
                {data.items.map((o) => {
                  const next = nextOrderStatus(o.status, o.fulfillmentMethod);
                  return (
                    <tr key={o.id} className="group hover:bg-line-2/40">
                      <td className="px-5 py-3">
                        <Link href={`/pedidos/${o.id}`} className="block">
                          <span className="tabular block font-bold">{formatOrderNumber(o.number)}</span>
                          <span className="block text-[12px] text-muted">{fmt(o.createdAt)}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <span className="block font-medium">{o.customerName}</span>
                        <span className="block text-[12px] text-muted">{o.itemCount} {o.itemCount === 1 ? "item" : "itens"}</span>
                      </td>
                      <td className="max-w-[220px] px-3 py-3">
                        <span className="block truncate font-medium">{o.fulfillmentMethod === "pickup" ? "Retirada na loja" : `${o.address.district}, ${o.address.city}`}</span>
                        <span className="block truncate text-[12px] text-muted">{o.deliverySlot}</span>
                      </td>
                      <td className="px-3 py-3 text-ink-2">{o.fulfillmentMethod === "pickup" && o.paymentMethod === "card_on_delivery" ? "Cartão na retirada" : PAYMENT_METHOD_LABEL[o.paymentMethod]}</td>
                      <td className="px-3 py-3"><StatusPill status={o.status} fulfillmentMethod={o.fulfillmentMethod} /></td>
                      <td className="tabular px-3 py-3 text-right font-bold">{formatBRL(o.totalCents)}</td>
                      <td className="px-5 py-3 text-right">
                        {next ? (
                          <Button size="sm" variant={o.status === "pending" ? "primary" : "outline"} loading={advance.isPending && advance.variables?.id === o.id} onClick={() => advance.mutate({ id: o.id, status: next })}>
                            {o.fulfillmentMethod === "pickup" && next === "delivered" ? "Confirmar retirada" : orderStatusLabel(next, o.fulfillmentMethod).replace("Pedido ", "")} <ArrowRight className="size-3.5" />
                          </Button>
                        ) : (
                          <Link href={`/pedidos/${o.id}`} className="text-[12.5px] font-semibold text-brand-2">Detalhes</Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > data.pageSize && (
          <div className="flex items-center justify-between border-t border-line-2 px-5 py-3 text-[13px] text-muted">
            <span>{data.total} pedidos · página {page} de {totalPages}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => set({ page: page - 1 })}><ChevronLeft className="size-4" /></Button>
              <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => set({ page: page + 1 })}><ChevronRight className="size-4" /></Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
