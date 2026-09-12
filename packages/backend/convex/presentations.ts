import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

const emoji = v.union(v.literal("fire"), v.literal("mind"), v.literal("heart"), v.literal("question"));

export const createDemo = mutation({
  args: { ownerName: v.string() },
  returns: v.object({ presentationId: v.id("presentations"), slug: v.string() }),
  handler: async (ctx, { ownerName }) => {
    const ownerId = await getAuthUserId(ctx);
    if (!ownerId) throw new Error("Sign in before creating a presentation");
    const createdAt = Date.now();
    const slug = `LIVE-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const presentationId = await ctx.db.insert("presentations", {
      title: "Presentations should be alive.", slug, ownerName, ownerId, status: "live", createdAt,
    });
    const titleId = await ctx.db.insert("slides", {
      presentationId, order: 0, kind: "title", title: "Your audience is already here.",
      body: "Slidex turns attention into a live signal — not a post-meeting survey.",
    });
    await ctx.db.insert("slides", {
      presentationId, order: 1, kind: "poll", title: "What should we explore next?",
      body: "The next chapter is chosen in the room.",
      choices: [{ id: "agents", label: "Slide agents" }, { id: "research", label: "Living research" }, { id: "chaos", label: "Chaos mode" }],
    });
    await ctx.db.insert("slides", {
      presentationId, order: 2, kind: "content", title: "A slide can answer back.",
      body: "Ask @slide to research a topic, turn an incoming email into a brief, or create a live comparison while presenting.",
    });
    await ctx.db.patch(presentationId, { currentSlideId: titleId });
    return { presentationId, slug };
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(v.null(), v.object({
    presentation: v.any(), slides: v.array(v.any()), reactions: v.array(v.any()), votes: v.array(v.any()), inbox: v.array(v.any()), operations: v.array(v.any()),
  })),
  handler: async (ctx, { slug }) => {
    const presentation = await ctx.db.query("presentations").withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
    if (!presentation) return null;
    const slides = await ctx.db.query("slides").withIndex("by_presentation_and_order", (q) => q.eq("presentationId", presentation._id)).take(50);
    const reactions = await ctx.db.query("reactions").withIndex("by_presentation_and_slide", (q) => q.eq("presentationId", presentation._id)).take(200);
    const votes = await ctx.db.query("votes").withIndex("by_presentation_and_slide", (q) => q.eq("presentationId", presentation._id)).take(200);
    const inbox = await ctx.db.query("inboxItems").withIndex("by_presentation_and_received", (q) => q.eq("presentationId", presentation._id)).order("desc").take(8);
    const operations = await ctx.db.query("operations").withIndex("by_presentation_and_creation", (q) => q.eq("presentationId", presentation._id)).order("desc").take(8);
    return { presentation, slides, reactions, votes, inbox, operations };
  },
});

export const join = mutation({
  args: { presentationId: v.id("presentations"), name: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attendeeId = await getAuthUserId(ctx);
    if (!attendeeId) throw new Error("Sign in before joining a presentation");
    const existing = await ctx.db.query("audience").withIndex("by_presentation_and_attendee", (q) => q.eq("presentationId", args.presentationId).eq("attendeeId", attendeeId)).unique();
    if (existing) await ctx.db.patch(existing._id, { name: args.name, lastSeenAt: Date.now() });
    else await ctx.db.insert("audience", { ...args, attendeeId, lastSeenAt: Date.now() });
    return null;
  },
});

export const react = mutation({
  args: { presentationId: v.id("presentations"), slideId: v.id("slides"), emoji },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attendeeId = await getAuthUserId(ctx);
    if (!attendeeId) throw new Error("Sign in before reacting");
    await ctx.db.insert("reactions", { ...args, attendeeId, createdAt: Date.now() });
    return null;
  },
});

export const vote = mutation({
  args: { presentationId: v.id("presentations"), slideId: v.id("slides"), choiceId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attendeeId = await getAuthUserId(ctx);
    if (!attendeeId) throw new Error("Sign in before voting");
    const existing = await ctx.db.query("votes").withIndex("by_presentation_slide_and_attendee", (q) => q.eq("presentationId", args.presentationId).eq("slideId", args.slideId).eq("attendeeId", attendeeId)).unique();
    if (existing) await ctx.db.patch(existing._id, { choiceId: args.choiceId, createdAt: Date.now() });
    else await ctx.db.insert("votes", { ...args, attendeeId, createdAt: Date.now() });
    return null;
  },
});

export const setCurrentSlide = mutation({
  args: { presentationId: v.id("presentations"), slideId: v.id("slides") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.presentationId);
    await ctx.db.patch(args.presentationId, { currentSlideId: args.slideId });
    return null;
  },
});

export const addSlide = internalMutation({
  args: { presentationId: v.id("presentations"), kind: v.union(v.literal("research"), v.literal("content")), title: v.string(), body: v.string(), sourceUrls: v.array(v.string()) },
  returns: v.id("slides"),
  handler: async (ctx, args) => {
    const last = await ctx.db.query("slides").withIndex("by_presentation_and_order", (q) => q.eq("presentationId", args.presentationId)).order("desc").first();
    return await ctx.db.insert("slides", { ...args, order: (last?.order ?? -1) + 1, generatedAt: Date.now() });
  },
});

export const updateOperation = internalMutation({
  args: { operationId: v.id("operations"), status: v.union(v.literal("running"), v.literal("complete"), v.literal("failed")), output: v.optional(v.string()), error: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { operationId, ...patch }) => { await ctx.db.patch(operationId, patch); return null; },
});

export const recordInbox = internalMutation({
  args: { presentationId: v.id("presentations"), sender: v.string(), subject: v.string(), text: v.string() },
  returns: v.id("inboxItems"),
  handler: async (ctx, args) => await ctx.db.insert("inboxItems", { ...args, receivedAt: Date.now(), status: "received" }),
});

async function requireOwner(ctx: MutationCtx, presentationId: Id<"presentations">) {
  const userId = await getAuthUserId(ctx);
  const presentation = await ctx.db.get(presentationId);
  if (!userId || !presentation?.ownerId || presentation.ownerId !== userId) throw new Error("Only the presentation host can perform this action");
}
