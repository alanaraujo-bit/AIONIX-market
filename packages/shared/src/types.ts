import type { OrderStatus, PaymentMethod } from "./orders";

export type Role = "customer" | "admin";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  /** Club membership unlocks the members-only price on products that have one. */
  clubMember: boolean;
  clubJoinedAt: string | null;
  createdAt: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string;
  color: string;
  imageUrl: string | null;
  sortOrder: number;
  active: boolean;
  productCount?: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  brand: string | null;
  categoryId: string;
  categorySlug?: string;
  priceCents: number;
  /** Final price after the best active promotion (equals priceCents when none). */
  finalPriceCents: number;
  /** Reference "de" price to show struck through, if any. */
  compareAtCents: number | null;
  discountPercent: number;
  promotionId: string | null;
  promotionName: string | null;
  /**
   * Members-only price (public data — shown to everyone as the reason to join).
   * Null when the product has no club price or it isn't lower than finalPriceCents.
   * Catalog responses are cached and user-agnostic: whether it applies is decided
   * client-side from the session, and server-side only in quote/checkout.
   */
  clubPriceCents: number | null;
  unit: string;
  unitLabel: string;
  stock: number;
  sku: string | null;
  imageUrl: string | null;
  blurDataUrl: string | null;
  active: boolean;
  featured: boolean;
  tags: string[];
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  imageUrl: string | null;
  theme: "forest" | "citrus" | "berry" | "ocean" | "night";
  promotionId: string | null;
  categoryId: string | null;
  categorySlug: string | null;
}

export interface Address {
  id: string;
  label: string;
  recipient: string;
  zip: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  reference: string | null;
  isDefault: boolean;
}

export interface QuoteLine {
  productId: string;
  name: string;
  imageUrl: string | null;
  unitLabel: string;
  quantity: number;
  unitPriceCents: number;
  originalUnitPriceCents: number;
  totalCents: number;
  available: boolean;
  stock: number;
  /** Members-only unit price, when the product has one. */
  clubPriceCents: number | null;
  /** True when unitPriceCents is the club price (caller is a member). */
  viaClub: boolean;
}

export interface Quote {
  lines: QuoteLine[];
  subtotalCents: number;
  /** Total savings vs list price (promotions + club). */
  discountCents: number;
  /** Portion of discountCents that came from club prices. */
  clubDiscountCents: number;
  /** For non-members: how much the same cart would save with club prices. */
  clubPotentialCents: number;
  clubMember: boolean;
  deliveryFeeCents: number;
  totalCents: number;
  freeDeliveryThresholdCents: number;
  minimumOrderCents: number;
  itemCount: number;
}

export interface OrderItem {
  id: string;
  productId: string | null;
  name: string;
  imageUrl: string | null;
  unitLabel: string;
  unitPriceCents: number;
  quantity: number;
  totalCents: number;
  viaClub: boolean;
}

export interface OrderEvent {
  id: string;
  status: OrderStatus;
  note: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  number: number;
  status: OrderStatus;
  subtotalCents: number;
  discountCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  paymentMethod: PaymentMethod;
  changeForCents: number | null;
  deliverySlot: string;
  notes: string | null;
  address: Omit<Address, "id" | "isDefault">;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
  events?: OrderEvent[];
  customer?: { id: string; name: string; email: string; phone: string | null };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
