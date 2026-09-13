/**
 * Seeds categories, products (downloading + optimizing images), promotions,
 * banners and a demo customer. Idempotent: re-running updates by slug.
 *
 *   pnpm --filter @aionix/api db:seed
 */
import { slugify } from "@aionix/shared";
import { eq } from "drizzle-orm";
import { db, schema, sqlClient } from "./client";
import { hashPassword } from "../lib/auth";
import { storeImage } from "../lib/images";
import { SEED_CATEGORIES, SEED_PRODUCTS } from "./seed-data";

const cents = (v: number) => Math.round(v * 100);

async function fetchImage(url: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "AIONIXMarket/0.1 (catalog seed; github alanaraujo-bit)" },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 429) throw new Error("rate limited");
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      console.warn(`  retry ${attempt + 1} for ${url}: ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
    }
  }
  return null;
}

async function main() {
  const force = process.argv.includes("--reimage");
  console.log("→ categories");
  const catBySlug = new Map<string, string>();
  for (const [i, c] of SEED_CATEGORIES.entries()) {
    const [row] = await db
      .insert(schema.categories)
      .values({ slug: c.slug, name: c.name, icon: c.icon, color: c.color, sortOrder: i })
      .onConflictDoUpdate({
        target: schema.categories.slug,
        set: { name: c.name, icon: c.icon, color: c.color, sortOrder: i },
      })
      .returning({ id: schema.categories.id });
    catBySlug.set(c.slug, row!.id);
  }

  console.log(`→ products (${SEED_PRODUCTS.length})`);
  const productIdBySlug = new Map<string, string>();
  for (const p of SEED_PRODUCTS) {
    const slug = slugify(p.name);
    const categoryId = catBySlug.get(p.category);
    if (!categoryId) throw new Error(`unknown category ${p.category} for ${p.name}`);
    const [existing] = await db.select().from(schema.products).where(eq(schema.products.slug, slug));

    let imageUrl = existing?.imageUrl ?? null;
    let blurDataUrl = existing?.blurDataUrl ?? null;
    if (p.image && (!imageUrl || force)) {
      const buf = await fetchImage(p.image);
      if (buf) {
        try {
          const stored = await storeImage(buf, { maxSize: 1000, trim: true });
          imageUrl = stored.url;
          blurDataUrl = stored.blurDataUrl;
          process.stdout.write(`  ✓ ${p.name}\n`);
        } catch (err) {
          console.warn(`  ✗ image failed for ${p.name}: ${(err as Error).message}`);
        }
      } else {
        console.warn(`  ✗ could not download image for ${p.name}`);
      }
    }

    const values = {
      slug,
      name: p.name,
      description: p.description ?? "",
      brand: p.brand ?? null,
      categoryId,
      priceCents: cents(p.price),
      compareAtCents: p.compareAt ? cents(p.compareAt) : null,
      unit: p.unit ?? "un",
      unitLabel: p.unitLabel,
      stock: p.stock ?? 40,
      featured: p.featured ?? false,
      tags: p.tags ?? [],
      imageUrl,
      blurDataUrl,
      active: true,
    };
    const [row] = await db
      .insert(schema.products)
      .values({ ...values, soldCount: Math.floor(Math.random() * 120) })
      .onConflictDoUpdate({ target: schema.products.slug, set: values })
      .returning({ id: schema.products.id });
    productIdBySlug.set(slug, row!.id);
  }

  console.log("→ promotions & banners");
  const now = new Date();
  const in30d = new Date(now.getTime() + 30 * 86_400_000);
  const [existingPromos] = await db.select({ id: schema.promotions.id }).from(schema.promotions).limit(1);
  if (!existingPromos) {
    const [semana] = await db
      .insert(schema.promotions)
      .values({
        name: "Semana do Café",
        description: "Até 20% off em cafés selecionados",
        discountType: "percent",
        discountValue: 20,
        startsAt: new Date(now.getTime() - 86_400_000),
        endsAt: in30d,
      })
      .returning();
    await db.insert(schema.promotionCategories).values({ promotionId: semana!.id, categoryId: catBySlug.get("cafe-matinais")! });

    const [bebidas] = await db
      .insert(schema.promotions)
      .values({
        name: "Happy Hour",
        description: "15% off em cervejas e vinhos",
        discountType: "percent",
        discountValue: 15,
        startsAt: new Date(now.getTime() - 86_400_000),
        endsAt: in30d,
      })
      .returning();
    const drinkSlugs = ["cerveja-heineken-lata", "cerveja-stella-artois-long-neck", "cerveja-brahma-chopp-lata", "vinho-reservado-sweet-rose-concha-y-toro"];
    await db.insert(schema.promotionProducts).values(
      drinkSlugs.filter((s) => productIdBySlug.has(s)).map((s) => ({ promotionId: bebidas!.id, productId: productIdBySlug.get(s)! })),
    );

    await db.insert(schema.banners).values([
      {
        title: "Semana do Café",
        subtitle: "Até 20% off em grãos e cápsulas selecionados",
        ctaLabel: "Aproveitar",
        theme: "forest",
        promotionId: semana!.id,
        categoryId: catBySlug.get("cafe-matinais")!,
        sortOrder: 0,
      },
      {
        title: "Frete grátis acima de R$ 150",
        subtitle: "Compre a semana inteira sem pagar entrega",
        ctaLabel: "Ver ofertas",
        theme: "citrus",
        sortOrder: 1,
      },
      {
        title: "Happy Hour",
        subtitle: "15% off em cervejas e vinhos até o fim do mês",
        ctaLabel: "Ver bebidas",
        theme: "night",
        promotionId: bebidas!.id,
        categoryId: catBySlug.get("bebidas")!,
        sortOrder: 2,
      },
    ]);
  }

  console.log("→ demo customer");
  const email = "cliente@aionix.market";
  const [demo] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
  if (!demo) {
    const [user] = await db
      .insert(schema.users)
      .values({ name: "Ana Demo", email, phone: "(11) 99876-5432", passwordHash: await hashPassword("aionix2026") })
      .returning();
    await db.insert(schema.addresses).values({
      userId: user!.id,
      label: "Casa",
      recipient: "Ana Demo",
      zip: "01310-100",
      street: "Avenida Paulista",
      number: "1578",
      complement: "Apto 42",
      district: "Bela Vista",
      city: "São Paulo",
      state: "SP",
      reference: "Em frente ao MASP",
      isDefault: true,
    });
  }

  console.log("✓ seed complete");
  await sqlClient.end();
}

main().catch(async (err) => {
  console.error(err);
  await sqlClient.end();
  process.exit(1);
});
