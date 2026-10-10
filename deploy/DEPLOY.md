# Despliegue de PiensaYa

Esta carpeta deja el proyecto listo para publicarse en **cualquier servidor con Docker** (un VPS, una VM en la nube, una Raspberry…). El stack de producción **se probó completo en local** (12 contenedores sanos, migraciones aplicadas solas y la suite e2e pasando a través de Caddy), pero **todavía no se ha desplegado en un servidor real**.

## Qué se levanta

```
                    Internet
                       │  :80 / :443
                    ┌──▼───┐   HTTPS automático (Let's Encrypt)
                    │Caddy │   piensaya.ejemplo.com      → frontend
                    └──┬───┘   api.piensaya.ejemplo.com  → servicios (por prefijo de ruta)
        ┌──────┬───────┼───────┬────────┬────────┐
     frontend  auth   users   posts    chat     feed        ← imágenes propias (backend/Dockerfile)
                │       │       │        │        │
        PostgreSQL ─────┘    MongoDB ────┘      Redis    RabbitMQ    S3Mock
        (red interna de Docker: ningún puerto de datos queda expuesto)
```

- Solo **Caddy** publica puertos (80 y 443). Las bases de datos, Redis y RabbitMQ **no** son accesibles desde fuera.
- Todo lleva contraseña (Postgres, MongoDB, Redis, RabbitMQ) y los secretos se generan al azar.
- Los servicios con Prisma aplican sus migraciones al arrancar.
- Un solo dominio de API alcanza: Caddy reparte por prefijo (`/auth`, `/users`, `/posts`, `/chat` y `/socket.io`, `/feed`).

## Requisitos

| | |
|---|---|
| **Servidor** | Linux con Docker y el plugin de Compose. **2 GB de RAM** alcanzan para correrlo (el stack completo usa ~1,1 GB en reposo, medido). Compilar las imágenes consume más: con 2 GB conviene añadir swap, y con **4 GB** va cómodo |
| **Dominio** | Dos nombres que apunten a la IP del servidor: uno para la app y otro para la API (p. ej. `piensaya.tudominio.com` y `api.piensaya.tudominio.com`) |
| **Puertos** | 80 y 443 abiertos en el firewall del proveedor |

### Opciones de servidor (orientativo, verifica precios y planes vigentes)

- **VPS barato (5–12 USD al mes):** Hetzner, DigitalOcean, Vultr, AWS Lightsail… Lo más simple y predecible.
- **Plan gratuito de Oracle Cloud ("Always Free"):** una VM ARM suficiente para este stack. Pide tarjeta para verificar la cuenta, a veces no hay capacidad disponible y Oracle puede reclamar máquinas casi inactivas. Confirma los límites actuales en su página oficial.
- **Dominio gratis:** servicios como DuckDNS dan un subdominio; con eso Caddy también obtiene certificado. Para dos nombres suele valer `app.nombre.duckdns.org` y `api.nombre.duckdns.org`.

## Paso a paso

```bash
# 1. En el servidor: instalar Docker (Ubuntu/Debian)
curl -fsSL https://get.docker.com | sh

# 2. Clonar el repositorio
git clone https://github.com/andresklve/PiensaYa.git
cd PiensaYa/deploy

# 3. Configuración: dominios y secretos aleatorios
cp .env.example .env
nano .env                       # APP_HOST, API_HOST, PUBLIC_APP_URL y PUBLIC_API_URL
./generate-secrets.sh >> .env   # añade las 7 contraseñas/secretos

# 4. Construir y levantar todo (la primera vez tarda unos minutos)
docker compose -f docker-compose.prod.yml up -d --build

# 5. Comprobar
docker compose -f docker-compose.prod.yml ps
```

Antes del paso 4, los registros DNS A de ambos nombres deben apuntar ya a la IP del servidor: Caddy pide los certificados al arrancar.

Cuando todo esté `healthy`, abre `https://piensaya.tudominio.com`.

### Cargar datos de demostración (opcional)

Para que la app no se vea vacía, desde tu computadora (con Node 24):

