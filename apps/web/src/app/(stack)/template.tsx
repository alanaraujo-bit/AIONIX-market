"use client";

import { motion } from "motion/react";

/** Pushed screens slide in from the trailing edge like a native stack. */
export default function StackTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="flex min-h-0 flex-1 flex-col bg-canvas"
      initial={{ opacity: 0, x: 36 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 38, mass: 0.8 }}
    >
      {children}
    </motion.div>
  );
}
