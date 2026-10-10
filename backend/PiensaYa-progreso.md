# PiensaYa — Estado del proyecto

Última actualización: 10 de octubre, 2026 (Postgres en Docker + `.env.example`, reacción propia persistida en el backend, CI con GitHub Actions; configuración de la laptop Windows)

## Qué es

Proyecto personal de portafolio (sin afiliación institucional ni fines comerciales): una plataforma tipo **Medium + Twitter** para comunidad estudiantil.

**Funcionalidades core:**
- Publicar artículos largos (posts) y publicaciones cortas (tweets, límite 280 caracteres)
- Comentar y reaccionar (6 tipos: like, dislike, feliz, triste, enojado, interesante)
- Seguirse entre usuarios
- Chat privado 1 a 1 en tiempo real
- Feed pre-calculado a partir de a quién sigues

## Repositorio

- GitHub: `andresklve/PiensaYa`
- Descripción del repo: *"Plataforma social para estudiantes. Proyecto de portafolio personal para explorar arquitectura de software y diseño de sistemas escalables."*
- Rama `main` protegida: cada servicio se desarrolla en su propia rama (`feature/<servicio>`) y se integra vía Pull Request.

## Decisión de arquitectura

**Microservicios reales** (no monolito modular): cada servicio es un proyecto Nest independiente, con su propio `package.json`, puerto, `.env` y base de datos — para demostrar en portafolio manejo de sistemas distribuidos, DDD, comunicación síncrona/asíncrona, y consistencia eventual.

### Los 5 servicios (todos completos y probados end-to-end)

| Servicio | Puerto | Responsabilidad | Base de datos |
|---|---|---|---|
| **Auth Service** | 3000 | Registro/login por **username** (no email), JWT (access + refresh), roles (USUARIO/ADMIN), logout, cambio de contraseña | PostgreSQL (`piensaya_auth`) |
| **User & Follow Service** | 3001 | Perfiles (nombre, apellido, bio, avatar, username), grafo de seguidores | PostgreSQL (`piensaya_users`) |
| **Post & Tweet Service** | 3002 | Artículos y tweets, comentarios, reacciones; publica eventos a RabbitMQ | MongoDB (`piensaya_posts`) |
| **Chat Service** | 3003 | Mensajería 1 a 1 en tiempo real (WebSocket/Socket.IO + Redis adapter), historial, no leídos | MongoDB (`piensaya_chat`) |
| **Feed Service** | 3004 | Consume eventos de RabbitMQ, arma el feed de cada seguidor en Redis (fan-out on write) | Redis (sin BD propia) |

### Flujo de eventos (Post → Feed)

```
Post Service --publica evento: post_created--> RabbitMQ --entrega--> Feed Service
                                                                        |
                                                          consulta síncrona (REST)
                                                                        v
                                                          User & Follow Service
                                                                        |
                                                                        v
                                                          Feed Service escribe en
                                                            Redis (feed de cada seguidor)
```

- Línea de evento (Post → RabbitMQ → Feed) = **asíncrona**, con reintento automático (nack) si el User & Follow Service está caído — el post nunca se pierde
- Línea Feed → User & Follow Service = **síncrona** (REST, "¿quiénes siguen a este autor?")
- Al eliminar un post, se publica `post_deleted` y desaparece de todos los feeds al instante

### Autenticación entre microservicios

- Un mismo `JWT_SECRET` compartido entre los 5 servicios: cada uno valida el token **localmente** (passport-jwt), sin llamarse entre sí — stateless de verdad
- El payload del JWT es `{ sub: userId, username, role }`
- Endpoints internos (ej. `POST /users` que Auth llama al registrar) protegidos con un **token de servicio compartido** (`x-internal-token`), para que no cualquiera pueda llamarlos directo

## Stack técnico

