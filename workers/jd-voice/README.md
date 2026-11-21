# JD natural voice

This isolated Worker renders only signed replies from Slidex's Convex backend.
Its AI binding uses Deepgram Aura 2 (`alvaro` for Spanish, `orion` for English),
returning MP3 audio. It has no database access and holds no private keys.

Production: `https://slidex-jd-voice.julianfullstackdev.workers.dev`.

Deployment uses Cloudflare's Worker upload API as an ES module, with:

- `index.mjs` as a module, plus a generated entrypoint calling
  `createVoiceWorker(publicKey)` with `public-key.json`.
- An `ai` binding named `AI`.
- Compatibility date `2026-11-21`.
- Observability logs and traces enabled; no text/audio or signatures in logs.
- Workers.dev enabled; preview URLs disabled.

Convex holds `JD_VOICE_PRIVATE_KEY` as a private P-256 JWK and
`JD_VOICE_API_URL`. Key rotation must update both the Convex secret and this
public verification key before new requests are sent. Never commit the private
key. Requests are signed over their full payload, restricted to JD speech, expire
after 15 seconds, and carry only a server-committed reply. Caller authorization
and speech rate limits are enforced in Convex before signing.

Checks: `node --test workers/jd-voice/index.test.mjs`, plus the repository checks.

Sources: [Spanish model](https://developers.cloudflare.com/workers-ai/models/aura-2-es/),
[English model](https://developers.cloudflare.com/workers-ai/models/aura-2-en/).
