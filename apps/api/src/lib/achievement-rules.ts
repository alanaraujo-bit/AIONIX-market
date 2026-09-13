import type { AchievementInput, AchievementMetric, AchievementSummary } from "@aionix/shared";

export type AchievementFacts = Record<AchievementMetric, number>;
export function achievementProgress(rule: AchievementInput["rule"], facts: AchievementFacts) {
  const current = Math.max(0, Number.isFinite(facts[rule.metric]) ? facts[rule.metric] : 0);
  return { current, target: rule.target, percent: Math.min(100, Math.floor(current / rule.target * 100)), complete: current >= rule.target };
}
export function achievementLevel(xp: number): Pick<AchievementSummary, "xp" | "level" | "levelName" | "nextLevelXp" | "levelProgress"> {
  const levels = [{ xp: 0, name: "Semente" }, { xp: 100, name: "Explorador" }, { xp: 350, name: "Descobridor" }, { xp: 800, name: "Especialista" }, { xp: 1600, name: "Referência" }, { xp: 3000, name: "Lenda da casa" }];
  let index = 0;
  while (index + 1 < levels.length && xp >= levels[index + 1]!.xp) index++;
  const current = levels[index]!;
  const next = levels[index + 1];
  return { xp, level: index + 1, levelName: current.name, nextLevelXp: next?.xp ?? null, levelProgress: next ? Math.min(100, Math.floor((xp - current.xp) / (next.xp - current.xp) * 100)) : 100 };
}

