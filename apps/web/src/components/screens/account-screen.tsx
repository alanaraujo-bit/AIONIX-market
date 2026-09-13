"use client";

import { formatBRL, formatPhone, profileSchema } from "@aionix/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Leaf, LogOut, MapPin, Receipt, Sparkles, UserRound } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Field, fieldErrors } from "@/components/ui/field";
import { Button, Skeleton } from "@/components/ui/primitives";
import { LargeTitle, Screen } from "@/components/ui/screen";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { useMe } from "@/lib/account";
import { useAuthActions, useSession } from "@/lib/session";
import { haptic, toast } from "@/lib/toast";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function AccountScreen() {
  const { user, loading } = useSession();
  const { logout } = useAuthActions();
  const me = useMe(!!user);
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) setForm({ name: user.name, phone: user.phone ?? "" });
  }, [user]);

  const save = useMutation({
    mutationFn: () => api("/me", { method: "PATCH", body: form }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["session"] });
      void qc.invalidateQueries({ queryKey: ["me"] });
      setEditing(false);
      haptic([8, 30, 8]);
      toast.success("Perfil atualizado");
    },
    onError: (e) => toast.error(e.message),
  });

  if (!loading && !user) {
    return (
      <Screen header={<LargeTitle title="Conta" />}>
        <div className="px-5 pt-4">
          <div className="grain relative overflow-hidden rounded-[28px] bg-brand p-6 text-white">
            <Leaf className="size-9" strokeWidth={2.2} />
            <h2 className="mt-4 font-display text-[26px] leading-tight font-extrabold tracking-[-0.03em]">Sua conta AIONIX</h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-white/80">Endereços salvos, histórico de compras e acompanhamento de pedidos em tempo real.</p>
            <div className="mt-6 flex gap-3">
              <Link href="/entrar?next=/conta" className="flex-1">
                <Button block className="!bg-white !text-brand">Entrar</Button>
              </Link>
              <Link href="/entrar?next=/conta&mode=cadastro" className="flex-1">
                <Button block variant="ghost" className="!text-white ring-1 ring-white/40">Criar conta</Button>
              </Link>
            </div>
            <span aria-hidden className="absolute -right-12 -bottom-16 size-48 rounded-full bg-white/10" />
          </div>
        </div>
      </Screen>
    );
  }

  const stats = me.data?.stats;

  return (
    <Screen header={<LargeTitle title="Conta" />}>
      <div className="space-y-5 px-4 pt-1 pb-8">
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 rounded-[24px] bg-card p-4 shadow-card">
          <span className="grid size-16 shrink-0 place-items-center rounded-[22px] bg-brand font-display text-[22px] font-bold text-white">{user ? initials(user.name) : "…"}</span>
          <div className="min-w-0 flex-1">
            {user ? (
              <>
                <p className="truncate font-display text-[19px] font-bold tracking-[-0.02em]">{user.name}</p>
                <p className="selectable truncate text-[13.5px] text-muted">{user.email}</p>
                {user.phone && <p className="text-[13.5px] text-muted">{user.phone}</p>}
              </>
            ) : (
              <Skeleton className="h-6 w-32" />
            )}
          </div>
          <button type="button" onClick={() => setEditing(true)} className="text-[13.5px] font-semibold text-brand-2">Editar</button>
        </motion.section>

        <section className="grid grid-cols-3 gap-3">
          {[
            { label: "Pedidos", value: stats ? String(stats.orders) : null },
            { label: "Gastos", value: stats ? formatBRL(stats.spentCents) : null },
            { label: "Economia", value: stats ? formatBRL(stats.savedCents) : null, tone: "text-brand-2" },
          ].map((s) => (
            <div key={s.label} className="rounded-[20px] bg-card p-3.5 shadow-card">
              <p className="text-[11.5px] font-bold tracking-[0.04em] text-muted uppercase">{s.label}</p>
              {s.value === null ? <Skeleton className="mt-1.5 h-5 w-14" /> : <p className={`tabular mt-1 truncate font-display text-[17px] font-bold tracking-[-0.02em] ${s.tone ?? ""}`}>{s.value}</p>}
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-[22px] bg-card shadow-card">
          {[
            { href: "/pedidos", icon: Receipt, label: "Meus pedidos", sub: "Histórico e acompanhamento" },
            { href: "/conta/enderecos", icon: MapPin, label: "Endereços", sub: "Gerencie locais de entrega" },
            { href: "/ofertas", icon: Sparkles, label: "Ofertas do dia", sub: "Promoções ativas agora" },
          ].map((item, i) => (
            <Link key={item.href} href={item.href} className={`flex items-center gap-3.5 px-4 py-3.5 active:bg-line-2/60 ${i > 0 ? "border-t border-line-2" : ""}`}>
              <span className="grid size-10 place-items-center rounded-2xl bg-brand-soft text-brand">
                <item.icon className="size-5" strokeWidth={2.2} />
              </span>
              <span className="flex-1">
                <span className="block text-[14.5px] font-bold">{item.label}</span>
                <span className="block text-[12.5px] text-muted">{item.sub}</span>
              </span>
              <ChevronRight className="size-5 text-faint" />
            </Link>
          ))}
        </section>

        <Button
          variant="secondary"
          block
          loading={logout.isPending}
          onClick={() => logout.mutate(undefined, { onSuccess: () => toast("Até logo!") })}
          className="!text-sale"
        >
          <LogOut className="size-4" /> Sair da conta
        </Button>
        <p className="text-center text-[11.5px] text-faint">AIONIX Market · v1.0</p>
      </div>

      <Sheet open={editing} onClose={() => setEditing(false)} title="Editar perfil">
        <form
          className="space-y-3 pb-2"
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = profileSchema.safeParse(form);
            if (!parsed.success) {
              setErrors(fieldErrors(parsed.error.issues.map((i) => ({ path: String(i.path[0]), message: i.message }))));
              return;
            }
            setErrors({});
            save.mutate();
          }}
        >
          <Field label="Nome" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={errors.name} />
          <Field label="Celular" inputMode="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))} error={errors.phone} />
          <Button type="submit" size="lg" block loading={save.isPending} className="!mt-4">
            <UserRound className="size-4" /> Salvar
          </Button>
        </form>
      </Sheet>
    </Screen>
  );
}
