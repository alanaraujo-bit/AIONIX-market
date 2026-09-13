"use client";

import {
  AWARD_ON,
  AWARD_ON_LABEL,
  formatBRL,
  formatOrderNumber,
  loyaltySettingsSchema,
  REDEMPTION_STATUS_LABEL,
  REWARD_TYPE_LABEL,
  REWARD_TYPES,
  rewardInputSchema,
  type LoyaltySettings,
  type Redemption,
  type Reward,
  type RewardType,
} from "@aionix/shared";
import { useQuery } from "@tanstack/react-query";
import { Coins, Gift, Package, Percent, Plus, Save, Search, Sparkles, Ticket, Trash2, Truck, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, ApiError, qs } from "@/lib/api";
import { useAdminMutation, useAdminProducts } from "@/lib/queries";
import { Badge, Button, Card, ConfirmDialog, Drawer, EmptyState, Input, PageHeader, Select, Skeleton, Switch, Textarea, cn, fieldErrors, moneyInput, parseMoney } from "@/components/ui";

// ---- Data -------------------------------------------------------------------
interface Overview {
  kpis: { circulating: number; pending: number; issued: number; redeemed: number; issued30: number; redeemed30: number; redemptions30: number; members: number };
  topRewards: { id: string; name: string; type: RewardType; costCoins: number; redeemedCount: number; active: boolean }[];
  series: { key: string; label: string; issued: number; redeemed: number }[];
}
type AdminReward = Reward & { redeemedCount: number };
type AdminRedemption = Redemption & { customerName: string; customerEmail: string };

const useLoyaltySettings = () => useQuery({ queryKey: ["admin", "loyalty", "settings"], queryFn: () => api<{ settings: LoyaltySettings }>("/admin/loyalty/settings"), select: (d) => d.settings });
const useOverview = () => useQuery({ queryKey: ["admin", "loyalty", "overview"], queryFn: () => api<Overview>("/admin/loyalty/overview"), refetchInterval: 60_000 });
const useRewards = () => useQuery({ queryKey: ["admin", "loyalty", "rewards"], queryFn: () => api<{ items: AdminReward[] }>("/admin/loyalty/rewards"), select: (d) => d.items });
const useRedemptions = (params: Record<string, string | undefined>) =>
  useQuery({ queryKey: ["admin", "loyalty", "redemptions", params], queryFn: () => api<{ items: AdminRedemption[]; total: number }>(`/admin/loyalty/redemptions${qs(params)}`) });

const REWARD_ICON: Record<RewardType, React.ComponentType<{ className?: string }>> = {
  discount_fixed: Ticket,
  discount_percent: Percent,
  free_delivery: Truck,
  product: Package,
  gift: Gift,
};
const REWARD_TONE: Record<RewardType, string> = {
  discount_fixed: "bg-sale-soft text-sale",
  discount_percent: "bg-club-soft text-club",
  free_delivery: "bg-brand-soft text-brand",
  product: "bg-citrus-soft text-[#8a5a00]",
  gift: "bg-coin-soft text-coin-2",
};

/** The same embossed coin used in the app, sized for the panel. */
export function CoinMark({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className={cn("shrink-0", className)}>
      <circle cx="32" cy="32" r="31" fill="#c9800f" />
      <circle cx="32" cy="32" r="26.5" fill="#f5b03a" />
      <circle cx="32" cy="32" r="21.5" fill="none" stroke="#b86f06" strokeOpacity="0.55" strokeWidth="1.6" strokeDasharray="2.2 2.6" />
      <path d="M32 17c1.1 6.7 4.3 9.9 11 11-6.7 1.1-9.9 4.3-11 11-1.1-6.7-4.3-9.9-11-11 6.7-1.1 9.9-4.3 11-11z" fill="#fff3cf" />
    </svg>
  );
}

const n = (v: number) => v.toLocaleString("pt-BR");

