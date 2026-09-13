"use client";

import type { Achievement, AchievementProgress } from "@aionix/shared";
import { formatBRL } from "@aionix/shared";
import { Coins, Star } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/primitives";
import { Medal } from "./medal";
import styles from "./achievements.module.css";

export const categoryLabels = { first_steps: "Primeiros passos", shopping: "Na sua cesta", exploration: "Descobertas", loyalty: "Clube e prêmios", consistency: "Com o tempo" };
export const difficultyLabels = { easy: "Fácil", medium: "Intermediária", hard: "Desafiadora", legendary: "Lendária" };

export function progressLabel(a: Pick<AchievementProgress, "rule" | "current" | "target">) {
  return ["single_spend", "total_spend"].includes(a.rule.metric)
    ? `${formatBRL(a.current)} de ${formatBRL(a.target)}`
    : `${a.current.toLocaleString("pt-BR")} de ${a.target.toLocaleString("pt-BR")}`;
}

export function AchievementRewards({ achievement }: { achievement: Achievement }) {
  return <div className={styles.rewards}>
    <span><Star size={15} /> {achievement.xp} XP</span>
    {achievement.bonusCoins > 0 && <span><Coins size={15} /> +{achievement.bonusCoins.toLocaleString("pt-BR")} moedas</span>}
  </div>;
}

export function AchievementDetail({ achievement: a, onClose }: { achievement: AchievementProgress; onClose: () => void }) {
  const destination = a.rule.metric === "profile_complete" ? "/conta" : a.rule.metric === "redemptions_count" ? "/moedas" : "/";
  const action = a.rule.metric === "profile_complete" ? "Completar meu perfil" : a.rule.metric === "redemptions_count" ? "Conhecer os prêmios" : "Explorar o mercado";
  return <div className={styles.detail}>
    <Medal icon={a.icon} color={a.color} unlocked={a.unlocked} large />
    <h3>{a.title}</h3>
    <p>{a.description}</p>
    <div className={styles.difficulty}>{categoryLabels[a.category]} · {difficultyLabels[a.difficulty]}</div>
    <AchievementRewards achievement={a} />
    {a.unlocked ? <p>Conquistada em {new Date(a.unlockedAt!).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}. Essa medalha já faz parte da sua história.</p> : <div className={styles.detailProgress}>
      <div className={styles.levelLine}><strong>Seu progresso</strong><span>{progressLabel(a)}</span></div>
      <progress aria-label={`Progresso de ${a.title}`} className={styles.progress} max={100} value={a.percent} />
    </div>}
    <p className={styles.note}>XP faz seu nível crescer. {a.bonusCoins ? "As moedas entram automaticamente na sua carteira ao concluir." : "Esta conquista oferece uma medalha e XP, sem bônus em moedas."}</p>
    {!a.unlocked && <p className={styles.note}>Compras contam depois da entrega ou retirada concluída. Pedidos cancelados não contam. Vá no seu ritmo.</p>}
    <div className="mt-6">{a.unlocked ? <Button block onClick={onClose}>Voltar à coleção</Button> : <Link href={destination} onClick={onClose} className="flex h-12 items-center justify-center rounded-2xl bg-brand font-semibold text-white">{action}</Link>}</div>
  </div>;
}
