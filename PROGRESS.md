# AIONIX Market — Progress Log

Persistent log so any session can resume. Newest entries at the bottom of each section.

## Architecture (decided 2026-09-13)
- **Monorepo** pnpm workspaces + Turborepo.
  - `apps/web` — PWA do consumidor (Next.js 16 App Router) → Vercel project `aionix-market` (team `aionixdev`).
  - `apps/admin` — Painel administrativo (Next.js 16) → Vercel project `aionix-market-admin`.
  - `apps/api` — Fastify 5 + Drizzle ORM + Postgres → Railway project `aionix-market` (service `api` + `Postgres`).
  - `packages/shared` — zod schemas, tipos, formatadores (consumido como TS source).
- **Auth** self-hosted: argon2 hashes, access JWT (15 min) + refresh token opaco rotativo (tabela `sessions`), cookies httpOnly.
  Frontends fazem rewrite `/api/*` → Railway, então cookies são first-party.
- **Realtime**: SSE direto do Railway, autenticado por ticket JWT curto emitido via `/api/realtime/ticket`.
- **Mídia**: upload → sharp (WebP + blur placeholder) → S3 bucket se configurado, senão tabela `media_blobs` no Postgres.
- **Pagamento**: pagamento na entrega (Pix/cartão/dinheiro). Gateway real está em BLOCKERS.md.
- **Migrations**: drizzle-kit gera SQL em `apps/api/drizzle`; API aplica no boot.

## Accounts
- GitHub: `alanaraujo-bit` — repo `alanaraujo-bit/AIONIX-market`.
- Railway: `alanvitoraraujo2a@gmail.com`, workspace "alanaraujo-bit's Projects", project `aionix-market` (e3d26e9f-7661-4f83-ade9-cc0ef2f8c914).
- Vercel: user `alanarauj0`, team `aionixdev`.

## Log
- 2026-09-13: Repo inicializado, monorepo scaffold, Railway project + Postgres criados.
