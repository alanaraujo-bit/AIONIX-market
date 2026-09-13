"use client";

import { formatBRL, formatOrderNumber, ORDER_STATUS_SHORT, type OrderStatus } from "@aionix/shared";
import { ArrowDownRight, ArrowUpRight, PackageMinus, RefreshCw, ShoppingBag, TrendingUp, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDashboard } from "@/lib/queries";
import { StatusPill } from "@/components/order-status";
import { Badge, Button, Card, PageHeader, Skeleton, cn } from "@/components/ui";

const RANGES = [
  { id: "today", label: "Hoje" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
];

function compact(cents: number) {
  const v = cents / 100;
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 10_000) return `R$ ${(v / 1000).toFixed(1).replace(".", ",")}k`;
  return formatBRL(cents);
}

function Delta({ value, invert }: { value: number; invert?: boolean }) {
  if (!value) return <span className="text-[12px] font-semibold text-muted">— vs. período anterior</span>;
  const good = invert ? value < 0 : value > 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[12px] font-bold", good ? "text-brand-2" : "text-sale")}>
      {value > 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {Math.abs(value).toFixed(1).replace(".", ",")}%
      <span className="ml-1 font-semibold text-muted">vs. anterior</span>
    </span>
  );
}

function StatTile({ label, value, delta, icon, invert, loading }: { label: string; value?: string; delta?: number; icon: React.ReactNode; invert?: boolean; loading?: boolean }) {
  return (
    <Card className="p-5" padded={false}>
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-semibold text-muted">{label}</p>
        <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand">{icon}</span>
      </div>
      {loading ? <Skeleton className="mt-3 h-8 w-32" /> : <p className="mt-2 text-[28px] leading-none font-semibold tracking-[-0.02em]">{value}</p>}
      <div className="mt-2.5">{delta !== undefined && !loading && <Delta value={delta} invert={invert} />}</div>
    </Card>
  );
}

const PIPELINE: { s: OrderStatus; tone: string }[] = [
  { s: "pending", tone: "bg-citrus" },
  { s: "confirmed", tone: "bg-info" },
  { s: "picking", tone: "bg-brand-3" },
  { s: "out_for_delivery", tone: "bg-brand" },
];

