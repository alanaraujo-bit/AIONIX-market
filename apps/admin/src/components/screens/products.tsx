"use client";

import { formatBRL, productInputSchema, type ProductInput } from "@aionix/shared";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Crown, Package, Plus, Search, Star, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAdminCategories, useAdminMutation, useAdminProducts, type AdminProduct } from "@/lib/queries";
import { ImagePicker } from "@/components/image-picker";
import { Badge, Button, Card, ConfirmDialog, Drawer, EmptyState, Input, PageHeader, Select, Skeleton, Switch, Textarea, cn, fieldErrors, moneyInput, parseMoney } from "@/components/ui";

const STATUS = [
  { id: "", label: "Todos" },
  { id: "active", label: "Ativos" },
  { id: "inactive", label: "Inativos" },
  { id: "low_stock", label: "Estoque baixo" },
  { id: "featured", label: "Destaques" },
];

const UNITS = ["un", "kg", "g", "l", "ml", "pct", "cx"];

interface FormState {
  name: string;
  description: string;
  brand: string;
  categoryId: string;
  price: string;
  compareAt: string;
  clubPrice: string;
  unit: string;
  unitLabel: string;
  stock: string;
  sku: string;
  imageUrl: string | null;
  active: boolean;
  featured: boolean;
  tags: string;
}

const empty = (categoryId = ""): FormState => ({ name: "", description: "", brand: "", categoryId, price: "", compareAt: "", clubPrice: "", unit: "un", unitLabel: "", stock: "0", sku: "", imageUrl: null, active: true, featured: false, tags: "" });
const fromProduct = (p: AdminProduct): FormState => ({
  name: p.name,
  description: p.description,
  brand: p.brand ?? "",
  categoryId: p.categoryId,
  price: moneyInput(p.priceCents),
  compareAt: moneyInput(p.compareAtCents),
  clubPrice: moneyInput(p.clubPriceCents),
  unit: p.unit,
  unitLabel: p.unitLabel,
  stock: String(p.stock),
  sku: p.sku ?? "",
  imageUrl: p.imageUrl,
  active: p.active,
  featured: p.featured,
  tags: p.tags.join(", "),
});

