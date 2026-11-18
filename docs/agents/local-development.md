# Desarrollo local

Requisitos: Node.js 22.12 o superior y pnpm 11.5.1. Usa las versiones fijadas en
los manifests y el lockfile; no se requiere Next.js ni un Worker Cloudflare.

```sh
pnpm install --frozen-lockfile
pnpm convex:dev
# En otra terminal:
pnpm dev:web
```

Vite sirve Slidex en `http://127.0.0.1:3000`. Configura en
`apps/web/.env.local` la URL pública del mismo backend de desarrollo:

```dotenv
VITE_CONVEX_URL=https://<deployment>.convex.cloud
```

En este workspace ese archivo es un symlink al entorno del backend. La variable
anterior `NEXT_PUBLIC_CONVEX_URL` sigue funcionando temporalmente para no romper
esa configuración. No subas los archivos locales ni copies sus secretos al build.

## Comprobaciones

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm --filter=slidex-web preview --port 3100
```

La vista previa sirve `apps/web/out`, exactamente el contenido público del
export. Revisa también desarrollo con Vite: su grafo y HMR no se comprueban solo
con la vista previa. Las prácticas del framework están en [rebask.md](rebask.md).

## Publicación existente

```sh
pnpm deploy:demo  # demo en el despliegue Convex de desarrollo
pnpm deploy      # backend/hosting de producción, con su configuración propia
```

Estos comandos siguen usando Convex Static Hosting y reconstruyen el frontend
con `VITE_CONVEX_URL` del destino antes de subir `out/`. `/agentmail` sigue siendo
un endpoint del backend. No publiques `dist/` ni uses las instrucciones de
Cloudflare de Conjuntify como si Slidex tuviera esa infraestructura.
