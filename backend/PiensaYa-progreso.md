# PiensaYa — Estado del proyecto

Última actualización: 8 de octubre, 2026

## Qué es

Proyecto personal de portafolio (sin afiliación institucional ni fines comerciales): una plataforma tipo **Medium + Twitter** para comunidad estudiantil.

**Funcionalidades core:**
- Publicar artículos largos (posts) y publicaciones cortas (tweets, límite 280 caracteres)
- Comentar y reaccionar (6 tipos: like, dislike, feliz, triste, enojado, interesante)
- Seguirse entre usuarios
- Chat privado 1 a 1 en tiempo real
- Notificaciones de toda esa actividad

## Repositorio

- GitHub: `andresklve/PiensaYa`
- Descripción del repo: *"Plataforma social para estudiantes. Proyecto de portafolio personal para explorar arquitectura de software y diseño de sistemas escalables."*

## Decisión de arquitectura

Arranca como **arquitectura de microservicios** (no monolito modular), para demostrar en portafolio manejo de sistemas distribuidos, DDD, comunicación síncrona/asíncrona, y Sagas.

### Los 5 servicios

1. **Auth Service** — registro y login, JWT
2. **User & Follow Service** — perfiles de usuario + grafo de seguidores (PostgreSQL)
3. **Post & Tweet Service** — contenido largo y corto (MongoDB, optimizado para escrituras rápidas)
4. **Chat Service** — mensajería en tiempo real (WebSockets + Redis Pub/Sub)
5. **Feed Service** — el núcleo del portafolio. Event-driven: escucha el evento `PostCreated` vía RabbitMQ, consulta al Follow Service los seguidores del autor, y pre-genera/indexa el feed en Redis (caché)

### Flujo de eventos (Post → Feed)

```
Post Service --publica evento: PostCreated--> RabbitMQ --entrega--> Feed Service
                                                                        |
                                                          consulta síncrona (REST)
                                                                        v
                                                          User & Follow Service
                                                                        |
                                                                        v
                                                          Feed Service escribe en
                                                            Redis (caché de feed)
```

- Línea de evento (Post → RabbitMQ → Feed) = **asíncrona**
- Línea Feed → Follow Service = **síncrona** (REST, pregunta "¿quiénes siguen a este autor?")

## Stack técnico

**Backend**
- NestJS (TypeScript) — elegido por su similitud con Spring Boot (controllers, DTOs, DI), stack que ya conoce de un proyecto universitario
- pnpm como gestor de paquetes
- CommonJS (CJS), no ESM — mejor soporte del ecosistema Nest por ahora
- Prisma como ORM (equivalente a JPA/Hibernate)
- PostgreSQL para Auth y User/Follow Service
- MongoDB para Post/Tweet Service
- Redis para caché de feed y Pub/Sub del chat
- RabbitMQ como broker de mensajería (eventos entre Post Service y Feed Service)
- Passport + JWT para autenticación
- class-validator / class-transformer para DTOs
- @nestjs/swagger para documentación de API

**Frontend** (pendiente de iniciar)
- Next.js (React + TypeScript)

**Testing**
- Jest + Supertest (vienen integrados con Nest)

## Decisiones pendientes / a futuro

- Despliegue en AWS más adelante (después de tener todo funcionando local con Docker Compose), principalmente para demostrar fundamentos de cloud/DevOps:
  - RabbitMQ → podría migrarse a SQS + SNS
  - Postgres → RDS
  - MongoDB → DocumentDB o MongoDB Atlas
  - Redis → ElastiCache (sin free tier, evaluar)
  - Servicios NestJS → ECS/Fargate o EC2
  - Posible Infraestructura como Código (Terraform/CDK) y CI/CD con GitHub Actions
- Diagrama de arquitectura completo (versión detallada del flujo Post→RabbitMQ→Feed) — en progreso en Excalidraw

## Progreso técnico hasta ahora

1. ✅ Repositorio creado en GitHub (`andresklve/PiensaYa`), con README inicial
2. ✅ Carpeta `backend/` generada con `nest new` (pnpm, CJS)
3. ✅ Dependencias instaladas: `@nestjs/swagger`, `swagger-ui-express`, `class-validator`, `class-transformer`, `@prisma/client`, `prisma` (dev)
4. ✅ Git configurado localmente (usuario y correo)
5. ✅ Creadas 5 ramas en GitHub, una por microservicio:
   - `feature/auth-service`
   - `feature/user-follow-service`
   - `feature/post-service`
   - `feature/chat-service`
   - `feature/feed-service`
6. 🔄 Trabajando actualmente en `feature/auth-service`

## Próximos pasos

- Definir el `schema.prisma` del Auth Service
- Generar el módulo de auth (`nest g resource auth`)
- Configurar Swagger en `main.ts`
- Implementar registro + login + estrategia JWT
