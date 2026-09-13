"use client";

import { ChevronLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn, Pressable } from "./primitives";

const ScrolledContext = createContext(false);

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Fixed-height screen: header and footer stay put, only the body scrolls.
 * Scroll position is restored per route, like a native navigation stack.
 */
export function Screen({
  header,
  footer,
  children,
  className,
  restoreScroll = true,
}: {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  restoreScroll?: boolean;
}) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const key = `scroll:${pathname}`;

  useIsoLayoutEffect(() => {
    if (!restoreScroll || !ref.current) return;
    const saved = Number(sessionStorage.getItem(key) || 0);
    if (saved) ref.current.scrollTop = saved;
  }, [key, restoreScroll]);

  const frame = useRef(0);
  const onScroll = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const top = ref.current?.scrollTop ?? 0;
      setScrolled(top > 4);
      if (restoreScroll) sessionStorage.setItem(key, String(Math.round(top)));
    });
  }, [key, restoreScroll]);

  return (
    <ScrolledContext.Provider value={scrolled}>
      <div className="flex h-full min-h-0 flex-1 flex-col">
        {header}
        <div ref={ref} onScroll={onScroll} className={cn("scroll-y relative min-h-0 flex-1", className)}>
          {children}
        </div>
        {footer}
      </div>
    </ScrolledContext.Provider>
  );
}

export const useScreenScrolled = () => useContext(ScrolledContext);

export function BackButton({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();
  return (
    <Pressable
      aria-label="Voltar"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      className="grid size-10 place-items-center rounded-full bg-card text-ink shadow-card ring-1 ring-line/70"
    >
      <ChevronLeft className="size-5 -translate-x-px" strokeWidth={2.4} />
    </Pressable>
  );
}

export function TopBar({
  title,
  subtitle,
  back,
  backFallback,
  right,
  className,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  back?: boolean;
  backFallback?: string;
  right?: React.ReactNode;
  className?: string;
}) {
  const scrolled = useScreenScrolled();
  return (
    <header className={cn("pt-safe relative z-20 shrink-0 bg-canvas/90 backdrop-blur-xl", className)}>
      <div className="flex h-[60px] items-center gap-2 px-4">
        <div className="flex w-10 shrink-0 justify-start">{back && <BackButton fallback={backFallback} />}</div>
        <div className="min-w-0 flex-1 text-center">
          {title && <h1 className="truncate font-display text-[17px] font-bold tracking-[-0.02em]">{title}</h1>}
          {subtitle && <p className="truncate text-[12px] font-medium text-muted">{subtitle}</p>}
        </div>
        <div className="flex min-w-10 shrink-0 justify-end">{right}</div>
      </div>
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 h-px bg-line transition-opacity duration-300",
          scrolled ? "opacity-100" : "opacity-0",
        )}
      />
    </header>
  );
}

/** Large, left-aligned title used on tab root screens. */
export function LargeTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const scrolled = useScreenScrolled();
  return (
    <header className="pt-safe relative z-20 shrink-0 bg-canvas/90 backdrop-blur-xl">
      <div className="flex items-end justify-between gap-3 px-5 pt-3 pb-3">
        <div className="min-w-0">
          <h1 className="font-display text-[30px] leading-[1.05] font-extrabold tracking-[-0.035em]">{title}</h1>
          {subtitle && <p className="mt-1 text-[13.5px] font-medium text-muted">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 h-px bg-line transition-opacity duration-300",
          scrolled ? "opacity-100" : "opacity-0",
        )}
      />
    </header>
  );
}
