"use client";

import { ShoppingBasket } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { cn } from "../ui/primitives";

export function ProductImage({
  src,
  blur,
  alt,
  sizes = "(max-width: 480px) 45vw, 220px",
  priority,
  className,
  padded = true,
}: {
  src: string | null;
  blur?: string | null;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  padded?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={cn("grid size-full place-items-center text-faint", className)}>
        <ShoppingBasket className="size-1/3" strokeWidth={1.5} />
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      draggable={false}
      placeholder={blur ? "blur" : "empty"}
      blurDataURL={blur ?? undefined}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      className={cn(
        "object-contain mix-blend-multiply transition-[opacity,transform] duration-500 ease-out",
        padded && "p-[10%]",
        loaded ? "scale-100 opacity-100" : "scale-[0.97] opacity-90",
        className,
      )}
    />
  );
}
