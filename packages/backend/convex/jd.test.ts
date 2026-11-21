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
    now.mockReturnValue(start + 20_000);
    await host.mutation(internal.jd.applyCommand, args);
    const late = (await guest.query(api.presentations.getBySlug, { slug: room.slug }))!.presentation.countdown!;
    expect(late.endsAt).toBe(start + 1_800_000);
    await host.mutation(api.jd.control, { presentationId: room.presentationId, operation: "pause", locale: "es" });
    now.mockReturnValue(start + 60_000);
    const paused = (await guest.query(api.presentations.getBySlug, { slug: room.slug }))!.presentation.countdown!;
    expect(paused.endsAt).toBeUndefined(); expect(paused.remainingMs).toBe(1_780_000);
    await host.mutation(api.jd.control, { presentationId: room.presentationId, operation: "resume", locale: "es" });
    const resumed = (await guest.query(api.presentations.getBySlug, { slug: room.slug }))!.presentation.countdown!;
    expect(resumed.endsAt).toBe(start + 60_000 + 1_780_000);
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
