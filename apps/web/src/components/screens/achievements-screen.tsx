"use client";

import type { AchievementProgress } from "@aionix/shared";
import { Check, Search, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AchievementDetail, categoryLabels, difficultyLabels, progressLabel } from "@/components/achievements/achievement-detail";
import { Medal } from "@/components/achievements/medal";
import { AchievementFocus } from "@/components/achievements/achievement-focus";
import styles from "@/components/achievements/achievements.module.css";
import { Button, Skeleton } from "@/components/ui/primitives";
import { Screen, TopBar } from "@/components/ui/screen";
import { Sheet } from "@/components/ui/sheet";
import { useAchievements } from "@/lib/achievements";
import { useSession } from "@/lib/session";

export function AchievementsScreen() {
  const { user, loading } = useSession();
  const query = useAchievements();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AchievementProgress | null>(null);
  const data = query.data;
  const next = data?.achievements.filter(a => !a.unlocked).sort((a,b) => b.percent - a.percent || a.sortOrder - b.sortOrder)[0];
  const visible = data?.achievements.filter(a => (filter === "all" || filter === "earned" && a.unlocked || filter === "progress" && !a.unlocked || a.category === filter) && `${a.title} ${a.description}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))) ?? [];

  return <Screen header={<TopBar title="Minhas conquistas" back backFallback="/conta" />}>
    {!loading && !user ? <div className={styles.guest}>
      <Medal icon="compass" color="emerald" large />
      <h2>Pequenos passos.<br />Uma coleção só sua.</h2>
      <p>Da primeira compra às descobertas de todo mês: transforme sua história no AIONIX em conquistas. No seu ritmo.</p>
      <Link href="/entrar?next=/conquistas&mode=cadastro" className="flex h-12 items-center justify-center rounded-2xl bg-brand font-semibold text-white">Começar minha coleção</Link>
      <Link href="/entrar?next=/conquistas" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand">Já tenho conta</Link>
    </div> : <div className={styles.journey}>
      <div className={styles.intro}><h2>Cada conquista tem uma história.</h2><p>A primeira cesta, uma nova descoberta, aquele prêmio tão esperado. A próxima história é sua.</p></div>
      {(loading || query.isPending) && <div role="status" aria-label="Carregando suas conquistas"><Skeleton className="mb-6 h-20 w-full" /><Skeleton className="h-36 w-full" /></div>}
      {query.isError && <div className={styles.empty} role="alert"><p>Não conseguimos carregar sua coleção.</p><p>{query.error.message}</p><Button className="mt-4" onClick={() => void query.refetch()}>Tentar novamente</Button></div>}
      {data && <>
        <section className={styles.level} aria-label="Seu nível">
          <span className={styles.levelMark}>{data.summary.level}</span>
          <div className={styles.levelBody}>
            <div className={styles.levelLine}><strong>{data.summary.levelName}</strong><span>{data.summary.xp.toLocaleString("pt-BR")} XP</span></div>
            <progress aria-label="Progresso para o próximo nível" className={styles.progress} max={100} value={data.summary.levelProgress} />
            <p className={styles.levelHint}>{data.summary.nextLevelXp ? `Faltam ${(data.summary.nextLevelXp - data.summary.xp).toLocaleString("pt-BR")} XP para o próximo nível` : "Você chegou ao nível mais alto. Sua coleção continua."}</p>
          </div>
        </section>
        {next && <section><div className={styles.sectionTitle}><h2>Seu próximo passo</h2></div><button type="button" className={styles.next} onClick={() => setSelected(next)}>
          <Medal icon={next.icon} color={next.color} />
          <div className={styles.nextBody}><h3>{next.title}</h3><p>{next.description}</p><progress className={styles.progress} aria-label={`Progresso de ${next.title}`} value={next.percent} max={100} /><small>{progressLabel(next)} · +{next.xp} XP</small></div>
        </button></section>}
        <section aria-label="Coleção de medalhas">
          <div className={styles.sectionTitle}><h2>Sua coleção</h2><span>{data.summary.unlocked} de {data.summary.total} conquistadas</span></div>
          <div className={styles.filters} aria-label="Filtrar conquistas">
            {[["all", "Todas"], ["progress", "A conquistar"], ["earned", "Conquistadas"], ...Object.entries(categoryLabels)].map(([key,label]) => <button key={key} type="button" className={styles.filter} aria-pressed={filter === key} onClick={() => setFilter(key!)}>{label}</button>)}
          </div>
          <label className={styles.search}><Search size={17} /><input type="search" aria-label="Buscar conquista" placeholder="Encontre uma conquista" value={search} onChange={e => setSearch(e.target.value)} /></label>
          {visible.length ? <div className={styles.collection}>
            {visible.map(a => <button key={a.id} type="button" className={styles.achievement} onClick={() => setSelected(a)} aria-label={`${a.title}, ${a.unlocked ? "conquistada" : progressLabel(a)}`}>
              <Medal icon={a.icon} color={a.color} unlocked={a.unlocked} />
              <h3>{a.title}</h3><span className={styles.difficulty}>{difficultyLabels[a.difficulty]} · {a.xp} XP</span>
              {a.unlocked ? <span className={styles.earned}><Check size={13} /> Conquistada</span> : <><progress className={styles.progress} aria-label={`Progresso de ${a.title}`} value={a.percent} max={100} /><small>{progressLabel(a)}</small></>}
            </button>)}
          </div> : <div className={styles.empty}><Trophy className="mx-auto mb-3" size={28} /><p>{search ? "Nenhuma conquista com esse nome." : filter === "earned" ? "Toda coleção começa com um primeiro passo. Sua primeira medalha está esperando." : "Nenhuma conquista por aqui ainda."}</p>{filter !== "all" && <Button variant="ghost" className="mt-3" onClick={() => { setFilter("all"); setSearch(""); }}>Ver todas as conquistas</Button>}</div>}
        </section>
        <p className="mt-7 text-center text-xs leading-relaxed text-ink-2">Sua coleção é pessoal. Escolha o que faz sentido para você, sem pressa para completar.</p>
      </>}
    </div>}
    <Sheet open={!!selected} onClose={() => setSelected(null)} title="Detalhes da conquista">{selected && <AchievementFocus><AchievementDetail achievement={selected} onClose={() => setSelected(null)} /></AchievementFocus>}</Sheet>
  </Screen>;
}
