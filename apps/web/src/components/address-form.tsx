"use client";

import { addressSchema, formatCep, type Address, type AddressInput } from "@aionix/shared";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAddressMutations } from "@/lib/account";
import { haptic, toast } from "@/lib/toast";
import { Field, fieldErrors } from "./ui/field";
import { Button, cn } from "./ui/primitives";

const LABELS = ["Casa", "Trabalho", "Outro"];

export function AddressForm({ address, onDone }: { address?: Address | null; onDone: (a: Address) => void }) {
  const { save } = useAddressMutations();
  const [form, setForm] = useState<AddressInput>({
    label: address?.label ?? "Casa",
    recipient: address?.recipient ?? "",
    zip: address?.zip ?? "",
    street: address?.street ?? "",
    number: address?.number ?? "",
    complement: address?.complement ?? "",
    district: address?.district ?? "",
    city: address?.city ?? "",
    state: address?.state ?? "",
    reference: address?.reference ?? "",
    isDefault: address?.isDefault ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cepLoading, setCepLoading] = useState(false);

  const set = (k: keyof AddressInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = k === "zip" ? formatCep(e.target.value) : k === "state" ? e.target.value.toUpperCase().slice(0, 2) : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: "" }));
    if (k === "zip" && v.replace(/\D/g, "").length === 8) void lookupCep(v);
  };

  const lookupCep = async (cep: string) => {
    setCepLoading(true);
    try {
      const r = await api<{ street: string; district: string; city: string; state: string }>(`/me/cep/${cep.replace(/\D/g, "")}`);
      setForm((f) => ({ ...f, street: r.street || f.street, district: r.district || f.district, city: r.city, state: r.state }));
      haptic();
      setTimeout(() => document.getElementById("addr-number")?.focus(), 50);
    } catch {
      /* user fills manually */
    } finally {
      setCepLoading(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = addressSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues.map((i) => ({ path: String(i.path[0]), message: i.message }))));
      haptic([20, 40, 20]);
      return;
    }
    save.mutate(
      { id: address?.id, input: parsed.data },
      {
        onSuccess: (d) => {
          haptic([8, 30, 8]);
          toast.success(address ? "Endereço atualizado" : "Endereço salvo");
          onDone(d.address);
        },
        onError: (err) => {
          if (err instanceof ApiError && err.details) setErrors(fieldErrors(err.details));
          toast.error(err.message);
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div className="flex gap-2">
        {LABELS.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setForm((f) => ({ ...f, label: l }))}
            className={cn("h-9 rounded-full px-4 text-[13px] font-semibold transition-colors", form.label === l ? "bg-ink text-white" : "bg-card text-ink-2 ring-1 ring-line")}
          >
            {l}
          </button>
        ))}
      </div>
      <Field label="Quem vai receber" autoComplete="name" value={form.recipient} onChange={set("recipient")} error={errors.recipient} />
      <Field
        label="CEP"
        inputMode="numeric"
        autoComplete="postal-code"
        value={form.zip}
        onChange={set("zip")}
        error={errors.zip}
        placeholder="00000-000"
        trailing={cepLoading ? <Loader2 className="size-4 animate-spin text-muted" /> : undefined}
      />
      <Field label="Rua / Avenida" autoComplete="address-line1" value={form.street} onChange={set("street")} error={errors.street} />
      <div className="grid grid-cols-[1fr_1.6fr] gap-3">
        <Field id="addr-number" label="Número" inputMode="numeric" value={form.number} onChange={set("number")} error={errors.number} />
        <Field label="Complemento" autoComplete="address-line2" value={form.complement ?? ""} onChange={set("complement")} placeholder="Apto, bloco…" />
      </div>
      <Field label="Bairro" autoComplete="address-level3" value={form.district} onChange={set("district")} error={errors.district} />
      <div className="grid grid-cols-[2fr_1fr] gap-3">
        <Field label="Cidade" autoComplete="address-level2" value={form.city} onChange={set("city")} error={errors.city} />
        <Field label="UF" autoComplete="address-level1" value={form.state} onChange={set("state")} error={errors.state} maxLength={2} />
      </div>
      <Field label="Ponto de referência (opcional)" value={form.reference ?? ""} onChange={set("reference")} />
      <label className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 ring-1 ring-line">
        <input type="checkbox" checked={!!form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} className="size-5 accent-brand" />
        <span className="text-[14px] font-semibold">Usar como endereço principal</span>
      </label>
      <Button type="submit" size="lg" block loading={save.isPending} className="!mt-4">
        {address ? "Salvar alterações" : "Salvar endereço"}
      </Button>
    </form>
  );
}
