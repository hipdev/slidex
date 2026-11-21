/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { registerCore, sessionIdentity } from "@convex-dev/auth/test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { isConvexCostsReaction, isFarewellReaction } from "./lib/jd_reactions";

const modules = import.meta.glob("./**/*.ts");

test("farewell recognizes closing phrases but rejects negated, hypothetical and unrelated commands", () => {
  for (const text of ["Listo JD, esto ha sido todo", "Listo JD, esto a sido todo", "that's all folks", "That’s all, folks!", "Eso es todo amigos", "Hey JD, eso ha sido todo"]) expect(isFarewellReaction(text)).toBe(true);
  for (const text of ["No JD, esto ha sido todo", "No digas eso es todo amigos", "Si digo eso es todo amigos", "Qué significa that's all folks", "Crea un slide de eso es todo amigos", "JD baja el contador", "Mi factura de Convex"]) expect(isFarewellReaction(text)).toBe(false);
});

test("farewell is shared for twenty seconds without ending the room or changing slides, and retries do not extend it", async () => {
  const { host, guest, room } = await fixture();
  const before=(await guest.query(api.presentations.getBySlug,{slug:room.slug}))!;
  const args={presentationId:room.presentationId,requestId:"goodbye-once",locale:"es" as const,text:"Listo JD, esto a sido todo"};
  const fetch=vi.spyOn(globalThis,"fetch");
  try {
    await expect(guest.action(api.jd.talk,args)).rejects.toThrow("Only the presentation host");
    await host.action(api.jd.talk,args);
    const after=(await guest.query(api.presentations.getBySlug,{slug:room.slug}))!;
    expect(after.presentation.jdReaction?.kind).toBe("farewell");
    expect(after.presentation.jdReaction!.endsAt-after.presentation.jdReaction!.startedAt).toBe(20_000);
    expect(after.presentation.currentSlideId).toBe(before.presentation.currentSlideId);
    expect(after.presentation.status).toBe(before.presentation.status);
    expect(after.slides).toEqual(before.slides);
    await host.action(api.jd.talk,args);
    expect((await guest.query(api.presentations.getBySlug,{slug:room.slug}))!.presentation.jdReaction).toEqual(after.presentation.jdReaction);
    expect(fetch).not.toHaveBeenCalled();
  } finally {fetch.mockRestore();}
});

test("billing reaction recognizes conversational Spanish without stealing normal commands", () => {
  for (const phrase of ["Hey JD, cómo me siento yo cuando veo los costos de Convex", "Hey JD, cómo me siento cuando veo la facturación de mis proyectos alojados en Convex", "JD, mi reacción al ver los precios de Convex", "JD, cómo reacciono cuando veo lo que pago por Convex"]) expect(isConvexCostsReaction(phrase)).toBe(true);
  for (const phrase of ["No muestres cómo me siento cuando veo costos de Convex", "Cuánto cuesta Convex", "Cómo me siento cuando veo costos de otro servicio", "Crea un slide de cómo me siento con los costos de Convex", "Cómo me siento con Convex y baja el contador 4 minutos"]) expect(isConvexCostsReaction(phrase)).toBe(false);
});

test("billing reaction is owner-only, shared for ten seconds, deduplicated and leaves the deck and timer intact", async () => {
  const { host, guest, room } = await fixture();
  const start = Date.now();
  const now = vi.spyOn(Date, "now").mockReturnValue(start);
  const fetch = vi.spyOn(globalThis, "fetch");
  const command = { presentationId: room.presentationId, requestId: "billing-once", locale: "es" as const, text: "Hey JD, cómo me siento cuando veo la facturación de mis proyectos alojados en Convex" };
  try {
    await host.mutation(api.jd.control, { presentationId: room.presentationId, operation: "set", seconds: 1800, locale: "es" });
    const before = (await guest.query(api.presentations.getBySlug, { slug: room.slug }))!;
    await expect(guest.action(api.jd.talk, command)).rejects.toThrow("Only the presentation host");
    await host.action(api.jd.talk, command);
    const after = (await guest.query(api.presentations.getBySlug, { slug: room.slug }))!;
    expect(after.presentation.jdReaction?.kind).toBe("convex_costs");
    expect(after.presentation.jdReaction!.endsAt - after.presentation.jdReaction!.startedAt).toBe(10_000);
    expect(after.presentation.currentSlideId).toBe(before.presentation.currentSlideId);
    expect(after.slides).toEqual(before.slides);
    expect(after.presentation.countdown).toEqual(before.presentation.countdown);
    expect(after.presentation.jdCue).toEqual(before.presentation.jdCue);
    now.mockReturnValue(start + 3000);
    await host.action(api.jd.talk, command);
    expect((await guest.query(api.presentations.getBySlug, { slug: room.slug }))!.presentation.jdReaction).toEqual(after.presentation.jdReaction);
    await host.action(api.jd.talk, { ...command, requestId: "billing-again" });
    const repeated = (await guest.query(api.presentations.getBySlug, { slug: room.slug }))!.presentation.jdReaction!;
    expect(repeated.endsAt - repeated.startedAt).toBe(10_000);
    expect(repeated.requestId).toBe("billing-again");
    expect(fetch).not.toHaveBeenCalled();
  } finally { now.mockRestore(); fetch.mockRestore(); }
});

