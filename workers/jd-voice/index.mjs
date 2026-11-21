// Isolated speech renderer. Only Convex can sign requests; no client secrets.
export function createVoiceWorker(publicKey) {
  return { async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (request.method === "GET" && path === "/health") return Response.json({ ok: true });
    if (request.method !== "POST" || path !== "/v1/speech") return new Response("Not found", { status: 404 });
    const started = Date.now();
    try {
      const reader = request.body?.getReader();
      if (!reader) return new Response("Bad request", { status: 400 });
      let size = 0; const chunks = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 8192) { await reader.cancel(); return new Response("Too large", { status: 413 }); }
        chunks.push(value);
      }
      const body = await new Blob(chunks).text();
      const input = JSON.parse(body);
      if (typeof input.payload !== "string" || input.payload.length > 4000 || typeof input.signature !== "string" || input.signature.length > 200) return new Response("Bad request", { status: 400 });
      const key = await crypto.subtle.importKey("jwk", publicKey, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
      const signature = Uint8Array.from(atob(input.signature), c => c.charCodeAt(0));
      const valid = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, signature, new TextEncoder().encode(input.payload));
      if (!valid) return new Response("Unauthorized", { status: 401 });
      const payload = JSON.parse(input.payload);
      if (payload.aud !== "slidex-jd-voice" || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now() || payload.expiresAt > Date.now() + 30_000) return new Response("Expired", { status: 401 });
      if (typeof payload.text !== "string" || !payload.text.trim() || payload.text.length > 800 || !["es", "en"].includes(payload.locale)) return new Response("Bad request", { status: 400 });
      const model = payload.locale === "es" ? "@cf/deepgram/aura-2-es" : "@cf/deepgram/aura-2-en";
      const response = await env.AI.run(model, { text: payload.text, speaker: payload.locale === "es" ? "alvaro" : "orion", encoding: "mp3" }, { returnRawResponse: true });
      if (!response.ok) throw new Error("Speech provider failed");
      console.info(JSON.stringify({ event: "jd.speech", model, durationMs: Date.now() - started, status: "ok" }));
      return new Response(response.body, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
    } catch {
      console.error(JSON.stringify({ event: "jd.speech", durationMs: Date.now() - started, status: "failed" }));
      return new Response("Speech unavailable", { status: 503 });
    }
  } };
}
