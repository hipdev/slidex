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

Para trabajar **sin desplegar**, usa `pnpm dev:web` para el frontend y las pruebas
locales de `convex-test` para el backend. `pnpm dev` y `pnpm convex:dev` sincronizan
automáticamente las funciones con Convex: no los inicies ni reanudes si el usuario
pidió esperar antes de desplegar. Tampoco hagas push a `main` en ese caso: Vercel
despliega automáticamente sus commits. Puedes crear commits locales, comprobar
tipos y generar `out/` sin publicar nada.

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

## Producción en Vercel

La web de producción está en `https://slidex-six.vercel.app`, conectada al backend
Convex `ideal-curlew-286`. Vercel importa `hipdev/slidex`, rama `main`, con raíz
`apps/web`, preset Vite y salida **`out`**. Mantén disponible el resto del workspace
durante el build. Su única variable pública necesaria es:

```dotenv
VITE_CONVEX_URL=https://ideal-curlew-286.convex.cloud
```

Publica primero el backend con `pnpm convex:deploy`, comprueba su resultado y
después publica el frontend en Vercel. No uses los scripts de Static Hosting para
actualizar la web de Vercel. `SITE_URL` en Convex apunta al dominio de la web.
Las rutas de sala siguen siendo parámetros de una página estática: `?room=LIVE-XXXXX`
y su enlace corto `?r=XXXXX`; ninguna necesita un servidor de rutas.

## Acceso por correo OTP

Slidex conserva Convex Auth **2.0.0**, sesiones en el navegador e invitados. El
único acceso con correo es OTP: `authOtp.request` encola un código con el componente
Resend y `auth.signInWithEmailOtp` lo verifica y entrega la sesión a `setSession`.
No hay endpoints de usuario/contraseña, recuperación de contraseña ni cookies SSR.

Configura en **cada despliegue de Convex**, nunca en `VITE_*` ni en Vercel:

- `RESEND_API_KEY`: la clave de envío de Resend.
- `RESEND_FROM`: `Slidex <dirección verificada>`; debe conservar un remitente válido.
- `EMAIL_OTP_SECRET`: secreto aleatorio de 32 bytes o más, diferente por entorno,
  utilizado para HMAC de los códigos. No lo sustituyas por una clave de servicio.

El flujo y las seis casillas se adaptaron de Tranky. Los códigos duran cinco
minutos, solo se usan una vez, admiten cinco intentos y se vinculan a la identidad
que los pidió. El reenvío espera 60 segundos; hay límites por correo y globales.
Los desafíos guardan un nonce y un HMAC, nunca el código, y se eliminan al vencer.
La entrega se encola en Resend dentro de la misma transacción; un fallo al encolar
revierte el desafío y los límites consumidos.

Un correo nuevo convierte al invitado en cuenta verificada **sin cambiar su ID**.
Para un correo que ya tiene cuenta, las presentaciones del invitado se trasladan
a esa identidad existente en lotes de 100. Solo ocurre tras verificar el código.
Las sesiones invitadas anteriores se revocan y el core mantiene renovación y
cierre de las sesiones OTP. Las cuentas de la etapa de contraseñas conservan sus
usuarios e historial y acceden ahora mediante el código enviado a su correo.

Las pruebas de Auth usan una base aislada y simulan la cola de Resend: no mandan
correos reales. Comprueban propiedad, migración de invitados, compatibilidad con
cuentas existentes, límites, caducidad, reemplazo y uso único de códigos, fallos
de entrega, renovación y revocación. Comprueba ambos pasos del diálogo en móvil
y escritorio antes de publicar. El frontend requiere `input-otp` en la lista
explícita de dependencias que Vite precompila.

## JD y contador compartido

JD reutiliza los Workers de transcripción e interpretación de Conjuntify. Configura
estas cuatro variables **en cada despliegue de Convex**, nunca en Vite o Vercel:

- `CLOUDFLARE_TRANSCRIPTION_API_URL`
- `CLOUDFLARE_TRANSCRIPTION_API_TOKEN`
- `CLOUDFLARE_AI_API_URL`
- `CLOUDFLARE_AI_API_TOKEN`

Los endpoints HTTPS son `/v1/transcriptions` (audio multipart) y `/v1/generate`
(interpretación estructurada, feature `voice-interpretation`). Solo el propietario
puede enviar comandos, con comprobación de permisos antes de llamar al proveedor
y al aplicar el cambio. El audio se limita a 30 segundos en el cliente y 512 KB
en el backend; Slidex no lo persiste. JD ofrece voz, texto y presets sin proveedor.

El contador comparte una fecha de finalización del servidor, no escribe cada
segundo. Todos los clientes reciben sus cambios con `useQuery`, muestrean el reloj
del servidor y dibujan el tiempo restante con un reloj monotónico. Pausar conserva
los milisegundos restantes; continuar calcula una nueva fecha. Recargar o entrar
tarde conserva el estado. Solo el host puede iniciar, ajustar, pausar, continuar
o quitarlo. El reloj se muestra como dígitos en la esquina superior derecha de
la diapositiva, sin caja ni botones; los cambios se piden a JD.

JD también avanza o retrocede **una** diapositiva y genera una nueva con el tema
dictado. La nueva diapositiva se inserta después de la actual y queda seleccionada
en una única transacción, respetando el límite de 50 slides. La generación usa
el mismo Worker de Cloudflare y valida título y cuerpo; si otra sesión cambia
la diapositiva durante la generación, el cambio se rechaza para evitar publicar
en un lugar inesperado. Navegación y comandos tienen un presupuesto separado
de la generación para permitir dirigir la charla sin agotar el límite de slides IA.

`JD, baja el contador 4 minutos porque voy tarde` resta 240 segundos al tiempo
**restante** sin reiniciar el reloj. `Suma dos minutos` añade 120 segundos;
`déjalo en diez minutos` fija un contador nuevo. Un ajuste conserva la pausa
si estaba pausado, nunca baja de cero y no permite más de cuatro horas restantes.

La primera diapositiva muestra el QR y el código. `Mostrar QR` abre la invitación
a pantalla completa. La audiencia móvil no recibe el navegador de diapositivas
ni los controles de JD; sigue la diapositiva seleccionada por el host.

Verifica `pnpm typecheck`, `pnpm test`, `pnpm build`, el modo Vite y el export con
dos sesiones distintas (host y audiencia), incluyendo pantalla de 390 px, enlace
corto, contador, pausa y recarga. Para comprobar voz, invoca `jd.talk` autenticado
como propietario con audio real o sintetizado y confirma el deadline compartido.

## Alojamiento alternativo existente en Convex

```sh
pnpm deploy:demo  # demo en el despliegue Convex de desarrollo
pnpm deploy      # backend/hosting de producción, con su configuración propia
```

Estos comandos siguen usando Convex Static Hosting y reconstruyen el frontend
con `VITE_CONVEX_URL` del destino antes de subir `out/`. `/agentmail` sigue siendo
un endpoint del backend. No publiques `dist/` ni uses las instrucciones de
Cloudflare de Conjuntify como si Slidex tuviera esa infraestructura.
