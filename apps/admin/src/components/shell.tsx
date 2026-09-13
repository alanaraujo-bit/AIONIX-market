"use client";

import { Boxes, Coins, ChevronRight, ImageIcon, LayoutDashboard, Leaf, LogOut, Megaphone, Menu, Package, Receipt, Settings, Tags, Users, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, useSession } from "@/lib/session";
import { useAdminRealtime } from "@/lib/realtime";
import { useActiveOrderCount } from "@/lib/queries";
import { Button, cn } from "./ui";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pedidos", label: "Pedidos", icon: Receipt, badge: true },
  { href: "/produtos", label: "Produtos", icon: Package },
  { href: "/categorias", label: "Categorias", icon: Boxes },
  { href: "/promocoes", label: "Promoções", icon: Tags },
  { href: "/banners", label: "Banners", icon: Megaphone },
  { href: "/midia", label: "Mídia", icon: ImageIcon },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/conquistas", label: "Conquistas", icon: Tags },
  { href: "/fidelidade", label: "Fidelidade", icon: Coins },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = useActiveOrderCount();
  return (
    <nav className="flex-1 space-y-0.5 px-3">
      {NAV.map(({ href, label, icon: Icon, badge }) => {
        const isActive = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-[13.5px] font-semibold transition-colors",
              isActive ? "text-white" : "text-white/60 hover:bg-white/5 hover:text-white",
            )}
          >
            {isActive && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-white/10" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            <Icon className={cn("relative size-[18px]", isActive ? "text-brand-3" : "")} strokeWidth={2.2} />
            <span className="relative flex-1">{label}</span>
            {badge && active > 0 && (
              <span className="tabular relative rounded-full bg-citrus px-1.5 text-[11px] font-bold text-ink">{active}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useSession();
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  useAdminRealtime(!!user);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);
  useEffect(() => setMobileOpen(false), [pathname]);

  if (loading || !user) {
    return (
      <div className="grid h-dvh place-items-center">
        <span className="size-8 animate-spin rounded-full border-[3px] border-line border-t-brand" />
      </div>
    );
  }

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col py-5">
      <div className="mb-6 flex items-center gap-3 px-6">
        <span className="grid size-9 place-items-center rounded-xl bg-brand-3/20 text-brand-3">
          <Leaf className="size-5" strokeWidth={2.4} />
        </span>
        <div>
          <p className="font-display text-[15px] leading-tight font-bold text-white">AIONIX Market</p>
          <p className="text-[11.5px] font-medium text-white/45">Painel operacional</p>
        </div>
      </div>
      <NavList onNavigate={onNavigate} />
      <div className="mt-4 border-t border-white/10 px-3 pt-4">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand text-[12px] font-bold text-white">{user.name.slice(0, 2).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-white">{user.name}</p>
            <p className="truncate text-[11.5px] text-white/45">{user.email}</p>
          </div>
          <button type="button" aria-label="Sair" onClick={() => logout.mutate(undefined, { onSuccess: () => router.replace("/login") })} className="grid size-8 place-items-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className="hidden w-[248px] shrink-0 bg-sidebar lg:block">{sidebar()}</aside>
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div className="absolute inset-0 bg-ink/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: "spring", stiffness: 420, damping: 40 }} className="absolute inset-y-0 left-0 w-[264px] bg-sidebar">
              <button type="button" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} className="absolute top-4 right-3 grid size-9 place-items-center rounded-lg text-white/60">
                <X className="size-5" />
              </button>
              {sidebar(() => setMobileOpen(false))}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-card/80 px-4 backdrop-blur lg:hidden">
          <Button variant="ghost" size="icon" aria-label="Menu" onClick={() => setMobileOpen(true)}>
            <Menu className="size-5" />
          </Button>
          <span className="font-display text-[15px] font-bold">AIONIX Admin</span>
        </header>
        <main className="scroll-y min-h-0 flex-1">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <div className="mb-3 flex items-center gap-1.5 text-[12.5px] font-medium text-muted">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {it.href ? <Link href={it.href} className="hover:text-ink">{it.label}</Link> : <span className="text-ink-2">{it.label}</span>}
          {i < items.length - 1 && <ChevronRight className="size-3.5" />}
        </span>
      ))}
    </div>
  );
}
