ALTER TABLE "users" ALTER COLUMN "club_member" SET DEFAULT true;--> statement-breakpoint
-- Club rule: every registered customer who buys through the app is a member.
UPDATE "users" SET "club_member" = true, "club_joined_at" = coalesce("club_joined_at", "created_at") WHERE "role" = 'customer';
