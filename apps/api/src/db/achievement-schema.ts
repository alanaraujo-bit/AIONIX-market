import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { Achievement, AchievementInput } from "@aionix/shared";
import { users } from "./schema";

export const achievements = pgTable("achievements", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  definition: jsonb("definition").$type<AchievementInput>().notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("achievements_slug_idx").on(t.slug)]);
export const achievementAwards = pgTable("achievement_awards", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  achievementId: uuid("achievement_id").notNull().references(() => achievements.id, { onDelete: "restrict" }),
  snapshot: jsonb("snapshot").$type<Achievement>().notNull(),
  awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
  seenAt: timestamp("seen_at", { withTimezone: true }),
}, (t) => [uniqueIndex("achievement_awards_user_achievement_idx").on(t.userId, t.achievementId), index("achievement_awards_achievement_idx").on(t.achievementId)]);