```bash
AUTH_URL=https://api.piensaya.tudominio.com \
USERS_URL=https://api.piensaya.tudominio.com \
POSTS_URL=https://api.piensaya.tudominio.com \
CHAT_URL=https://api.piensaya.tudominio.com \
node scripts/seed.mjs
```

Crea la cuenta `demo` / `Demo12345` (cámbiala con `SEED_PASSWORD` si la demo es pública y no quieres que la usen terceros), más usuarios, publicaciones, comentarios y conversaciones. Tarda unos dos minutos por el rate limiting; es idempotente.

## Operación

```bash
cd PiensaYa/deploy
F="-f docker-compose.prod.yml"

docker compose $F logs -f posts          # logs de un servicio
docker compose $F restart chat           # reiniciar uno
docker compose $F down                   # parar todo (los datos se conservan en volúmenes)

# Actualizar a la última versión
git pull && docker compose $F up -d --build
```

### Copias de seguridad

Los datos viven en volúmenes de Docker (`postgres-data`, `mongo-data`, `redis-data`, `rabbitmq-data`, `s3-data`). Un respaldo mínimo:

```bash
set -a; . ./.env; set +a
docker compose $F exec -T postgres pg_dumpall -U postgres | gzip > backup-postgres-$(date +%F).sql.gz
docker compose $F exec -T mongo mongodump -u piensaya -p "$MONGO_PASSWORD" --authenticationDatabase admin --archive --gzip > backup-mongo-$(date +%F).gz
```

Redis solo guarda feeds derivados (se reconstruyen) y RabbitMQ colas transitorias: no hace falta respaldarlos.

## Imágenes de perfil

Por defecto se usa **S3Mock** (un servidor compatible con S3 dentro de Docker) y Caddy publica el bucket en `https://api…/piensaya-media/`. Sirve para una demo.

Para producción de verdad conviene un bucket real (AWS S3 o Cloudflare R2). El `user-follow-service` ya habla S3: en `docker-compose.prod.yml`, en el servicio `users`, quita `STORAGE_ENDPOINT` si usas AWS (o ponlo con el endpoint de R2) y define `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` y `STORAGE_PUBLIC_URL` (la URL pública del bucket o de su CDN). Después puedes borrar el servicio `s3` y el bloque `@media` del `Caddyfile`.

## Lista de comprobación de seguridad

- [x] Solo 80/443 expuestos; datos en red interna.
- [x] Contraseñas y secretos aleatorios; `.env` fuera de git (`deploy/.env` está en `.gitignore`).
- [x] CORS restringido al dominio de la app (`CORS_ORIGIN`).
- [x] Rate limiting con IP real detrás del proxy (`TRUST_PROXY`).
- [x] Contenedores de los servicios corren sin root.
- [ ] Mantener el servidor actualizado (`apt upgrade`) y habilitar un firewall (`ufw allow 22,80,443/tcp`).
- [ ] Programar los respaldos (cron) y copiarlos fuera del servidor.
- [ ] Si la demo es pública, cambiar `SEED_PASSWORD` o no sembrar la cuenta `demo`.

## Probarlo en local sin dominio

Los mismos archivos funcionan en tu computadora usando `localhost` y `127.0.0.1` como "dominios" y un puerto alto:

```bash
cd deploy
cp .env.example .env
sed -i 's#^APP_HOST=.*#APP_HOST=http://localhost#; s#^API_HOST=.*#API_HOST=http://127.0.0.1#' .env
sed -i 's#^PUBLIC_APP_URL=.*#PUBLIC_APP_URL=http://localhost:8080#; s#^PUBLIC_API_URL=.*#PUBLIC_API_URL=http://127.0.0.1:8080#' .env
sed -i 's#^HTTP_PORT=.*#HTTP_PORT=8080#; s#^HTTPS_PORT=.*#HTTPS_PORT=8443#' .env
./generate-secrets.sh >> .env
docker compose -f docker-compose.prod.yml up -d --build --wait
# App en http://localhost:8080  ·  API en http://127.0.0.1:8080
```
