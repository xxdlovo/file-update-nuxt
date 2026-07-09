# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS builder
COPY . .
RUN pnpm build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DATABASE_URL=file:/app/data/app.db
ENV RUN_DB_MIGRATIONS=true

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nuxt \
  && mkdir -p /app/data \
  && chown -R nuxt:nodejs /app

COPY --from=deps --chown=nuxt:nodejs /app/node_modules ./node_modules
COPY --chown=nuxt:nodejs package.json pnpm-lock.yaml pnpm-workspace.yaml drizzle.config.ts ./
COPY --chown=nuxt:nodejs db ./db
COPY --chown=nuxt:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
COPY --from=builder --chown=nuxt:nodejs /app/.output ./.output
RUN chmod +x ./docker-entrypoint.sh

USER nuxt
EXPOSE 3000
VOLUME ["/app/data"]

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", ".output/server/index.mjs"]
