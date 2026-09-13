ALTER TABLE "order_items" ADD COLUMN "via_club" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "club_price_cents" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "club_member" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "club_joined_at" timestamp with time zone;