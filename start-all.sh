#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "Levantando Mongo, Redis y RabbitMQ..."
docker compose -f backend/docker-compose.yml up -d

mkdir -p logs
PIDS=()

BACKEND_SERVICES=(auth-service user-follow-service post-service chat-service feed-service)

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
