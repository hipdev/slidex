# Migración de Next.js a Rebask

Fecha: 18 de noviembre de 2026.

## Decisiones

- Se reemplazaron Next.js, `next/dynamic`, metadata de Next y su configuración
  por Rebask 0.5.0, Vite 8.3.8, plugin React 6.3.0 y plugin RSC 0.5.39, las
  versiones verificadas por Conjuntify (base consultada: `1598a849`).
- Se adaptaron sus prácticas de grafo fijo de dependencias del navegador,
  aislamiento RSC/cliente, Suspense local, metadata con un único propietario,
  variables públicas y eliminación del peer opcional de Next de Auth 2.0.0.
- Se conserva el hosting estático de Convex y su carpeta pública `out/`.
  El adaptador local usa la API pública de build de Rebask; no depende de parches
  ni de rutas internas de su paquete. Se rechazan páginas que requieren runtime.
- Auth 2.0 y el modelo de sesión de Slidex permanecen en el navegador. No se
  introdujo la infraestructura SSR/cookies/Cloudflare de Conjuntify.
- Las visualizaciones conservan carga diferida y exclusión de SSR con
  `React.lazy`, `Suspense` y `ClientOnly`.
- La primera hidratación usa un placeholder estático estable antes de montar
  el cliente. Se detectó y corrigió React #418 al recargar con español guardado:
  el efecto del provider podía cambiar el idioma antes de hidratar un segmento.
  No se ocultó el problema con `suppressHydrationWarning`.

## Comprobaciones automatizadas

- Instalación `pnpm install --frozen-lockfile` correcta; `pnpm why next -r`
  sin Next instalado como dependencia directa ni peer transitivo.
- `pnpm typecheck`: frontend y backend correctos.
- `pnpm test`: 11 pruebas de backend/Auth correctas, 278 traducciones verificadas.
- `pnpm test:web`: tres pruebas adicionales de exportación y preview:
  rechazo de PPR/runtime/páginas incompletas, GET/HEAD/MIME/404 y rutas privadas,
  copia desde un workspace oculto sin manifests privados ni bundles de servidor.
- `pnpm build`: prerender de `/` y `/404`, con assets cliente exportados a `out/`.
  `dist/rsc`, `dist/ssr` y `dist/.rebask` quedan fuera de los archivos públicos.
- Se conserva el aviso de tamaño del chunk diferido de Three.js (~535 kB sin
  comprimir). No se incorpora al módulo inicial de las visualizaciones.

## Comprobaciones de navegador

Se probó la exportación real con el servidor de preview, y Vite en un origen
local separado para obtener una identidad de audiencia independiente:

- Entrada anónima, creación de sala y conservación de permisos de host al recargar.
- Acceso de audiencia desde Vite con controles de host ausentes.
- Reacción de audiencia en tiempo real y gráfico diferido de pulso.
- Diálogo de cuenta con historial; no se crearon contraseñas nuevas en navegador.
- Cambio de idioma a español y conservación de la preferencia tras recarga.
- Vista directa `?room=…&view=stage` y comprobación de Atrás/Adelante.
- HMR de un componente cliente sin perder la sala ni emitir errores de hooks.
- Tras corregir la hidratación, las consolas de Vite y del export final no
  mostraron errores ni warnings en las comprobaciones repetidas.

La prueba no ejercitó micrófono real, solicitudes externas de IA ni recepción de
correo: esos servicios y sus endpoints no forman parte de la migración. No se
repitió una auditoría móvil completa ni una revisión de todos los tamaños de
pantalla. Las pruebas de Auth existentes siguen cubriendo registro, login,
renovación, revocación, rollback y conservación de propiedad.