**Backend**
- NestJS v11 (TypeScript, CommonJS) — elegido por su similitud con Spring Boot (controllers, DTOs, DI), stack que ya conoce de un proyecto universitario
- pnpm como gestor de paquetes
- Prisma v6 como ORM para los servicios con Postgres (equivalente a JPA/Hibernate)
- Mongoose para los servicios con MongoDB
- PostgreSQL para Auth y User/Follow Service
- MongoDB para Post/Tweet y Chat
- Redis para el feed (fan-out on write) y el adapter de Socket.IO
- RabbitMQ como broker de eventos (Post → Feed)
- Passport + JWT para autenticación (passport-jwt)
- class-validator / class-transformer para DTOs
- @nestjs/swagger para documentación de API (cada servicio expone `/docs`)
- Docker Compose para levantar Postgres, Mongo, Redis, RabbitMQ y S3Mock localmente (`backend/docker-compose.yml`)

**Frontend**
- Next.js 16 (App Router) + React 19 + Tailwind 4, conectado a los 5 servicios vía `NEXT_PUBLIC_*_URL` (`lib/api.ts`). Corre en el puerto 3100 (`pnpm dev` / `pnpm start`)
- Sistema de diseño **"Cuaderno"** (identidad propia, elegida entre 3 propuestas): base blanco/negro con grises de tinte cálido y un único acento, **amarillo marcador** `#FFD60A` (nunca como color de texto sobre fondo claro; en oscuro el marcador cubre la palabra y el texto pasa a negro). Tipografías **Bricolage Grotesque** (títulos) + **Atkinson Hyperlegible** (texto). Esquinas de 12px en vez de píldoras. Modo claro/oscuro con toggle (`data-theme` + localStorage, script de arranque en `app/layout.tsx`)
- Reaccionar con "Me gusta" pasa a ser **Subrayar** (trazo de marcador animado); el resto de reacciones son monocromas. Avatares sin foto con patrón generativo propio por persona. Estados vacíos como hoja punteada
- Tres formatos con jerarquía propia: **artículo** (ficha con borde, tiempo de lectura), **apunte** (`TWEET`, ≤280, hora en el margen) y **opinión** (`OPINION`, ≤600, estilo cita)
- Animaciones con **framer-motion** (respeta `prefers-reduced-motion` vía `MotionConfig`): pop en reacciones, contadores que deslizan, indicador de tab tipo marcador (`layoutId`), entrada escalonada del feed, sugerencias que salen al seguir, mensajes de chat con spring, barra de progreso de lectura
- Layout: barra superior (logo, búsqueda, Escribir, cuenta) + índice izquierdo (navegación + lista real de a quién sigues) + columna central 660px + panel derecho (tu resumen + compañeros por descubrir). En móvil, barra inferior
- Páginas: `/` (portada), `/login`, `/registro`, `/feed` (tabs **Para ti** / **Siguiendo** + filtro Todo/Artículos/Apuntes/Opiniones), `/explorar`, `/perfil` y `/u/[username]` (portada y foto subidas como archivo, con recorte), `/post/[id]`, `/chat` y `/chat/[userId]`
- **TanStack Query** como capa de datos (`lib/queries.ts`): caché por clave, mutaciones optimistas con rollback (seguir, reaccionar, publicar, comentar, borrar) e invalidación de todas las vistas afectadas. Seguir a alguien actualiza al instante botón, sugerencias, índice y contadores
- Componentes base en `components/ui.tsx` (Button, Input, Avatar, PageHeader, etc.); reacciones y comentarios en `components/post-interactions.tsx`; íconos `lucide-react`
- La reacción propia viene del backend (`myReaction` en cada publicación), así que se ve igual en cualquier navegador o dispositivo. Las lecturas públicas de posts mandan el token si hay sesión (`auth: 'optional'` en `lib/api.ts`)
- Limitación conocida: no existe endpoint de sugerencias; "Compañeros por descubrir" propone autores recientes que aún no sigues
- Tus propias publicaciones no aparecen en "Para ti" ni en Explorar; solo en el bloque **"Actividad en tus publicaciones"** cuando otra persona comentó o reaccionó y aún no lo viste (se marca visto en el servidor tras 1,5 s en pantalla o al abrirla; vuelve si llega actividad nueva)
- Hay un hook `useMounted` (`lib/use-mounted.ts`) para evitar errores de hidratación en UI que depende de la sesión (localStorage)
- Historial: se probó primero un estilo editorial "Minimalist Monochrome" (serif, esquinas rectas, titulares gigantes) y se descartó por poco práctico; se rehízo desde cero

