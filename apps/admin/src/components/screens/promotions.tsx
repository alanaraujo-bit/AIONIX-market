"use client";

import { formatBRL, promotionInputSchema } from "@aionix/shared";
import { CalendarClock, Plus, Search, Tags, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAdminCategories, useAdminMutation, useAdminProducts, useAdminPromotions, type AdminPromotion } from "@/lib/queries";
import { Badge, Button, Card, ConfirmDialog, Drawer, EmptyState, Input, PageHeader, Select, Skeleton, Switch, Textarea, cn, fieldErrors, moneyInput, parseMoney } from "@/components/ui";

const STATUS_TONE = { live: "brand", scheduled: "info", ended: "neutral", paused: "citrus" } as const;
const STATUS_LABEL = { live: "Ativa", scheduled: "Agendada", ended: "Encerrada", paused: "Pausada" } as const;

const toLocalInput = (iso: string | Date) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function PromotionForm({ promo, onClose }: { promo: AdminPromotion | null; onClose: () => void }) {
  const cats = useAdminCategories();
  const [q, setQ] = useState("");
  const products = useAdminProducts({ q, pageSize: 40, status: "active" });
  const [form, setForm] = useState({
    name: promo?.name ?? "",
    description: promo?.description ?? "",
    discountType: promo?.discountType ?? ("percent" as "percent" | "fixed"),
    value: promo ? (promo.discountType === "percent" ? String(promo.discountValue) : moneyInput(promo.discountValue)) : "10",
    startsAt: toLocalInput(promo?.startsAt ?? new Date()),
    endsAt: toLocalInput(promo?.endsAt ?? new Date(Date.now() + 7 * 86_400_000)),
    active: promo?.active ?? true,
    productIds: new Set(promo?.productIds ?? []),
    categoryIds: new Set(promo?.categoryIds ?? []),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const save = useAdminMutation(
    (input: unknown) => (promo ? api(`/admin/promotions/${promo.id}`, { method: "PUT", body: input }) : api("/admin/promotions", { body: input })),
    { invalidate: [["admin", "promotions"], ["admin", "products"]], success: promo ? "Campanha atualizada" : "Campanha criada", onSuccess: onClose },
  );
  const remove = useAdminMutation(() => api(`/admin/promotions/${promo!.id}`, { method: "DELETE" }), { invalidate: [["admin", "promotions"], ["admin", "products"]], success: "Campanha excluída", onSuccess: onClose });

  const toggle = (set: "productIds" | "categoryIds", id: string) =>
    setForm((f) => {
      const n = new Set(f[set]);
      n.has(id) ? n.delete(id) : n.add(id);
      return { ...f, [set]: n };
    });

  const submit = () => {
    const payload = {
      name: form.name,
      description: form.description,
      discountType: form.discountType,
      discountValue: form.discountType === "percent" ? Number(form.value) : parseMoney(form.value),
      startsAt: new Date(form.startsAt),
      endsAt: new Date(form.endsAt),
      active: form.active,
      productIds: [...form.productIds],
      categoryIds: [...form.categoryIds],
    };
    const parsed = promotionInputSchema.safeParse(payload);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues.map((i) => ({ path: String(i.path[0]), message: i.message }))));
    if (!payload.productIds.length && !payload.categoryIds.length) return setErrors({ scope: "Selecione ao menos um produto ou categoria" });
    setErrors({});
    save.mutate(parsed.data, { onError: (e) => e instanceof ApiError && e.details && setErrors(fieldErrors(e.details)) });
  };

  return (
    <Drawer open onClose={onClose} title={promo ? "Editar campanha" : "Nova campanha"} width="max-w-2xl" footer={<>{promo && <Button variant="danger" className="mr-auto" onClick={() => setConfirm(true)}><Trash2 className="size-4" /> Excluir</Button>}<Button variant="outline" onClick={onClose}>Cancelar</Button><Button loading={save.isPending} onClick={submit}>{promo ? "Salvar" : "Criar campanha"}</Button></>}>
      <Input label="Nome da campanha" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={errors.name} autoFocus placeholder="Semana do Café" />
      <Textarea label="Descrição (aparece no app)" rows={2} className="mt-4" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr]">
        <Select label="Tipo de desconto" value={form.discountType} onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value as "percent" | "fixed", value: e.target.value === "percent" ? "10" : "5,00" }))}>
          <option value="percent">Percentual</option>
          <option value="fixed">Valor fixo</option>
        </Select>
        <Input label="Desconto" prefix={form.discountType === "fixed" ? "R$" : undefined} suffix={form.discountType === "percent" ? "%" : undefined} inputMode="decimal" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} error={errors.discountValue} />
        <Input label="Início" type="datetime-local" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} error={errors.startsAt} />
        <Input label="Término" type="datetime-local" value={form.endsAt} onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))} error={errors.endsAt} />
      </div>
      <div className="mt-4"><Switch checked={form.active} onChange={(v) => setForm((f) => ({ ...f, active: v }))} label="Campanha ativa" /></div>

      <h3 className="mt-6 mb-2 text-[12.5px] font-bold tracking-[0.04em] text-muted uppercase">Categorias inteiras</h3>
      <div className="flex flex-wrap gap-2">
        {cats.data?.map((c) => (
          <button key={c.id} type="button" onClick={() => toggle("categoryIds", c.id)} className={cn("flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ring-1 transition-colors", form.categoryIds.has(c.id) ? "bg-brand text-white ring-brand" : "bg-card text-ink-2 ring-line hover:bg-line-2")}>
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      <h3 className="mt-6 mb-2 text-[12.5px] font-bold tracking-[0.04em] text-muted uppercase">Produtos específicos {form.productIds.size > 0 && <Badge tone="brand">{form.productIds.size}</Badge>}</h3>
      {errors.scope && <p className="mb-2 text-[12.5px] font-semibold text-sale">{errors.scope}</p>}
      <label className="flex h-10 items-center gap-2 rounded-xl bg-card px-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-brand-3">
        <Search className="size-4 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto" className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none" />
      </label>
      <ul className="mt-2 max-h-64 divide-y divide-line-2 overflow-y-auto rounded-xl bg-card ring-1 ring-line">
        {products.data?.items.map((p) => (
          <li key={p.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-line-2/50">
              <input type="checkbox" checked={form.productIds.has(p.id)} onChange={() => toggle("productIds", p.id)} className="size-4 accent-brand" />
              <span className="size-8 shrink-0 overflow-hidden rounded-md bg-line-2">{p.imageUrl && <img src={p.imageUrl} alt="" className="size-full object-contain mix-blend-multiply" />}</span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{p.name}</span>
              <span className="tabular text-[12.5px] text-muted">{formatBRL(p.priceCents)}</span>
            </label>
          </li>
        ))}
      </ul>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="Excluir campanha?" description="Os preços voltam ao normal imediatamente." confirmLabel="Excluir" loading={remove.isPending} onConfirm={() => remove.mutate(undefined)} />
    </Drawer>
  );
}

export function PromotionsScreen() {
  const { data, isPending } = useAdminPromotions();
  const cats = useAdminCategories();
  const [editing, setEditing] = useState<AdminPromotion | null | "new">(null);
  const toggle = useAdminMutation(({ id, active }: { id: string; active: boolean }) => api(`/admin/promotions/${id}`, { method: "PATCH", body: { active } }), { invalidate: [["admin", "promotions"], ["admin", "products"]] });
  const catName = useMemo(() => new Map(cats.data?.map((c) => [c.id, c.name])), [cats.data]);
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");

  return (
    <>
      <PageHeader title="Promoções" description="Motor de campanhas com desconto por produto ou categoria" actions={<Button onClick={() => setEditing("new")}><Plus className="size-4" /> Nova campanha</Button>} />
      {isPending ? (
        <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}</div>
      ) : !data?.length ? (
        <Card><EmptyState icon={<Tags className="size-6" />} title="Nenhuma campanha" description="Crie descontos por categoria ou para produtos específicos, com início e fim agendados." action={<Button onClick={() => setEditing("new")}><Plus className="size-4" /> Nova campanha</Button>} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((p) => (
            <Card key={p.id} className="flex flex-col" padded={false}>
              <div className="flex-1 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-[16px] font-bold">{p.name}</h3>
                    <p className="mt-0.5 text-[12.5px] text-muted">{p.description || "Sem descrição"}</p>
                  </div>
                  <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                </div>
                <p className="mt-4 text-[30px] leading-none font-semibold tracking-[-0.03em] text-sale">
                  {p.discountType === "percent" ? `${p.discountValue}% off` : `− ${formatBRL(p.discountValue)}`}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-muted"><CalendarClock className="size-3.5" /> {fmt(p.startsAt)} → {fmt(p.endsAt)}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.categoryIds.map((id) => <Badge key={id} tone="brand">{catName.get(id) ?? "Categoria"}</Badge>)}
                  {p.productIds.length > 0 && <Badge>{p.productIds.length} produto(s)</Badge>}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-line-2/60 p-3 text-center">
                  <div><p className="tabular text-[15px] font-bold">{p.stats.orders}</p><p className="text-[11px] text-muted">pedidos</p></div>
                  <div><p className="tabular text-[15px] font-bold">{formatBRL(p.stats.revenueCents)}</p><p className="text-[11px] text-muted">receita</p></div>
                  <div><p className="tabular text-[15px] font-bold text-sale">{formatBRL(p.stats.discountCents)}</p><p className="text-[11px] text-muted">descontos</p></div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-line-2 px-5 py-3">
                <Switch checked={p.active} onChange={(v) => toggle.mutate({ id: p.id, active: v })} label={p.active ? "Ativa" : "Pausada"} />
                <Button size="sm" variant="outline" onClick={() => setEditing(p)}>Editar</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && <PromotionForm key={editing === "new" ? "new" : editing.id} promo={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
