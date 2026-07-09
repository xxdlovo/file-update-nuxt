# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS builder
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DATABASE_URL=file:/app/data/app.db
ENV RUN_DB_MIGRATIONS=true
ENV PM2_HOME=/home/nuxt/.pm2

RUN npm install -g pm2 \
  && useradd --system --create-home --uid 1001 nuxt \
  && mkdir -p /app/data /home/nuxt/.pm2 \
  && chown -R nuxt:nuxt /app /home/nuxt/.pm2 \
  && npm cache clean --force

COPY --from=builder --chown=nuxt:nuxt /app/.output ./.output
COPY --from=builder --chown=nuxt:nuxt /app/node_modules ./node_modules
COPY --chown=nuxt:nuxt package.json drizzle.config.ts ./
COPY --chown=nuxt:nuxt db ./db
COPY --chown=nuxt:nuxt docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

USER nuxt
EXPOSE 3000
VOLUME ["/app/data"]

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["pm2-runtime", "start", ".output/server/index.mjs", "--name", "file-update-nuxt"]