test("spoken billing cue uses transcription and triggers the same reaction without a model round trip", async () => {
  const { host, guest, room } = await fixture();
  vi.stubEnv("CLOUDFLARE_TRANSCRIPTION_API_URL", "https://transcribe.example.test");
  vi.stubEnv("CLOUDFLARE_TRANSCRIPTION_API_TOKEN", "test-only");
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ success: true, transcription: { text: "Hey JD, cómo me siento yo cuando veo los costos de Convex", durationSeconds: 4 } }), { status: 200 }));
  try {
    const result = await host.action(api.jd.talk, { presentationId: room.presentationId, requestId: "spoken-bill", locale: "es", audio: new Uint8Array(200).buffer, mime: "audio/webm" });
    expect(result.changed).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((await guest.query(api.presentations.getBySlug, { slug: room.slug }))!.presentation.jdReaction?.kind).toBe("convex_costs");
  } finally { fetch.mockRestore(); vi.unstubAllEnvs(); }
});

test("JD cannot create slides even if the interpreter returns the former creation operation", async () => {
  const { host, room } = await fixture();
  const before = (await host.query(api.presentations.getBySlug, { slug: room.slug }))!;
  vi.stubEnv("CLOUDFLARE_AI_API_URL", "https://ai.example.test"); vi.stubEnv("CLOUDFLARE_AI_API_TOKEN", "test-only");
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ output: { operation: "create_slide", seconds: null, prompt: "Pricing y Costos" } }), { status: 200 }));
  try {
    await expect(host.action(api.jd.talk, { presentationId: room.presentationId, requestId: "no-creation", locale: "es", text: "Crea un slide de los costos de Convex" })).rejects.toThrow("JD_INTERPRETATION_FAILED");
    const after = (await host.query(api.presentations.getBySlug, { slug: room.slug }))!;
    expect(after.slides).toEqual(before.slides);
    expect(after.presentation.currentSlideId).toBe(before.presentation.currentSlideId);
  } finally { fetch.mockRestore(); vi.unstubAllEnvs(); }
});

test("natural speech is restricted to the owner's last server-committed reply", async () => {
  const { host, guest, room } = await fixture();
  const command = { presentationId: room.presentationId, requestId: "speak-last", locale: "es" as const };
  await host.mutation(internal.jd.applyCommand, { ...command, operation: "convex_costs" });
  await expect(guest.action(api.jd.voiceReply, command)).rejects.toThrow("Only the presentation host");
  await expect(host.action(api.jd.voiceReply, { ...command, requestId: "different" })).rejects.toThrow("JD_STALE_REPLY");
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  vi.stubEnv("JD_VOICE_PRIVATE_KEY", JSON.stringify(await crypto.subtle.exportKey("jwk", pair.privateKey)));
  vi.stubEnv("JD_VOICE_API_URL", "https://voice.example.test");
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(new Uint8Array([1,2,3]), { headers: { "content-type": "audio/mpeg" } }));
  try {
    expect(new Uint8Array((await host.action(api.jd.voiceReply, command))!)).toEqual(new Uint8Array([1,2,3]));
    const body = JSON.parse(fetch.mock.calls[0][1]!.body as string);
    expect(JSON.parse(body.payload).text).toBe("Así, tal cual.");
    expect(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pair.publicKey, Uint8Array.from(atob(body.signature), c=>c.charCodeAt(0)), new TextEncoder().encode(body.payload))).toBe(true);
  } finally { fetch.mockRestore(); vi.unstubAllEnvs(); }
});
async function fixture() {
  const t = convexTest(schema, modules);
  registerCore(t); rateLimiterTest.register(t);
  const host = t.withIdentity(sessionIdentity(await t.mutation(api.auth.signInAnonymous, {})));
  const guest = t.withIdentity(sessionIdentity(await t.mutation(api.auth.signInAnonymous, {})));
  const room = await host.mutation(api.presentations.createDemo, { ownerName: "JD test", locale: "es" });
  return { t, host, guest, room };
}

