# Rebask en Slidex

Slidex usa **Rebask 0.5.0**, React 19, Vite 8.3.8, `@vitejs/plugin-react` 6.3.0 y
`@vitejs/plugin-rsc` 0.5.39. Las rutas siguen en `apps/web/app`; los componentes
compartidos están en `apps/web/components`.

Esta guía adapta el conocimiento de Conjuntify, proyecto hermano, concretamente
`docs/agents/rebask.md`, `apps/web/AGENTS.md`, `apps/web/vite.config.ts` y
`.pnpmfile.cjs`. Se consultaron el 18 de noviembre de 2026 (base Git de Conjuntify: `1598a849`). No se trasladaron sus
reglas de condominios, roles, servicios de IA, cookies SSR ni infraestructura.

Referencias del framework: [documentación](https://rebask.com/docs),
[cheatsheet](https://rebask.com/cheatsheet) y las declaraciones públicas de la
versión instalada (`@rebask/core/vite`). Las versiones están fijadas para que las
prácticas y el pequeño adaptador estático tengan un contrato verificable.

## Rutas, búsqueda y navegación

- `app/layout.tsx` conserva el documento, los estilos, la metadata y el provider
  de idioma. `app/page.tsx` renderiza el cliente interactivo.
- Los enlaces actuales son navegaciones de documento. `?room=LIVE-…` conserva
  la sala y `&view=stage` la vista de presentación al recargar.
- Para estado local futuro (pestañas o filtros), usa `history.pushState` o
  `replaceState` conservando `history.state`, los demás parámetros y el hash;
  escucha `popstate` si el componente necesita reaccionar a Atrás/Adelante.
  No agregues un segundo router ni una caché de datos de usuario.
- Slidex se publica en un host estático: no puede resolver peticiones Flight
  adicionales ni funciones de servidor. No cambies enlaces por `Link` o
  `router.push/replace` de Rebask sin proporcionar y probar esas respuestas.
- Si se añade un servidor Rebask, sus APIs nativas usan exports nombrados:
  `Link`, `Image`, `routeParams` y `searchParam` en sus subpaths. Los parámetros
  no llegan como props de Next.js. Lee datos de petición debajo de Suspense;
  las rutas HTTP reciben `Request` y devuelven `Response`.
- Un ID o código en la URL no concede permisos. Convex valida la identidad y
  la propiedad de las presentaciones.

## Providers, datos y límites de carga

Conserva la sesión y los providers en un árbol estable. La integración actual de
Auth 2.0 es de cliente, igual que antes de la migración. Se mantienen invitados,
registro con correo/contraseña, renovación, revocación y conversión del invitado
sin perder su usuario ni sus presentaciones. No hay cookies SSR/httpOnly ni
sesiones de Conjuntify copiadas a este proyecto.

`useQuery` sigue siendo reactivo: no lo envuelvas en un efecto para recargarlo.
Usa `"skip"` al no tener los argumentos o la sesión y distingue `undefined`
(cargando) de `null` (sin recurso). Nunca muestres datos de otra sesión para
ocultar una espera. Cualquier control de acceso real pertenece al backend.

Suspense controla qué región se revela; no ejecuta consultas ni autoriza al
usuario. Mantén el marco y los controles persistentes fuera de regiones de carga
independientes. Conserva las dimensiones y textos de los fallbacks. No añadas
esperas artificiales ni retengas globalmente una pantalla hasta cargar todo.

Las visualizaciones usan `React.lazy`, `Suspense` y `ClientOnly`, sustituyendo
`next/dynamic` con `ssr: false`. La importación de Three.js sigue siendo diferida;
WebGL, observers y APIs del navegador se ejecutan en efectos y se limpian al
salir. No importes módulos que lean `window` o `document` durante SSR.

## Documento y metadata

El layout es el único propietario del título, descripción, viewport y favicon.
Usa elementos React (`title`, `meta`, `link`); no uses el tipo `Metadata` de
Next.js ni el antiguo `HeadScript` de Rebask. Conjuntify identificó conflictos de
reconciliación al manipular nodos de metadata que React todavía posee.

El arranque de `app/page.tsx` tiene un `ClientOnly` con texto estático estable.
Es deliberado: el efecto del provider de idioma puede ejecutarse antes de que un
segmento cliente se hidrate. Renderizar allí texto traducido directamente podía
comparar HTML inglés del build con español guardado y producir React #418.
La aplicación interactiva se monta después de hidratar ese límite. No elimines
esa separación ni la reemplaces por `suppressHydrationWarning`.

El idioma se aplica en `LanguageProvider`, conservando la preferencia del
navegador y actualizando `document.documentElement.lang` después de hidratar.

## Desarrollo estable con Vite

Mantén el orden `rsc()`, `react()`, `rebask()` y después el adaptador estático.
Como en Conjuntify, `environments.client.optimizeDeps` usa una lista explícita y
`noDiscovery: true`. Los módulos RSC llegan después del crawl inicial; descubrir
dependencias tarde puede reemplazar chunks de React y provocar errores 504 o un
dispatcher de hooks nulo. Cada nueva dependencia del navegador o subpath debe
estar en `include` antes de comprobar navegación en frío y después de HMR.

Core se mantiene fuera del prebundle mediante su exclusión nativa. No fuerces
condiciones `react-server` en todo el proyecto ni compartas el grafo del cliente
con RSC. No se necesita el parche del adapter Cloudflare de Conjuntify: Slidex no
usa ese adapter y Core 0.5.0 se instala sin parches.

`.pnpmfile.cjs` elimina únicamente el peer opcional `next` de Auth **2.0.0**,
igual que Conjuntify. No altera el runtime de Auth ni sus dependencias. Revisa ese
hook al actualizar Auth; no amplíes la excepción a otras versiones sin probarlas.

## Configuración pública y secretos

Usa `import.meta.env.VITE_CONVEX_URL`. El build admite temporalmente
`NEXT_PUBLIC_CONVEX_URL` como alias para conservar el symlink local existente.
La CLI de Convex Static Hosting ya proporciona `VITE_CONVEX_URL` al construir.

Carga únicamente los prefijos públicos y define únicamente esa URL. Nunca
incrustes todo `process.env`, el archivo de entorno del backend ni credenciales
con `vite.define`. Las claves de OpenAI, Firecrawl, AgentMail y firmas permanecen
en Convex y no se trasladan al cliente.

## Build y alojamiento estático

`pnpm build` compila los entornos cliente, SSR y RSC con Rebask, prerenderiza
`/` y `/404`, y ejecuta `scripts/static-export.mjs`. El adaptador consume la API
pública de build de Core, exige HTML completo e independiente de la petición y
copia solo assets públicos y documentos a `apps/web/out`.

Los bundles en `dist/rsc`, `dist/ssr` y las cachés `dist/.rebask` son privados y
no se publican. La página 404 se exporta como `404.html`. El build rechaza shells
PPR, páginas dependientes de la petición, ausencia de home/404 y rutas HTTP.

No añadas `"use server"`, cookies, headers o datos privados a las rutas estáticas.
Si se necesitan, primero cambia el alojamiento a un adapter de servidor y
prueba sus bindings y sesiones. En una futura adopción de Cloudflare, la regla
traída de Conjuntify es publicar el bundle y config generados como conjunto,
nunca solo el Worker, los assets o los snapshots privados.

`pnpm --filter=slidex-web preview` sirve **out/**, sin un servidor Rebask que
oculte archivos faltantes. GET, HEAD, MIME de assets y respuestas 404 se prueban
con ese servidor. No hay fallback de todas las URLs hacia el home.

## Verificación

Ejecuta instalación frozen, tipos, pruebas y build. Después verifica Vite en
frío y el export estático real: entrada anónima, creación/apertura de sala,
recarga de URL compartida y stage, selector de idioma, Atrás/Adelante, diálogo de
cuenta, visualizaciones diferidas y consola. Comprueba móvil y escritorio cuando
se modifica layout o interacción. Un build verde no prueba hidratación ni HMR.

Las pruebas de Auth comprueban registro, login, renovación, revocación, rollback
y propiedad; la migración de framework no cambia sus contratos. Las pruebas de
exportación comprueban que no se puedan publicar páginas que necesiten servidor.
