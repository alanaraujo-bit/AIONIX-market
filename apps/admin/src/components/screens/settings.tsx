"use client";

import { settingsSchema, type StoreSettings } from "@aionix/shared";
import { Save, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAdminMutation, useSettings } from "@/lib/queries";
import { Button, Card, Input, PageHeader, Skeleton, Switch, cn, fieldErrors, moneyInput, parseMoney } from "@/components/ui";

export function SettingsScreen() {
  const { data, isPending } = useSettings();
  const [form, setForm] = useState({ storeName: "", deliveryFee: "", freeThreshold: "", minimum: "", storeOpen: true, eta: "45" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (data) setForm({ storeName: data.storeName, deliveryFee: moneyInput(data.deliveryFeeCents), freeThreshold: moneyInput(data.freeDeliveryThresholdCents), minimum: moneyInput(data.minimumOrderCents), storeOpen: data.storeOpen, eta: String(data.etaMinutes) });
  }, [data]);
  const save = useAdminMutation((input: StoreSettings) => api("/admin/settings", { method: "PUT", body: input }), { invalidate: [["admin", "settings"]], success: "Configurações salvas" });

  const submit = () => {
    const parsed = settingsSchema.safeParse({ storeName: form.storeName, deliveryFeeCents: parseMoney(form.deliveryFee), freeDeliveryThresholdCents: parseMoney(form.freeThreshold), minimumOrderCents: parseMoney(form.minimum), storeOpen: form.storeOpen, etaMinutes: Number(form.eta) });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues.map((i) => ({ path: String(i.path[0]), message: i.message }))));
    setErrors({});
    save.mutate(parsed.data);
  };

  if (isPending) return <><PageHeader title="Configurações" /><Skeleton className="h-96 rounded-2xl" /></>;

  return (
    <>
      <PageHeader title="Configurações" description="Regras comerciais aplicadas em tempo real no app" actions={<Button loading={save.isPending} onClick={submit}><Save className="size-4" /> Salvar</Button>} />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card title="Loja">
            <Input label="Nome da loja" value={form.storeName} onChange={(e) => setForm((f) => ({ ...f, storeName: e.target.value }))} error={errors.storeName} />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input label="Tempo estimado de entrega" type="number" suffix="min" value={form.eta} onChange={(e) => setForm((f) => ({ ...f, eta: e.target.value }))} error={errors.etaMinutes} />
            </div>
          </Card>
          <Card title="Entrega e pedido mínimo">
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Taxa de entrega" prefix="R$" inputMode="decimal" value={form.deliveryFee} onChange={(e) => setForm((f) => ({ ...f, deliveryFee: e.target.value }))} error={errors.deliveryFeeCents} />
              <Input label="Frete grátis a partir de" prefix="R$" inputMode="decimal" value={form.freeThreshold} onChange={(e) => setForm((f) => ({ ...f, freeThreshold: e.target.value }))} error={errors.freeDeliveryThresholdCents} />
              <Input label="Pedido mínimo" prefix="R$" inputMode="decimal" value={form.minimum} onChange={(e) => setForm((f) => ({ ...f, minimum: e.target.value }))} error={errors.minimumOrderCents} />
            </div>
          </Card>
        </div>
        <Card title="Status da operação">
          <div className={cn("grain rounded-2xl p-5 text-white", form.storeOpen ? "bg-brand" : "bg-sale")}>
            <Store className="size-7" />
            <p className="mt-3 font-display text-[22px] font-bold">{form.storeOpen ? "Loja aberta" : "Loja fechada"}</p>
            <p className="mt-1 text-[13px] text-white/75">{form.storeOpen ? "Clientes podem finalizar pedidos." : "O app exibe aviso e bloqueia o checkout."}</p>
          </div>
          <div className="mt-4"><Switch checked={form.storeOpen} onChange={(v) => setForm((f) => ({ ...f, storeOpen: v }))} label="Aceitar pedidos" /></div>
          <p className="mt-3 text-[12px] text-muted">Lembre de salvar para aplicar.</p>
        </Card>
      </div>
    </>
  );
}