test("only the owner can control JD, including before a paid provider request", async () => {
  const { host, guest, room } = await fixture();
  const fetch = vi.spyOn(globalThis, "fetch");
  try {
    await expect(guest.mutation(api.jd.control, { presentationId: room.presentationId, operation: "set", seconds: 1800, locale: "es" })).rejects.toThrow("Only the presentation host");
    await expect(guest.action(api.jd.talk, { presentationId: room.presentationId, text: "Tengo treinta minutos", requestId: "guest", locale: "es" })).rejects.toThrow("Only the presentation host");
    expect(fetch).not.toHaveBeenCalled();
    await host.mutation(api.jd.control, { presentationId: room.presentationId, operation: "set", seconds: 1800, locale: "es" });
    const audience = (await guest.query(api.presentations.getBySlug, { slug: room.slug }))!;
    expect(audience.presentation.countdown?.durationSeconds).toBe(1800);
    expect(audience.isHost).toBe(false);
  } finally { fetch.mockRestore(); }
});

test("timer bounds and finite integer values are validated on the server", async () => {
  const { host, room } = await fixture();
  for (const seconds of [-1, 0, 9, 60.5, 14_401, Infinity, NaN]) {
    await expect(host.mutation(api.jd.control, { presentationId: room.presentationId, operation: "set", seconds, locale: "es" })).rejects.toThrow("JD_INVALID_DURATION");
  }
});

test("pause/resume preserves elapsed time, late viewers share a deadline, retries do not restart it", async () => {
  const { host, guest, room } = await fixture();
  const start = Date.now();
  const now = vi.spyOn(Date, "now").mockReturnValue(start);
  try {
    const args = { presentationId: room.presentationId, operation: "set" as const, seconds: 1800, locale: "es" as const, requestId: "one" };
    await host.mutation(internal.jd.applyCommand, args);
    const initial = (await guest.query(api.presentations.getBySlug, { slug: room.slug }))!.presentation.countdown!;
    now.mockReturnValue(start + 20_000);
    await host.mutation(internal.jd.applyCommand, args);
    const late = (await guest.query(api.presentations.getBySlug, { slug: room.slug }))!.presentation.countdown!;
    expect(late.endsAt).toBe(initial.endsAt);
    await host.mutation(api.jd.control, { presentationId: room.presentationId, operation: "pause", locale: "es" });
    now.mockReturnValue(start + 60_000);
    const paused = (await guest.query(api.presentations.getBySlug, { slug: room.slug }))!.presentation.countdown!;
    expect(paused.endsAt).toBeUndefined(); expect(paused.remainingMs).toBe(initial.endsAt! - paused.updatedAt);
    await host.mutation(api.jd.control, { presentationId: room.presentationId, operation: "resume", locale: "es" });
    const resumed = (await guest.query(api.presentations.getBySlug, { slug: room.slug }))!.presentation.countdown!;
    expect(resumed.endsAt).toBe(resumed.updatedAt + paused.remainingMs);
    await host.mutation(api.jd.control, { presentationId: room.presentationId, operation: "clear", locale: "es" });
    expect((await guest.query(api.presentations.getBySlug, { slug: room.slug }))!.presentation.countdown).toBeUndefined();
  } finally { now.mockRestore(); }
});

