"use client";

import { formatPhone } from "@aionix/shared";
import { Eye, EyeOff, Leaf, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Field, fieldErrors } from "@/components/ui/field";
import { Button, cn } from "@/components/ui/primitives";
import { BackButton, Screen } from "@/components/ui/screen";
import { ApiError } from "@/lib/api";
import { useAuthActions, useSession } from "@/lib/session";
import { haptic, toast } from "@/lib/toast";

const DEMO = { email: "cliente@aionix.market", password: "aionix2026" };

export function AuthScreen({ next, initialMode }: { next: string; initialMode: "login" | "register" }) {
  const router = useRouter();
  const { user } = useSession();
  const { login, register } = useAuthActions();
  const [mode, setMode] = useState(initialMode);
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  const pending = login.isPending || register.isPending;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = k === "phone" ? formatPhone(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: "" }));
  };

  const onError = (err: unknown) => {
    haptic([20, 40, 20]);
    if (err instanceof ApiError && err.details) setErrors(fieldErrors(err.details));
    else if (err instanceof ApiError && err.code === "EMAIL_TAKEN") setErrors({ email: err.message });
    toast.error(err instanceof Error ? err.message : "Não foi possível continuar");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const done = (msg: string) => () => {
      haptic([8, 30, 8]);
      toast.success(msg);
      router.replace(next);
    };
    if (mode === "login") {
      login.mutate({ email: form.email, password: form.password }, { onSuccess: done("Que bom te ver de novo!"), onError });
    } else {
      register.mutate(form, { onSuccess: done("Conta criada com sucesso!"), onError });
    }
  };

  return (
    <Screen
      header={
        <div className="pt-safe shrink-0 px-4 pt-3">
          <BackButton />
        </div>
      }
    >
      <div className="px-6 pt-4 pb-10">
        <div className="grain mb-6 grid size-16 place-items-center rounded-[22px] bg-brand text-white shadow-float">
          <Leaf className="size-8" strokeWidth={2.2} />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <h1 className="font-display text-[32px] leading-[1.05] font-extrabold tracking-[-0.035em]">
              {mode === "login" ? "Bem-vindo de volta" : "Crie sua conta"}
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              {mode === "login" ? "Entre para acompanhar pedidos e finalizar compras." : "Leva menos de um minuto. Ofertas exclusivas te esperam."}
            </p>
          </motion.div>
        </AnimatePresence>

        <div className="relative mt-7 grid grid-cols-2 rounded-2xl bg-line-2 p-1">
          {(["login", "register"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className="relative z-10 h-10 text-[14px] font-bold">
              {mode === m && <motion.span layoutId="auth-seg" className="absolute inset-0 -z-10 rounded-[12px] bg-card shadow-card" />}
              <span className={cn("transition-colors", mode === m ? "text-ink" : "text-muted")}>{m === "login" ? "Entrar" : "Criar conta"}</span>
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-5 space-y-3" noValidate>
          <AnimatePresence initial={false}>
            {mode === "register" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
                <Field label="Nome completo" autoComplete="name" value={form.name} onChange={set("name")} error={errors.name} />
                <Field label="Celular (opcional)" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} error={errors.phone} placeholder="(11) 90000-0000" />
              </motion.div>
            )}
          </AnimatePresence>
          <Field label="E-mail" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={form.email} onChange={set("email")} error={errors.email} />
          <Field
            label="Senha"
            type={showPw ? "text" : "password"}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={form.password}
            onChange={set("password")}
            error={errors.password}
            hint={mode === "register" ? "Mínimo de 8 caracteres" : undefined}
            trailing={
              <button type="button" aria-label={showPw ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPw((v) => !v)} className="grid size-8 place-items-center text-muted">
                {showPw ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
              </button>
            }
          />
          <Button type="submit" size="lg" block loading={pending} className="!mt-5">
            {mode === "login" ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        {mode === "login" && (
          <button
            type="button"
            onClick={() => {
              setForm((f) => ({ ...f, ...DEMO }));
              login.mutate(DEMO, {
                onSuccess: () => {
                  toast.success("Entrou com a conta demo");
                  router.replace(next);
                },
                onError,
              });
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line py-3.5 text-[13.5px] font-semibold text-ink-2 active:bg-line-2"
          >
            <Sparkles className="size-4 text-citrus" /> Explorar com a conta demo
          </button>
        )}

        <p className="mt-8 text-center text-[12px] leading-relaxed text-faint">
          Ao continuar você concorda com os Termos de Uso e a Política de Privacidade da AIONIX Market.
        </p>
      </div>
    </Screen>
  );
}