**Testing**
- Jest, con tests unitarios por servicio (81 tests en total entre los 5)
- **CI con GitHub Actions** (`.github/workflows/ci.yml`): en cada push a `main` y en cada PR corre, por servicio, `install --frozen-lockfile` → `prisma generate` (si aplica) → lint (oxlint) → build → tests; y en el frontend lint (eslint) → `tsc --noEmit` → `next build`

## Decisiones de diseño tomadas

- **Login por username, no por email**: se evaluó agregar verificación de correo (Resend/Twilio), pero ambos servicios gratuitos solo entregan correos a la cuenta propia sin un dominio verificado — se descartó por ahora. Se decidió usar `username` (3–30 caracteres, `[a-z0-9_.]`, normalizado a minúsculas) como identificador de login, sin pedir ni validar correo.
- **Google OAuth**: pendiente, se implementará desde el frontend (el botón que abre la ventana de Google vive ahí).
- **Roles simples** (`USUARIO`, `ADMIN`) como campo en el propio Auth Service — se descartó un microservicio de roles aparte por sobre-ingeniería para el alcance del proyecto.

## Decisiones pendientes / a futuro

- Despliegue en AWS (después de tener todo funcionando local con Docker Compose):
  - RabbitMQ → podría migrarse a SQS + SNS
  - Postgres → RDS
  - MongoDB → DocumentDB o MongoDB Atlas
  - Redis → ElastiCache
  - Servicios NestJS → ECS/Fargate o EC2
  - Infraestructura como Código (Terraform/CDK) y CI/CD con GitHub Actions
- API Gateway (hoy el frontend tendría que saber el puerto de cada servicio)
- Patrón Saga formal para fallos distribuidos (hoy el Feed Service resuelve con reintento simple vía nack a RabbitMQ)
- Verificación de email al registrarse (pendiente por limitación de servicios gratuitos sin dominio propio)
- Paginación en followers/following, subida real de avatar (storage tipo S3), tests e2e, rate limiting
- Diagrama de arquitectura completo — en progreso en Excalidraw

## Progreso técnico

1. ✅ Repositorio creado en GitHub (`andresklve/PiensaYa`)
2. ✅ Estructura final: cada microservicio vive en `backend/<servicio>/` como proyecto Nest independiente
3. ✅ **Auth Service** completo: registro/login por username, JWT access+refresh, roles, logout, cambio de contraseña, guards, tests — mergeado a `main`
4. ✅ **User & Follow Service** completo: perfiles, follow/unfollow, followers/following, búsqueda por `@username`, protección inter-servicio — mergeado a `main`
5. ✅ **Post & Tweet Service** completo: posts/tweets con reglas (tweet ≤280, post requiere título), comentarios, 6 reacciones, publica eventos a RabbitMQ — mergeado a `main`
6. ✅ **Chat Service** completo: mensajería en tiempo real vía WebSocket, historial, no leídos, validación de destinatario contra User Service — mergeado a `main`
7. ✅ **Feed Service** completo: consumidor de RabbitMQ, fan-out on write en Redis, reintento ante fallos, probado con caída simulada de un servicio dependiente — mergeado a `main`
8. ✅ Migración de email → username aplicada en los 5 servicios — mergeado a `main`
9. ✅ Infraestructura local con Docker Compose (Mongo, Redis, RabbitMQ, S3Mock para imágenes) + 2 bases PostgreSQL
10. ✅ **Frontend Next.js** iniciado y conectado a los 5 servicios — mergeado a `main`
11. ✅ Setup local completo documentado y probado end-to-end (registro → login → JWT compartido → perfil creado vía token interno, los 6 servicios corriendo a la vez) — ver sección "Cómo correr en local"
12. ✅ Primer rediseño "Social Monochrome" (estilo X/Threads) — descartado después por parecer un clon de Twitter; reemplazado por "Cuaderno" (punto 14)
13. ✅ Bug de build corregido: `tsconfig.build.tsbuildinfo` (caché incremental de TypeScript) sobrevivía al borrado de `dist/` por `deleteOutDir: true`, así que `nest build` terminaba con exit 0 sin generar `dist/main.js` en el segundo arranque. Solución: se quitó `incremental` de los 5 `tsconfig.json` y `start-all.sh` borra `*.tsbuildinfo` antes de compilar y falla con mensaje claro si falta `dist/main.js`

