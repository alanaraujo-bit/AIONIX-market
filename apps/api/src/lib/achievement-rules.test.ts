import { describe, expect, it } from "vitest";
import { achievementInputSchema, achievementMetrics } from "@aionix/shared";
import { achievementLevel, achievementProgress, defaultAchievements, type AchievementFacts } from "./achievement-rules";

const facts = Object.fromEntries(achievementMetrics.map(metric => [metric, 0])) as AchievementFacts;
describe("achievement rules", () => {
  it("ships a varied valid catalog with unique stable slugs and no unbudgeted coin rewards", () => {
    expect(defaultAchievements.length).toBeGreaterThanOrEqual(30);
    expect(new Set(defaultAchievements.map(item => item.slug)).size).toBe(defaultAchievements.length);
    expect(new Set(defaultAchievements.map(item => item.rule.metric)).size).toBe(11);
    for (const definition of defaultAchievements) {
      expect(achievementInputSchema.safeParse(definition).success, definition.slug).toBe(true);
      expect(definition.bonusCoins).toBe(0);
    }
  });
  it("requires exact monetary threshold and caps visual progress", () => {
    expect(achievementProgress({ metric: "single_spend", target: 10000 }, { ...facts, single_spend: 9999 }).complete).toBe(false);
    expect(achievementProgress({ metric: "single_spend", target: 10000 }, { ...facts, single_spend: 10000 }).complete).toBe(true);
    expect(achievementProgress({ metric: "orders_count", target: 3 }, { ...facts, orders_count: 8 })).toEqual({ current: 8, target: 3, percent: 100, complete: true });
  });
  it("isolates metrics and rejects malformed facts", () => {
    expect(achievementProgress({ metric: "pickup_count", target: 1 }, { ...facts, orders_count: 25 }).complete).toBe(false);
    expect(achievementProgress({ metric: "orders_count", target: 3 }, { ...facts, orders_count: NaN }).current).toBe(0);
    expect(achievementProgress({ metric: "orders_count", target: 3 }, { ...facts, orders_count: -5 }).current).toBe(0);
  });
  it("rejects unbounded rewards, unknown rules, impossible profiles and client supplied fields", () => {
    const base = defaultAchievements[0]!;
    for (const input of [{ ...base, bonusCoins: 100001 }, { ...base, xp: -1 }, { ...base, rule: { metric: "fake", target: 1 } }, { ...base, rule: { metric: "profile_complete", target: 2 } }, { ...base, id: "injected" }, { ...base, rule: { metric: "orders_count", target: 0 } }]) expect(achievementInputSchema.safeParse(input).success).toBe(false);
  });
  it("advances levels at exact boundaries and has a finite maximum", () => {
    expect(achievementLevel(0)).toEqual({ xp: 0, level: 1, levelName: "Semente", nextLevelXp: 100, levelProgress: 0 });
    expect(achievementLevel(99).level).toBe(1);
    expect(achievementLevel(100).level).toBe(2);
    expect(achievementLevel(350).level).toBe(3);
    expect(achievementLevel(3000)).toEqual({ xp: 3000, level: 6, levelName: "Lenda da casa", nextLevelXp: null, levelProgress: 100 });
    expect(achievementLevel(100000).levelProgress).toBe(100);
  });
});
