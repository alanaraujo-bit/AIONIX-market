import { formatBRL } from "@aionix/shared";
import { cn } from "../ui/primitives";

/** Price with de-emphasized cents, e.g. R$ 12,90 → "R$ 12" + ",90". */
export function Price({
  cents,
  compareAt,
  size = "md",
  className,
}: {
  cents: number;
  compareAt?: number | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const [whole, frac] = formatBRL(cents).replace("R$ ", "").split(",");
  const onSale = !!compareAt && compareAt > cents;
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-1.5", className)}>
      <span
        className={cn(
          "tabular font-display font-bold tracking-[-0.02em]",
          onSale ? "text-sale" : "text-ink",
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