14. ✅ **Rediseño "Cuaderno"** aplicado en todas las páginas (reemplaza "Social Monochrome", que se parecía demasiado a X)
15. ✅ **Opiniones** (`OPINION`, ≤600 caracteres) en Post Service + filtro por tipo en el feed, el perfil y Explorar
16. ✅ **Foto de perfil y portada por archivo**: `POST/DELETE /users/me/avatar` y `/users/me/cover` en User & Follow Service (multer en memoria, validación del tipo real con `sharp`, máx. 5 MB, recorte a 400×400 / 1500×500, WebP sin EXIF), guardadas en almacenamiento S3 (local: contenedor **S3Mock**, porque las imágenes oficiales de MinIO dejaron de publicarse). Frontend con selector, recorte (`react-easy-crop`), vista previa y progreso de subida
17. ✅ **TanStack Query** + fix del bug "seguir no se refleja" en el frontend; fix de `lib/my-reactions.ts` (dos pestañas se pisaban las reacciones guardadas)

18. ✅ **Lo propio fuera de "Para ti" y Explorar**: Post Service con `excludeAuthorId` en el listado, `GET /posts/activity/mine` (actividad de otras personas no vista; la propia no cuenta) y `POST /posts/:id/seen` (guarda la actividad vista en el post: `ownerSeenComments` / `ownerSeenReactions`)
19. ✅ **Paso 3 — seguir refleja el feed**: User & Follow Service publica `user_followed` / `user_unfollowed` en RabbitMQ; el Feed Service hace **backfill** (últimas 20 publicaciones, mezcladas por fecha) o **purga**, reescribiendo la lista con `WATCH`/`MULTI` para no perder un fan-out concurrente. Los follows anteriores a esto se migran solos: la primera vez que se pide un feed se sincroniza con todos los seguidos (marca `feedsync:v1:{userId}`)
20. ✅ **Paso 3 — "Para ti"**: `GET /feed/for-you` en el Feed Service: 3 publicaciones de seguidos (por recencia) por 1 de descubrimiento (gente que no sigues, ranking `(1 + reacciones + 2·comentarios) / (horas + 2)^1.4`), nunca lo propio, filtrable por tipo; sin seguidos es 100% descubrimiento. `GET /posts/batch` evita N peticiones al hidratar feeds
21. ✅ **Paso 3 — pestaña Comentarios en el perfil**: `GET /posts/comments/by-author/:authorId` devuelve cada comentario con la publicación comentada como contexto

22. ✅ **Hashtags y buscador unificado**: el Post Service extrae los `#hashtags` del título y el texto al publicar/editar y los guarda **normalizados** (minúsculas, sin tildes: `#Cálculo2` = `#calculo2`) en `posts.tags` (las publicaciones previas se indexan solas al arrancar). `GET /hashtags/suggest` (autocompletar: primero los que empiezan con lo escrito, luego los más usados), `GET /posts?tag=` y `GET /posts/search?q=` (hashtags que contienen la palabra + publicaciones con esos hashtags o la palabra en título/texto, sin importar tildes). User & Follow Service: `GET /users/search?q=` (nombre, apellido o @usuario). Frontend: autocompletado al escribir `#` en el composer (teclado y mouse, opción "Crear nuevo"), hashtags como enlaces, página de tema `/explorar?tag=`, Explorar como buscador de temas + personas + publicaciones, "Temas populares" en el panel derecho