const seeds: [string, string, string, AchievementMetric, number, AchievementInput["category"], AchievementInput["icon"]][] = [
  ["primeiro-capitulo", "Primeiro capítulo", "Receba sua primeira compra e comece uma história com a gente.", "orders_count", 1, "first_steps", "sparkles"],
  ["oi-pessoalmente", "Oi, pessoalmente!", "Faça uma compra pelo aplicativo e retire na loja.", "pickup_count", 1, "first_steps", "heart"],
  ["encontro-marcado", "Encontro marcado", "Retire 5 compras na loja e crie novos encontros.", "pickup_count", 5, "shopping", "basket"],
  ["da-tela-para-a-loja", "Da tela para a loja", "Complete 15 compras com retirada na loja, no seu ritmo.", "pickup_count", 15, "consistency", "trophy"],
  ["trio-da-casa", "Trio da casa", "Complete 3 compras entregues. Cada visita tem seu sabor.", "orders_count", 3, "shopping", "basket"],
  ["mesa-para-cinco", "Mesa para cinco", "Chegue a 5 compras entregues, no seu próprio ritmo.", "orders_count", 5, "shopping", "heart"],
  ["dez-boas-escolhas", "Dez boas escolhas", "Complete 10 compras entregues e celebre sua trajetória.", "orders_count", 10, "shopping", "star"],
  ["vizinho-de-carteirinha", "Vizinho de carteirinha", "Complete 25 compras entregues e faça parte da história da casa.", "orders_count", 25, "shopping", "trophy"],
  ["lenda-do-carrinho", "Lenda do carrinho", "Alcance 50 compras entregues. Uma coleção de bons encontros.", "orders_count", 50, "shopping", "crown"],
  ["carrinho-caprichado", "Carrinho caprichado", "Receba uma compra de R$ 100 ou mais, quando fizer sentido para você.", "single_spend", 10000, "shopping", "basket"],
  ["mesa-aberta", "Mesa aberta", "Receba uma compra de R$ 200 ou mais para seus planos do dia.", "single_spend", 20000, "shopping", "heart"],
  ["despensa-preparada", "Despensa preparada", "Receba uma compra de R$ 350 ou mais. Sem pressa: só o que você precisa.", "single_spend", 35000, "shopping", "star"],
  ["historia-de-quinhentos", "Uma história de 500", "Some R$ 500 em compras entregues ao longo da sua jornada.", "total_spend", 50000, "shopping", "rocket"],
  ["mil-encontros", "Mil motivos à mesa", "Some R$ 1.000 em compras entregues, sem prazo para chegar lá.", "total_spend", 100000, "shopping", "trophy"],
  ["despensa-de-memorias", "Despensa de memórias", "Some R$ 3.000 em compras entregues ao longo do tempo.", "total_spend", 300000, "shopping", "crown"],
  ["primeiras-descobertas", "Primeiras descobertas", "Experimente 3 produtos diferentes em compras entregues.", "distinct_products", 3, "exploration", "compass"],
  ["cardapio-aberto", "Cardápio aberto", "Leve 10 produtos diferentes em suas compras entregues.", "distinct_products", 10, "exploration", "leaf"],
  ["colecionador-de-sabores", "Colecionador de sabores", "Descubra 25 produtos diferentes em compras entregues.", "distinct_products", 25, "exploration", "compass"],
  ["atlas-da-despensa", "Atlas da despensa", "Descubra 50 produtos diferentes, um novo favorito de cada vez.", "distinct_products", 50, "exploration", "crown"],
  ["alem-da-lista", "Além da lista", "Explore 2 categorias de produtos em compras entregues.", "distinct_categories", 2, "exploration", "leaf"],
  ["passeio-pelos-corredores", "Passeio pelos corredores", "Explore 4 categorias em compras entregues.", "distinct_categories", 4, "exploration", "compass"],
  ["primeiro-presente", "Meu primeiro presente", "Resgate seu primeiro prêmio com moedas do clube.", "redemptions_count", 1, "first_steps", "gift"],
  ["bons-mimos", "Bons mimos", "Resgate 3 prêmios. Pequenas alegrias também fazem história.", "redemptions_count", 3, "loyalty", "gift"],
  ["colecao-de-alegrias", "Coleção de alegrias", "Resgate 10 prêmios ao longo da sua jornada.", "redemptions_count", 10, "loyalty", "trophy"],
  ["primeiras-moedas", "Primeiras moedas", "Acumule 10 moedas confirmadas por compras.", "coins_earned", 10, "first_steps", "coins"],
  ["cofrinho-crescendo", "Cofrinho crescendo", "Ganhe 100 moedas confirmadas por compras; gastar não apaga seu progresso.", "coins_earned", 100, "loyalty", "coins"],
  ["tesouro-da-casa", "Tesouro da casa", "Ganhe 500 moedas confirmadas por compras ao longo do tempo.", "coins_earned", 500, "loyalty", "crown"],
  ["dias-de-encontro", "Dias de encontro", "Tenha compras entregues feitas em 3 dias diferentes.", "shopping_days", 3, "consistency", "calendar"],
  ["dez-dias-de-historia", "Dez dias de história", "Tenha compras entregues feitas em 10 dias diferentes, sem sequência obrigatória.", "shopping_days", 10, "consistency", "calendar"],
  ["calendario-de-sabores", "Calendário de sabores", "Tenha compras entregues feitas em 30 dias diferentes. Cada dia conta.", "shopping_days", 30, "consistency", "star"],
  ["bom-te-ver-de-novo", "Bom te ver de novo", "Compre em 2 meses diferentes e receba seus pedidos. Não precisam ser seguidos.", "shopping_months", 2, "consistency", "heart"],
  ["quatro-estacoes", "Quatro estações", "Tenha compras entregues feitas em 4 meses diferentes, no seu ritmo.", "shopping_months", 4, "consistency", "leaf"],
  ["um-ano-de-historias", "Um ano de histórias", "Tenha compras entregues feitas em 12 meses diferentes. Sem perder progresso.", "shopping_months", 12, "consistency", "crown"],
  ["prazer-em-conhecer", "Prazer em conhecer", "Complete seu nome, telefone e um endereço no perfil.", "profile_complete", 1, "first_steps", "heart"],
];
export const defaultAchievements: AchievementInput[] = seeds.map(([slug, title, description, metric, target, category, icon], index) => {
  const difficulty = icon === "crown" ? "legendary" : icon === "trophy" || target >= 25 && !metric.includes("spend") ? "hard" : category === "first_steps" || target <= 3 ? "easy" : "medium";
  return { slug, title, description, rule: { metric, target }, category, icon, difficulty, color: category === "exploration" ? "emerald" : category === "consistency" ? "sky" : category === "loyalty" ? "violet" : category === "first_steps" ? "rose" : "amber", xp: difficulty === "legendary" ? 300 : difficulty === "hard" ? 150 : difficulty === "medium" ? 75 : 25, bonusCoins: 0, active: true, sortOrder: index };
});
