# Slidex — tu próxima charla, viva

A realtime presentation room where the audience proposes improvements, votes, collects takeaways, and writes the closing slide together. The presenter remains in control.

**Live demo:** https://rosy-cuttlefish-617.convex.site

This public demo currently runs on the configured Convex **development** deployment. It is a working hackathon demo, not a separate production environment.

## Quick start

1. Open Slidex and choose **Crear una sala en vivo**.
2. Share **Invitar a la sala**. Guests join without an account; each browser receives an anonymous identity.
3. Audience members propose changes under **Este slide**, or save conclusions, questions and facts under **Para el cierre**. The host chooses what reaches the stage.
4. Open **Copiloto** to edit/create slides, research a topic, activate an email inbox or use voice commands.
5. Choose **Mostrar cierre colectivo** to display selected takeaways, then **Presentar** for the stage view.

An anonymous host identity belongs to that browser. Keep the room URL and use the same browser to retain control; clearing browser storage loses that identity. A shared URL lets others participate, not become host.

## Features and integrations

| Feature | What does real work |
| --- | --- |
| Suggestions and collective closing | Convex queries/mutations synchronize proposals, endorsements and host moderation across clients. Acceptance incorporates a suggestion exactly once. |
| Living research | Firecrawl searches/scrapes sources; OpenAI creates a sourced slide using the Convex Agent component and AI SDK. Uses `OPENAI_API_KEY` when configured, otherwise the existing Convex AI Gateway. |
| Voice director | Browser SpeechRecognition accepts Spanish commands. No microphone starts automatically. Commands work in a text field too. |
| Contextual moments | Separately enabled by the host. OpenAI identifies a memorable phrase and Firecrawl searches for a relevant meme image. A source link is shown; moments expire after 16 seconds. |
| Idea constellation | Lazy-loaded Three.js creates one sphere per contribution, sized by its endorsements. Includes a text fallback for WebGL failures. |
| Audience pulse | D3 scales render a chart from real reactions to the current slide. |
| Email to slide | AgentMail creates a per-room inbox, lists/fetches received mail, and passes a host-selected message to OpenAI. Original emails are visible only to the host. |
| Static hosting | Convex Static Hosting serves the Next.js export while preserving root auth and webhook routes. |

## Voice commands

Activate **Copiloto → Activar micrófono** and grant your browser microphone access, or enter these in **Comando o frase de prueba**:

- `siguiente` / `anterior`
- `cierre` / `volver al slide`
- `constelación` / `pulso`
- `investiga cómo funciona la colaboración en tiempo real`
- `crea un slide sobre aprendizaje colectivo`
- Enable **Momentos en vivo**, then say a memorable phrase or `meme cuando la charla de cinco minutos dura una hora`.

Speech recognition availability depends on the browser and its speech service. Spanish recognition is configured as `es-CO`. The browser may send audio to its speech provider. Only finalized phrases reach application logic; enabling contextual moments sends relevant phrases to OpenAI and searches to Firecrawl. Disabling moments prevents pending generation from publishing. Speech capture has no persistent audio recording in Slidex.

## Development

```sh
pnpm install
pnpm convex:dev
pnpm dev:web
```

The frontend reads `NEXT_PUBLIC_CONVEX_URL` from `apps/web/.env.local`. In this workspace that file is a local symlink to `packages/backend/.env.local`; neither file is committed. Backend code is in `packages/backend/convex`, and UI code in `apps/web`.

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm --filter=@slidex/backend exec convex dev --once
```

Tests cover independent host/guest identities, cross-room references, invalid votes, endorsement toggling, idempotent moderation, closing selection, voice opt-in, AgentMail signature verification, malformed payloads and replay deduplication.

## Authentication

Uses stable `@convex-dev/auth` 2.0 with `convexAuthProvider()`, a session-aware React provider and the username/password components. Email addresses serve as usernames; email verification is not enabled. Existing password/username components retain their mounted names so accounts and password hashes survive upgrades.

Guest sign-in and guest-to-account upgrades use a small backend adapter because 2.0 does not expose a public anonymous method. Auth owns password hashing, session storage, signing, refresh and revocation. The adapter resolves the guest identity before crossing component boundaries and upgrades the same app user inside a transaction; failed signup rolls everything back. Its component API calls are pinned to Auth 2.0 and covered by integration tests.

When upgrading an alpha deployment, export a full snapshot first. Alpha session documents are incompatible with stable 2.0. Remove expired sessions from the `auth/sessions` component table before deploying; do not clear user, username or password tables. On this development deployment all 11 legacy sessions had expired on October 14, 2026, and were removed after backup during the November 18 migration. Existing accounts sign in again with their password; expired anonymous sessions cannot recover their identity.

Auth tests exercise real Argon2 WASM, guest upgrades with retained room ownership, login, token refresh and revocation. Vitest loads WASM bytes through a small plugin to match Convex's runtime.

Setup follows [Convex Auth getting started](https://docs.convex.dev/auth/convex-auth/getting-started).

## Backend environment

Configure secrets in Convex, never in the browser:

- `FIRECRAWL_API_KEY`
- `AGENTMAIL_API_KEY`
- `OPENAI_API_KEY` (optional when Convex AI Gateway is enabled for the team)
- Convex Auth 2.0 signs tokens with the deployment key; no auth signing secrets are required.
- `AGENTMAIL_WEBHOOK_SECRET` for optional push delivery

The current deployment has working Firecrawl, AgentMail and Convex Auth settings. OpenAI via Convex AI Gateway was verified with real research and meme requests. The optional AgentMail webhook signing secret is not configured; **Consultar correos** works without it.

## AgentMail webhook

Point an AgentMail `message.received` webhook to:

`https://<deployment>.convex.site/agentmail`

Set its signing secret as `AGENTMAIL_WEBHOOK_SECRET` in Convex. The handler verifies Svix signatures, routes by `message.inbox_id`, and deduplicates using inbox/message IDs across both polling and webhook delivery. Legacy deliveries with `from_` and a configured `X-Slidex-Presentation-Id` header are also supported. No email is sent automatically.

## Deploy

```sh
# Update the development backend first, then build and publish its public demo:
pnpm --filter=@slidex/backend exec convex dev --once
pnpm deploy:demo

# Deploy production after configuring its provider secrets:
pnpm deploy
```

`deploy:demo` uploads `apps/web/out` atomically to the configured development deployment. The build wrapper maps the hosting CLI's deployment URL to `NEXT_PUBLIC_CONVEX_URL`; local builds still read `.env.local`. Auth and webhook URLs stay at the root.

## Current boundaries

- Designed for hackathon rooms: up to 50 slides; room queries show the latest 100 contributions, up to 500 registered participants and 200 stored reactions/votes. These are bounded queries, not unlimited scale claims.
- Participant count means registered guests, not live presence.
- Voice and remote images depend on browser/provider support. Text commands and image error fallbacks are available.
- A microphone start/stop UI and typed voice commands were exercised; an actual spoken command still needs a human microphone test.
- The AgentMail inbox was created and queried live. No real incoming email was sent during automated validation; signed incoming delivery is covered by tests.
- Public GitHub remote, social post and demo video remain submission work. See [hackathon.md](hackathon.md) and [demo guide](docs/demo.md).
