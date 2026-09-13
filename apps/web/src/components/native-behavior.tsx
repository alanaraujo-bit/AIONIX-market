"use client";

import { useEffect } from "react";

/**
 * Enforces native-app mechanics the viewport meta alone can't guarantee
 * (iOS Safari ignores user-scalable=no): blocks pinch, double-tap and
 * ctrl+wheel zoom, long-press menus, and registers the service worker.
 */
export function NativeBehavior() {
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    let lastTouchEnd = 0;
    const onTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd < 300 && !(e.target as HTMLElement)?.closest("input,textarea")) e.preventDefault();
      lastTouchEnd = now;
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "0"].includes(e.key)) e.preventDefault();
    };
    const onContextMenu = (e: MouseEvent) => {
      if (!(e.target as HTMLElement)?.closest("input,textarea,.selectable")) e.preventDefault();
    };

    document.addEventListener("gesturestart", prevent, { passive: false });
    document.addEventListener("gesturechange", prevent, { passive: false });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: false });
    document.addEventListener("dblclick", prevent, { passive: false });
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    document.addEventListener("contextmenu", onContextMenu);

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }

    return () => {
      document.removeEventListener("gesturestart", prevent);
      document.removeEventListener("gesturechange", prevent);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("dblclick", prevent);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("contextmenu", onContextMenu);
    };
  }, []);
  return null;
}
