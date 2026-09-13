"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Search, X } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CartBar } from "@/components/cart-bar";
import { InfiniteProductGrid, SortChips } from "@/components/product/product-list";
import { Skeleton } from "@/components/ui/primitives";
import { Screen } from "@/components/ui/screen";
import { api } from "@/lib/api";
import type { Category } from "@/lib/types";

const SUGGESTIONS = ["Café", "Leite", "Arroz", "Chocolate", "Banana", "Azeite", "Sorvete", "Pão"];
const RECENT_KEY = "aionix-recent-searches";

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function SearchScreen({
  initialQuery,
  autoFocus,
  initialCategories,
}: {
  initialQuery: string;
  autoFocus: boolean;
  initialCategories: Category[] | null;
}) {
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const cats = useQuery({
    queryKey: ["catalog", "categories"],
    queryFn: () => api<{ items: Category[] }>("/categories"),
    initialData: initialCategories ? { items: initialCategories } : undefined,
    staleTime: 60_000,
  });

  useEffect(() => {
    setRecent(readRecent());
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 250);
  }, [autoFocus]);

  // Debounced search as the user types.
  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 280);
    return () => clearTimeout(t);
  }, [input]);

  // Keep the URL shareable without triggering navigation.
  useEffect(() => {
    const url = query ? `/buscar?q=${encodeURIComponent(query)}` : "/buscar";
    window.history.replaceState(window.history.state, "", url);
  }, [query]);

  const commit = (term: string) => {
    const t = term.trim();
    if (t.length < 2) return;
    const next = [t, ...readRecent().filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    setRecent(next);
  };

  const pick = (term: string) => {
    setInput(term);
    setQuery(term);
    commit(term);
    inputRef.current?.blur();
  };

  const header = (
    <header className="pt-safe relative z-20 shrink-0 bg-canvas">
      <div className="px-5 pt-3">
        <h1 className="font-display text-[30px] leading-[1.05] font-extrabold tracking-[-0.035em]">Buscar</h1>
      </div>
      <form
        className="px-5 pt-3 pb-3"
        onSubmit={(e) => {
          e.preventDefault();
          commit(input);
          inputRef.current?.blur();
        }}
      >
        <label className="flex h-12 items-center gap-3 rounded-2xl bg-card px-4 shadow-card ring-1 ring-line/70 focus-within:ring-2 focus-within:ring-brand-3">
          <Search className="size-[18px] shrink-0 text-muted" strokeWidth={2.4} />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            enterKeyHint="search"
            inputMode="search"
            type="search"
            autoComplete="off"
            placeholder="O que você procura?"
            className="h-full min-w-0 flex-1 bg-transparent font-medium outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
          />
          {input && (
            <button type="button" aria-label="Limpar" onClick={() => pick("")} className="grid size-7 place-items-center rounded-full bg-line-2 text-ink-2">
              <X className="size-4" />
            </button>
          )}
        </label>
      </form>
      {query && <SortChips value={sort} onChange={setSort} />}
    </header>
  );

  return (
    <>
      <Screen header={header} restoreScroll={false}>
        <div className="pt-2 pb-28">
          {query ? (
            <InfiniteProductGrid query={{ q: query, sort }} emptyTitle={`Nada encontrado para “${query}”`} />
          ) : (
            <div className="space-y-7">
              <section className="px-5">
                <h2 className="mb-3 text-[13px] font-bold tracking-[0.04em] text-muted uppercase">
                  {recent.length ? "Buscas recentes" : "Sugestões"}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {(recent.length ? recent : SUGGESTIONS).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => pick(s)}
                      className="h-9 rounded-full bg-card px-4 text-[13.5px] font-semibold text-ink-2 ring-1 ring-line active:scale-95 transition-transform"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </section>

              <section className="px-4">
                <h2 className="mb-3 px-1 text-[13px] font-bold tracking-[0.04em] text-muted uppercase">Categorias</h2>
                <div className="grid grid-cols-2 gap-3">
                  {cats.isPending
                    ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-[22px]" />)
                    : cats.data?.items.map((c, i) => (
                        <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.025 }}>
                          <Link
                            href={`/categoria/${c.slug}`}
                            className="grain relative flex h-[92px] flex-col justify-between overflow-hidden rounded-[22px] p-3.5 active:scale-[0.97] transition-transform"
                            style={{ background: c.color }}
                          >
                            <span className="relative z-10 max-w-[70%] text-[14.5px] leading-tight font-bold tracking-[-0.01em] text-ink">{c.name}</span>
                            <span className="relative z-10 flex items-center text-[11.5px] font-semibold text-ink/55">
                              {c.productCount} itens <ChevronRight className="size-3.5" />
                            </span>
                            <span className="absolute -right-2 -bottom-3 text-[54px] leading-none drop-shadow-[0_6px_8px_rgb(0_0_0/0.12)]">{c.icon}</span>
                          </Link>
                        </motion.div>
                      ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </Screen>
      <CartBar className="bottom-3" />
    </>
  );
}
