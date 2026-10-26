# PiensaYa — Frontend

Next.js 16 (App Router) · React 19 · TanStack Query · Tailwind CSS 4 · Socket.IO.

Para levantar el proyecto completo, ver el [README principal](../README.md).

## Desarrollo

Con los servicios del backend corriendo (`./start-all.sh` desde la raíz):

```bash
cp .env.example .env.local   # URLs de los 5 servicios (localhost:3000 a 3004)
pnpm install
pnpm dev                     # http://localhost:3100
```

| Comando | |
|---|---|
| `pnpm dev` | Servidor de desarrollo en el puerto 3100 |
| `pnpm build` | Build de producción (salida `standalone`, usada por el `Dockerfile`) |
| `pnpm lint` | ESLint |

Las variables `NEXT_PUBLIC_*` se incrustan al compilar: en la imagen Docker se pasan como argumentos de build.
