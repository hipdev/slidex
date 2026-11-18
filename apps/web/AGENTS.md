# Frontend Slidex

Uses Rebask 0.5.0, Vite 8.3.8 and React 19. Routes live in `app/`; shared
components live in `components/`. Next.js has been removed.

Read [Rebask usage and practices](../../docs/agents/rebask.md) before changing
routing, fetching, metadata, Suspense or build configuration. Read
[local development](../../docs/agents/local-development.md) for commands.

- Keep the document layout synchronous and metadata under one React owner.
- Keep Convex auth and language providers stable. Authorization belongs to Convex.
- Use `useQuery` reactively and explicitly handle `undefined` (loading) and `null`.
- Preserve `React.lazy` + `Suspense` + `ClientOnly` for browser-only visuals, their
  loading geometry, reduced-motion behavior and cleanup of observers/renderers.
- Follow Conjuntify's fixed browser dependency graph: update
  `environments.client.optimizeDeps.include` whenever adding a browser dependency
  or imported subpath. Keep `noDiscovery: true` and exclude Core from prebundling.
- Current hosting is static. Room/stage parameters are read in the browser.
  Keep document links for page changes; do not add RSC-only navigation or runtime
  server functions without changing and verifying the hosting adapter.
- `VITE_CONVEX_URL` is public. Never expose backend environment files with
  `loadEnv(..., "")`, `Object.assign(process.env, env)` or broad `vite.define`.
- Interactive controls retain clear hover, focus-visible, pressed and disabled
  states. Keep touch actions usable without hover and respect reduced motion.

Validate with `pnpm typecheck`, `pnpm test`, `pnpm build`, and
`pnpm --filter=slidex-web preview`. Check both development and the actual static
export in a browser: cold loading, reload, room/stage query URLs, language,
back/forward, account dialog and lazy visuals. A green build alone is insufficient.

When editing Convex, read `packages/backend/convex/_generated/ai/guidelines.md` first.
