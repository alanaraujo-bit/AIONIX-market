"use client";

import { formatBRL } from "@aionix/shared";
import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCustomers } from "@/lib/queries";
import { Button, Card, EmptyState, PageHeader, Skeleton, cn } from "@/components/ui";

export function CustomersScreen() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => (setDebounced(q.trim()), setPage(1)), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, isPending, isFetching } = useCustomers({ q: debounced, page, pageSize: 30 });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" }).replace(".", "") : "—");

  return (
    <>
      <PageHeader title="Clientes" description={data ? `${data.total} clientes cadastrados` : "Base de clientes"} />
      <label className="mb-4 flex h-10 w-full items-center gap-2 rounded-xl bg-card px-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-brand-3 sm:w-80">
        <Search className="size-4 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome ou e-mail" className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-faint" />
      </label>
      <Card padded={false} className={cn("transition-opacity", isFetching && !isPending && "opacity-70")}>
        {isPending ? (
          <div className="space-y-2 p-5">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
        ) : !data?.items.length ? (
          <EmptyState icon={<Users className="size-6" />} title="Nenhum cliente encontrado" />
        ) : (
          <div className="scroll-x">
            <table className="w-full min-w-[720px] text-[13.5px]">
              <thead>
                <tr className="border-b border-line-2 text-left text-[11.5px] font-bold tracking-[0.04em] text-muted uppercase">
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-3 py-3">Telefone</th>
                  <th className="px-3 py-3 text-right">Pedidos</th>
                  <th className="px-3 py-3 text-right">Total gasto</th>
                  <th className="px-3 py-3">Último pedido</th>
                  <th className="px-5 py-3">Cadastro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-2">
                {data.items.map((c) => (
                  <tr key={c.id} className="hover:bg-line-2/40">
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-[12px] font-bold text-brand">{c.name.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase()}</span>
                        <span className="min-w-0">
                          <span className="block font-semibold">{c.name}</span>
                          <span className="block text-[12px] text-muted">{c.email}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-ink-2">{c.phone ?? "—"}</td>
                    <td className="tabular px-3 py-3 text-right"><Link href={`/pedidos?q=${encodeURIComponent(c.email)}&status=`} className="font-semibold text-brand-2 hover:underline">{c.orders}</Link></td>
                    <td className="tabular px-3 py-3 text-right font-bold">{formatBRL(c.spentCents)}</td>
                    <td className="px-3 py-3 text-ink-2">{fmt(c.lastOrderAt)}</td>
                    <td className="px-5 py-3 text-muted">{fmt(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > data.pageSize && (
          <div className="flex items-center justify-between border-t border-line-2 px-5 py-3 text-[13px] text-muted">
            <span>Página {page} de {totalPages}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="size-4" /></Button>
              <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="size-4" /></Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
