import { z } from "zod";
import { ORDER_STATUSES, PAYMENT_METHODS } from "./orders";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(80),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  phone: z.string().trim().regex(/^\D*(\d\D*){10,11}$/, "Telefone inválido").optional().or(z.literal("")),
  password: z.string().min(8, "A senha precisa de ao menos 8 caracteres").max(128),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: z.string().min(1, "Informe sua senha"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^\D*(\d\D*){10,11}$/, "Telefone inválido").optional().or(z.literal("")),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const addressSchema = z.object({
  label: z.string().trim().min(1).max(30).default("Casa"),
  recipient: z.string().trim().min(2, "Informe quem vai receber").max(80),
  zip: z.string().trim().regex(/^\d{5}-?\d{3}$/, "CEP inválido"),
  street: z.string().trim().min(2, "Informe a rua").max(120),
  number: z.string().trim().min(1, "Informe o número").max(10),
  complement: z.string().trim().max(60).optional().or(z.literal("")),
  district: z.string().trim().min(2, "Informe o bairro").max(60),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().length(2, "UF inválida").toUpperCase(),
  reference: z.string().trim().max(120).optional().or(z.literal("")),
  isDefault: z.boolean().optional(),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const cartLineSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
});
export type CartLine = z.infer<typeof cartLineSchema>;

export const quoteSchema = z.object({
  items: z.array(cartLineSchema).max(200),
});

export const checkoutSchema = z.object({
  items: z.array(cartLineSchema).min(1, "Carrinho vazio").max(200),
  addressId: z.string().uuid(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  changeForCents: z.number().int().min(0).optional(),
  deliverySlot: z.string().max(40),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const productUnitSchema = z.enum(["un", "kg", "g", "l", "ml", "pct", "cx"]);

export const productInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).default(""),
  brand: z.string().trim().max(60).optional().or(z.literal("")),
  categoryId: z.string().uuid(),
  priceCents: z.number().int().min(1),
  compareAtCents: z.number().int().min(0).nullable().optional(),
  unit: productUnitSchema.default("un"),
  unitLabel: z.string().trim().max(30).default(""),
  stock: z.number().int().min(0).default(0),
  sku: z.string().trim().max(40).optional().or(z.literal("")),
  imageUrl: z.string().url().nullable().optional(),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
});
export type ProductInput = z.infer<typeof productInputSchema>;

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2).max(60),
  icon: z.string().trim().max(8).default("🛒"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#E8F5E9"),
  imageUrl: z.string().url().nullable().optional(),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const promotionInputSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(300).default(""),
    discountType: z.enum(["percent", "fixed"]),
    discountValue: z.number().int().min(1),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    active: z.boolean().default(true),
    productIds: z.array(z.string().uuid()).default([]),
    categoryIds: z.array(z.string().uuid()).default([]),
  })
  .refine((p) => p.endsAt > p.startsAt, { message: "O término deve ser após o início", path: ["endsAt"] })
  .refine((p) => p.discountType !== "percent" || p.discountValue <= 90, {
    message: "Desconto percentual máximo é 90%",
    path: ["discountValue"],
  });
export type PromotionInput = z.infer<typeof promotionInputSchema>;

export const bannerInputSchema = z.object({
  title: z.string().trim().min(2).max(60),
  subtitle: z.string().trim().max(120).default(""),
  ctaLabel: z.string().trim().max(24).default("Ver ofertas"),
  imageUrl: z.string().url().nullable().optional(),
  theme: z.enum(["forest", "citrus", "berry", "ocean", "night"]).default("forest"),
  promotionId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
});
export type BannerInput = z.infer<typeof bannerInputSchema>;

export const orderStatusUpdateSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(200).optional(),
});

export const settingsSchema = z.object({
  storeName: z.string().trim().min(2).max(60),
  deliveryFeeCents: z.number().int().min(0),
  freeDeliveryThresholdCents: z.number().int().min(0),
  minimumOrderCents: z.number().int().min(0),
  storeOpen: z.boolean(),
  etaMinutes: z.number().int().min(10).max(600),
});
export type StoreSettings = z.infer<typeof settingsSchema>;
