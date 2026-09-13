import type { Address, Order, OrderEvent, OrderItem, PublicUser } from "@aionix/shared";
import type { schema } from "../db/client";

type UserRow = typeof schema.users.$inferSelect;
type AddressRow = typeof schema.addresses.$inferSelect;
type OrderRow = typeof schema.orders.$inferSelect;
type OrderItemRow = typeof schema.orderItems.$inferSelect;
type OrderEventRow = typeof schema.orderEvents.$inferSelect;

export function serializeUser(u: UserRow): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    clubMember: u.clubMember,
    clubJoinedAt: u.clubJoinedAt ? u.clubJoinedAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
  };
}

export function serializeAddress(a: AddressRow): Address {
  return {
    id: a.id,
    label: a.label,
    recipient: a.recipient,
    zip: a.zip,
    street: a.street,
    number: a.number,
    complement: a.complement,
    district: a.district,
    city: a.city,
    state: a.state,
    reference: a.reference,
    isDefault: a.isDefault,
  };
}

export function serializeOrder(
  o: OrderRow,
  extra: {
    items?: OrderItemRow[];
    events?: OrderEventRow[];
    customer?: { id: string; name: string; email: string; phone: string | null };
  } = {},
): Order {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    subtotalCents: o.subtotalCents,
    discountCents: o.discountCents,
    deliveryFeeCents: o.deliveryFeeCents,
    totalCents: o.totalCents,
    paymentMethod: o.paymentMethod,
    changeForCents: o.changeForCents,
    deliverySlot: o.deliverySlot,
    notes: o.notes,
    address: o.address as Order["address"],
    itemCount: o.itemCount,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    items: extra.items?.map<OrderItem>((i) => ({
      id: i.id,
      productId: i.productId,
      name: i.name,
      imageUrl: i.imageUrl,
      unitLabel: i.unitLabel,
      unitPriceCents: i.unitPriceCents,
      quantity: i.quantity,
      totalCents: i.totalCents,
      viaClub: i.viaClub,
    })),
    events: extra.events
      ?.slice()
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map<OrderEvent>((e) => ({
        id: e.id,
        status: e.status,
        note: e.note,
        createdAt: e.createdAt.toISOString(),
      })),
    customer: extra.customer,
  };
}