test("an expired timer cannot be resumed into negative time and an ended room cannot be changed", async () => {
  const { t, host, room } = await fixture();
  await t.run(async ctx => {
    await ctx.db.patch(room.presentationId, { countdown: { durationSeconds: 10, endsAt: Date.now() - 1000, remainingMs: 10_000, updatedAt: Date.now() } });
  });
  await host.mutation(api.jd.control, { presentationId: room.presentationId, operation: "pause", locale: "es" });
  await host.mutation(api.jd.control, { presentationId: room.presentationId, operation: "resume", locale: "es" });
  const timer = (await host.query(api.presentations.getBySlug, { slug: room.slug }))!.presentation.countdown!;
  expect(timer.remainingMs).toBe(0); expect(timer.endsAt).toBeUndefined();
  await t.run(ctx => ctx.db.patch(room.presentationId, { status: "ended" }));
  await expect(host.mutation(api.jd.control, { presentationId: room.presentationId, operation: "set", seconds: 1800, locale: "es" })).rejects.toThrow("JD_ROOM_ENDED");
});

test("ambiguous and invalid model output never changes the countdown", async () => {
  const { host, room } = await fixture();
  vi.stubEnv("CLOUDFLARE_AI_API_URL", "https://ai.example.test");
  vi.stubEnv("CLOUDFLARE_AI_API_TOKEN", "test-only");
  const fetch = vi.spyOn(globalThis, "fetch");
  try {
    for (const output of [{ operation: "unknown", seconds: null }, { operation: "set", seconds: 1e12 }]) {
      fetch.mockResolvedValueOnce(new Response(JSON.stringify({ output }), { status: 200 }));
      const result = await host.action(api.jd.talk, { presentationId: room.presentationId, text: "No quiero cambiar nada", requestId: crypto.randomUUID(), locale: "es" });
      expect(result.changed).toBe(false);
      expect((await host.query(api.presentations.getBySlug, { slug: room.slug }))!.presentation.countdown).toBeUndefined();
    }
  } finally { fetch.mockRestore(); vi.unstubAllEnvs(); }
});

test("relative adjustments subtract from remaining time without restarting, preserve pause and clamp at zero", async () => {
  const { host, guest, room } = await fixture();
  const start = Date.now();
  const now = vi.spyOn(Date, "now").mockReturnValue(start);
  const control = (operation: "set" | "adjust" | "pause", seconds?: number) => host.mutation(api.jd.control, { presentationId: room.presentationId, operation, seconds, locale: "es" });
  const read = async () => (await guest.query(api.presentations.getBySlug, { slug: room.slug }))!.presentation.countdown!;
  try {
    await control("set", 1800);
    const initial = await read();
    now.mockReturnValue(start + 60_000);
    await control("adjust", -240);
    const adjusted = await read();
    expect(adjusted.endsAt).toBe(initial.endsAt! - 240_000);
    expect(adjusted.remainingMs).toBe(adjusted.endsAt! - adjusted.updatedAt);
    await control("pause");
    const paused = await read();
    now.mockReturnValue(start + 120_000);
    await control("adjust", 120);
    expect(await read()).toMatchObject({ remainingMs: paused.remainingMs + 120_000 });
    expect((await read()).endsAt).toBeUndefined();
    for (const seconds of [0, -14_401, 0.5, Infinity, NaN]) await expect(control("adjust", seconds)).rejects.toThrow("JD_INVALID_DURATION");
    await expect(control("adjust", 14_400)).rejects.toThrow("JD_INVALID_DURATION");
    await control("adjust", -10_000);
    expect((await read()).remainingMs).toBe(0);
    expect((await read()).endsAt).toBeUndefined();
  } finally { now.mockRestore(); }
});

test("JD navigation is host-only, bounded by the deck and does not replay a completed step", async () => {
  const { host, guest, room } = await fixture();
  const before = (await host.query(api.presentations.getBySlug, { slug: room.slug }))!;
  const command = { presentationId: room.presentationId, operation: "next" as const, locale: "es" as const, requestId: "next-once" };
  await expect(guest.mutation(internal.jd.applyCommand, command)).rejects.toThrow("Only the presentation host");
  await host.mutation(internal.jd.applyCommand, command);
  await host.mutation(internal.jd.applyCommand, command);
  expect((await guest.query(api.presentations.getBySlug, { slug: room.slug }))!.presentation.currentSlideId).toBe(before.slides[1]._id);
  for (const requestId of ["back", "back-at-start"]) await host.mutation(internal.jd.applyCommand, { ...command, operation: "previous", requestId });
  expect((await guest.query(api.presentations.getBySlug, { slug: room.slug }))!.presentation.currentSlideId).toBe(before.slides[0]._id);
  for (const requestId of ["next-1", "next-2", "next-at-end"]) await host.mutation(internal.jd.applyCommand, { ...command, requestId });
  expect((await guest.query(api.presentations.getBySlug, { slug: room.slug }))!.presentation.currentSlideId).toBe(before.slides[2]._id);
});

