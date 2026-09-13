import { formatBRL } from "@aionix/shared";
import { Crown } from "lucide-react";
import { cn } from "../ui/primitives";

/** Price with de-emphasized cents, e.g. R$ 12,90 → "R$ 12" + ",90". */
export function Price({
  cents,
  compareAt,
  size = "md",
  tone,
  className,
}: {
  cents: number;
  compareAt?: number | null;
  size?: "sm" | "md" | "lg" | "xl";
  /** "club" paints the price in the club plum instead of sale red. */
  tone?: "auto" | "club";
  className?: string;
}) {
  const [whole, frac] = formatBRL(cents).replace("R$ ", "").split(",");
  const onSale = !!compareAt && compareAt > cents;
  const club = tone === "club";
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-1.5", className)}>
      <span
        className={cn(
          "tabular font-display font-bold tracking-[-0.02em]",
          club ? "text-club" : onSale ? "text-sale" : "text-ink",
          { "text-[15px]": size === "sm", "text-[17px]": size === "md", "text-[24px]": size === "lg", "text-[32px]": size === "xl" },
        )}
      >
        <span className={cn("mr-0.5 font-semibold", size === "xl" ? "text-[18px]" : size === "lg" ? "text-[14px]" : "text-[11px]")}>R$</span>
        {whole}
        <span className={size === "xl" ? "text-[20px]" : size === "lg" ? "text-[16px]" : "text-[0.72em]"}>,{frac}</span>
      </span>
      {onSale && (
        <span className={cn("tabular text-faint line-through", size === "xl" || size === "lg" ? "text-[14px]" : "text-[11.5px]")}>
          {formatBRL(compareAt!)}
        </span>
      )}
    </div>
  );
}

/** Small "Clube R$ X" pill: the members-only price advertised to non-members. */
export function ClubOffer({ cents, size = "sm", className }: { cents: number; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-club-soft font-bold whitespace-nowrap text-club",
        size === "sm" ? "px-1.5 py-[3px] text-[11px] leading-none" : "px-2.5 py-1 text-[13px]",
        className,
      )}
    >
      <Crown className={cn("shrink-0 text-club-gold", size === "sm" ? "size-3" : "size-3.5")} strokeWidth={2.8} fill="currentColor" />
      <span className="font-semibold opacity-70">Clube</span>
      <span className="tabular">{formatBRL(cents)}</span>
    </span>
  );
}

/** Gold crown badge marking a product bought at the club price. */
export function ClubBadge({ label = "Clube", className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-club px-2 py-0.5 text-[11px] leading-[18px] font-bold text-white shadow-[0_4px_12px_-4px_rgb(74_45_143/0.7)]",
        className,
      )}
    >
      <Crown className="size-3 text-club-gold-2" strokeWidth={2.8} fill="currentColor" />
      {label}
    </span>
  );
}
