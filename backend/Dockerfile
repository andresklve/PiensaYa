# Imagen de cualquiera de los 5 servicios. Contexto de build: backend/
#
#   docker build -f backend/Dockerfile --build-arg SERVICE=post-service backend
#
# Los servicios con Prisma (auth, user-follow) aplican sus migraciones al
# arrancar (`prisma migrate deploy`); el resto arranca directo.

ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-bookworm-slim AS base
# openssl lo necesita Prisma; pnpm se fija a la misma versión que el CI.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g pnpm@10.29.2
WORKDIR /app

FROM base AS build
ARG SERVICE
COPY ${SERVICE}/package.json ${SERVICE}/pnpm-lock.yaml ${SERVICE}/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY ${SERVICE}/ ./
RUN if [ -f prisma/schema.prisma ]; then pnpm exec prisma generate; fi
RUN pnpm exec nest build
# Sin Prisma se descartan las devDependencies; con Prisma se conservan porque
# el CLI (devDependency) hace falta en producción para migrar.
RUN if [ ! -f prisma/schema.prisma ]; then pnpm prune --prod; fi

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app ./
USER node
CMD ["sh", "-c", "if [ -f prisma/schema.prisma ]; then pnpm exec prisma migrate deploy || exit 1; fi; exec node dist/main.js"]