23. ✅ **Foco de los campos de texto**: la regla global `:focus-visible` pasó a `@layer base` y excluye los campos de texto (cada uno marca el foco en su borde o en su contenedor), así no hay dos indicadores a la vez
24. ✅ **PR #8 mergeado a `main`** (6 commits: chore, post-service, user-follow-service, feed-service, frontend, docs)
25. ✅ **Limpieza del repo**: se quitó la coautoría de Claude de los commits (historial reescrito con force-push), los 28 commits quedaron con el correo `droupandres@gmail.com` (vinculados a la cuenta `andresklve`) y se borraron las ramas ya mergeadas: hoy el repo solo tiene `main`

26. ✅ **Setup reproducible**: Postgres 16 dentro de `docker-compose` (puerto **5433** en el host para no chocar con un Postgres local; crea `piensaya_auth` y `piensaya_users` solo, vía `backend/docker/postgres/init.sql`) y un `.env.example` por servicio + `frontend/.env.example`, con valores de desarrollo que ya funcionan juntos. `start-all.sh` copia los `.env` que falten, espera el healthcheck de Postgres (`up --wait`) y corre `prisma migrate deploy` en auth y user-follow
27. ✅ **Reacción propia persistida**: el Post Service ya guardaba una reacción por usuario en Mongo, pero solo devolvía conteos. Ahora `GET /posts`, `/posts/:id`, `/posts/batch` y `/posts/search` aceptan token opcional (`OptionalJwtAuthGuard`: sin token = anónimo, token inválido = 401 para que el cliente lo renueve) y cada publicación trae `myReaction`. El Feed Service reenvía el header `Authorization` al hidratar "Para ti". El frontend lee `post.myReaction` y se borró `lib/my-reactions.ts` (localStorage)
28. ✅ **CI con GitHub Actions**: 5 servicios en matriz + frontend (ver "Testing")

## Flujo de trabajo con git

