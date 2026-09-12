# Slidex

Slidex is a realtime presentation system: audience reactions and polls update the slide itself, while the Slide Agent can create a new research slide during a presentation.

## Run it

```bash
pnpm install
pnpm convex:dev
pnpm dev:web
```

The first Convex command provisions or connects a development deployment from `packages/backend` and writes its local environment. The web app consumes the generated API references through `@slidex/backend/api`; it does not host Convex functions itself. Open the local URL, then select **Start a live presentation**.

## Integrations

- **Convex Auth (beta/alpha track)** issues an anonymous guest identity for every viewer and protects host-only operations. BetterAuth is not used.
- **Convex** stores presentation state, reactions, votes, inbox items, and agent operations; all are reactive.
- **Vercel AI SDK + Convex AI Gateway** creates a concise slide from researched material in `convex/research.ts`.
- **Firecrawl** is called from the research action when `FIRECRAWL_API_KEY` is set with `npx convex env set FIRECRAWL_API_KEY ...`.
- **AgentMail** can post normalized inbound email data to `POST $NEXT_PUBLIC_CONVEX_SITE_URL/agentmail` with the `x-slidex-webhook-secret` header. Set the matching `AGENTMAIL_WEBHOOK_SECRET` in Convex. Its webhook transform should send `{ presentationId, from, subject, text }`.

## Deploying to GPT Sites

The Next app uses `output: "export"`; `pnpm build` creates `apps/web/out`. The hosting descriptor at `apps/web/.openai/hosting.json` points Sites to that directory. Add `NEXT_PUBLIC_CONVEX_URL` as a public build variable in Sites and maintain Firecrawl/AgentMail secrets exclusively in Convex.
