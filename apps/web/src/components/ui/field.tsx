"use client";

import { forwardRef, useId } from "react";
import { cn } from "./primitives";

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  trailing?: React.ReactNode;
};

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, trailing, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className={cn(
          "group relative flex h-[58px] items-end rounded-2xl bg-card px-4 pb-2 ring-1 transition-[box-shadow] duration-200 focus-within:ring-2",
          error ? "ring-sale/60 focus-within:ring-sale" : "ring-line focus-within:ring-brand-3",
        )}
      >
        <span className="pointer-events-none absolute top-2 left-4 text-[11.5px] font-semibold tracking-[0.01em] text-muted">
          {label}
        </span>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          className="h-7 w-full min-w-0 bg-transparent text-[16px] font-medium text-ink outline-none placeholder:text-faint"
          {...props}
        />
        {trailing && <span className="mb-0.5 ml-2 shrink-0">{trailing}</span>}
      </label>
      {(error || hint) && (
        <p className={cn("mt-1.5 px-1 text-[12.5px] font-medium", error ? "text-sale" : "text-muted")}>{error ?? hint}</p>
      )}
    </div>
  );
});

export function fieldErrors(details?: { path: string; message: string }[]) {
  const out: Record<string, string> = {};
  for (const d of details ?? []) if (!out[d.path]) out[d.path] = d.message;
  return out;
}
