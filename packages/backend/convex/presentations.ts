import { localeValidator, languageName } from "./language";
import { limits } from "./limits";
import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { getAuthUserId } from "@convex-dev/auth/core";

const emoji = v.union(v.literal("fire"), v.literal("mind"), v.literal("heart"), v.literal("question"));

export const createDemo = mutation({
  args: { ownerName: v.string(), locale: localeValidator },
  returns: v.object({ presentationId: v.id("presentations"), slug: v.string() }),
  handler: async (ctx, { ownerName, locale }) => {
    const ownerId = await getAuthUserId(ctx);
    if (!ownerId) throw new Error("Sign in before creating a presentation");
    await limits.limit(ctx,"rooms",{key:ownerId,throws:true});
    const createdAt = Date.now();
    const slug = `LIVE-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const presentationId = await ctx.db.insert("presentations", {
      title: (locale === "en" ? "A presentation that listens." : "Una presentación que escucha."), slug, ownerName, ownerId, status: "live", createdAt,
    });
    const titleId = await ctx.db.insert("slides", {
      presentationId, order: 0, kind: "title", title: (locale === "en" ? "The next big idea is in this room." : "La próxima gran idea está en esta sala."),
      body: (locale === "en" ? "Suggest an improvement, share what you discover, and let\u2019s build the last slide together." : "Propón una mejora, comparte lo que descubres y construyamos juntos el último slide."),
    });
    await ctx.db.insert("slides", {
      presentationId, order: 1, kind: "poll", title: (locale === "en" ? "Where should we go next?" : "¿Hacia dónde vamos ahora?"),
      body: (locale === "en" ? "Vote for the next chapter. You help choose the direction." : "Vota por el próximo capítulo. El rumbo se decide aquí."),
      choices: [{ id: "agents", label: (locale === "en" ? "Slides that respond" : "Slides que responden") }, { id: "research", label: (locale === "en" ? "Live research" : "Investigar en vivo") }, { id: "chaos", label: (locale === "en" ? "Unexpected moments" : "Momentos inesperados") }],
    });
    await ctx.db.insert("slides", {
      presentationId, order: 2, kind: "content", title: (locale === "en" ? "One talk. Many perspectives." : "Una charla. Muchas perspectivas."),
      body: (locale === "en" ? "Use the assistant to research, turn emails into slides or direct the talk with your voice. The audience writes the ending with you." : "Usa el copiloto para investigar, convertir un correo en slide o dirigir la charla con tu voz. La audiencia escribe el cierre contigo."),
    });
    await ctx.db.patch(presentationId, { currentSlideId: titleId });
    return { presentationId, slug };
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(v.null(), v.object({
    presentation: schema.doc("presentations"), slides: v.array(schema.doc("slides")), reactions: v.array(schema.doc("reactions")), votes: v.array(schema.doc("votes")), inbox: v.array(schema.doc("inboxItems")), operations: v.array(schema.doc("operations")), isHost: v.boolean(), participantCount: v.number(),
  })),
  handler: async (ctx, { slug }) => {
    const presentation = await ctx.db.query("presentations").withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
    if (!presentation) return null;
    const slides = await ctx.db.query("slides").withIndex("by_presentation_and_order", (q) => q.eq("presentationId", presentation._id)).take(50);
    const reactions = await ctx.db.query("reactions").withIndex("by_presentation_and_slide", (q) => q.eq("presentationId", presentation._id)).take(200);
    const votes = await ctx.db.query("votes").withIndex("by_presentation_and_slide", (q) => q.eq("presentationId", presentation._id)).take(200);
    const userId = await getAuthUserId(ctx);
    const isHost = !!userId && presentation.ownerId === userId;
    const attendees = await ctx.db.query("audience").withIndex("by_presentation_and_attendee", q => q.eq("presentationId", presentation._id)).take(500);
    const inbox = isHost ? await ctx.db.query("inboxItems").withIndex("by_presentation_and_received", (q) => q.eq("presentationId", presentation._id)).order("desc").take(8) : [];
    const operations = await ctx.db.query("operations").withIndex("by_presentation_and_creation", (q) => q.eq("presentationId", presentation._id)).order("desc").take(8);
    return { presentation, slides, reactions, votes, inbox, operations, isHost, participantCount: attendees.length };
  },
});

export const listMine = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("presentations"),
    title: v.string(),
    slug: v.string(),
    status: v.union(v.literal("draft"), v.literal("live"), v.literal("ended")),
    createdAt: v.number(),
  })),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const presentations = await ctx.db
      .query("presentations")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", userId))
      .order("desc")
      .take(50);
    return presentations.map(({ _id, title, slug, status, createdAt }) => ({ _id, title, slug, status, createdAt }));
  },
});

export const join = mutation({
  args: { presentationId: v.id("presentations"), name: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attendeeId = await getAuthUserId(ctx);
    if (!attendeeId) throw new Error("Sign in before joining a presentation");
    const room = await ctx.db.get(args.presentationId);
    if (!room) throw new Error("Room not found");
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
    await requireSlide(ctx, args.presentationId, args.slideId);
    await limits.limit(ctx,"reactions",{key:attendeeId,throws:true});
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
    const slide = await requireSlide(ctx, args.presentationId, args.slideId);
    if (slide.kind !== "poll" || !slide.choices?.some(c => c.id === args.choiceId)) throw new Error("Invalid poll choice");
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
    await requireSlide(ctx, args.presentationId, args.slideId);
    await ctx.db.patch(args.presentationId, { currentSlideId: args.slideId, showConclusions: false });
    return null;
  },
});

export const addSlide = internalMutation({
  args: { presentationId: v.id("presentations"), kind: v.union(v.literal("research"), v.literal("content")), title: v.string(), body: v.string(), sourceUrls: v.array(v.string()), imageUrl: v.optional(v.string()), imageSourceUrl: v.optional(v.string()) },
  returns: v.id("slides"),
  handler: async (ctx, args) => {
    const last = await ctx.db.query("slides").withIndex("by_presentation_and_order", (q) => q.eq("presentationId", args.presentationId)).order("desc").first();
    if ((last?.order ?? 0) >= 49) throw new Error("This deck has reached its 50 slide limit");
    return await ctx.db.insert("slides", { ...args, order: (last?.order ?? -1) + 1, generatedAt: Date.now() });
  },
});

export const reorderSlides = mutation({
  args: { presentationId: v.id("presentations"), slideIds: v.array(v.id("slides")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.presentationId);
    if (!args.slideIds.length || args.slideIds.length > 50 || new Set(args.slideIds).size !== args.slideIds.length) throw new Error("Invalid slide order");
    const existing = await ctx.db.query("slides").withIndex("by_presentation_and_order", (q) => q.eq("presentationId", args.presentationId)).take(50);
    if (existing.length !== args.slideIds.length || existing.some((slide) => !args.slideIds.includes(slide._id))) throw new Error("The slide order does not match this presentation");
    await Promise.all(args.slideIds.map((slideId, order) => ctx.db.patch(slideId, { order })));
    return null;
  },
});

export const updateOperation = internalMutation({
  args: { operationId: v.id("operations"), status: v.union(v.literal("running"), v.literal("complete"), v.literal("failed")), output: v.optional(v.string()), error: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { operationId, ...patch }) => { await ctx.db.patch(operationId, patch); return null; },
});

export const recordInbox = internalMutation({
  args: { presentationId: v.id("presentations"), sender: v.string(), subject: v.string(), text: v.string(), agentMailEventId: v.optional(v.string()) },
  returns: v.id("inboxItems"),
  handler: async (ctx, args) => {
    const presentation = await ctx.db.get(args.presentationId);
    if (!presentation) throw new Error("Presentation not found");
    if (args.agentMailEventId) {
      const existing = await ctx.db
        .query("inboxItems")
        .withIndex("by_agent_mail_event_id", (q) => q.eq("agentMailEventId", args.agentMailEventId))
        .unique();
      if (existing) return existing._id;
    }
    return await ctx.db.insert("inboxItems", { ...args, receivedAt: Date.now(), status: "received" });
  },
});

export async function requireOwner(ctx: MutationCtx | QueryCtx, presentationId: Id<"presentations">) {
  const userId = await getAuthUserId(ctx);
  const presentation = await ctx.db.get(presentationId);
  if (!userId || !presentation?.ownerId || presentation.ownerId !== userId) throw new Error("Only the presentation host can perform this action");
  return presentation;
}

export async function requireSlide(ctx: MutationCtx | QueryCtx, presentationId: Id<"presentations">, slideId: Id<"slides">) {
  const room = await ctx.db.get(presentationId);
  const slide = await ctx.db.get(slideId);
  if (!room || room.status === "ended" || !slide || slide.presentationId !== presentationId) throw new Error("Slide is not in an active room");
  return slide;
}
