"use client";

import { bannerInputSchema } from "@aionix/shared";
import { ArrowRight, Eye, Megaphone, MousePointerClick, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAdminBanners, useAdminCategories, useAdminMutation, useAdminPromotions, type AdminBanner } from "@/lib/queries";
import { ImagePicker } from "@/components/image-picker";
import { Badge, Button, Card, ConfirmDialog, Drawer, EmptyState, Input, PageHeader, Select, Skeleton, Switch, cn, fieldErrors } from "@/components/ui";

const THEMES: Record<AdminBanner["theme"], { label: string; bg: string; text: string; cta: string }> = {
  forest: { label: "Floresta", bg: "linear-gradient(135deg,#0b4f37 0%,#13784f 55%,#1f9a67 100%)", text: "text-white", cta: "bg-white text-brand" },
  citrus: { label: "Cítrico", bg: "linear-gradient(135deg,#f2b233 0%,#f6c65a 60%,#fbe09a 100%)", text: "text-ink", cta: "bg-ink text-white" },
  berry: { label: "Frutas vermelhas", bg: "linear-gradient(135deg,#6f1633 0%,#a82c4f 60%,#d2566f 100%)", text: "text-white", cta: "bg-white text-[#8c2142]" },
  ocean: { label: "Oceano", bg: "linear-gradient(135deg,#0a3f5f 0%,#11678f 60%,#2a93be 100%)", text: "text-white", cta: "bg-white text-[#0f5a80]" },
  night: { label: "Noite", bg: "linear-gradient(135deg,#0f1a14 0%,#22302a 60%,#34423a 100%)", text: "text-white", cta: "bg-citrus text-ink" },
};

/** Pixel-faithful preview of the consumer banner. */
export function BannerPreview({ b, className }: { b: Pick<AdminBanner, "title" | "subtitle" | "ctaLabel" | "imageUrl" | "theme">; className?: string }) {
  const t = THEMES[b.theme] ?? THEMES.forest;
  return (
    <div className={cn("grain relative flex h-[150px] w-full overflow-hidden rounded-[22px]", t.text, className)} style={{ background: t.bg }}>
      <span aria-hidden className="absolute top-5 -right-6 size-24 rounded-full border-[14px] border-white/10" />
      {b.imageUrl && <span className="absolute inset-y-0 right-0 w-[46%]"><img src={b.imageUrl} alt="" className="size-full object-contain object-right-bottom p-3 drop-shadow-[0_18px_20px_rgb(0_0_0/0.25)]" /></span>}
      <span className="relative z-10 flex h-full max-w-[62%] flex-col justify-between p-4">
        <span>
          <span className="block font-display text-[20px] leading-[1.05] font-extrabold tracking-[-0.03em]">{b.title || "Título do banner"}</span>
          {b.subtitle && <span className="mt-1 block text-[12px] leading-snug font-medium opacity-85">{b.subtitle}</span>}
        </span>
        <span className={cn("inline-flex w-fit items-center gap-1 rounded-full px-3 py-1.5 text-[11.5px] font-bold", t.cta)}>{b.ctaLabel || "Ver ofertas"} <ArrowRight className="size-3" strokeWidth={2.6} /></span>
      </span>
    </div>
  );
}

const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");

