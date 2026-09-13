"use client";

import { formatOrderNumber } from "@aionix/shared";
import { useEffect, useRef } from "react";
import { useWallet } from "@/lib/loyalty";
import { unlockAudio } from "@/lib/sound";
import { useCoinCelebration } from "./coin-celebration";

/**
 * Glue between the wallet and the celebration: credits the shopper hasn't
 * been shown yet (order delivered while the app was closed, realtime credit,
 * admin bonus) trigger the coin shower exactly once. Also unlocks WebAudio on
 * the first gesture so feedback sounds can play later.
 */
export function CoinBridge() {
  const wallet = useWallet();
  const shown = useRef(new Set<string>());

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    const unseen = wallet.data?.unseen.filter((u) => !shown.current.has(u.id)) ?? [];
    if (!unseen.length) return;
    for (const u of unseen) shown.current.add(u.id);
    const coins = unseen.reduce((s, u) => s + u.coins, 0);
    const first = unseen[0]!;
    const orders = unseen.filter((u) => u.orderNumber != null);
    const title =
      first.type === "bonus" && unseen.length === 1
        ? (first.note ?? "Bônus recebido!")
        : first.type === "adjust" && unseen.length === 1
          ? "A loja te presenteou!"
          : orders.length === 1
            ? `Pedido ${formatOrderNumber(orders[0]!.orderNumber!)} entregue!`
            : "Você ganhou!";
    const subtitle =
      first.type === "adjust" && first.note ? first.note : orders.length > 1 ? `${orders.length} pedidos entregues.` : orders.length === 1 ? "Obrigado por comprar pelo app." : undefined;
    useCoinCelebration.getState().show({ coins, title, subtitle, entryIds: unseen.map((u) => u.id), balance: wallet.data?.balance ?? null });
  }, [wallet.data]);

  return null;
}
