import type { CoinEntryStatus, CoinEntryType, OrderStatus, PaymentMethod, RedemptionStatus, RewardType } from "./orders";

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
  /** True for the free unit granted by a "product" reward. */
  viaReward: boolean;
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
  /** Loyalty: voucher applied to this quote (null when none / invalid). */
  reward: AppliedReward | null;
  /** Money taken off by the voucher (discount or free product value). */
  rewardDiscountCents: number;
  /** Why the requested voucher could not be applied (shown to the shopper). */
  rewardError: string | null;
  /** Coins this order will earn (0 when the program is off or below the minimum). */
  coinsToEarn: number;
}

export interface AppliedReward {
  redemptionId: string;
  rewardId: string | null;
  name: string;
  type: RewardType;
  /** Human summary, e.g. "R$ 10,00 de desconto" / "Frete grátis". */
  label: string;
  freeDelivery: boolean;
  productId: string | null;
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
  viaReward: boolean;
}

export interface OrderEvent {
  id: string;
  status: OrderStatus;
  note: string | null;
  createdAt: string;
}

export interface Order {
  fulfillmentMethod: "delivery" | "pickup";
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
  /** Loyalty: coins this order earns, and whether they are already credited. */
  coinsEarned: number;
  coinsStatus: CoinEntryStatus | null;
  rewardDiscountCents: number;
  reward: { redemptionId: string; name: string; type: RewardType; label: string; code: string } | null;
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

// ---- Loyalty (coins) --------------------------------------------------------
export interface Reward {
  id: string;
  name: string;
  description: string;
  type: RewardType;
  costCoins: number;
  value: number;
  maxDiscountCents: number | null;
  productId: string | null;
  product: { id: string; name: string; imageUrl: string | null; priceCents: number } | null;
  imageUrl: string | null;
  minOrderCents: number;
  stock: number | null;
  maxPerCustomer: number | null;
  active: boolean;
  sortOrder: number;
  /** Human summary of what the shopper gets. */
  label: string;
}

/** Public program description (no per-user data; safe to cache). */
export interface LoyaltyProgram {
  enabled: boolean;
  coinName: string;
  coinNamePlural: string;
  coinEmoji: string;
  earnCoins: number;
  earnPerCents: number;
  minOrderCents: number;
  awardOn: "created" | "confirmed" | "delivered";
  clubBonusPercent: number;
  signupBonusCoins: number;
  firstOrderBonusCoins: number;
  tagline: string;
  rewards: Reward[];
}

export interface CoinEntry {
  id: string;
  type: CoinEntryType;
  status: CoinEntryStatus;
  coins: number;
  note: string | null;
  orderId: string | null;
  orderNumber: number | null;
  rewardName: string | null;
  createdAt: string;
  settledAt: string | null;
}

export interface Redemption {
  id: string;
  code: string;
  status: RedemptionStatus;
  coins: number;
  reward: { id: string | null; name: string; type: RewardType; label: string; imageUrl: string | null; description: string; minOrderCents: number; productId: string | null };
  orderId: string | null;
  orderNumber: number | null;
  createdAt: string;
  usedAt: string | null;
}

export interface Wallet {
  balance: number;
  pending: number;
  /** Lifetime coins credited (for the "you've earned X so far" line). */
  earnedTotal: number;
  /** Credits the shopper hasn't been shown yet (drives the celebration). */
  unseen: { id: string; coins: number; type: CoinEntryType; orderNumber: number | null; fulfillmentMethod: "delivery" | "pickup" | null; note: string | null }[];
  vouchers: Redemption[];
  history: CoinEntry[];
  /** Cheapest active reward the shopper can't afford yet, for the progress bar. */
  nextReward: { id: string; name: string; costCoins: number; missing: number } | null;
}
