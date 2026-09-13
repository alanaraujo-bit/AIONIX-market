"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Keep keyboard navigation within the collection's sheet and restore its trigger. */
export function AchievementFocus({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const selectors = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex="0"]';
    root.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const elements = Array.from(root.querySelectorAll<HTMLElement>(selectors));
      const first = elements[0], last = elements.at(-1);
      if (!first || !last) { e.preventDefault(); return; }
      if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === root)) { e.preventDefault(); first.focus(); }
    };
    root.addEventListener("keydown", trap);
    return () => { root.removeEventListener("keydown", trap); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div ref={ref} tabIndex={-1} className="outline-none">{children}</div>;
}
