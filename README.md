# AIONIX Market

Ecossistema de delivery de supermercado: PWA do consumidor com mecânica nativa, painel administrativo em tempo real e API própria.

| App | Stack | Produção |
| --- | --- | --- |
| `apps/web` — PWA do consumidor | Next.js 16 · React 19 · Tailwind 4 · Motion · TanStack Query | https://aionix-market.vercel.app |
| `apps/admin` — painel operacional | Next.js 16 · Recharts · dnd-kit | https://aionix-market-admin.vercel.app |
| `apps/api` — backend | Fastify 5 · Drizzle ORM · Postgres · sharp · S3 | https://api-production-5de6.up.railway.app |
| `packages/shared` | zod schemas, tipos e formatadores compartilhados | — |

## Rodando localmente

Pré-requisitos: Node 24, pnpm 10.

```sh
pnpm install
pnpm -C apps/api dev        # :8080 — usa apps/api/.env (banco "staging" no Railway)
pnpm -C apps/web dev -p 3000
pnpm -C apps/admin dev -p 3001
```

Os frontends fazem rewrite de `/api/*` para `API_ORIGIN` (padrão `http://localhost:8080` em dev), então cookies de sessão são first-party em qualquer ambiente.

Variáveis da API (`apps/api/src/env.ts`): `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `PUBLIC_API_URL`, `ADMIN_EMAIL`/`ADMIN_PASSWORD` (cria/sincroniza o admin no boot) e `S3_*` (opcional — sem S3 as imagens vão para a tabela `media_blobs`).

### Banco e seed

Migrations em `apps/api/drizzle` são aplicadas automaticamente no boot. Para gerar novas: `pnpm --filter @aionix/api db:generate`.

```sh
cd apps/api
pnpm exec tsx --env-file=.env src/db/seed.ts             # staging (idempotente por slug)
pnpm exec tsx --env-file=.env src/db/seed.ts --reimage   # rebaixa e reprocessa todas as imagens
pnpm exec tsx --env-file=.env.prod src/db/seed.ts        # produção (arquivo git-ignored)
```

O seed cria 12 categorias, 129 produtos com fotos reais (Open Food Facts / Wikimedia Commons, ver `src/db/seed-images.json`), 2 promoções, 3 banners e o cliente demo `cliente@aionix.market` / `aionix2026`.

## Qualidade

```sh
pnpm turbo typecheck            # 4 pacotes
pnpm turbo test                 # vitest — regras de preço (apps/api/src/lib/pricing.test.ts)
node scripts/flow.mjs http://localhost:3000 out/            # E2E consumidor: login → carrinho → checkout → pedido
ADMIN_PASSWORD=… node scripts/realtime-e2e.mjs http://localhost:3000 http://localhost:3001 out/   # pedido → admin avança → cliente vê via SSE
node scripts/pwa-check.mjs https://aionix-market.vercel.app  # manifest, ícones, service worker, offline
node scripts/shot.mjs <url> out.png [--desktop] [--login] [--scroll N]   # screenshot para QA visual
```

## Arquitetura em uma tela

- **Preço é decidido no servidor** (`apps/api/src/lib/pricing.ts`): promoções percent/fixed por produto ou categoria, a mais vantajosa vence, desconto efetivo limitado a 90%. O carrinho do cliente é re-cotado via `POST /api/cart/quote`; o checkout re-cota e baixa estoque atomicamente.
- **Auth** própria: argon2 + access JWT (15 min, cookie `ax_at`) + refresh opaco rotativo (30 d, cookie `ax_rt`, hash em `sessions`).
- **Realtime**: SSE direto do Railway com ticket JWT de 90 s; o admin recebe `order.created`/`order.updated` (fila com som), o cliente acompanha o pedido sem recarregar.
- **Mídia**: upload → sharp (rotate, trim contra o fundo detectado, WebP ≤1200px, placeholder blur) → S3 → `/api/media/<key>` com cache imutável.
- **PWA**: viewport travado, sem seleção/zoom/bounce, telas 100dvh com scroll apenas em containers internos, transições de pilha, service worker com fallback offline.

Deploy é contínuo: push em `main` publica web/admin na Vercel e a API no Railway (Dockerfile em `apps/api`). Progresso e decisões em `PROGRESS.md`; bloqueios em `BLOCKERS.md`.
