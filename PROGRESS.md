# AIONIX Market — Progress Log

Persistent log so any session can resume. Newest entries at the bottom of each section.

## Architecture (decided 2026-09-13)
- **Monorepo** pnpm workspaces + Turborepo.
  - `apps/web` — PWA do consumidor (Next.js 16 App Router) → Vercel project `aionix-market` (`prj_GCzD4BfpC3Q0iIcxhi619tNE1IJP`, team `aionixdev`). Prod: https://aionix-market.vercel.app
  - `apps/admin` — Painel administrativo (Next.js 16) → Vercel project `aionix-market-admin` (`prj_ZkfPdXjoYBvNs5kOYpOu9ooFYTTi`). Prod: https://aionix-market-admin.vercel.app
  - `apps/api` — Fastify 5 + Drizzle ORM + Postgres → Railway project `aionix-market` (service `api`, `Postgres`, bucket `aionix-media`). Prod: https://api-production-5de6.up.railway.app
  - `packages/shared` — zod schemas, tipos, formatadores (consumido como TS source; `transpilePackages` no Next, `noExternal` no tsup).
- **Auth** self-hosted: argon2 hashes, access JWT (15 min) + refresh token opaco rotativo (tabela `sessions`), cookies httpOnly `ax_at`/`ax_rt` com `path=/api`.
  Frontends fazem rewrite `/api/*` → Railway (`API_ORIGIN` env), então cookies são first-party.
- **Realtime**: SSE direto do Railway (`/api/realtime/stream?ticket=`), ticket JWT de 90s emitido via `/api/realtime/ticket` (mesma origem).
- **Mídia**: upload → sharp (WebP ≤1200px + blur placeholder 16px) → S3 (Railway bucket) se `S3_*` configurados, senão tabela `media_blobs`. Servido em `/api/media/<key>` com cache imutável.
- **Preços**: `lib/pricing.ts` é a fonte da verdade. Promoções (percent/fixed, por produto ou categoria) aplicadas no servidor; carrinho do cliente é re-cotado via `POST /api/cart/quote`.
- **Pedidos**: fluxo `pending → confirmed → picking → out_for_delivery → delivered`, `cancelled` a partir de qualquer não-final. Estoque decrementado atomicamente no checkout, devolvido no cancelamento.
- **Pagamento**: na entrega (Pix/cartão/dinheiro com troco). Gateway online está em BLOCKERS.md.
- **Migrations**: `pnpm --filter @aionix/api db:generate` gera SQL em `apps/api/drizzle`; a API aplica no boot (`migrate()`).

## Accounts / infra
- GitHub: `alanaraujo-bit/AIONIX-market` (branch `main`; push dispara Vercel e Railway).
- Railway: workspace "alanaraujo-bit's Projects", project `e3d26e9f-7661-4f83-ade9-cc0ef2f8c914`. Postgres TCP proxy: `altaria.proxy.rlwy.net:25486`.
- Vercel: user `alanarauj0`, team `aionixdev` (`team_nBRZLjwUxaJG1SB3JxLq8l92`). Env `API_ORIGIN` aponta para o Railway.
- Credenciais do admin: `CREDENTIALS.local.md` (git-ignored). Demo cliente: `cliente@aionix.market` / `aionix2026`.

## Local dev
- API: `pnpm -C apps/api dev` (porta 8080, usa `apps/api/.env` com DATABASE_URL do proxy Railway + S3).
- Web: `pnpm -C apps/web dev -p 3000`. Admin: `pnpm -C apps/admin dev -p 3001`.
- Seed: `cd apps/api && pnpm exec tsx --env-file=.env.seed src/db/seed.ts` (idempotente; `--reimage` para rebaixar imagens).
- QA visual: `node scripts/shot.mjs <url> <out.png> [--login] [--scroll N]`, fluxo E2E: `node scripts/flow.mjs http://localhost:3000 <dir>`.

## Log
- 2026-09-13: Repo inicializado, monorepo scaffold, Railway project + Postgres + bucket, API deployada (health OK).
- 2026-09-13: Vercel projects criados e ligados ao GitHub (root dirs `apps/web`, `apps/admin`).
- 2026-09-13: Catálogo seedado (129 produtos, 12 categorias, 2 promoções, 3 banners) com imagens do Open Food Facts / Wikimedia Commons reprocessadas para o bucket.
- 2026-09-13: PWA do consumidor completa: home, busca, categoria, produto, carrinho, checkout, pedidos (timeline realtime), conta, endereços. Fluxo E2E validado via Playwright.
- 2026-09-13: PWA: manifest, service worker (offline + cache de mídia), ícones gerados (`scripts/icons.mjs`).
- 2026-09-13: Fix Vercel: `API_ORIGIN` precisava estar em `turbo.json` (`globalEnv`/`env`), senão o rewrite `/api` caía. Mídia agora usa URLs relativas `/api/media/...`.
- 2026-09-13: Admin completo (login, dashboard c/ gráfico, fila de pedidos c/ SSE + som, detalhe do pedido, produtos c/ upload/inline stock/bulk, categorias DnD, promoções, banners c/ prévia, mídia, clientes, configurações). E2E realtime (`scripts/realtime-e2e.mjs`) verde. Produção validada em ambos os domínios.
- Próximo: revisão do advisor, polimento (imagens Commons com fundo cinza → trim mais agressivo), testes unitários de pricing, README.
