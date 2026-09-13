"use client";

import type { Banner } from "@aionix/shared";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn, Skeleton } from "./ui/primitives";

const THEMES: Record<Banner["theme"], { bg: string; text: string; cta: string; orb: string }> = {
  forest: { bg: "linear-gradient(135deg,#0b4f37 0%,#13784f 55%,#1f9a67 100%)", text: "text-white", cta: "bg-white text-brand", orb: "#2fbf83" },
  citrus: { bg: "linear-gradient(135deg,#f2b233 0%,#f6c65a 60%,#fbe09a 100%)", text: "text-ink", cta: "bg-ink text-white", orb: "#fff3c9" },
  berry: { bg: "linear-gradient(135deg,#6f1633 0%,#a82c4f 60%,#d2566f 100%)", text: "text-white", cta: "bg-white text-[#8c2142]", orb: "#f08aa0" },
  ocean: { bg: "linear-gradient(135deg,#0a3f5f 0%,#11678f 60%,#2a93be 100%)", text: "text-white", cta: "bg-white text-[#0f5a80]", orb: "#6cc6e8" },
  night: { bg: "linear-gradient(135deg,#0f1a14 0%,#22302a 60%,#34423a 100%)", text: "text-white", cta: "bg-citrus text-ink", orb: "#f2b233" },
};

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const paused = useRef(false);

  const go = useCallback((i: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => {
      if (paused.current || document.hidden) return;
      go((index + 1) % banners.length);
    }, 5200);
    return () => clearInterval(t);
  }, [index, banners.length, go]);

  const open = (b: Banner) => {
    void fetch(`/api/banners/${b.id}/click`, { method: "POST" }).catch(() => {});
    router.push(b.categorySlug ? `/categoria/${b.categorySlug}` : "/ofertas");
  };

  if (!banners.length) return null;

  return (
    <div className="relative">
      <div
        ref={ref}
        className="scroll-x flex snap-x snap-mandatory"
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          if (i !== index) setIndex(i);
        }}
        onPointerDown={() => (paused.current = true)}
        onPointerUp={() => setTimeout(() => (paused.current = false), 2500)}
      >
        {banners.map((b, i) => {
          const t = THEMES[b.theme] ?? THEMES.forest;
          return (
            <div key={b.id} className="w-full shrink-0 snap-center px-5">
              <button
                type="button"
                onClick={() => open(b)}
                className={cn(
                  "grain relative flex h-[168px] w-full overflow-hidden rounded-[26px] text-left active:scale-[0.99] transition-transform",
                  t.text,
                )}
                style={{ background: t.bg }}
              >
                <span
                  aria-hidden
                  className="absolute -right-10 -bottom-16 size-56 rounded-full opacity-30 blur-[2px]"
                  style={{ background: t.orb }}
                />
                <span aria-hidden className="absolute top-6 -right-6 size-24 rounded-full border-[14px] border-white/10" />
                {b.imageUrl && (
                  <span className="absolute inset-y-0 right-0 w-[46%]">
                    <Image
                      src={b.imageUrl}
                      alt=""
                      fill
                      sizes="220px"
                      priority={i === 0}
                      className="object-contain object-right-bottom p-3 drop-shadow-[0_18px_20px_rgb(0_0_0/0.25)]"
                    />
                  </span>
                )}
                <span className="relative z-10 flex h-full max-w-[62%] flex-col justify-between p-5">
                  <span>
                    <span className="block font-display text-[23px] leading-[1.05] font-extrabold tracking-[-0.03em]">
                      {b.title}
                    </span>
                    {b.subtitle && <span className="mt-1.5 block text-[13px] leading-snug font-medium opacity-85">{b.subtitle}</span>}
                  </span>
                  <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-bold", t.cta)}>
                    {b.ctaLabel}
                    <ArrowRight className="size-3.5" strokeWidth={2.6} />
                  </span>
                </span>
              </button>
            </div>
          );
        })}
      </div>
      {banners.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              aria-label={`Banner ${i + 1}`}
              onClick={() => go(i)}
              className={cn("h-1.5 rounded-full transition-all duration-300", i === index ? "w-5 bg-brand" : "w-1.5 bg-line")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function BannerSkeleton() {
  return (
    <div className="px-5">
      <Skeleton className="h-[168px] w-full rounded-[26px]" />
    </div>
  );
}
