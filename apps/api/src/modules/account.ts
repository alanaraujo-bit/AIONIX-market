import { addressSchema, checkoutSchema, onlyDigits, profileSchema, formatCep } from "@aionix/shared";
import { and, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { db, schema } from "../db/client";
import { requireUser } from "../lib/auth";
import { publish } from "../lib/events";
import { badRequest, conflict, notFound, pageParams, parse } from "../lib/http";
import { attachRedemptionToOrder, recordOrderCoins, syncOrderLoyalty } from "../lib/loyalty";
import { quoteCart } from "../lib/pricing";
import { serializeAddress, serializeOrder, serializeUser, type OrderLoyalty } from "../lib/serializers";
import { getLoyaltySettings, getSettings } from "../lib/settings";

const a = schema.addresses;
const o = schema.orders;

export async function restoreStock(tx: Pick<typeof db, "update" | "select">, orderId: string) {
  const items = await tx.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
  for (const item of items) {
    if (!item.productId) continue;
    await tx
      .update(schema.products)
      .set({
        stock: sql`${schema.products.stock} + ${item.quantity}`,
        soldCount: sql`greatest(0, ${schema.products.soldCount} - ${item.quantity})`,
      })
      .where(eq(schema.products.id, item.productId));
  }
}

export async function loadOrderDetail(orderId: string) {
  const [order] = await db.select().from(o).where(eq(o.id, orderId));
  if (!order) return null;
  const [items, events, [customer], [coin], [redemption]] = await Promise.all([
    db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId)),
    db.select().from(schema.orderEvents).where(eq(schema.orderEvents.orderId, orderId)),
    db
      .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, phone: schema.users.phone })
      .from(schema.users)
      .where(eq(schema.users.id, order.userId)),
    db
      .select({ status: schema.coinEntries.status })
      .from(schema.coinEntries)
      .where(and(eq(schema.coinEntries.orderId, orderId), eq(schema.coinEntries.type, "earn")))
      .limit(1),
    order.redemptionId
      ? db
          .select({ row: schema.redemptions, productName: schema.products.name })
          .from(schema.redemptions)
          .leftJoin(schema.products, eq(schema.products.id, sql`(${schema.redemptions.snapshot}->>'productId')::uuid`))
          .where(eq(schema.redemptions.id, order.redemptionId))
      : Promise.resolve([] as { row: typeof schema.redemptions.$inferSelect; productName: string | null }[]),
  ]);
  const loyalty: OrderLoyalty = {
    coinsStatus: coin?.status ?? null,
    redemption: redemption?.row ?? null,
    rewardProductName: redemption?.productName ?? null,
  };
  return { order, items, events, customer, loyalty };
}

