"use client";

import { AnimatePresence, motion, useDragControls } from "motion/react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

/** Draggable bottom sheet rendered inside the app frame. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const controls = useDragControls();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const host = typeof document !== "undefined" ? document.getElementById("app") : null;
  if (!host) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="absolute inset-0 z-[60] flex flex-col justify-end">
          <motion.div
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative flex max-h-[88%] flex-col rounded-t-[28px] bg-canvas shadow-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%", transition: { type: "tween", ease: [0.4, 0, 1, 1], duration: 0.22 } }}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            drag="y"
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose();
            }}
          >
            <div
              className="flex shrink-0 cursor-grab touch-none flex-col items-center pt-2.5 pb-1 active:cursor-grabbing"
              onPointerDown={(e) => controls.start(e)}
            >
              <span className="h-1.5 w-10 rounded-full bg-line" />
              {title && (
                <h2 className="mt-3 w-full px-6 text-left font-display text-[20px] font-bold tracking-[-0.025em]">
                  {title}
                </h2>
              )}
            </div>
            <div className="scroll-y min-h-0 flex-1 px-5 pt-2 pb-4">{children}</div>
            {footer && <div className="pb-safe shrink-0 border-t border-line bg-canvas px-5 pt-3 pb-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    host,
  );
}
