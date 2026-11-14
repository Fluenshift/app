# The image of the local profile: one non-root Node process serves the API and the web build.
# Both stages start from the same Node release, pinned by the digest of its multi-platform index.
FROM node:26.13.0-slim@sha256:5adad64f9a1fca2d51972caa65983634c8a774eb300d72b20f7f2a0f60368072 AS builder
WORKDIR /app
ENV CI=true DO_NOT_TRACK=1 HUSKY=0 TURBO_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@12.18.0
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --store-dir /pnpm/store \
      --filter "server..." --filter "web..."
RUN pnpm --filter server --filter web run build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter server deploy --prod --ignore-scripts --store-dir /pnpm/store /deploy/server

FROM node:26.13.0-slim@sha256:5adad64f9a1fca2d51972caa65983634c8a774eb300d72b20f7f2a0f60368072
ENV NODE_ENV=production
WORKDIR /app/apps/server
COPY --from=builder /deploy/server/package.json ./package.json
COPY --from=builder /deploy/server/node_modules ./node_modules
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/web/dist /app/apps/web/dist
COPY --from=builder /app/packages/db/src/migrations /app/packages/db/src/migrations
USER node
EXPOSE 3000
CMD ["node", "dist/index.mjs"]
