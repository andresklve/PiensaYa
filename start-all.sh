#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
mkdir -p logs

BACKEND_SERVICES=(auth-service user-follow-service post-service chat-service feed-service)

# Primera vez en una máquina: se crean los .env desde las plantillas. Los que
# ya existen no se tocan (pueden apuntar a otro Postgres, p. ej. uno local).
for name in "${BACKEND_SERVICES[@]}"; do
  if [ ! -f "backend/$name/.env" ]; then
    cp "backend/$name/.env.example" "backend/$name/.env"
    echo "Creado backend/$name/.env desde .env.example"
  fi
done
if [ ! -f frontend/.env.local ]; then
  cp frontend/.env.example frontend/.env.local
  echo "Creado frontend/.env.local desde .env.example"
fi

echo "Levantando Postgres, Mongo, Redis, RabbitMQ y S3Mock..."
# --wait: espera a que Postgres pase su healthcheck antes de migrar.
docker compose -f backend/docker-compose.yml up -d --wait

for name in auth-service user-follow-service; do
  echo "Aplicando migraciones de $name..."
  if ! (cd "backend/$name" && pnpm exec prisma migrate deploy) > "logs/$name.migrate.log" 2>&1; then
    echo "AVISO: falló prisma migrate deploy en $name (ver logs/$name.migrate.log)"
  fi
done

PIDS=()

# Compilamos uno por uno (no en paralelo). nest-cli borra dist/ de forma
# asíncrona al compilar (deleteOutDir): si varios servicios compilan a la vez
# bajo carga, ese borrado puede terminar DESPUÉS de que el archivo ya se
# escribió, eliminándolo otra vez y dejando "Cannot find module dist/main".
# Compilando en serie evitamos esa carrera. Para desarrollo activo de un
# servicio puntual, sigue usando "pnpm start:dev" dentro de su carpeta.
for name in "${BACKEND_SERVICES[@]}"; do
  echo "Compilando $name..."
  # Un .tsbuildinfo viejo hace que tsc no re-emita nada tras el borrado de dist/.
  rm -f "backend/$name"/*.tsbuildinfo
  (cd "backend/$name" && pnpm exec nest build) > "logs/$name.build.log" 2>&1
  if [ ! -f "backend/$name/dist/main.js" ]; then
    echo "ERROR: $name no generó dist/main.js (ver logs/$name.build.log)"
    exit 1
  fi
done

start_node() {
  local name="$1"
  local dir="$2"
  echo "Iniciando $name..."
  (cd "$dir" && node dist/main.js) > "logs/$name.log" 2>&1 &
  PIDS+=($!)
}

for name in "${BACKEND_SERVICES[@]}"; do
  start_node "$name" "backend/$name"
done

echo "Iniciando frontend..."
(cd frontend && pnpm dev) > "logs/frontend.log" 2>&1 &
PIDS+=($!)

cleanup() {
  echo ""
  echo "Deteniendo servicios..."
  kill "${PIDS[@]}" 2>/dev/null
}
trap cleanup SIGINT SIGTERM EXIT

cat <<EOF

Servicios iniciando (logs en logs/<servicio>.log):
  Auth               http://localhost:3000/docs
  User & Follow      http://localhost:3001/docs
  Post & Tweet       http://localhost:3002/docs
  Chat               http://localhost:3003/docs
  Feed               http://localhost:3004
  Frontend           http://localhost:3100

Ctrl+C para detener todo.
EOF

wait
