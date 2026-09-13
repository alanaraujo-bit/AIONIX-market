import { z } from "zod";

export const achievementMetrics = ["orders_count", "single_spend", "total_spend", "distinct_products", "distinct_categories", "redemptions_count", "coins_earned", "shopping_days", "shopping_months", "profile_complete", "pickup_count"] as const;
export type AchievementMetric = typeof achievementMetrics[number];
export const achievementInputSchema = z.object({
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().min(10).max(350),
  icon: z.enum(["sparkles", "basket", "trophy", "heart", "leaf", "gift", "crown", "star", "compass", "calendar", "coins", "rocket"]),
  color: z.enum(["amber", "emerald", "sky", "rose", "violet"]),
  category: z.enum(["first_steps", "shopping", "exploration", "loyalty", "consistency"]),
  difficulty: z.enum(["easy", "medium", "hard", "legendary"]),
  rule: z.object({ metric: z.enum(achievementMetrics), target: z.number().int().min(1).max(100_000_000), minOrderCents: z.number().int().min(0).max(100_000_000).optional(), productId: z.string().uuid().optional(), categoryId: z.string().uuid().optional(), paymentMethod: z.enum(["pix", "card_on_delivery", "cash"]).optional() }).strict(),
  xp: z.number().int().min(0).max(10_000),
  bonusCoins: z.number().int().min(0).max(100_000),
  active: z.boolean(),
  sortOrder: z.number().int().min(0).max(100_000),
}).strict().superRefine((value, ctx) => {
  if (value.rule.metric === "profile_complete" && value.rule.target !== 1) ctx.addIssue({ code: "custom", path: ["rule", "target"], message: "Perfil completo usa meta 1." });
  if (["profile_complete", "redemptions_count"].includes(value.rule.metric) && [value.rule.minOrderCents, value.rule.productId, value.rule.categoryId, value.rule.paymentMethod].some(field => field !== undefined)) ctx.addIssue({ code: "custom", path: ["rule"], message: "Filtros de compra só podem ser usados em conquistas de compras." });
});
export type AchievementInput = z.infer<typeof achievementInputSchema>;
export interface Achievement extends AchievementInput { id: string }
export interface AchievementAward { id: string; achievementId: string; snapshot: Achievement; awardedAt: string; seenAt: string | null }
export interface AchievementProgress extends Achievement { current: number; target: number; percent: number; unlocked: boolean; unlockedAt: string | null; awardId: string | null }
export interface AchievementSummary { xp: number; level: number; levelName: string; nextLevelXp: number | null; levelProgress: number; unlocked: number; total: number }
export interface MyAchievements { achievements: AchievementProgress[]; summary: AchievementSummary; celebrations: AchievementAward[]; capabilities: { pickup: boolean } }
export interface AdminAchievements { achievements: (Achievement & { recipientsCount: number })[]; stats: { total: number; active: number; awards: number; participants: number; bonusCoins: number } }
export interface AchievementRecipient { id: string; userId: string; name: string; email: string; awardedAt: string; snapshot: Achievement }
export interface AchievementRecipients { items: AchievementRecipient[]; total: number; page: number; pageSize: number }