test("the full voice action interprets relative time and navigation without publishing anything", async () => {
  const { host, guest, room } = await fixture();
  vi.stubEnv("CLOUDFLARE_AI_API_URL", "https://ai.example.test");
  vi.stubEnv("CLOUDFLARE_AI_API_TOKEN", "test-only");
  const fetch = vi.spyOn(globalThis, "fetch");
  const answer = (output: unknown) => fetch.mockResolvedValueOnce(new Response(JSON.stringify({ output }), { status: 200 }));
  const talk = (text: string) => host.action(api.jd.talk, { presentationId: room.presentationId, requestId: crypto.randomUUID(), text, locale: "es" });
  try {
    await host.mutation(api.jd.control, { presentationId: room.presentationId, operation: "set", seconds: 1800, locale: "es" });
    answer({ operation: "adjust", seconds: -240, prompt: null });
    await talk("JD, sabes que mejor baja el contador 4 minutos porque voy tarde");
    const adjusted = (await guest.query(api.presentations.getBySlug, { slug: room.slug }))!;
    expect(adjusted.presentation.countdown!.durationSeconds).toBe(1560);
    answer({ operation: "next", seconds: null, prompt: null });
    await talk("JD, siguiente slide");
    expect((await guest.query(api.presentations.getBySlug, { slug: room.slug }))!.presentation.currentSlideId).toBe(adjusted.slides[1]._id);
  } finally { fetch.mockRestore(); vi.unstubAllEnvs(); }
});

test("committed JD gestures are reactive, atomic, deduplicated and absent for failed or manual navigation", async () => {
  const { host, guest, room } = await fixture();
  const read = async () => (await guest.query(api.presentations.getBySlug, { slug: room.slug }))!;
  expect((await read()).presentation.jdCue).toBeUndefined();
  const command = { presentationId:room.presentationId, locale:"es" as const, operation:"next" as const, requestId:"gesture-next" };
  await host.mutation(internal.jd.applyCommand, command);
  const moved = await read();
  expect(moved.presentation.jdCue).toMatchObject({ sequence:1, kind:"next", slideId:moved.presentation.currentSlideId });
  await host.mutation(internal.jd.applyCommand, command);
  expect((await read()).presentation.jdCue).toEqual(moved.presentation.jdCue);
  await host.mutation(api.presentations.setCurrentSlide, { presentationId:room.presentationId, slideId:moved.slides[0]._id });
  expect((await read()).presentation.jdCue).toEqual(moved.presentation.jdCue);
  await host.mutation(internal.jd.applyCommand, { ...command, operation:"previous", requestId:"at-start" });
  expect((await read()).presentation.jdCue).toEqual(moved.presentation.jdCue);
  await expect(guest.mutation(api.jd.control, { presentationId:room.presentationId, operation:"set", seconds:1800, locale:"es" })).rejects.toThrow();
  await host.mutation(api.jd.control, { presentationId:room.presentationId, operation:"resume", locale:"es" });
  expect((await read()).presentation.jdCue).toEqual(moved.presentation.jdCue);
  await host.mutation(api.jd.control, { presentationId:room.presentationId, operation:"set", seconds:1800, locale:"es" });
  await host.mutation(internal.jd.applyCommand, { ...command, operation:"adjust", seconds:-240, requestId:"gesture-time" });
  const timed = await read();
  expect(timed.presentation.jdCue).toMatchObject({ sequence:3, kind:"timer", deltaSeconds:-240 });
  expect(timed.presentation.countdown!.durationSeconds).toBe(1560);
  expect((await read()).presentation.jdCue).toEqual(timed.presentation.jdCue);
});
