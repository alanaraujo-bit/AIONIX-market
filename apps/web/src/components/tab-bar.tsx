"use client";

import { Home, Receipt, Search, ShoppingBag, UserRound } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cartCount, useCart, useHydrated } from "@/lib/cart";
import { cn } from "./ui/primitives";

const TABS = [
  { href: "/", label: "Início", icon: Home },
  { href: "/buscar", label: "Buscar", icon: Search },
  { href: "/carrinho", label: "Carrinho", icon: ShoppingBag },
  { href: "/pedidos", label: "Pedidos", icon: Receipt },
  { href: "/conta", label: "Conta", icon: UserRound },
] as const;

export function TabBar() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const count = useCart((s) => cartCount(s.items));

  return (
    <nav className="pb-safe relative z-30 shrink-0 border-t border-line/80 bg-card/92 backdrop-blur-xl">
      <ul className="flex h-[62px] items-stretch px-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                replace
                aria-current={active ? "page" : undefined}
                className="relative flex h-full flex-col items-center justify-center gap-[3px]"
              >
                <motion.span whileTap={{ scale: 0.86 }} className="relative grid h-8 w-14 place-items-center">
                  {active && (
                    <motion.span
                      layoutId="tab-pill"
                      className="absolute inset-0 rounded-full bg-brand-soft"
                      transition={{ type: "spring", stiffness: 500, damping: 36 }}
                    />
                  )}
                  <Icon
                    className={cn("relative size-[21px] transition-colors", active ? "text-brand" : "text-muted")}
                    strokeWidth={active ? 2.4 : 2}
                  />
                  {href === "/carrinho" && hydrated && count > 0 && (
                    <motion.span
                      key={count}
                      initial={{ scale: 0.4 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 600, damping: 14 }}
                      className="tabular absolute -top-1 right-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-sale px-1 text-[10.5px] font-bold text-white ring-2 ring-card"
                    >
                      {count > 99 ? "99+" : count}
                    </motion.span>
                  )}
                </motion.span>
                <span
                  className={cn(
                    "text-[10.5px] font-semibold tracking-[0.01em] transition-colors",
                    active ? "text-brand" : "text-muted",
                  )}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