- Todo el código vive en `main`. Para cada cambio: rama nueva desde `main` (`feature/<tema>`), PR y merge; después se borra la rama
- El repo tiene configurado `user.email = droupandres@gmail.com` para que los commits se vinculen a la cuenta de GitHub (la config global de la Mac no tiene correo)
- Los commits y PRs **no** llevan líneas de coautoría ni "Generated with" de herramientas de IA
- `gh` (GitHub CLI) está instalado y autenticado como `andresklve`, así que los PRs se pueden abrir desde la terminal (`gh pr create`)
- `main` **no** tiene protección de rama activada en GitHub (el flujo con PR es por convención). Recomendado: activar "Automatically delete head branches" en Settings → General
- Nota: la barra lateral "Contributors" de GitHub puede seguir mostrando a @claude un tiempo por caché (GitHub guarda los commits originales del PR #8). Si no desaparece, solo GitHub Support puede borrar esas referencias

## Cómo correr en local

**Camino rápido (máquina nueva)**: tener Docker abierto, `pnpm install` en cada servicio de `backend/` y en `frontend/`, y correr `./start-all.sh`. El script crea los `.env` desde los `.env.example`, levanta todo en Docker (incluido Postgres con sus dos bases), aplica las migraciones de Prisma y arranca los servicios. No hace falta instalar Postgres ni crear bases a mano.

Detalle:

1. Postgres: por defecto el del `docker-compose` (`localhost:5433`, usuario/contraseña `postgres`/`postgres`, bases creadas solas). Si prefieres un Postgres instalado en la máquina, apunta `AUTH_DATABASE_URL` / `USER_DATABASE_URL` a él y crea las dos bases.
2. Cada servicio de `backend/` lee su `.env` (en `.gitignore`; la plantilla es `.env.example`). Variables que lee cada uno:
   - **auth-service**: `PORT`, `AUTH_DATABASE_URL`, `JWT_SECRET`, `JWT_ACCESS_EXPIRES_SECONDS`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_SECONDS`, `USER_SERVICE_URL`, `INTERNAL_SERVICE_TOKEN`
   - **user-follow-service**: `PORT`, `USER_DATABASE_URL`, `JWT_SECRET`, `INTERNAL_SERVICE_TOKEN`, `STORAGE_ENDPOINT` (`http://localhost:9090`), `STORAGE_BUCKET` (`piensaya-media`), `STORAGE_REGION`, `RABBITMQ_URL`, `RABBITMQ_FEED_QUEUE` (publica `user_followed` / `user_unfollowed`) (opcionales en AWS: `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_PUBLIC_URL`)
   - **post-service**: `PORT`, `MONGO_URI`, `JWT_SECRET`, `RABBITMQ_URL`, `RABBITMQ_FEED_QUEUE`
   - **chat-service**: `PORT`, `MONGO_URI`, `JWT_SECRET`, `REDIS_URL`, `USER_SERVICE_URL`
   - **feed-service**: `PORT`, `JWT_SECRET`, `RABBITMQ_URL`, `RABBITMQ_FEED_QUEUE`, `REDIS_URL`, `USER_SERVICE_URL`, `POST_SERVICE_URL`, `FEED_MAX_LENGTH`
   - `JWT_SECRET` debe ser **idéntico** en los 5. `INTERNAL_SERVICE_TOKEN` debe ser idéntico entre auth y user-follow. `RABBITMQ_FEED_QUEUE` debe ser idéntico entre post, user-follow y feed.
3. `frontend/.env.local` (plantilla `frontend/.env.example`) con `NEXT_PUBLIC_AUTH_URL`, `NEXT_PUBLIC_USERS_URL`, `NEXT_PUBLIC_POSTS_URL`, `NEXT_PUBLIC_CHAT_URL`, `NEXT_PUBLIC_FEED_URL` (`http://localhost:3000` a `3004`) — si faltan, el frontend tira `Failed to construct 'URL': Invalid URL`.
4. `./start-all.sh` desde la raíz del repo: copia los `.env` que falten (no toca los existentes), levanta Docker Compose y espera los healthchecks (`up --wait`), corre `prisma migrate deploy` en auth y user-follow (si falla solo avisa; ver `logs/<servicio>.migrate.log`), compila los 5 servicios **en secuencia** (no en paralelo — ver nota abajo) y los arranca junto al frontend. Logs en `logs/<servicio>.log`. Ctrl+C detiene todo.
   - Si una base ya tenía tablas creadas con `prisma db push` (sin historial), `migrate deploy` falla con **P3005**: sincronizar con `pnpm exec prisma db push` y marcar cada migración con `pnpm exec prisma migrate resolve --applied <carpeta>`.
5. Para desarrollo activo de un solo servicio con hot-reload, usar `pnpm start:dev` dentro de su carpeta (no usar `start-all.sh` para eso).

**Nota de tooling**: `nest-cli.json` tiene `deleteOutDir: true` en los 5 servicios. Dos problemas relacionados, ambos resueltos en `start-all.sh`:
1. *Carrera de compilación*: ese borrado de `dist/` es asíncrono; si varios servicios compilan a la vez bajo carga, puede terminar después de que el archivo ya se escribió y lo elimina (`Cannot find module dist/main`). Por eso el script compila uno por uno y luego arranca todos los `node dist/main.js` en paralelo.
2. *Caché incremental obsoleto*: con `incremental: true`, `tsc` guarda `tsconfig.build.tsbuildinfo` en la raíz del servicio (fuera de `dist/`). Al reiniciar sin cambios en `src/`, asumía el output al día mientras `deleteOutDir` ya lo había borrado: build "exitoso" sin archivos y el servicio crasheaba al iniciar (síntoma en el frontend: `Failed to fetch`). Ya no se usa `incremental` y el script limpia los `.tsbuildinfo`.

**Nota del dev server del frontend**: el loader `@tailwindcss/turbopack` de este setup no recarga el CSS en caliente tras cambiar `globals.css` o los tokens; hay que reiniciar `pnpm dev` (idealmente borrando `frontend/.next`).

También se agregó `pnpm-workspace.yaml` en auth-service, user-follow-service, post-service, chat-service y feed-service para dos políticas de seguridad nuevas de pnpm 12: `minimumReleaseAgeExclude` (paquetes transitivos muy recién publicados) y `allowBuilds` (scripts de instalación de paquetes nativos como Prisma/bcrypt/parcel-watcher).

## Windows (laptop) — configuración específica de este equipo

> **Si lees esto desde la Mac:** esta sección es solo para la laptop con Windows. El código es el mismo; lo que cambia es el entorno local (`.env` no se versionan). No copies estos valores a la Mac sin revisarlos.

Configurado el 10 de octubre, 2026. Todo corre y fue verificado (los 5 servicios + frontend responden; registro y login probados de punta a punta).

- **Postgres local (instalado en Windows, no el de Docker)**: escucha en el puerto **5434** (no el 5432 por defecto), usuario `postgres`; la contraseña solo está en los `.env` locales de esta laptop (no se versiona). Las bases `piensaya_auth` y `piensaya_users` se crearon a mano desde pgAdmin
  - El Postgres del `docker-compose` (5433) también se levanta aquí, pero los `.env` de Windows siguen apuntando al local (5434). Para pasarse al de Docker basta cambiar las dos URLs por las de `.env.example` (se verificó que las migraciones se aplican bien ahí)
- **Docker Desktop** debe estar abierto antes de arrancar. `backend/docker-compose.yml` levanta Postgres, Mongo, Redis, RabbitMQ y S3Mock (puertos 5433, 27017, 6379, 5672/15672, 9090)
- **`.env` de cada servicio** reescritos completos (ver lista de variables en "Cómo correr en local"):
  - `AUTH_DATABASE_URL` / `USER_DATABASE_URL` = `postgresql://postgres:<contraseña>@localhost:5434/<base>`
  - `PORT` explícito en los 5 servicios (3000 a 3004)
  - `JWT_SECRET`, `JWT_REFRESH_SECRET` e `INTERNAL_SERVICE_TOKEN` son cadenas aleatorias de 64 hex, con `JWT_SECRET` idéntico en los 5 e `INTERNAL_SERVICE_TOKEN` idéntico en auth y user-follow
  - user-follow-service: `STORAGE_ENDPOINT=http://localhost:9090`, `STORAGE_BUCKET=piensaya-media`, `STORAGE_REGION=us-east-1`, `RABBITMQ_URL=amqp://guest:guest@localhost:5672`, `RABBITMQ_FEED_QUEUE=feed_events`
  - feed-service: se añadió `POST_SERVICE_URL=http://localhost:3002`
  - `frontend/.env.local` ya apuntaba a `localhost:3000` a `3004` (sin cambios)
- **Prisma**: las bases ya tenían tablas creadas con `db push` y sin historial, así que `prisma migrate deploy` fallaba con **P3005**. Se resolvió con `prisma db push` (sincroniza sin borrar datos) + `prisma migrate resolve --applied <migración>` para cada migración. Ya quedaron con historial: `start-all.sh` aplica las migraciones nuevas solo
- **Arranque**: `bash ./start-all.sh` desde la raíz (Git Bash; funciona igual que en la Mac). Instalar antes con `pnpm install` en cada servicio y en `frontend/`. Logs en `logs/<servicio>.log`
- **Para detener todo** (si se lanzó en segundo plano): cerrar la terminal que corre el script, o terminar los procesos `node` y luego `docker compose -f backend/docker-compose.yml stop`
- `GET /` del feed-service devuelve 404; es normal (no tiene `/docs`, solo `/feed/*`)

## Próximos pasos

- Revisar en GitHub (en uno o dos días) que @claude ya no aparezca en "Contributors"; si sigue, escribir a GitHub Support
- Terminar el diagrama de arquitectura y el README (pendiente a propósito)
- Desplegar (AWS u otro) para tener demo en línea (pendiente a propósito, después del diagrama)
- Añadir endpoint de sugerencias de usuarios
- Tests de integración / e2e del flujo post → RabbitMQ → feed (hoy solo unitarios)
- Rate limiting y paginación en followers/following
- Implementar Google OAuth (desde el frontend)
- Considerar bajar `deleteOutDir` a `false` en los 5 `nest-cli.json` para eliminar la carrera de compilación de raíz, en vez de depender de que `start-all.sh` compile en serie
