#!/usr/bin/env bash
# Imprime secretos aleatorios (hex) listos para pegar en deploy/.env:
#   ./generate-secrets.sh >> .env
# Hex a propósito: viajan dentro de URLs de conexión y no necesitan escape.
# Usa openssl, que viene en cualquier servidor Linux y en Git Bash.
set -e
for name in POSTGRES_PASSWORD MONGO_PASSWORD REDIS_PASSWORD RABBITMQ_PASSWORD \
            JWT_SECRET JWT_REFRESH_SECRET INTERNAL_SERVICE_TOKEN; do
  echo "$name=$(openssl rand -hex 32)"
done
