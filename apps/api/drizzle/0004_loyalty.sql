CREATE TYPE "public"."coin_entry_status" AS ENUM('pending', 'settled', 'void');--> statement-breakpoint
CREATE TYPE "public"."coin_entry_type" AS ENUM('earn', 'bonus', 'redeem', 'refund', 'adjust', 'reversal');--> statement-breakpoint
CREATE TYPE "public"."redemption_status" AS ENUM('available', 'applied', 'used', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."reward_type" AS ENUM('discount_fixed', 'discount_percent', 'free_delivery', 'product', 'gift');--> statement-breakpoint
CREATE TABLE "coin_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "coin_entry_type" NOT NULL,
	"status" "coin_entry_status" DEFAULT 'settled' NOT NULL,
	"coins" integer NOT NULL,
	"order_id" uuid,
	"redemption_id" uuid,
	"note" text,
	"seen_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"reward_id" uuid,
	"code" text NOT NULL,
	"coins" integer NOT NULL,
	"status" "redemption_status" DEFAULT 'available' NOT NULL,
	"snapshot" jsonb NOT NULL,
	"order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"type" "reward_type" NOT NULL,
	"cost_coins" integer NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"max_discount_cents" integer,
	"product_id" uuid,
	"image_url" text,
	"min_order_cents" integer DEFAULT 0 NOT NULL,
	"stock" integer,
	"max_per_customer" integer,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"redeemed_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "via_reward" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "coins_earned" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "redemption_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "reward_discount_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "coin_entries" ADD CONSTRAINT "coin_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_entries" ADD CONSTRAINT "coin_entries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_entries" ADD CONSTRAINT "coin_entries_redemption_id_redemptions_id_fk" FOREIGN KEY ("redemption_id") REFERENCES "public"."redemptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_reward_id_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."rewards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coin_entries_user_idx" ON "coin_entries" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "coin_entries_order_idx" ON "coin_entries" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "redemptions_code_idx" ON "redemptions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "redemptions_user_idx" ON "redemptions" USING btree ("user_id","status");