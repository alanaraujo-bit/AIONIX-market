"use client";

import { useId } from "react";
import { cn } from "@/components/ui/primitives";

/**
 * The coin itself: embossed amber disc with a sparkle mark. Pure SVG so it
 * scales crisply from 14px pills to the 96px wallet hero, and takes a
 * `spin` prop for the slow 3D turn used on hero surfaces.
 */
export function Coin({ size = 24, spin = false, className, style }: { size?: number; spin?: boolean; className?: string; style?: React.CSSProperties }) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden
      className={cn("shrink-0 drop-shadow-[0_2px_3px_rgb(120_70_0/0.35)]", spin && "animate-coin-spin", className)}
      style={{ ...style, transformStyle: "preserve-3d", backfaceVisibility: "visible" }}
    >
      <defs>
        <radialGradient id={`${id}-face`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffe9a8" />
          <stop offset="45%" stopColor="#f5b03a" />
          <stop offset="100%" stopColor="#d07e0a" />
        </radialGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff0c2" />
          <stop offset="50%" stopColor="#e08f14" />
          <stop offset="100%" stopColor="#8a5205" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="60%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="31" fill={`url(#${id}-rim)`} />
      <circle cx="32" cy="32" r="26.5" fill={`url(#${id}-face)`} />
      <circle cx="32" cy="32" r="21.5" fill="none" stroke="#b86f06" strokeOpacity="0.55" strokeWidth="1.6" strokeDasharray="2.2 2.6" />
      {/* Sparkle emblem */}
      <path
        d="M32 17c1.1 6.7 4.3 9.9 11 11-6.7 1.1-9.9 4.3-11 11-1.1-6.7-4.3-9.9-11-11 6.7-1.1 9.9-4.3 11-11z"
        fill="#8a5205"
        fillOpacity="0.28"
        transform="translate(0.8 1.4)"
      />
      <path d="M32 17c1.1 6.7 4.3 9.9 11 11-6.7 1.1-9.9 4.3-11 11-1.1-6.7-4.3-9.9-11-11 6.7-1.1 9.9-4.3 11-11z" fill="#fff3cf" />
      <ellipse cx="24" cy="20" rx="10" ry="6" fill={`url(#${id}-shine)`} transform="rotate(-30 24 20)" />
    </svg>
  );
}

/** Small inline coin + amount, for prices, rails and list rows. */
export function CoinAmount({ coins, size = 15, className, signed = false }: { coins: number; size?: number; className?: string; signed?: boolean }) {
  const prefix = signed ? (coins > 0 ? "+" : coins < 0 ? "−" : "") : "";
  return (
    <span className={cn("inline-flex items-center gap-1 tabular font-bold", className)}>
      <Coin size={size} />
      {prefix}
      {Math.abs(coins).toLocaleString("pt-BR")}
    </span>
  );
}