function ProductForm({ product, onClose }: { product: AdminProduct | null; onClose: () => void }) {
  const cats = useAdminCategories();
  const [form, setForm] = useState<FormState>(() => (product ? fromProduct(product) : empty()));
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!product && !form.categoryId && cats.data?.[0]) setForm((f) => ({ ...f, categoryId: cats.data![0]!.id }));
  }, [cats.data, product, form.categoryId]);

  const save = useAdminMutation(
    (input: ProductInput) => (product ? api(`/admin/products/${product.id}`, { method: "PUT", body: input }) : api("/admin/products", { body: input })),
    { invalidate: [["admin", "products"], ["admin", "categories"], ["admin", "dashboard"]], success: product ? "Produto atualizado" : "Produto criado", onSuccess: onClose },
  );
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    const payload = {
      name: form.name,
      description: form.description,
      brand: form.brand,
      categoryId: form.categoryId,
      priceCents: parseMoney(form.price),
      compareAtCents: form.compareAt ? parseMoney(form.compareAt) : null,
      clubPriceCents: form.clubPrice ? parseMoney(form.clubPrice) : null,
      unit: form.unit,
      unitLabel: form.unitLabel,
      stock: Number(form.stock) || 0,
      sku: form.sku,
      imageUrl: form.imageUrl,
      active: form.active,
      featured: form.featured,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    const parsed = productInputSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues.map((i) => ({ path: String(i.path[0]), message: i.message }))));
      return;
    }
    if (parsed.data.compareAtCents && parsed.data.compareAtCents <= parsed.data.priceCents) {
      setErrors({ compareAtCents: "O preço 'de' deve ser maior que o preço de venda" });
      return;
    }
    setErrors({});
    save.mutate(parsed.data, { onError: (e) => e instanceof ApiError && e.details && setErrors(fieldErrors(e.details)) });
  };

  const margin = form.compareAt && parseMoney(form.compareAt) > parseMoney(form.price) ? Math.round((1 - parseMoney(form.price) / parseMoney(form.compareAt)) * 100) : 0;
  const clubOff = form.clubPrice && parseMoney(form.clubPrice) < parseMoney(form.price) ? Math.round((1 - parseMoney(form.clubPrice) / parseMoney(form.price)) * 100) : 0;
  const clubInvalid = !!form.clubPrice && parseMoney(form.clubPrice) >= parseMoney(form.price);

  return (
    <Drawer open onClose={onClose} title={product ? "Editar produto" : "Novo produto"} footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button loading={save.isPending} onClick={submit}>{product ? "Salvar alterações" : "Criar produto"}</Button></>}>
      <div className="grid gap-5 sm:grid-cols-[240px_1fr]">
        <ImagePicker value={form.imageUrl} onChange={(v) => set("imageUrl", v)} />
        <div className="space-y-4">
          <Input label="Nome do produto" value={form.name} onChange={(e) => set("name", e.target.value)} error={errors.name} autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Marca" value={form.brand} onChange={(e) => set("brand", e.target.value)} />
            <Select label="Categoria" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} error={errors.categoryId}>
              {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </Select>
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Input label="Preço de venda" prefix="R$" inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value)} error={errors.priceCents} />
        <Input label="Preço 'de' (opcional)" prefix="R$" inputMode="decimal" value={form.compareAt} onChange={(e) => set("compareAt", e.target.value)} error={errors.compareAtCents} hint={margin ? `Exibe -${margin}% na vitrine` : undefined} />
        <Input label="Estoque" type="number" min={0} value={form.stock} onChange={(e) => set("stock", e.target.value)} error={errors.stock} />
      </div>
      <div className="mt-4 rounded-xl bg-club-soft/60 p-4 ring-1 ring-club/15">
        <div className="mb-3 flex items-center gap-2">
          <Badge tone="club"><Crown className="size-3" strokeWidth={2.6} /> Clube AIONIX</Badge>
          <span className="text-[12.5px] text-muted">Preço exclusivo para membros. Todo mundo vê o preço, só membros pagam por ele.</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Preço de clube (opcional)"
            prefix="R$"
            inputMode="decimal"
            value={form.clubPrice}
            onChange={(e) => set("clubPrice", e.target.value)}
            error={errors.clubPriceCents ?? (clubInvalid ? "Deve ser menor que o preço de venda" : undefined)}
            hint={clubOff ? `Membros economizam ${clubOff}% · ${formatBRL(parseMoney(form.price) - parseMoney(form.clubPrice))} por unidade` : "Deixe em branco para não oferecer"}
          />
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Select label="Unidade" value={form.unit} onChange={(e) => set("unit", e.target.value)}>{UNITS.map((u) => <option key={u}>{u}</option>)}</Select>
        <Input label="Rótulo da unidade" placeholder="500 g, 1 L, dúzia…" value={form.unitLabel} onChange={(e) => set("unitLabel", e.target.value)} />
        <Input label="SKU" value={form.sku} onChange={(e) => set("sku", e.target.value)} />
      </div>
      <Textarea label="Descrição" rows={4} className="mt-4" value={form.description} onChange={(e) => set("description", e.target.value)} />
      <Input label="Tags (separadas por vírgula)" className="mt-4" placeholder="café, gourmet, arábica" value={form.tags} onChange={(e) => set("tags", e.target.value)} hint="Usadas na busca do app" />
      <div className="mt-5 flex flex-wrap gap-6 rounded-xl bg-card p-4 ring-1 ring-line">
        <Switch checked={form.active} onChange={(v) => set("active", v)} label="Visível na loja" />
        <Switch checked={form.featured} onChange={(v) => set("featured", v)} label="Destaque na home" />
      </div>
    </Drawer>
  );
}

