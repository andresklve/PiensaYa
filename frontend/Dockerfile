# Frontend Next.js (salida "standalone"). Contexto de build: frontend/
#
# Las URLs públicas de la API (NEXT_PUBLIC_*) se incrustan al compilar, así
# que son argumentos de build, no variables de entorno de ejecución:
#
#   docker build --build-arg NEXT_PUBLIC_AUTH_URL=https://api.ejemplo.com ... frontend

ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-bookworm-slim AS base
RUN npm install -g pnpm@10.29.2
WORKDIR /app

FROM base AS build
ARG NEXT_PUBLIC_AUTH_URL
ARG NEXT_PUBLIC_USERS_URL
ARG NEXT_PUBLIC_POSTS_URL
ARG NEXT_PUBLIC_CHAT_URL
ARG NEXT_PUBLIC_FEED_URL
ENV NEXT_PUBLIC_AUTH_URL=$NEXT_PUBLIC_AUTH_URL \
    NEXT_PUBLIC_USERS_URL=$NEXT_PUBLIC_USERS_URL \
    NEXT_PUBLIC_POSTS_URL=$NEXT_PUBLIC_POSTS_URL \
    NEXT_PUBLIC_CHAT_URL=$NEXT_PUBLIC_CHAT_URL \
    NEXT_PUBLIC_FEED_URL=$NEXT_PUBLIC_FEED_URL \
    NEXT_TELEMETRY_DISABLED=1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3100 \
    HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3100
CMD ["node", "server.js"]