// ---- Overview ---------------------------------------------------------------
function OverviewTab() {
  const { data, isPending } = useOverview();
  const tiles = [
    { label: "Em circulação", value: data?.kpis.circulating, hint: "Saldo disponível dos clientes", icon: Wallet },
    { label: "A caminho", value: data?.kpis.pending, hint: "Pedidos ainda não concluídos", icon: Sparkles },
    { label: "Emitidas (30d)", value: data?.kpis.issued30, hint: `${n(data?.kpis.issued ?? 0)} desde o início`, icon: Coins },
    { label: "Resgatadas (30d)", value: data?.kpis.redeemed30, hint: `${n(data?.kpis.redemptions30 ?? 0)} resgates`, icon: Gift },
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} padded={false} className="p-5">
            <div className="flex items-start justify-between">
              <p className="text-[12.5px] font-semibold text-muted">{t.label}</p>
              <span className="grid size-8 place-items-center rounded-lg bg-coin-soft text-coin-2"><t.icon className="size-4" /></span>
            </div>
            {isPending ? <Skeleton className="mt-2 h-8 w-24" /> : <p className="mt-1.5 flex items-center gap-2 font-display text-[28px] font-bold tracking-[-0.03em] tabular"><CoinMark size={22} />{n(t.value ?? 0)}</p>}
            <p className="mt-1 text-[12px] text-muted">{t.hint}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card title="Moedas emitidas × resgatadas (30 dias)">
          {isPending ? (
            <Skeleton className="h-64" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.series} margin={{ left: -18, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="gIssued" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f5b03a" stopOpacity={0.5} /><stop offset="100%" stopColor="#f5b03a" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gRedeemed" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0c5a3e" stopOpacity={0.35} /><stop offset="100%" stopColor="#0c5a3e" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#efece5" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval={4} stroke="#6b766f" />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#6b766f" allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e6e3da", fontSize: 12 }} formatter={(v, name) => [n(Number(v)), name === "issued" ? "Emitidas" : "Resgatadas"]} />
                  <Area type="monotone" dataKey="issued" stroke="#d98a12" strokeWidth={2} fill="url(#gIssued)" />
                  <Area type="monotone" dataKey="redeemed" stroke="#0c5a3e" strokeWidth={2} fill="url(#gRedeemed)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="Prêmios mais resgatados">
          {isPending ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : !data?.topRewards.length ? (
            <p className="text-[13.5px] text-muted">Nenhum prêmio cadastrado ainda.</p>
          ) : (
            <ul className="space-y-3">
              {data.topRewards.map((r) => {
                const Icon = REWARD_ICON[r.type];
                return (
                  <li key={r.id} className="flex items-center gap-3">
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", REWARD_TONE[r.type])}><Icon className="size-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold">{r.name}</span>
                      <span className="flex items-center gap-1 text-[12px] text-muted"><CoinMark size={12} /> {n(r.costCoins)}</span>
                    </span>
                    <span className="tabular text-[13px] font-bold">{n(r.redeemedCount)}×</span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-4 text-[12px] text-muted">{(data?.kpis.members ?? 0) === 1 ? "1 cliente já ganhou moedas." : `${n(data?.kpis.members ?? 0)} clientes já ganharam moedas.`}</p>
        </Card>
      </div>
    </div>
  );
}

// ---- Rules ------------------------------------------------------------------
function RulesTab() {
  const { data, isPending } = useLoyaltySettings();
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [simulate, setSimulate] = useState("120,00");
  useEffect(() => {
    if (!data) return;
    setForm({
      enabled: data.enabled,
      coinName: data.coinName,
      coinNamePlural: data.coinNamePlural,
      coinEmoji: data.coinEmoji,
      earnCoins: String(data.earnCoins),
      earnPer: moneyInput(data.earnPerCents),
      minOrder: moneyInput(data.minOrderCents),
      awardOn: data.awardOn,
      clubBonusPercent: String(data.clubBonusPercent),
      signupBonusCoins: String(data.signupBonusCoins),
      firstOrderBonusCoins: String(data.firstOrderBonusCoins),
      tagline: data.tagline,
    });
  }, [data]);
  const save = useAdminMutation((input: LoyaltySettings) => api("/admin/loyalty/settings", { method: "PUT", body: input }), { invalidate: [["admin", "loyalty"]], success: "Regras do programa salvas" });

  const payload = (): LoyaltySettings => ({
    enabled: !!form.enabled,
    coinName: String(form.coinName ?? ""),
    coinNamePlural: String(form.coinNamePlural ?? ""),
    coinEmoji: String(form.coinEmoji ?? "🪙"),
    earnCoins: Number(form.earnCoins) || 0,
    earnPerCents: parseMoney(String(form.earnPer ?? "")),
    minOrderCents: parseMoney(String(form.minOrder ?? "")),
    awardOn: (form.awardOn as LoyaltySettings["awardOn"]) ?? "delivered",
    clubBonusPercent: Number(form.clubBonusPercent) || 0,
    signupBonusCoins: Number(form.signupBonusCoins) || 0,
    firstOrderBonusCoins: Number(form.firstOrderBonusCoins) || 0,
    tagline: String(form.tagline ?? ""),
  });
  const submit = () => {
    const parsed = loyaltySettingsSchema.safeParse(payload());
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues.map((i) => ({ path: String(i.path[0]), message: i.message }))));
    setErrors({});
    save.mutate(parsed.data);
  };
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const p = payload();
  const sim = parseMoney(simulate);
  const base = p.earnPerCents >= 100 && sim >= p.minOrderCents ? Math.floor(sim / p.earnPerCents) * p.earnCoins : 0;
  const club = p.clubBonusPercent ? Math.round(base * (1 + p.clubBonusPercent / 100)) : base;
  const plural = p.coinNamePlural || "Moedas";

  if (isPending) return <Skeleton className="h-96 rounded-2xl" />;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <Card title="Como os clientes ganham" action={<Button loading={save.isPending} onClick={submit}><Save className="size-4" /> Salvar regras</Button>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Moedas ganhas" type="number" min={1} value={String(form.earnCoins ?? "")} onChange={set("earnCoins")} error={errors.earnCoins} suffix={plural.toLowerCase()} />
            <Input label="A cada (em produtos)" prefix="R$" inputMode="decimal" value={String(form.earnPer ?? "")} onChange={set("earnPer")} error={errors.earnPerCents} hint="Mínimo R$ 1,00" />
            <Input label="Pedido mínimo para ganhar" prefix="R$" inputMode="decimal" value={String(form.minOrder ?? "")} onChange={set("minOrder")} error={errors.minOrderCents} hint="0 = qualquer pedido" />
            <Select label="Quando as moedas são liberadas" value={String(form.awardOn ?? "delivered")} onChange={set("awardOn")}>
              {AWARD_ON.map((a) => <option key={a} value={a}>{AWARD_ON_LABEL[a]}</option>)}
            </Select>
          </div>
          <p className="mt-3 text-[12px] text-muted">As moedas são calculadas sobre o valor pago em produtos, depois de promoções, preço de clube e prêmios. Frete não conta. Pedido cancelado não gera moedas.</p>
        </Card>
        <Card title="Bônus">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Extra para membros do Clube" type="number" min={0} max={300} suffix="%" value={String(form.clubBonusPercent ?? "")} onChange={set("clubBonusPercent")} error={errors.clubBonusPercent} hint="100% = dobro" />
            <Input label="Bônus de cadastro" type="number" min={0} suffix={plural.toLowerCase()} value={String(form.signupBonusCoins ?? "")} onChange={set("signupBonusCoins")} error={errors.signupBonusCoins} />
            <Input label="Bônus no 1º pedido" type="number" min={0} suffix={plural.toLowerCase()} value={String(form.firstOrderBonusCoins ?? "")} onChange={set("firstOrderBonusCoins")} error={errors.firstOrderBonusCoins} />
          </div>
        </Card>
        <Card title="Identidade da moeda">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Nome (singular)" value={String(form.coinName ?? "")} onChange={set("coinName")} error={errors.coinName} placeholder="Moeda" />
            <Input label="Nome (plural)" value={String(form.coinNamePlural ?? "")} onChange={set("coinNamePlural")} error={errors.coinNamePlural} placeholder="Moedas" />
            <Input label="Emoji" value={String(form.coinEmoji ?? "")} onChange={set("coinEmoji")} error={errors.coinEmoji} />
          </div>
          <Textarea label="Frase do programa (aparece no app)" rows={2} className="mt-4" value={String(form.tagline ?? "")} onChange={set("tagline")} error={errors.tagline} />
        </Card>
      </div>
      <div className="space-y-4">
        <Card title="Status do programa">
          <div className={cn("rounded-2xl p-5", form.enabled ? "bg-gradient-to-br from-[#ffd66b] via-[#f5b03a] to-[#e8941a] text-[#3b2404]" : "bg-line-2 text-ink-2")}>
            <CoinMark size={34} />
            <p className="mt-3 font-display text-[22px] font-bold">{form.enabled ? "Programa ativo" : "Programa pausado"}</p>
            <p className="mt-1 text-[13px] opacity-80">{form.enabled ? "Clientes ganham e trocam moedas no app." : "Novas moedas não são emitidas e resgates ficam bloqueados. Saldos são preservados."}</p>
          </div>
          <div className="mt-4"><Switch checked={!!form.enabled} onChange={(v) => setForm((f) => ({ ...f, enabled: v }))} label="Programa de moedas ativo" /></div>
        </Card>
        <Card title="Simulador">
          <Input label="Se o cliente comprar" prefix="R$" inputMode="decimal" value={simulate} onChange={(e) => setSimulate(e.target.value)} />
          <div className="mt-4 space-y-2 text-[13.5px]">
            <div className="flex items-center justify-between"><span className="text-muted">Cliente</span><span className="flex items-center gap-1.5 font-bold tabular"><CoinMark size={15} /> {n(base)} {plural.toLowerCase()}</span></div>
            {p.clubBonusPercent > 0 && <div className="flex items-center justify-between"><span className="text-muted">Membro do Clube</span><span className="flex items-center gap-1.5 font-bold text-club tabular"><CoinMark size={15} /> {n(club)}</span></div>}
            {p.firstOrderBonusCoins > 0 && <div className="flex items-center justify-between"><span className="text-muted">No 1º pedido</span><span className="font-bold tabular">+{n(p.firstOrderBonusCoins)}</span></div>}
          </div>
          <p className="mt-3 text-[12px] text-muted">Equivale a devolver cerca de <span className="font-semibold text-ink-2">{sim && base ? (() => { const r = Math.round((base / (sim / 100)) * 100) / 100; return `${n(r)} ${(r === 1 ? p.coinName || "Moeda" : plural).toLowerCase()} por real`; })() : "—"}</span>. Compare com o custo dos prêmios para calibrar.</p>
        </Card>
      </div>
    </div>
  );
}

// ---- Rewards ----------------------------------------------------------------
function RewardForm({ reward, onClose }: { reward: AdminReward | null; onClose: () => void }) {
  const [q, setQ] = useState("");
  const products = useAdminProducts({ q, pageSize: 30, status: "active" });
  const [form, setForm] = useState({
    name: reward?.name ?? "",
    description: reward?.description ?? "",
    type: reward?.type ?? ("discount_fixed" as RewardType),
    costCoins: String(reward?.costCoins ?? 100),
    value: reward ? (reward.type === "discount_fixed" ? moneyInput(reward.value) : String(reward.value)) : "10,00",
    maxDiscount: moneyInput(reward?.maxDiscountCents),
    productId: reward?.productId ?? null,
    productName: reward?.product?.name ?? "",
    minOrder: moneyInput(reward?.minOrderCents ?? 0),
    stock: reward?.stock != null ? String(reward.stock) : "",
    maxPerCustomer: reward?.maxPerCustomer != null ? String(reward.maxPerCustomer) : "",
    active: reward?.active ?? true,
    sortOrder: String(reward?.sortOrder ?? 0),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const save = useAdminMutation(
    (input: unknown) => (reward ? api(`/admin/loyalty/rewards/${reward.id}`, { method: "PUT", body: input }) : api("/admin/loyalty/rewards", { body: input })),
    { invalidate: [["admin", "loyalty"]], success: reward ? "Prêmio atualizado" : "Prêmio criado", onSuccess: onClose },
  );
  const remove = useAdminMutation(() => api(`/admin/loyalty/rewards/${reward!.id}`, { method: "DELETE" }), { invalidate: [["admin", "loyalty"]], success: "Prêmio excluído", onSuccess: onClose });

  const submit = () => {
    const payload = {
      name: form.name,
      description: form.description,
      type: form.type,
      costCoins: Number(form.costCoins) || 0,
      value: form.type === "discount_fixed" ? parseMoney(form.value) : form.type === "discount_percent" ? Number(form.value) || 0 : 0,
      maxDiscountCents: form.type === "discount_percent" && form.maxDiscount ? parseMoney(form.maxDiscount) : null,
      productId: form.type === "product" ? form.productId : null,
      minOrderCents: parseMoney(form.minOrder),
      stock: form.stock === "" ? null : Number(form.stock),
      maxPerCustomer: form.maxPerCustomer === "" ? null : Number(form.maxPerCustomer),
      active: form.active,
      sortOrder: Number(form.sortOrder) || 0,
      imageUrl: null,
    };
    const parsed = rewardInputSchema.safeParse(payload);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues.map((i) => ({ path: String(i.path[0]), message: i.message }))));
    setErrors({});
    save.mutate(parsed.data, { onError: (e) => e instanceof ApiError && e.details && setErrors(fieldErrors(e.details)) });
  };
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const Icon = REWARD_ICON[form.type];

  return (
    <Drawer
      open
      onClose={onClose}
      title={reward ? "Editar prêmio" : "Novo prêmio"}
      footer={<>{reward && <Button variant="danger" className="mr-auto" onClick={() => setConfirm(true)}><Trash2 className="size-4" /> Excluir</Button>}<Button variant="outline" onClick={onClose}>Cancelar</Button><Button loading={save.isPending} onClick={submit}>{reward ? "Salvar" : "Criar prêmio"}</Button></>}
    >
      <p className="mb-2 text-[12.5px] font-semibold text-ink-2">Tipo de prêmio</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {REWARD_TYPES.map((t) => {
          const I = REWARD_ICON[t];
          return (
            <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, type: t, value: t === "discount_fixed" ? "10,00" : t === "discount_percent" ? "10" : f.value }))} className={cn("flex items-center gap-2 rounded-xl p-2.5 text-left text-[12.5px] font-semibold ring-1 transition-colors", form.type === t ? "bg-ink text-white ring-ink" : "bg-card text-ink-2 ring-line hover:bg-line-2")}>
              <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg", form.type === t ? "bg-white/15" : REWARD_TONE[t])}><I className="size-3.5" /></span>
              {REWARD_TYPE_LABEL[t]}
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_160px]">
        <Input label="Nome do prêmio" value={form.name} onChange={set("name")} error={errors.name} placeholder="R$ 10 de desconto" autoFocus />
        <Input label="Custo" type="number" min={1} value={form.costCoins} onChange={set("costCoins")} error={errors.costCoins} suffix="moedas" />
      </div>
      <Textarea label="Descrição (aparece no app)" rows={2} className="mt-4" value={form.description} onChange={set("description")} />

      {form.type === "discount_fixed" && <Input className="mt-4" label="Valor do desconto" prefix="R$" inputMode="decimal" value={form.value} onChange={set("value")} error={errors.value} />}
      {form.type === "discount_percent" && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input label="Percentual" type="number" min={1} max={100} suffix="%" value={form.value} onChange={set("value")} error={errors.value} />
          <Input label="Desconto máximo (opcional)" prefix="R$" inputMode="decimal" value={form.maxDiscount} onChange={set("maxDiscount")} />
        </div>
      )}
      {form.type === "product" && (
        <div className="mt-4">
          <p className="mb-1.5 text-[12.5px] font-semibold text-ink-2">Produto dado de presente {form.productName && <Badge tone="brand">{form.productName}</Badge>}</p>
          {errors.productId && <p className="mb-2 text-[12px] font-semibold text-sale">{errors.productId}</p>}
          <label className="flex h-10 items-center gap-2 rounded-xl bg-card px-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-brand-3">
            <Search className="size-4 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto" className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none" />
          </label>
          <ul className="mt-2 max-h-56 divide-y divide-line-2 overflow-y-auto rounded-xl bg-card ring-1 ring-line">
            {products.data?.items.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setForm((f) => ({ ...f, productId: p.id, productName: p.name }))} className={cn("flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-line-2/50", form.productId === p.id && "bg-brand-soft")}>
                  <span className="size-8 shrink-0 overflow-hidden rounded-md bg-line-2">{p.imageUrl && <img src={p.imageUrl} alt="" className="size-full object-contain mix-blend-multiply" />}</span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{p.name}</span>
                  <span className="tabular text-[12.5px] text-muted">{formatBRL(p.priceCents)} · {p.stock} un</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {form.type === "gift" && <p className="mt-4 rounded-xl bg-coin-soft p-3 text-[12.5px] text-coin-2">O cliente recebe um código (ex.: AX-7F3K-9QWD). Valide em <span className="font-bold">Vouchers → Validar código</span> quando entregar o brinde.</p>}

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {form.type !== "gift" && <Input label="Pedido mínimo" prefix="R$" inputMode="decimal" value={form.minOrder} onChange={set("minOrder")} error={errors.minOrderCents} />}
        <Input label="Estoque de prêmios" type="number" min={0} value={form.stock} onChange={set("stock")} hint="Vazio = ilimitado" />
        <Input label="Limite por cliente" type="number" min={1} value={form.maxPerCustomer} onChange={set("maxPerCustomer")} hint="Vazio = sem limite" />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <Switch checked={form.active} onChange={(v) => setForm((f) => ({ ...f, active: v }))} label="Visível no app" />
        <Input className="w-28" label="Ordem" type="number" value={form.sortOrder} onChange={set("sortOrder")} />
      </div>

      <div className="mt-6 rounded-2xl bg-canvas p-4 ring-1 ring-line">
        <p className="mb-3 text-[11.5px] font-bold tracking-[0.04em] text-muted uppercase">Prévia no app</p>
        <div className="w-44 rounded-[20px] bg-card p-3 shadow-card">
          <div className="flex items-start justify-between">
            <span className={cn("grid size-11 place-items-center rounded-2xl", REWARD_TONE[form.type])}><Icon className="size-5" /></span>
            <span className="flex items-center gap-1 rounded-full bg-coin-soft px-2 py-0.5 text-[11px] font-extrabold text-coin-2 tabular"><CoinMark size={11} /> {n(Number(form.costCoins) || 0)}</span>
          </div>
          <p className="mt-2 line-clamp-2 text-[13px] font-bold">{form.name || "Nome do prêmio"}</p>
          <p className="line-clamp-2 text-[11.5px] text-muted">{form.description || REWARD_TYPE_LABEL[form.type]}</p>
          <span className="mt-2 inline-block rounded-full bg-[#f5b03a] px-2.5 py-1 text-[11px] font-bold text-[#4a2e05]">Resgatar</span>
        </div>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="Excluir prêmio?" description="Vouchers já resgatados continuam válidos para os clientes." confirmLabel="Excluir" loading={remove.isPending} onConfirm={() => remove.mutate(undefined)} />
    </Drawer>
  );
}

function RewardsTab() {
  const { data, isPending } = useRewards();
  const [editing, setEditing] = useState<AdminReward | "new" | null>(null);
  const toggle = useAdminMutation(({ id, active }: { id: string; active: boolean }) => api(`/admin/loyalty/rewards/${id}`, { method: "PATCH", body: { active } }), { invalidate: [["admin", "loyalty"]] });
  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => setEditing("new")}><Plus className="size-4" /> Novo prêmio</Button></div>
      {isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
      ) : !data?.length ? (
        <Card><EmptyState icon={<Gift className="size-6" />} title="Nenhum prêmio ainda" description="Crie descontos, frete grátis, produtos ou brindes para os clientes trocarem por moedas." action={<Button onClick={() => setEditing("new")}><Plus className="size-4" /> Criar primeiro prêmio</Button>} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((r) => {
            const Icon = REWARD_ICON[r.type];
            return (
              <Card key={r.id} padded={false} className={cn("cursor-pointer p-5 transition-shadow hover:shadow-pop", !r.active && "opacity-60")}>
                <div onClick={() => setEditing(r)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setEditing(r)}>
                  <div className="flex items-start justify-between gap-3">
                    <span className={cn("grid size-11 place-items-center rounded-xl", REWARD_TONE[r.type])}><Icon className="size-5" /></span>
                    <span className="flex items-center gap-1.5 rounded-full bg-coin-soft px-2.5 py-1 text-[13px] font-extrabold text-coin-2 tabular"><CoinMark size={14} /> {n(r.costCoins)}</span>
                  </div>
                  <p className="mt-3 font-display text-[16px] font-bold tracking-[-0.01em]">{r.name}</p>
                  <p className="text-[13px] text-muted">{r.label}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge tone="neutral">{REWARD_TYPE_LABEL[r.type]}</Badge>
                    {r.minOrderCents > 0 && <Badge tone="neutral">mín. {formatBRL(r.minOrderCents)}</Badge>}
                    {r.stock !== null && <Badge tone={r.stock <= 5 ? "sale" : "neutral"}>{r.stock} em estoque</Badge>}
                    {r.maxPerCustomer !== null && <Badge tone="neutral">{r.maxPerCustomer}× por cliente</Badge>}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-line-2 pt-3">
                  <span className="text-[12.5px] text-muted"><span className="font-bold text-ink tabular">{n(r.redeemedCount)}</span> resgates</span>
                  <Switch checked={r.active} onChange={(v) => toggle.mutate({ id: r.id, active: v })} label={r.active ? "Visível" : "Oculto"} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {editing && <RewardForm reward={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

// ---- Vouchers ---------------------------------------------------------------
const STATUS_TONE = { available: "brand", applied: "info", used: "neutral", cancelled: "sale" } as const;

function VouchersTab() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [code, setCode] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, isPending } = useRedemptions({ status: status || undefined, q: debounced || undefined, pageSize: "60" });
  const use = useAdminMutation((c: string) => api<{ redemption: Redemption }>("/admin/loyalty/redemptions/use", { body: { code: c } }), {
    invalidate: [["admin", "loyalty"]],
    success: (d) => `Brinde entregue: ${d.redemption.reward.name}`,
    onSuccess: () => setCode(""),
  });
  const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).replace(".", "");
  return (
    <div className="space-y-4">
      <Card title="Validar código de brinde">
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => (e.preventDefault(), code.trim() && use.mutate(code.trim()))}>
          <Input className="w-full sm:w-72" label="Código apresentado pelo cliente" placeholder="AX-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <Button type="submit" loading={use.isPending} disabled={code.trim().length < 4}><Ticket className="size-4" /> Marcar como entregue</Button>
        </form>
      </Card>
      <div className="flex flex-wrap items-center gap-2">
        {[{ id: "", label: "Todos" }, ...(["available", "applied", "used", "cancelled"] as const).map((s) => ({ id: s, label: REDEMPTION_STATUS_LABEL[s] }))].map((s) => (
          <button key={s.id} type="button" onClick={() => setStatus(s.id)} className={cn("h-9 rounded-full px-3.5 text-[13px] font-semibold ring-1 transition-colors", status === s.id ? "bg-ink text-white ring-ink" : "bg-card text-ink-2 ring-line hover:bg-line-2")}>{s.label}</button>
        ))}
        <label className="ml-auto flex h-9 w-full items-center gap-2 rounded-xl bg-card px-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-brand-3 sm:w-72">
          <Search className="size-4 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Código, nome ou e-mail" className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-faint" />
        </label>
      </div>
      <Card padded={false}>
        {isPending ? (
          <div className="space-y-2 p-5">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
        ) : !data?.items.length ? (
          <EmptyState icon={<Ticket className="size-6" />} title="Nenhum voucher encontrado" />
        ) : (
          <div className="scroll-x">
            <table className="w-full min-w-[760px] text-[13.5px]">
              <thead>
                <tr className="border-b border-line-2 text-left text-[11.5px] font-bold tracking-[0.04em] text-muted uppercase">
                  <th className="px-5 py-3">Código</th><th className="px-3 py-3">Prêmio</th><th className="px-3 py-3">Cliente</th><th className="px-3 py-3 text-right">Moedas</th><th className="px-3 py-3">Status</th><th className="px-5 py-3">Resgate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-2">
                {data.items.map((v) => (
                  <tr key={v.id} className="hover:bg-line-2/40">
                    <td className="px-5 py-3 font-mono text-[12.5px] font-bold tracking-wider">{v.code}</td>
                    <td className="px-3 py-3"><span className="block font-semibold">{v.reward.name}</span><span className="block text-[12px] text-muted">{v.reward.label}</span></td>
                    <td className="px-3 py-3"><span className="block">{v.customerName}</span><span className="block text-[12px] text-muted">{v.customerEmail}</span></td>
                    <td className="px-3 py-3 text-right"><span className="inline-flex items-center gap-1 font-bold tabular"><CoinMark size={13} /> {n(v.coins)}</span></td>
                    <td className="px-3 py-3"><Badge tone={STATUS_TONE[v.status]}>{v.status === "applied" && v.orderNumber != null ? `Pedido ${formatOrderNumber(v.orderNumber)}` : REDEMPTION_STATUS_LABEL[v.status]}</Badge></td>
                    <td className="px-5 py-3 text-ink-2">{fmt(v.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---- Customer wallet drawer (used from Clientes) ----------------------------
interface CustomerCoins {
  balance: number;
  pending: number;
  items: { id: string; type: string; status: string; coins: number; note: string | null; orderNumber: number | null; createdAt: string }[];
}
const ENTRY_LABEL: Record<string, string> = { earn: "Compra", bonus: "Bônus", redeem: "Resgate", refund: "Devolução", adjust: "Ajuste", reversal: "Estorno" };

export function CustomerCoinsDrawer({ customer, onClose }: { customer: { id: string; name: string } | null; onClose: () => void }) {
  const { data, isPending } = useQuery({
    queryKey: ["admin", "loyalty", "customer", customer?.id],
    queryFn: () => api<CustomerCoins>(`/admin/loyalty/customers/${customer!.id}/coins`),
    enabled: !!customer,
  });
  const [coins, setCoins] = useState("");
  const [note, setNote] = useState("");
  const adjust = useAdminMutation((body: { coins: number; note: string }) => api(`/admin/loyalty/customers/${customer!.id}/coins`, { body }), {
    invalidate: [["admin", "loyalty"], ["admin", "customers"]],
    success: "Saldo ajustado",
    onSuccess: () => (setCoins(""), setNote("")),
  });
  const value = Number(coins) || 0;
  return (
    <Drawer open={!!customer} onClose={onClose} title={customer ? `Moedas · ${customer.name}` : "Moedas"}>
      {isPending || !data ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : (
        <>
          <div className="rounded-2xl bg-gradient-to-br from-[#ffd66b] via-[#f5b03a] to-[#e8941a] p-5 text-[#3b2404]">
            <p className="text-[12px] font-bold tracking-[0.1em] uppercase opacity-70">Saldo disponível</p>
            <p className="mt-1 flex items-center gap-2 font-display text-[34px] font-bold tabular"><CoinMark size={28} /> {n(data.balance)}</p>
            {data.pending > 0 && <p className="text-[12.5px] font-semibold opacity-75">+{n(data.pending)} a caminho (pedidos em andamento)</p>}
          </div>
          <Card title="Ajustar saldo" className="mt-4">
            <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
              <Input label="Moedas (+/−)" type="number" value={coins} onChange={(e) => setCoins(e.target.value)} hint="Use negativo para remover" />
              <Input label="Motivo (o cliente vê)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Presente de aniversário" />
            </div>
            <Button className="mt-3" disabled={!value || note.trim().length < 2} loading={adjust.isPending} onClick={() => adjust.mutate({ coins: value, note: note.trim() })}>
              <Coins className="size-4" /> {value < 0 ? `Remover ${n(-value)}` : `Creditar ${n(value)}`}
            </Button>
          </Card>
          <h3 className="mt-6 mb-2 text-[12.5px] font-bold tracking-[0.04em] text-muted uppercase">Extrato</h3>
          {data.items.length ? (
            <ul className="divide-y divide-line-2 rounded-2xl bg-card ring-1 ring-line">
              {data.items.map((e) => (
                <li key={e.id} className={cn("flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]", e.status === "void" && "opacity-50")}>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{e.orderNumber != null ? `Pedido ${formatOrderNumber(e.orderNumber)}` : (e.note ?? ENTRY_LABEL[e.type])}</span>
                    <span className="block text-[11.5px] text-muted">{ENTRY_LABEL[e.type]} · {new Date(e.createdAt).toLocaleDateString("pt-BR")}{e.status === "pending" ? " · a caminho" : e.status === "void" ? " · cancelado" : ""}</span>
                  </span>
                  <span className={cn("font-bold tabular", e.coins > 0 ? "text-coin-2" : "text-ink-2")}>{e.coins > 0 ? "+" : "−"}{n(Math.abs(e.coins))}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">Sem movimentações.</p>
          )}
        </>
      )}
    </Drawer>
  );
}

// ---- Screen -----------------------------------------------------------------
const TABS = [
  { id: "overview", label: "Visão geral" },
  { id: "rules", label: "Regras" },
  { id: "rewards", label: "Prêmios" },
  { id: "vouchers", label: "Vouchers" },
] as const;

export function LoyaltyScreen() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");
  const settings = useLoyaltySettings();
  const desc = useMemo(() => {
    const s = settings.data;
    if (!s) return "Programa de moedas e prêmios";
    return `${s.enabled ? "Ativo" : "Pausado"} · ${n(s.earnCoins)} ${s.earnCoins === 1 ? s.coinName.toLowerCase() : s.coinNamePlural.toLowerCase()} a cada ${formatBRL(s.earnPerCents)} em produtos`;
  }, [settings.data]);
  return (
    <>
      <PageHeader title="Fidelidade" description={desc} />
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-line-2 p-1 sm:w-fit">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={cn("h-9 shrink-0 rounded-lg px-4 text-[13.5px] font-semibold transition-colors", tab === t.id ? "bg-card text-ink shadow-card" : "text-muted hover:text-ink")}>{t.label}</button>
        ))}
      </div>
      {tab === "overview" && <OverviewTab />}
      {tab === "rules" && <RulesTab />}
      {tab === "rewards" && <RewardsTab />}
      {tab === "vouchers" && <VouchersTab />}
    </>
  );
}
