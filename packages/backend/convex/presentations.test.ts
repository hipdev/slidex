/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { registerCore, sessionIdentity } from "@convex-dev/auth/test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";
const modules = import.meta.glob("./**/*.ts");
async function fixture() {
  const t = convexTest(schema, modules); registerCore(t); rateLimiterTest.register(t);
  const tokens = await t.mutation(api.auth.signInAnonymous, {});
  const host = t.withIdentity(sessionIdentity(tokens));
  return { t, host, ownerId: tokens.userId as Id<"users"> };
}

test("new rooms have a working four-character code and a Spanish opening without the introductory paragraph", async () => {
  const { host } = await fixture();
  const room = await host.mutation(api.presentations.createDemo, { ownerName: "Host" });
  const data = (await host.query(api.presentations.getBySlug, { slug: room.slug }))!;
  expect(data.presentation.joinCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
  expect(data.slides[0]).toMatchObject({ title: "La próxima gran idea está en esta sala.", body: "" });
  const joined = await host.query(api.presentations.getBySlug, { slug: data.presentation.joinCode!.toLowerCase() });
  expect(joined!.presentation._id).toBe(room.presentationId);
});

test("old rooms get a stable short alias without breaking canonical links or the old five-character codes", async () => {
  const { t, host, ownerId } = await fixture();
  const id = await t.run(ctx => ctx.db.insert("presentations", { title: "Legacy", slug: "LIVE-S2PSY", ownerName: "Host", ownerId, status: "live", createdAt: Date.now() }));
  await expect(t.mutation(api.presentations.ensureJoinCode, { presentationId: id })).rejects.toThrow("Only the presentation host");
  const code = await host.mutation(api.presentations.ensureJoinCode, { presentationId: id });
  expect(code).toHaveLength(4);
  expect(await host.mutation(api.presentations.ensureJoinCode, { presentationId: id })).toBe(code);
  for (const slug of ["LIVE-S2PSY", "s2psy", code, `LIVE-${code}`]) expect((await host.query(api.presentations.getBySlug, { slug }))!.presentation._id).toBe(id);
});

test("allocation retries collisions with legacy codes instead of sending an audience to another room", async () => {
  const { t, host, ownerId } = await fixture();
  const make = (slug: string) => t.run(ctx => ctx.db.insert("presentations", { title: "Legacy", slug, ownerName: "Host", ownerId, status: "live", createdAt: Date.now() }));
  await make("LIVE-AAAA");
  const id = await make("LIVE-OTHER");
  const original = crypto.getRandomValues.bind(crypto);
  let candidates = 0;
  const random = vi.spyOn(crypto, "getRandomValues").mockImplementation(((array: Uint8Array<ArrayBuffer>) => {
    if (array instanceof Uint8Array && array.length === 4) {
      array.set(candidates++ === 0 ? [0, 0, 0, 0] : [0, 1, 2, 3]); return array;
    }
    return original(array);
  }) as typeof crypto.getRandomValues);
  try {
    const code = await host.mutation(api.presentations.ensureJoinCode, { presentationId: id });
    expect(code).toBe("ABCD"); expect(candidates).toBe(2);
    expect((await host.query(api.presentations.getBySlug, { slug: "AAAA" }))!.presentation._id).not.toBe(id);
  } finally { random.mockRestore(); }
});
