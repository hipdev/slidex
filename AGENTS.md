# Slidex

- Frontend: `apps/web`, Rebask 0.6 + Vite + React 19. Read
  [its instructions](apps/web/AGENTS.md) and the
  [Rebask guide](docs/agents/rebask.md) before changing it. Do not reintroduce Next.js.
- Backend: `packages/backend/convex`. Read
  `packages/backend/convex/_generated/ai/guidelines.md` before editing Convex functions.
- Follow the [local development guide](docs/agents/local-development.md) for setup,
  checks and deployment. Keep secrets in Convex; only public configuration belongs
  in `VITE_*` variables.
- Authentication stays on Convex Auth 2.1. Preserve guest identities, upgrade
  ownership and backend permissions. This app uses browser sessions; it does not
  claim Conjuntify's SSR/httpOnly-cookie authentication contract.
- Frontend output is `apps/web/out`. Never publish `dist/rsc`, `dist/ssr` or
  `dist/.rebask` as static assets. Runtime routes require an explicit hosting change.
