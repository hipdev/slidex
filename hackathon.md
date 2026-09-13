# Slidex — Convex All Gas Hackathon

## Product

**“El último slide todavía no existe. Lo escribirá tu audiencia.”**

Slidex turns a presentation into a live room. The audience proposes improvements and collects takeaways; a presenter curates them into the stage. Research, email and opt-in voice add useful material while the talk is running.

## Live URL

https://rosy-cuttlefish-617.convex.site

Public working demo on the configured development deployment. Production remains a separately configurable target.

## Stack

- Next.js + React + TypeScript, static export.
- Convex database, indexed queries, transactional mutations, anonymous Auth, scheduled actions.
- Convex components: Agent, Rate Limiter, Static Hosting.
- OpenAI through the AI SDK / Convex AI Gateway, with direct-key support.
- Firecrawl v2 search/scrape and image search.
- AgentMail per-room inbox creation, retrieval and host-selected email-to-slide generation; signed webhook support.
- Three.js constellation and D3 live reaction chart.
- Browser speech recognition with an explicit start button and separate contextual-moment opt-in.

## Build log — September 12, 2026

### Stage 1 — The room writes with you

Reviewed the existing monorepo, auth and sponsor calls. Added per-slide suggestions, one-person endorsements, host moderation and a collective closing wall for conclusions, questions and curious facts. Tightened cross-room slide checks, poll validation and host controls.

Commit: `8ceec08`.

### Stage 2 — The presentation listens

Added Three.js and D3 visuals backed by audience data. Added host slide editing, stage mode, previous/next controls and Spanish voice/text commands. Mounted Convex Agent for OpenAI generation. Added opt-in contextual meme generation with Firecrawl sources and automatic expiry. Created functional AgentMail inbox activation, polling and email-to-slide controls.

Commit: `a52ebd8`.

### Stage 3 — Hosted and verified

Added usage limits, Convex Static Hosting, a URL-aware Next.js build wrapper, room-code entry, mobile participation shortcut, safer microphone startup handling, and current AgentMail webhook routing/deduplication. Added automated behavioral tests and this demo guide. Published the app at the URL above.

Validation:

- TypeScript and optimized Next.js export pass.
- Convex functions/schema/components pushed successfully.
- Five automated tests pass, including multiple auth identities, permissions and signed webhook delivery.
- Native browser: room creation; suggestion submission/acceptance; conclusion selection/display; separate mobile guest contribution and reaction updating the host; Three.js rendering; D3 reaction and typed navigation; public login, room creation and live slide editing.
- Live Firecrawl + OpenAI request produced a research slide with its source.
- Live OpenAI + Firecrawl image request produced a contextual meme with its source.
- Live AgentMail inbox creation and empty-inbox query succeeded.
- Microphone UI was exercised, but real spoken-command recognition needs a human test in the presentation browser.

## Submission status

- [x] Public convex.site demo
- [x] Convex backend and substantive sponsor integrations
- [x] Build log
- [ ] Public GitHub repo (no Git remote configured in this workspace)
- [ ] Video under 3 minutes
- [ ] Social post tagging the sponsors
- [ ] Submit on vibeapps.dev before September 22, 12 PM PT

No social posts, emails or final submissions were sent by the coding agent.

Rules checked against https://luma.com/convex-allgas-hackathon on September 12, 2026.

## September 13, 2026 — Desktop landing fit

Rebalanced the landing page using viewport-height-aware spacing and display sizes. Switched the main heading to Playfair Display with gentler tracking and readable leading. Consolidated conflicting landing overrides; the live-room layout is unchanged.

Browser measurements confirm no vertical or horizontal overflow at 1536×980, 1366×768, 1280×720 and 1024×600. Mobile at 390×844 retains natural vertical scrolling without horizontal overflow. Next.js production build passed.