function BannerForm({ banner, onClose }: { banner: AdminBanner | null; onClose: () => void }) {
  const cats = useAdminCategories();
  const promos = useAdminPromotions();
  const [form, setForm] = useState({
    title: banner?.title ?? "",
    subtitle: banner?.subtitle ?? "",
    ctaLabel: banner?.ctaLabel ?? "Ver ofertas",
    imageUrl: banner?.imageUrl ?? null,
    theme: banner?.theme ?? ("forest" as AdminBanner["theme"]),
    promotionId: banner?.promotionId ?? "",
    categoryId: banner?.categoryId ?? "",
    sortOrder: banner?.sortOrder ?? 0,
    active: banner?.active ?? true,
    startsAt: toLocal(banner?.startsAt ?? null),
    endsAt: toLocal(banner?.endsAt ?? null),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const save = useAdminMutation(
    (input: unknown) => (banner ? api(`/admin/banners/${banner.id}`, { method: "PUT", body: input }) : api("/admin/banners", { body: input })),
    { invalidate: [["admin", "banners"]], success: banner ? "Banner atualizado" : "Banner criado", onSuccess: onClose },
  );
  const remove = useAdminMutation(() => api(`/admin/banners/${banner!.id}`, { method: "DELETE" }), { sound: "remove", invalidate: [["admin", "banners"]], success: "Banner excluído", onSuccess: onClose });
  const submit = () => {
    const payload = { ...form, promotionId: form.promotionId || null, categoryId: form.categoryId || null, startsAt: form.startsAt ? new Date(form.startsAt) : null, endsAt: form.endsAt ? new Date(form.endsAt) : null };
    const parsed = bannerInputSchema.safeParse(payload);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues.map((i) => ({ path: String(i.path[0]), message: i.message }))));
    setErrors({});
    save.mutate(parsed.data, { onError: (e) => e instanceof ApiError && e.details && setErrors(fieldErrors(e.details)) });
  };
  return (
    <Drawer open onClose={onClose} title={banner ? "Editar banner" : "Novo banner"} width="max-w-xl" footer={<>{banner && <Button variant="danger" className="mr-auto" onClick={() => setConfirm(true)}><Trash2 className="size-4" /> Excluir</Button>}<Button variant="outline" onClick={onClose}>Cancelar</Button><Button loading={save.isPending} onClick={submit}>Salvar</Button></>}>
      <p className="mb-2 text-[12.5px] font-semibold text-ink-2">Prévia ao vivo</p>
      <div className="mx-auto max-w-[400px]"><BannerPreview b={form} /></div>
      <div className="mt-5 grid gap-4">
        <Input label="Título" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} error={errors.title} autoFocus />
        <Input label="Subtítulo" value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} error={errors.subtitle} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Texto do botão" value={form.ctaLabel} onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))} error={errors.ctaLabel} />
          <Select label="Tema" value={form.theme} onChange={(e) => setForm((f) => ({ ...f, theme: e.target.value as AdminBanner["theme"] }))}>
            {Object.entries(THEMES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </div>
        <ImagePicker label="Imagem de destaque (opcional, fundo transparente fica melhor)" value={form.imageUrl} onChange={(v) => setForm((f) => ({ ...f, imageUrl: v }))} aspect="wide" />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Leva para a categoria" value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}>
            <option value="">Página de ofertas</option>
            {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </Select>
          <Select label="Campanha vinculada" value={form.promotionId} onChange={(e) => setForm((f) => ({ ...f, promotionId: e.target.value }))}>
            <option value="">Nenhuma</option>
            {promos.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Input label="Exibir a partir de (opcional)" type="datetime-local" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} />
          <Input label="Exibir até (opcional)" type="datetime-local" value={form.endsAt} onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))} />
          <Input label="Ordem" type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))} hint="Menor aparece primeiro" />
        </div>
        <Switch checked={form.active} onChange={(v) => setForm((f) => ({ ...f, active: v }))} label="Banner ativo" />
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="Excluir banner?" confirmLabel="Excluir" loading={remove.isPending} onConfirm={() => remove.mutate(undefined)} />
    </Drawer>
  );
}

export function BannersScreen() {
  const { data, isPending } = useAdminBanners();
  const [editing, setEditing] = useState<AdminBanner | null | "new">(null);
  const toggle = useAdminMutation(({ id, active }: { id: string; active: boolean }) => api(`/admin/banners/${id}`, { method: "PATCH", body: { active } }), { invalidate: [["admin", "banners"]] });
  return (
    <>
      <PageHeader title="Banners" description="Carrossel da home do app, com métricas de impressão e clique" actions={<Button onClick={() => setEditing("new")}><Plus className="size-4" /> Novo banner</Button>} />
      {isPending ? (
        <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}</div>
      ) : !data?.length ? (
        <Card><EmptyState icon={<Megaphone className="size-6" />} title="Nenhum banner" action={<Button onClick={() => setEditing("new")}>Criar banner</Button>} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((b) => (
            <Card key={b.id} padded={false} className="overflow-hidden">
              <div className="p-3"><BannerPreview b={b} className={!b.active ? "opacity-50 grayscale" : undefined} /></div>
              <div className="flex items-center gap-4 border-t border-line-2 px-5 py-3 text-[12.5px] text-muted">
                <span className="flex items-center gap-1"><Eye className="size-3.5" /> {b.impressions}</span>
                <span className="flex items-center gap-1"><MousePointerClick className="size-3.5" /> {b.clicks}</span>
                <Badge tone={b.ctr >= 3 ? "brand" : "neutral"}>CTR {b.ctr.toFixed(1).replace(".", ",")}%</Badge>
                <span className="ml-auto flex items-center gap-2">
                  <Switch checked={b.active} onChange={(v) => toggle.mutate({ id: b.id, active: v })} />
                  <Button size="sm" variant="outline" onClick={() => setEditing(b)}>Editar</Button>
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && <BannerForm key={editing === "new" ? "new" : editing.id} banner={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
