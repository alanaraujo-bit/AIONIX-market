import type { Address, Banner, Category, Order, Paginated, Product, PublicUser } from "@aionix/shared";

export interface StoreInfo {
  pickupEnabled: boolean;
  pickupAddress: string;
  name: string;
  open: boolean;
  etaMinutes: number;
  deliveryFeeCents: number;
  freeDeliveryThresholdCents: number;
  minimumOrderCents: number;
}

export interface HomeData {
  store: StoreInfo;
  banners: Banner[];
  categories: Category[];
  featured: Product[];
  deals: Product[];
  bestSellers: Product[];
  club: Product[];
}

export interface ProductDetail {
  product: Product;
  category: { id: string; name: string; slug: string } | null;
  related: Product[];
}

export type ProductPage = Paginated<Product>;

export interface OrderListItem extends Order {
  previews: { imageUrl: string | null; name: string }[];
}

export interface MeData {
  user: PublicUser;
  stats: { orders: number; spentCents: number; savedCents: number; clubSavedCents: number; coinBalance: number; coinPending: number };
}

export type { Address, Banner, Category, Order, Product };