export function DashboardScreen() {
  const [range, setRange] = useState("today");
  const { data, isPending, isFetching, refetch } = useDashboard(range);
  const k = data?.kpis;
  const pipelineTotal = PIPELINE.reduce((s, p) => s + (data?.pipeline[p.s] ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={data ? `Atualizado ${new Date(data.generatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Visão executiva da operação"}
        actions={
          <>
            <div className="flex rounded-xl bg-line-2 p-1">
              {RANGES.map((r) => (
                <button key={r.id} type="button" onClick={() => setRange(r.id)} className={cn("h-8 rounded-lg px-3.5 text-[13px] font-semibold transition-colors", range === r.id ? "bg-card text-ink shadow-card" : "text-muted hover:text-ink")}>
                  {r.label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="icon" aria-label="Atualizar" onClick={() => refetch()}>
              <RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Faturamento" value={k ? formatBRL(k.revenueCents) : undefined} delta={k?.revenueDelta} icon={<Wallet className="size-4" />} loading={isPending} />
        <StatTile label="Pedidos" value={k ? String(k.orders) : undefined} delta={k?.ordersDelta} icon={<ShoppingBag className="size-4" />} loading={isPending} />
        <StatTile label="Ticket médio" value={k ? formatBRL(k.avgTicketCents) : undefined} delta={k?.avgTicketDelta} icon={<TrendingUp className="size-4" />} loading={isPending} />
        <StatTile label="Novos clientes" value={k ? String(k.newCustomers) : undefined} icon={<Users className="size-4" />} loading={isPending} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card title={range === "today" ? "Faturamento por hora" : "Faturamento por dia"} action={k && <span className="text-[12.5px] font-semibold text-muted">{k.itemsSold} itens vendidos</span>}>
          <div className={cn("h-[260px] w-full transition-opacity", isFetching && "opacity-60")}>
            {isPending ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid vertical={false} stroke="#efece5" strokeWidth={1} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6b766f" }} interval={range === "today" ? 3 : range === "30d" ? 4 : 0} />
                  <YAxis tickLine={false} axisLine={false} width={64} domain={[0, (max: number) => Math.max(max, 10_000)]} allowDecimals={false} tick={{ fontSize: 11, fill: "#6b766f" }} tickFormatter={(v: number) => compact(v).replace(",00", "")} />
                  <Tooltip
                    cursor={{ fill: "#efece5" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0]!.payload as { label: string; revenueCents: number; orders: number };
                      return (
                        <div className="rounded-xl bg-ink px-3 py-2 text-white shadow-pop">
                          <p className="text-[11.5px] font-semibold text-white/60">{p.label}</p>
                          <p className="tabular text-[14px] font-bold">{formatBRL(p.revenueCents)}</p>
                          <p className="text-[11.5px] text-white/70">{p.orders} {p.orders === 1 ? "pedido" : "pedidos"}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="revenueCents" fill="#13784f" radius={[4, 4, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card title="Pedidos em aberto" action={<Link href="/pedidos?status=active" className="text-[12.5px] font-semibold text-brand-2">Ver fila</Link>}>
          {isPending ? (
            <Skeleton className="h-40" />
          ) : (
            <>
              <p className="text-[40px] leading-none font-semibold tracking-[-0.03em]">{pipelineTotal}</p>
              <p className="mt-1 text-[12.5px] text-muted">aguardando ação da loja</p>
              <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-line-2">
                {PIPELINE.map((p) => {
                  const n = data?.pipeline[p.s] ?? 0;
                  return n > 0 ? <span key={p.s} className={cn("h-full rounded-full", p.tone)} style={{ width: `${(n / pipelineTotal) * 100}%` }} /> : null;
                })}
              </div>
              <ul className="mt-4 space-y-2">
                {PIPELINE.map((p) => (
                  <li key={p.s} className="flex items-center gap-2.5 text-[13.5px]">
                    <span className={cn("size-2.5 rounded-full", p.tone)} />
                    <span className="flex-1 font-medium text-ink-2">{p.s === "out_for_delivery" ? "Em rota · pronto p/ retirar" : ORDER_STATUS_SHORT[p.s]}</span>
                    <span className="tabular font-bold">{data?.pipeline[p.s] ?? 0}</span>
                  </li>
                ))}
              </ul>
              {(k?.cancelled ?? 0) > 0 && <p className="mt-4 text-[12.5px] font-semibold text-sale">{k?.cancelled} cancelado(s) no período</p>}
            </>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="Últimos pedidos" className="xl:col-span-2" padded={false} action={<Link href="/pedidos" className="text-[12.5px] font-semibold text-brand-2">Todos</Link>}>
          {isPending ? (
            <div className="space-y-2 p-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : data?.recentOrders.length ? (
            <ul className="divide-y divide-line-2">
              {data.recentOrders.map((o) => (
                <li key={o.id}>
                  <Link href={`/pedidos/${o.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-line-2/50">
                    <span className="tabular w-16 text-[13.5px] font-bold">{formatOrderNumber(o.number)}</span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{o.customerName}</span>
                    <span className="hidden text-[12.5px] text-muted sm:block">{new Date(o.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                    <StatusPill status={o.status} fulfillmentMethod={o.fulfillmentMethod} />
                    <span className="tabular w-24 text-right text-[13.5px] font-bold">{formatBRL(o.totalCents)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-8 text-center text-[13.5px] text-muted">Nenhum pedido ainda.</p>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Mais vendidos" padded={false}>
            {isPending ? (
              <div className="space-y-2 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
            ) : data?.topProducts.length ? (
              <ul className="divide-y divide-line-2">
                {data.topProducts.map((p, i) => (
                  <li key={p.productId ?? i} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="tabular w-4 text-[12px] font-bold text-faint">{i + 1}</span>
                    <span className="size-9 shrink-0 overflow-hidden rounded-lg bg-line-2">{p.imageUrl && <img src={p.imageUrl} alt="" className="size-full object-contain mix-blend-multiply" />}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{p.name}</span>
                    <span className="tabular text-[12.5px] font-bold">{p.units} un</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-6 text-center text-[13px] text-muted">Sem vendas no período.</p>
            )}
          </Card>
          <Card title="Estoque baixo" padded={false} action={data?.lowStock.length ? <Badge tone="citrus">{data.lowStock.length}</Badge> : undefined}>
            {isPending ? (
              <div className="space-y-2 p-5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
            ) : data?.lowStock.length ? (
              <ul className="divide-y divide-line-2">
                {data.lowStock.map((p) => (
                  <li key={p.id}>
                    <Link href={`/produtos?q=${encodeURIComponent(p.name)}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-line-2/50">
                      <span className="size-9 shrink-0 overflow-hidden rounded-lg bg-line-2">{p.imageUrl && <img src={p.imageUrl} alt="" className="size-full object-contain mix-blend-multiply" />}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{p.name}</span>
                      <Badge tone={p.stock === 0 ? "sale" : "citrus"}>
                        <PackageMinus className="size-3" /> {p.stock}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-6 text-center text-[13px] text-muted">Estoque saudável.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
