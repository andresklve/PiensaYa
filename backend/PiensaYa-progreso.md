# PiensaYa — Estado del proyecto

Última actualización: 8 de octubre, 2026

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
- Docker Compose para levantar Mongo, Redis y RabbitMQ localmente (`backend/docker-compose.yml`)

**Frontend** (pendiente de iniciar)
- Next.js (React + TypeScript)

**Testing**
- Jest, con tests unitarios por servicio (42 tests en total entre los 5)

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
- Paginación en followers/following, búsqueda de usuarios por nombre, subida real de avatar (storage tipo S3), tests e2e, rate limiting
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
9. ✅ Infraestructura local con Docker Compose (Mongo, Redis, RabbitMQ) + 2 bases PostgreSQL

## Próximos pasos

- Iniciar el frontend en Next.js
- Implementar Google OAuth (desde el frontend)
- Evaluar cuándo abordar AWS/infra vs. seguir cerrando huecos del backend (paginación, búsqueda, rate limiting)
