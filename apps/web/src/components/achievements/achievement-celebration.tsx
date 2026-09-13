"use client";

import type { MyAchievements } from "@aionix/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trophy, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { AchievementFocus } from "./achievement-focus";
import { AchievementRewards } from "./achievement-detail";
import { Medal } from "./medal";
import styles from "./achievements.module.css";
import { Button } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { useAchievements } from "@/lib/achievements";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { sfx } from "@/lib/sound";
import { haptic } from "@/lib/toast";

/** An invitation first: celebrations never take focus away from checkout. */
export function AchievementCelebration() {
  const { user } = useSession();
  const query = useAchievements();
  const qc = useQueryClient();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => { setOpen(false); setHidden([]); }, [user?.id]);
  const award = user ? query.data?.celebrations.find(a => !hidden.includes(a.id)) : undefined;
  const remaining = query.data?.celebrations.filter(a => !hidden.includes(a.id)).length ?? 0;
  const acknowledge = useMutation({
    mutationFn: (id: string) => api("/me/achievements/acknowledge", { method: "POST", body: { ids: [id] } }),
    onSuccess: (_, id) => {
      qc.setQueryData<MyAchievements>(["achievements", user?.id], old => old ? { ...old, celebrations: old.celebrations.filter(a => a.id !== id) } : old);
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["loyalty"] });
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
  const host = typeof document !== "undefined" ? document.getElementById("app") : null;
  // Browsing screens only: never over a footer CTA (cart, checkout, product, order detail) or sign-in.
  const browsing = pathname === "/" || pathname === "/pedidos" || ["/conta", "/conquistas", "/moedas", "/buscar", "/ofertas", "/clube", "/categoria"].some(path => pathname.startsWith(path));
  if (!host || !award || !browsing) return null;
  return createPortal(<>
    {!open && <aside className={styles.notice} aria-label="Nova conquista">
      <button type="button" onClick={() => { acknowledge.reset(); setOpen(true); haptic([10, 40, 10, 40, 30]); sfx.success(); }}><Trophy size={28} className="shrink-0 text-club-gold-2" /><span><strong>{remaining > 1 ? `${remaining} novas conquistas!` : "Você conquistou uma medalha!"}</strong><small>{award.snapshot.title} · Toque para celebrar</small></span></button>
      <button type="button" aria-label="Ver em outro momento" className={styles.noticeClose} onClick={() => setHidden(query.data?.celebrations.map(a => a.id) ?? [])}><X size={18} /></button>
    </aside>}
    <Sheet open={open} onClose={() => setOpen(false)} title="Conquista desbloqueada">
      <AchievementFocus><div className={`${styles.detail} ${styles.celebration}`}>
        <div className={styles.burst} aria-hidden="true">{Array.from({length: 20}, (_,i) => <i key={i} style={{ "--i": i } as CSSProperties} />)}</div>
        <Medal icon={award.snapshot.icon} color={award.snapshot.color} large />
        <h3>{award.snapshot.title}</h3>
        <p>{award.snapshot.description}</p>
        <AchievementRewards achievement={award.snapshot} />
        <p className={styles.note}>Uma nova medalha na sua coleção. {award.snapshot.bonusCoins > 0 ? "Seu bônus já está na carteira." : "Seu XP já foi somado ao seu nível."}</p>
        {acknowledge.isError && <p role="alert" className="mt-4 text-sm text-sale">{acknowledge.error.message} Sua conquista está salva. Tente novamente.</p>}
        <Button block className="mt-6" loading={acknowledge.isPending} onClick={() => acknowledge.mutate(award.id)}>Guardar na minha coleção</Button>
      </div></AchievementFocus>
    </Sheet>
  </>, host);
}
