import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const roleEnum = pgEnum("role", ["customer", "admin"]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "picking",
  "out_for_delivery",
  "delivered",
  "cancelled",
]);
export const paymentMethodEnum = pgEnum("payment_method", ["pix", "card_on_delivery", "cash"]);
export const discountTypeEnum = pgEnum("discount_type", ["percent", "fixed"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull().default("customer"),
    clubMember: boolean("club_member").notNull().default(false),
    clubJoinedAt: timestamp("club_joined_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sessions_token_idx").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull().default("Casa"),
    recipient: text("recipient").notNull(),
    zip: text("zip").notNull(),
    street: text("street").notNull(),
    number: text("number").notNull(),
    complement: text("complement"),
    district: text("district").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    reference: text("reference"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("addresses_user_idx").on(t.userId)],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    icon: text("icon").notNull().default("🛒"),
    color: text("color").notNull().default("#E8F5E9"),
    imageUrl: text("image_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("categories_slug_idx").on(t.slug)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    brand: text("brand"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    priceCents: integer("price_cents").notNull(),
    compareAtCents: integer("compare_at_cents"),
    /** Members-only price; only takes effect when below priceCents. */
    clubPriceCents: integer("club_price_cents"),
    unit: text("unit").notNull().default("un"),
    unitLabel: text("unit_label").notNull().default(""),
    stock: integer("stock").notNull().default(0),
    sku: text("sku"),
    imageUrl: text("image_url"),
    blurDataUrl: text("blur_data_url"),
    active: boolean("active").notNull().default(true),
    featured: boolean("featured").notNull().default(false),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    soldCount: integer("sold_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("products_slug_idx").on(t.slug),
    index("products_category_idx").on(t.categoryId),
    index("products_active_idx").on(t.active),
  ],
);

export const promotions = pgTable("promotions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  discountType: discountTypeEnum("discount_type").notNull(),
  discountValue: integer("discount_value").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const promotionProducts = pgTable(
  "promotion_products",
  {
    promotionId: uuid("promotion_id")
      .notNull()
      .references(() => promotions.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.promotionId, t.productId] })],
);

export const promotionCategories = pgTable(
  "promotion_categories",
  {
    promotionId: uuid("promotion_id")
      .notNull()
      .references(() => promotions.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.promotionId, t.categoryId] })],
);

export const banners = pgTable("banners", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  ctaLabel: text("cta_label").notNull().default("Ver ofertas"),
  imageUrl: text("image_url"),
  theme: text("theme").notNull().default("forest"),
  promotionId: uuid("promotion_id").references(() => promotions.id, { onDelete: "set null" }),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  createdAt: createdAt(),
});

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: serial("number").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: orderStatusEnum("status").notNull().default("pending"),
    subtotalCents: integer("subtotal_cents").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    deliveryFeeCents: integer("delivery_fee_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    changeForCents: integer("change_for_cents"),
    deliverySlot: text("delivery_slot").notNull(),
    notes: text("notes"),
    address: jsonb("address").notNull(),
    itemCount: integer("item_count").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("orders_number_idx").on(t.number),
    index("orders_user_idx").on(t.userId),
    index("orders_status_idx").on(t.status),
    index("orders_created_idx").on(t.createdAt),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    promotionId: uuid("promotion_id").references(() => promotions.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    imageUrl: text("image_url"),
    unitLabel: text("unit_label").notNull().default(""),
    unitPriceCents: integer("unit_price_cents").notNull(),
    originalUnitPriceCents: integer("original_unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    totalCents: integer("total_cents").notNull(),
    /** True when the unit price came from the club price rather than a promotion. */
    viaClub: boolean("via_club").notNull().default(false),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), index("order_items_promo_idx").on(t.promotionId)],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: orderStatusEnum("status").notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull(),
  url: text("url").notNull(),
  mime: text("mime").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  blurDataUrl: text("blur_data_url"),
  createdAt: createdAt(),
});

/** Binary storage fallback so uploads work even without an object bucket. */
export const mediaBlobs = pgTable("media_blobs", {
  key: text("key").primaryKey(),
  data: text("data").notNull(),
  mime: text("mime").notNull(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});
