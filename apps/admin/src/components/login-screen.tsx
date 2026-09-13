"use client";

import { play } from "@/lib/sound";
import { Eye, EyeOff, Leaf, Loader2, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { useAuth, useSession } from "@/lib/session";

export function LoginScreen() {
  const router = useRouter();
  const { user } = useSession();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  return (
    <div className="grid h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="grain relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-brand-3/20 text-brand-3">
            <Leaf className="size-6" strokeWidth={2.2} />
          </span>
          <span className="font-display text-[20px] font-bold tracking-[-0.02em]">AIONIX Market</span>
        </div>
        <div className="max-w-md">
          <h1 className="font-display text-[44px] leading-[1.05] font-extrabold tracking-[-0.035em]">
            Operação do supermercado em uma única tela.
          </h1>
          <p className="mt-5 text-[16px] leading-relaxed text-white/65">
            Pedidos em tempo real, estoque, promoções e banners — tudo com a precisão que a sua loja precisa.
          </p>
        </div>
        <p className="text-[12.5px] text-white/40">© {new Date().getFullYear()} AIONIX · Painel administrativo</p>
        <span aria-hidden className="absolute -right-32 -bottom-40 size-[520px] rounded-full bg-brand-3/15 blur-3xl" />
        <span aria-hidden className="absolute top-24 -right-20 size-72 rounded-full border-[28px] border-white/5" />
      </section>

      <section className="flex items-center justify-center p-6">
        <motion.form
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate(
              { email, password },
              { onSuccess: () => (play("welcome"), router.replace("/dashboard")), onError: (err) => toast.error(err.message) },
            );
          }}
          className="w-full max-w-sm"
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-brand text-white lg:hidden">
            <Leaf className="size-6" />
          </span>
          <h2 className="mt-6 font-display text-[28px] font-bold tracking-[-0.03em] lg:mt-0">Entrar no painel</h2>
          <p className="mt-1.5 text-[14.5px] text-muted">Use a conta de gestor da loja.</p>

          <label className="mt-8 block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">E-mail</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 w-full rounded-xl bg-card px-4 text-[15px] ring-1 ring-line outline-none focus:ring-2 focus:ring-brand-3"
            />
          </label>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Senha</span>
            <span className="relative block">
              <input
                type={show ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 w-full rounded-xl bg-card pr-12 pl-4 text-[15px] ring-1 ring-line outline-none focus:ring-2 focus:ring-brand-3"
              />
              <button type="button" aria-label={show ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShow((v) => !v)} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted">
                {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
              </button>
            </span>
          </label>
          <button
            type="submit"
            disabled={login.isPending}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-[15px] font-semibold text-white transition-colors hover:bg-brand-2 disabled:opacity-60"
          >
            {login.isPending ? <Loader2 className="size-5 animate-spin" /> : <ShieldCheck className="size-5" />}
            Entrar
          </button>
        </motion.form>
      </section>
    </div>
  );
}
