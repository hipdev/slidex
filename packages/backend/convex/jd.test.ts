/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { registerCore, sessionIdentity } from "@convex-dev/auth/test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
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

test("creating a slide inserts and selects it atomically, while guarding stale context, validation and deck limits", async () => {
  const { t, host, guest, room } = await fixture();
  const before = (await host.query(api.presentations.getBySlug, { slug: room.slug }))!;
  const command = { presentationId: room.presentationId, operation: "create_slide" as const, locale: "es" as const, requestId: "slide-once", expectedSlideId: before.slides[0]._id, slide: { title: "Convex reactivo", body: "Un cambio en el backend llega a toda la audiencia." } };
  await expect(guest.mutation(internal.jd.applyCommand, command)).rejects.toThrow("Only the presentation host");
  await host.mutation(internal.jd.applyCommand, command);
  await host.mutation(internal.jd.applyCommand, command);
  const after = (await guest.query(api.presentations.getBySlug, { slug: room.slug }))!;
  expect(after.slides.map(slide => slide.order)).toEqual([0, 1, 2, 3]);
  expect(after.slides[1]).toMatchObject(command.slide);
  expect(after.presentation.currentSlideId).toBe(after.slides[1]._id);
  expect(after.slides[2]._id).toBe(before.slides[1]._id);
  await expect(host.mutation(internal.jd.applyCommand, { ...command, requestId: "stale" })).rejects.toThrow("JD_SLIDE_CHANGED");
  await expect(host.mutation(internal.jd.applyCommand, { ...command, requestId: "invalid", slide: { title: "", body: "" } })).rejects.toThrow("JD_INVALID_SLIDE");
  await t.run(async ctx => {
    for (let order = 4; order < 50; order++) await ctx.db.insert("slides", { presentationId: room.presentationId, order, kind: "content", title: "Filler", body: "For the deck limit test" });
  });
  await expect(host.mutation(internal.jd.applyCommand, { ...command, requestId: "full", expectedSlideId: after.slides[1]._id })).rejects.toThrow("50 slide limit");
});

test("the full voice action interprets relative time, navigation and slide generation without publishing anything", async () => {
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
    answer({ operation: "create_slide", seconds: null, prompt: "Explica Convex reactivo con un ejemplo" });
    answer({ title: "Todos vemos el mismo cambio", body: "El host ajusta el contador. Convex actualiza cada pantalla conectada." });
    const result = await talk("JD, crea un slide explicando Convex reactivo con un ejemplo");
    expect(result.changed).toBe(true);
    const created = (await guest.query(api.presentations.getBySlug, { slug: room.slug }))!;
    expect(created.slides[2].title).toBe("Todos vemos el mismo cambio");
    expect(created.presentation.currentSlideId).toBe(created.slides[2]._id);
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
  await expect(host.mutation(internal.jd.applyCommand, { ...command, operation:"create_slide", requestId:"bad-slide", slide:{title:"",body:""} })).rejects.toThrow();
  expect((await read()).presentation.jdCue).toEqual(timed.presentation.jdCue);
  await host.mutation(internal.jd.applyCommand, { ...command, operation:"create_slide", requestId:"new-page", expectedSlideId:timed.presentation.currentSlideId, slide:{title:"Una página nueva",body:"Creada por JD"} });
  const created = await read();
  expect(created.presentation.jdCue).toMatchObject({ sequence:4, kind:"create_slide", slideId:created.presentation.currentSlideId });
});