export const accountRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (req) => {
    const { userId } = requireUser(req);
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    if (!user) throw notFound();
    const [stats] = await db
      .select({
        orders: sql<number>`count(*)::int`,
        spentCents: sql<number>`coalesce(sum(${o.totalCents}) filter (where ${o.status} <> 'cancelled'), 0)::int`,
        savedCents: sql<number>`coalesce(sum(${o.discountCents}) filter (where ${o.status} <> 'cancelled'), 0)::int`,
        clubSavedCents: sql<number>`coalesce((
          select sum((${schema.orderItems.originalUnitPriceCents} - ${schema.orderItems.unitPriceCents}) * ${schema.orderItems.quantity})
          from ${schema.orderItems}
          join ${o} as co on co.id = ${schema.orderItems.orderId}
          where co.user_id = ${userId} and co.status <> 'cancelled' and ${schema.orderItems.viaClub}
        ), 0)::int`,
      })
      .from(o)
      .where(eq(o.userId, userId));
    const [coins] = await db
      .select({
        balance: sql<number>`coalesce(sum(${schema.coinEntries.coins}) filter (where ${schema.coinEntries.status} = 'settled'), 0)::int`,
        pending: sql<number>`coalesce(sum(${schema.coinEntries.coins}) filter (where ${schema.coinEntries.status} = 'pending'), 0)::int`,
      })
      .from(schema.coinEntries)
      .where(eq(schema.coinEntries.userId, userId));
    return { user: serializeUser(user), stats: { ...stats, coinBalance: coins?.balance ?? 0, coinPending: coins?.pending ?? 0 } };
  });

  app.patch("/", async (req) => {
    const { userId } = requireUser(req);
    const input = parse(profileSchema, req.body);
    const [user] = await db
      .update(schema.users)
      .set({ name: input.name, phone: input.phone || null })
      .where(eq(schema.users.id, userId))
      .returning();
    return { user: serializeUser(user!) };
  });

  // ---- Addresses -------------------------------------------------------
  app.get("/addresses", async (req) => {
    const { userId } = requireUser(req);
    const rows = await db.select().from(a).where(eq(a.userId, userId)).orderBy(desc(a.isDefault), desc(a.createdAt));
    return { items: rows.map(serializeAddress) };
  });

  const saveAddress = async (userId: string, body: unknown, id?: string) => {
    const input = parse(addressSchema, body);
    const values = {
      ...input,
      zip: formatCep(input.zip),
      complement: input.complement || null,
      reference: input.reference || null,
    };
    return db.transaction(async (tx) => {
      const [{ count } = { count: 0 }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(a)
        .where(eq(a.userId, userId));
      const makeDefault = input.isDefault || count === 0 || (count === 1 && !!id);
      if (makeDefault) await tx.update(a).set({ isDefault: false }).where(eq(a.userId, userId));
      if (id) {
        const [row] = await tx
          .update(a)
          .set({ ...values, isDefault: makeDefault || undefined })
          .where(and(eq(a.id, id), eq(a.userId, userId)))
          .returning();
        if (!row) throw notFound("Endereço não encontrado");
        return row;
      }
      if (count >= 10) throw badRequest("Limite de 10 endereços atingido");
      const [row] = await tx
        .insert(a)
        .values({ ...values, userId, isDefault: makeDefault })
        .returning();
      return row!;
    });
  };

  app.post("/addresses", async (req, reply) => {
    const { userId } = requireUser(req);
    const row = await saveAddress(userId, req.body);
    return reply.status(201).send({ address: serializeAddress(row) });
  });

  app.put("/addresses/:id", async (req) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    return { address: serializeAddress(await saveAddress(userId, req.body, id)) };
  });

  app.post("/addresses/:id/default", async (req) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    await db.transaction(async (tx) => {
      await tx.update(a).set({ isDefault: false }).where(eq(a.userId, userId));
      const [row] = await tx
        .update(a)
        .set({ isDefault: true })
        .where(and(eq(a.id, id), eq(a.userId, userId)))
        .returning();
      if (!row) throw notFound("Endereço não encontrado");
    });
    return { ok: true };
  });

  app.delete("/addresses/:id", async (req) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const [row] = await db
      .delete(a)
      .where(and(eq(a.id, id), eq(a.userId, userId)))
      .returning();
    if (!row) throw notFound("Endereço não encontrado");
    if (row.isDefault) {
      const [next] = await db.select().from(a).where(eq(a.userId, userId)).orderBy(desc(a.createdAt)).limit(1);
      if (next) await db.update(a).set({ isDefault: true }).where(eq(a.id, next.id));
    }
    return { ok: true };
  });

  app.get("/cep/:cep", async (req) => {
    requireUser(req);
    const cep = onlyDigits((req.params as { cep: string }).cep);
    if (cep.length !== 8) throw badRequest("CEP inválido");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(4000) });
      const data = (await res.json()) as Record<string, string | boolean>;
      if (data.erro) throw notFound("CEP não encontrado");
      return {
        zip: formatCep(cep),
        street: data.logradouro ?? "",
        district: data.bairro ?? "",
        city: data.localidade ?? "",
        state: data.uf ?? "",
      };
    } catch (err) {
      if (err instanceof Error && "statusCode" in err) throw err;
      throw badRequest("Não foi possível consultar o CEP agora");
    }
  });

  // ---- Orders ----------------------------------------------------------
  app.get("/orders", async (req) => {
    const { userId } = requireUser(req);
    const { page, pageSize, offset } = pageParams(req.query as Record<string, unknown>, 50);
    const [rows, [{ total } = { total: 0 }]] = await Promise.all([
      db.select().from(o).where(eq(o.userId, userId)).orderBy(desc(o.createdAt)).limit(pageSize).offset(offset),
      db.select({ total: sql<number>`count(*)::int` }).from(o).where(eq(o.userId, userId)),
    ]);
    const ids = rows.map((r) => r.id);
    const [thumbs, coinRows] = ids.length
      ? await Promise.all([
          db
            .select({ orderId: schema.orderItems.orderId, imageUrl: schema.orderItems.imageUrl, name: schema.orderItems.name })
            .from(schema.orderItems)
            .where(inArray(schema.orderItems.orderId, ids)),
          db
            .select({ orderId: schema.coinEntries.orderId, status: schema.coinEntries.status })
            .from(schema.coinEntries)
            .where(and(inArray(schema.coinEntries.orderId, ids), eq(schema.coinEntries.type, "earn"))),
        ])
      : [[], []];
    const coinStatus = new Map(coinRows.map((c) => [c.orderId, c.status]));
    return {
      items: rows.map((r) => ({
        ...serializeOrder(r, { loyalty: { coinsStatus: coinStatus.get(r.id) ?? null, redemption: null } }),
        previews: thumbs.filter((t) => t.orderId === r.id).slice(0, 4).map((t) => ({ imageUrl: t.imageUrl, name: t.name })),
      })),
      total,
      page,
      pageSize,
    };
  });

  app.get("/orders/:id", async (req) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const detail = /^[0-9a-f-]{36}$/i.test(id) ? await loadOrderDetail(id) : null;
    if (!detail || detail.order.userId !== userId) throw notFound("Pedido não encontrado");
    return { order: serializeOrder(detail.order, { items: detail.items, events: detail.events, loyalty: detail.loyalty }) };
  });

  app.post("/orders", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    const { userId } = requireUser(req);
    const input = parse(checkoutSchema, req.body);
    const settings = await getSettings();
    if (!settings.storeOpen) throw conflict("A loja está fechada no momento", "STORE_CLOSED");

    if (input.fulfillmentMethod === "pickup" && (!settings.pickupEnabled || !settings.pickupAddress.trim())) {
      throw badRequest("A retirada na loja está indisponível no momento");
    }
    const [deliveryAddress] = input.fulfillmentMethod === "delivery" && input.addressId
      ? await db.select().from(a).where(and(eq(a.id, input.addressId), eq(a.userId, userId)))
      : [];
    if (input.fulfillmentMethod === "delivery" && !deliveryAddress) throw badRequest("Selecione um endereço de entrega válido");
    const address = deliveryAddress ?? {
      label: "Retirada na loja", recipient: settings.storeName, street: settings.pickupAddress,
      number: "", zip: "", complement: null, district: "", city: "", state: "", reference: null,
    };

    const loyalty = await getLoyaltySettings();
    const quote = await quoteCart(input.items, { userId, redemptionId: input.redemptionId ?? null, fulfillmentMethod: input.fulfillmentMethod });
    if (quote.lines.length === 0) throw badRequest("Seu carrinho está vazio");
    if (input.redemptionId && !quote.reward) {
      throw conflict(quote.rewardError ?? "Este prêmio não pode ser usado neste pedido", "REWARD_UNAVAILABLE");
    }
    const unavailable = quote.lines.filter((l) => !l.available);
    if (unavailable.length) {
      throw conflict(`Estoque insuficiente para ${unavailable.map((l) => l.name).join(", ")}`, "OUT_OF_STOCK");
    }
    // Minimum is judged before the voucher so a big reward never bounces the checkout.
    const netBeforeReward = quote.subtotalCents - quote.discountCents - (quote.reward?.productId ? quote.rewardDiscountCents : 0);
    if (netBeforeReward < settings.minimumOrderCents) {
      throw badRequest("O pedido não atingiu o valor mínimo");
    }
    if (input.paymentMethod === "cash" && input.changeForCents && input.changeForCents < quote.totalCents) {
      throw badRequest("O troco deve ser maior que o total do pedido");
    }

    const order = await db.transaction(async (tx) => {
      for (const line of quote.lines) {
        const updated = await tx
          .update(schema.products)
          .set({
            stock: sql`${schema.products.stock} - ${line.quantity}`,
            soldCount: sql`${schema.products.soldCount} + ${line.quantity}`,
          })
          .where(and(eq(schema.products.id, line.productId), gte(schema.products.stock, line.quantity)))
          .returning({ id: schema.products.id });
        if (!updated.length) throw conflict(`Estoque insuficiente para ${line.name}`, "OUT_OF_STOCK");
      }
      const [created] = await tx
        .insert(o)
        .values({
          userId,
          status: "pending",
          fulfillmentMethod: input.fulfillmentMethod,
          subtotalCents: quote.subtotalCents,
          discountCents: quote.discountCents,
          deliveryFeeCents: quote.deliveryFeeCents,
          totalCents: quote.totalCents,
          paymentMethod: input.paymentMethod,
          changeForCents: input.paymentMethod === "cash" ? (input.changeForCents ?? null) : null,
          deliverySlot: input.deliverySlot,
          notes: input.notes || null,
          itemCount: quote.itemCount,
          coinsEarned: quote.coinsToEarn,
          redemptionId: quote.reward?.redemptionId ?? null,
          rewardDiscountCents: quote.rewardDiscountCents,
          address: {
            label: address.label,
            recipient: address.recipient,
            zip: address.zip,
            street: address.street,
            number: address.number,
            complement: address.complement,
            district: address.district,
            city: address.city,
            state: address.state,
            reference: address.reference,
          },
        })
        .returning();
      await tx.insert(schema.orderItems).values(
        quote.lines.map((l) => ({
          orderId: created!.id,
          productId: l.productId,
          promotionId: l.promotionId,
          name: l.name,
          imageUrl: l.imageUrl,
          unitLabel: l.unitLabel,
          unitPriceCents: l.unitPriceCents,
          originalUnitPriceCents: l.originalUnitPriceCents,
          viaClub: l.viaClub,
          viaReward: l.viaReward,
          quantity: l.quantity,
          totalCents: l.totalCents,
        })),
      );
      await tx.insert(schema.orderEvents).values({ orderId: created!.id, status: "pending" });
      if (quote.reward) await attachRedemptionToOrder(tx, quote.reward.redemptionId, userId, created!.id);
      await recordOrderCoins(tx, { userId, orderId: created!.id, coins: quote.coinsToEarn, awardOn: loyalty.awardOn });
      return created!;
    });

    publish({
      type: "order.created",
      orderId: order.id,
      userId,
      number: order.number,
      status: order.status,
      totalCents: order.totalCents,
      at: new Date().toISOString(),
    });
    const coinsStatus = order.coinsEarned > 0 ? (loyalty.awardOn === "created" ? "settled" : "pending") : null;
    return reply.status(201).send({ order: serializeOrder(order, { loyalty: { coinsStatus, redemption: null } }) });
  });

  app.post("/orders/:id/cancel", async (req) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const order = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(o)
        .set({ status: "cancelled" })
        .where(and(eq(o.id, id), eq(o.userId, userId), eq(o.status, "pending")))
        .returning();
      if (!row) throw conflict("Este pedido não pode mais ser cancelado", "NOT_CANCELLABLE");
      await restoreStock(tx, id);
      await syncOrderLoyalty(tx, row, "cancelled");
      await tx.insert(schema.orderEvents).values({ orderId: id, status: "cancelled", note: "Cancelado pelo cliente" });
      return row;
    });
    publish({
      type: "order.updated",
      orderId: order.id,
      userId,
      number: order.number,
      status: order.status,
      totalCents: order.totalCents,
      at: new Date().toISOString(),
    });
    return { order: serializeOrder(order) };
  });

  /** Re-adds a past order's items to the cart (returns lines still available). */
  app.get("/orders/:id/reorder", async (req) => {
    const { userId } = requireUser(req);
    const { id } = req.params as { id: string };
    const [order] = await db.select({ id: o.id }).from(o).where(and(eq(o.id, id), eq(o.userId, userId)));
    if (!order) throw notFound("Pedido não encontrado");
    const items = await db
      .select({ productId: schema.orderItems.productId, quantity: schema.orderItems.quantity })
      .from(schema.orderItems)
      .where(and(eq(schema.orderItems.orderId, id), ne(schema.orderItems.quantity, 0), eq(schema.orderItems.viaReward, false)));
    const quote = await quoteCart(
      items.filter((i): i is { productId: string; quantity: number } => !!i.productId),
    );
    return { items: quote.lines.filter((l) => l.stock > 0).map((l) => ({ productId: l.productId, quantity: Math.min(l.quantity, l.stock) })) };
  });
};
