# Build context: repository root (monorepo).
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile --filter "@aionix/api..."
RUN pnpm --filter @aionix/api build
RUN pnpm --filter @aionix/api deploy --prod --legacy /out

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out .
EXPOSE 8080
CMD ["node", "--enable-source-maps", "dist/index.js"]
