/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { registerCore, sessionIdentity } from "@convex-dev/auth/test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";
const modules = import.meta.glob("./**/*.ts");
afterEach(() => vi.useRealTimers());
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


test("only the owner can delete a presentation; active-room cleanup is harmless and retries are idempotent", async () => {
  vi.useFakeTimers();
  const { t, host } = await fixture();
  const room = await host.mutation(api.presentations.createDemo, { ownerName: "Owner" });
  const other = t.withIdentity(sessionIdentity(await t.mutation(api.auth.signInAnonymous, {})));
  const args = { presentationId: room.presentationId };
  await expect(t.mutation(api.presentations.remove, args)).rejects.toThrow("Only the presentation host");
  await expect(other.mutation(api.presentations.remove, args)).rejects.toThrow("Only the presentation host");
  await t.mutation(internal.presentations.cleanupDeleted, { ...args, phase: 2 });
  expect((await host.query(api.presentations.getBySlug, { slug: room.slug }))!.slides).toHaveLength(3);
  await host.mutation(api.presentations.remove, args);
  await host.mutation(api.presentations.remove, args);
  expect(await host.query(api.presentations.getBySlug, { slug: room.slug })).toBeNull();
  expect(await host.query(api.presentations.listMine, {})).toEqual([]);
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
});

test("deleted rooms reject writes and late generated slides, and batch cleanup removes dependent data without touching other rooms", async () => {
  vi.useFakeTimers();
  const { t, host, ownerId } = await fixture();
  const room = await host.mutation(api.presentations.createDemo, { ownerName: "Remove" });
  const other = await host.mutation(api.presentations.createDemo, { ownerName: "Keep" });
  const data = (await host.query(api.presentations.getBySlug, { slug: room.slug }))!;
  const otherData = (await host.query(api.presentations.getBySlug, { slug: other.slug }))!;
  const slideId = data.slides[0]._id;
  const ids = await t.run(async ctx => {
    const contributionId = await ctx.db.insert("contributions", { presentationId: room.presentationId, slideId, authorId: ownerId, authorName: "Host", kind: "question", text: "Why?", status: "pending", votes: 125 });
    const interventionId = await ctx.db.insert("interventions", { presentationId: room.presentationId, slideId, kind: "lost", text: "An example", votes: 125, status: "pending" });
    for (let i = 0; i < 125; i++) {
      const userId = await ctx.db.insert("users", { isAnonymous: true });
      await ctx.db.insert("endorsements", { contributionId, userId });
      await ctx.db.insert("interventionVotes", { interventionId, userId });
      await ctx.db.insert("audience", { presentationId: room.presentationId, attendeeId: String(i), lastSeenAt: Date.now() });
    }
    await ctx.db.insert("reactions", { presentationId: room.presentationId, slideId, attendeeId: ownerId, emoji: "heart", createdAt: Date.now() });
    await ctx.db.insert("votes", { presentationId: room.presentationId, slideId: data.slides[1]._id, attendeeId: ownerId, choiceId: "agents", createdAt: Date.now() });
    const operationId = await ctx.db.insert("operations", { presentationId: room.presentationId, kind: "research", status: "running", input: "Pending AI", createdAt: Date.now() });
    await ctx.db.insert("inboxItems", { presentationId: room.presentationId, sender: "test@example.invalid", subject: "Idea", text: "A thought", receivedAt: Date.now(), status: "received" });
    const keptContribution = await ctx.db.insert("contributions", { presentationId: other.presentationId, slideId: otherData.slides[0]._id, authorId: ownerId, authorName: "Host", kind: "question", text: "Keep me", status: "pending", votes: 1 });
    const keptEndorsement = await ctx.db.insert("endorsements", { contributionId: keptContribution, userId: ownerId });
    return { operationId, keptContribution, keptEndorsement };
  });
  await host.mutation(api.presentations.remove, { presentationId: room.presentationId });
  expect(await host.query(api.live.list, { presentationId: room.presentationId })).toEqual([]);
  expect(await host.query(api.interventions.list, { slideId })).toEqual([]);
  await expect(host.mutation(api.presentations.setCurrentSlide, { presentationId: room.presentationId, slideId })).rejects.toThrow();
  await expect(host.mutation(api.presentations.join, { presentationId: room.presentationId })).rejects.toThrow("Room not found");
  await expect(t.mutation(internal.presentations.addSlide, { presentationId: room.presentationId, kind: "content", title: "Late AI", body: "Must not reappear", sourceUrls: [] })).rejects.toThrow("Presentation not found");
  // Run the actual scheduled batch chain against the isolated test database.
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  const remaining = await t.run(async ctx => ({
    slides: await ctx.db.query("slides").withIndex("by_presentation_and_order", q => q.eq("presentationId", room.presentationId)).take(1),
    contributions: await ctx.db.query("contributions").withIndex("by_presentationId", q => q.eq("presentationId", room.presentationId)).take(1),
    interventions: await ctx.db.query("interventions").withIndex("by_presentationId", q => q.eq("presentationId", room.presentationId)).take(1),
    audience: await ctx.db.query("audience").withIndex("by_presentation_and_attendee", q => q.eq("presentationId", room.presentationId)).take(1),
    reactions: await ctx.db.query("reactions").withIndex("by_presentation_and_slide", q => q.eq("presentationId", room.presentationId)).take(1),
    votes: await ctx.db.query("votes").withIndex("by_presentation_and_slide", q => q.eq("presentationId", room.presentationId)).take(1),
    operations: await ctx.db.query("operations").withIndex("by_presentation_and_creation", q => q.eq("presentationId", room.presentationId)).take(1),
    inbox: await ctx.db.query("inboxItems").withIndex("by_presentation_and_received", q => q.eq("presentationId", room.presentationId)).take(1),
    endorsements: await ctx.db.query("endorsements").take(200),
    interventionVotes: await ctx.db.query("interventionVotes").take(1),
  }));
  expect(remaining).toEqual({ slides: [], contributions: [], interventions: [], audience: [], reactions: [], votes: [], operations: [], inbox: [], endorsements: [expect.objectContaining({ _id: ids.keptEndorsement })], interventionVotes: [] });
  expect((await host.query(api.presentations.listMine, {})).map(room => room._id)).toEqual([other.presentationId]);
  expect((await host.query(api.presentations.getBySlug, { slug: other.slug }))!.slides).toHaveLength(3);
  await t.mutation(internal.presentations.updateOperation, { operationId: ids.operationId, status: "complete" });
});