export function ProductsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const status = sp.get("status") ?? "";
  const categoryId = sp.get("categoryId") ?? "";
  const sort = sp.get("sort") ?? "updated";
  const dir = sp.get("dir") ?? "desc";
  const page = Number(sp.get("page") ?? 1);
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [debounced, setDebounced] = useState(q);
  const [editing, setEditing] = useState<AdminProduct | null | "new">(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const set = (patch: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) (v === undefined || v === "" ? next.delete(k) : next.set(k, String(v)));
    router.replace(`${pathname}?${next}`);
  };
  const toggleSort = (col: string) => set({ sort: col, dir: sort === col && dir === "desc" ? "asc" : "desc" });

  const cats = useAdminCategories();
  const { data, isPending, isFetching } = useAdminProducts({ q: debounced, status, categoryId, sort, dir, page, pageSize: 25 });
  const patch = useAdminMutation(
    ({ id, body }: { id: string; body: Record<string, unknown> }) => api(`/admin/products/${id}`, { method: "PATCH", body }),
    { invalidate: [["admin", "products"]] },
  );
  const bulk = useAdminMutation(
    ({ ids, action }: { ids: string[]; action: string }) => api("/admin/products/bulk", { body: { ids, action } }),
    { invalidate: [["admin", "products"], ["admin", "categories"]], success: "Ação aplicada", onSuccess: () => (setSelected(new Set()), setConfirmDelete(null)) },
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const allSelected = !!data?.items.length && data.items.every((p) => selected.has(p.id));

  const SortHead = ({ col, children, className }: { col: string; children: React.ReactNode; className?: string }) => (
    <th className={cn("px-3 py-3", className)}>
      <button type="button" onClick={() => toggleSort(col)} className={cn("inline-flex items-center gap-1 uppercase", sort === col ? "text-ink" : "hover:text-ink")}>
        {children}
        {sort === col && (dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );

  return (
    <>
      <PageHeader title="Produtos" description={data ? `${data.total} produtos no catálogo` : "Catálogo da loja"} actions={<Button onClick={() => setEditing("new")}><Plus className="size-4" /> Novo produto</Button>} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex h-10 w-full items-center gap-2 rounded-xl bg-card px-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-brand-3 sm:w-80">
          <Search className="size-4 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, marca ou SKU" className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-faint" />
        </label>
        <Select value={categoryId} onChange={(e) => set({ categoryId: e.target.value, page: undefined })} className="w-52">
          <option value="">Todas as categorias</option>
          {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name} ({c.productCount})</option>)}
        </Select>
        <div className="flex rounded-xl bg-line-2 p-1">
          {STATUS.map((s) => (
            <button key={s.id} type="button" onClick={() => set({ status: s.id, page: undefined })} className={cn("h-8 rounded-lg px-3 text-[13px] font-semibold whitespace-nowrap transition-colors", status === s.id ? "bg-card text-ink shadow-card" : "text-muted hover:text-ink")}>{s.label}</button>
          ))}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-white">
          <span className="mr-2 text-[13px] font-semibold">{selected.size} selecionado(s)</span>
          {[["activate", "Ativar"], ["deactivate", "Desativar"], ["feature", "Destacar"], ["unfeature", "Remover destaque"]].map(([a, l]) => (
            <Button key={a} size="sm" variant="secondary" onClick={() => bulk.mutate({ ids: [...selected], action: a! })}>{l}</Button>
          ))}
          <Button size="sm" variant="danger" onClick={() => setConfirmDelete([...selected])}><Trash2 className="size-3.5" /> Excluir</Button>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-[12.5px] font-semibold text-white/70">Limpar</button>
        </div>
      )}

      <Card padded={false} className={cn("transition-opacity", isFetching && !isPending && "opacity-70")}>
        {isPending ? (
          <div className="space-y-2 p-5">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !data?.items.length ? (
          <EmptyState icon={<Package className="size-6" />} title="Nenhum produto encontrado" description="Ajuste os filtros ou cadastre um novo produto." action={<Button onClick={() => setEditing("new")}><Plus className="size-4" /> Novo produto</Button>} />
        ) : (
          <div className="scroll-x">
            <table className="w-full min-w-[900px] text-[13.5px]">
              <thead>
                <tr className="border-b border-line-2 text-left text-[11.5px] font-bold tracking-[0.04em] text-muted">
                  <th className="w-10 px-4 py-3"><input type="checkbox" checked={allSelected} onChange={(e) => setSelected(e.target.checked ? new Set(data.items.map((p) => p.id)) : new Set())} className="size-4 accent-brand" /></th>
                  <SortHead col="name">Produto</SortHead>
                  <th className="px-3 py-3 uppercase">Categoria</th>
                  <SortHead col="price" className="text-right">Preço</SortHead>
                  <SortHead col="stock" className="text-right">Estoque</SortHead>
                  <SortHead col="sold" className="text-right">Vendidos</SortHead>
                  <th className="px-3 py-3 uppercase">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line-2">
                {data.items.map((p) => (
                  <tr key={p.id} className={cn("group hover:bg-line-2/40", selected.has(p.id) && "bg-brand-soft/40")}>
                    <td className="px-4 py-2.5"><input type="checkbox" checked={selected.has(p.id)} onChange={(e) => setSelected((s) => { const n = new Set(s); e.target.checked ? n.add(p.id) : n.delete(p.id); return n; })} className="size-4 accent-brand" /></td>
                    <td className="px-3 py-2.5">
                      <button type="button" onClick={() => setEditing(p)} className="flex items-center gap-3 text-left">
                        <span className="size-11 shrink-0 overflow-hidden rounded-lg bg-line-2">{p.imageUrl && <img src={p.imageUrl} alt="" loading="lazy" className="size-full object-contain p-0.5 mix-blend-multiply" />}</span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 font-semibold">{p.name}{p.featured && <Star className="size-3.5 fill-citrus text-citrus" />}</span>
                          <span className="block text-[12px] text-muted">{[p.brand, p.unitLabel, p.sku].filter(Boolean).join(" · ")}</span>
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-ink-2">{p.categoryName}</td>
                    <td className="tabular px-3 py-2.5 text-right">
                      <span className={cn("block font-bold", p.discountPercent > 0 && "text-sale")}>{formatBRL(p.finalPriceCents)}</span>
                      {p.discountPercent > 0 && <span className="block text-[11.5px] text-muted line-through">{formatBRL(p.compareAtCents ?? p.priceCents)}</span>}
                      {p.clubPriceCents !== null && <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-club-soft px-1.5 py-px text-[11px] font-bold text-club"><Crown className="size-2.5" strokeWidth={3} /> {formatBRL(p.clubPriceCents)}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <StockCell value={p.stock} onCommit={(v) => patch.mutate({ id: p.id, body: { stock: v } })} />
                    </td>
                    <td className="tabular px-3 py-2.5 text-right text-ink-2">{p.soldCount}</td>
                    <td className="px-3 py-2.5"><Switch checked={p.active} onChange={(v) => patch.mutate({ id: p.id, body: { active: v } })} /></td>
                    <td className="px-4 py-2.5 text-right"><Button size="sm" variant="ghost" onClick={() => setEditing(p)}>Editar</Button></td>
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
              <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => set({ page: page - 1 })}><ChevronLeft className="size-4" /></Button>
              <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => set({ page: page + 1 })}><ChevronRight className="size-4" /></Button>
            </div>
          </div>
        )}
      </Card>

      {editing && <ProductForm key={editing === "new" ? "new" : editing.id} product={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title={`Excluir ${confirmDelete?.length} produto(s)?`} description="Pedidos anteriores mantêm o histórico, mas o produto sai da loja definitivamente." confirmLabel="Excluir" loading={bulk.isPending} onConfirm={() => confirmDelete && bulk.mutate({ ids: confirmDelete, action: "delete" })} />
    </>
  );
}

/** Inline-editable stock number: click, type, Enter/blur to commit. */
function StockCell({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    setEditing(false);
    const n = Math.max(0, Math.floor(Number(draft)));
    if (Number.isFinite(n) && n !== value) onCommit(n);
    else setDraft(String(value));
  };
  if (editing) {
    return <input autoFocus type="number" min={0} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => (e.key === "Enter" ? commit() : e.key === "Escape" && (setDraft(String(value)), setEditing(false)))} className="tabular h-8 w-20 rounded-lg bg-card px-2 text-right ring-2 ring-brand-3 outline-none" />;
  }
  return (
    <button type="button" onClick={() => setEditing(true)} className="inline-flex h-8 items-center justify-end gap-1.5 rounded-lg px-2 hover:bg-line-2" title="Clique para ajustar">
      <Badge tone={value === 0 ? "sale" : value <= 10 ? "citrus" : "neutral"}>{value}</Badge>
    </button>
  );
}
