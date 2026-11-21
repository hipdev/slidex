import { limits } from "./limits";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { requireOwner, requireSlide } from "./presentations";
import schema from "./schema";

export const list = query({
  args: { presentationId: v.id("presentations") },
  returns: v.array(schema.doc("contributions").extend({ endorsed: v.boolean() })),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId || !await ctx.db.get(args.presentationId)) return [];
    const rows = await ctx.db.query("contributions").withIndex("by_presentationId", q => q.eq("presentationId", args.presentationId)).order("desc").take(100);
    return await Promise.all(rows.map(async row => ({ ...row, endorsed: !!await ctx.db.query("endorsements").withIndex("by_contributionId_and_userId", q => q.eq("contributionId", row._id).eq("userId", userId)).unique() })));
  },
});

export const contribute = mutation({
  args: { presentationId: v.id("presentations"), slideId: v.id("slides"), authorName: v.string(), text: v.string(), kind: v.union(v.literal("suggestion"), v.literal("conclusion"), v.literal("question"), v.literal("fact")) },
  returns: v.id("contributions"),
  handler: async (ctx, args) => {
    const authorId = await getAuthUserId(ctx);
    if (!authorId) throw new Error("Join the room first");
    await requireSlide(ctx, args.presentationId, args.slideId);
    const text = args.text.trim();
    if (!text || text.length > 500) throw new Error("Write between 1 and 500 characters");
    await limits.limit(ctx,"contributions",{key:authorId,throws:true});
    return await ctx.db.insert("contributions", { ...args, text, authorId, authorName: args.authorName.trim().slice(0, 40) || "Guest", status: "pending", votes: 0 });
  },
});

export const endorse = mutation({
  args: { contributionId: v.id("contributions") }, returns: v.null(),
  handler: async (ctx, { contributionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Join the room first");
    const row = await ctx.db.get(contributionId);
    if (!row) throw new Error("Contribution not found");
    await requireSlide(ctx, row.presentationId, row.slideId);
    const existing = await ctx.db.query("endorsements").withIndex("by_contributionId_and_userId", q => q.eq("contributionId", contributionId).eq("userId", userId)).unique();
    if (existing) await ctx.db.delete(existing._id);
    else await ctx.db.insert("endorsements", { contributionId, userId });
    await ctx.db.patch(contributionId, { votes: Math.max(0, row.votes + (existing ? -1 : 1)) });
    return null;
  },
});

export const moderate = mutation({
  args: { contributionId: v.id("contributions"), accept: v.boolean() }, returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.contributionId);
    if (!row) throw new Error("Contribution not found");
    await requireOwner(ctx, row.presentationId);
    if (row.status !== "pending") return null;
    if (args.accept && row.kind === "suggestion") {
      const slide = await requireSlide(ctx, row.presentationId, row.slideId);
      if (slide.body.length + row.text.length > 2000) throw new Error("This slide is full; create another slide");
      await ctx.db.patch(slide._id, { body: `${slide.body}\n\n${row.text}` });
    }
    await ctx.db.patch(row._id, { status: args.accept ? "accepted" : "dismissed" });
    return null;
  },
});

export const settings = mutation({
  args: { presentationId: v.id("presentations"), showConclusions: v.optional(v.boolean()), voiceEnabled: v.optional(v.boolean()), clearMoment: v.optional(v.boolean()) }, returns: v.null(),
  handler: async (ctx, { presentationId, clearMoment, ...settings }) => {
    await requireOwner(ctx, presentationId);
    await ctx.db.patch(presentationId, { ...settings, ...(clearMoment ? { moment: undefined } : {}) });
    return null;
  },
});

export const saveSlide = mutation({
  args: { presentationId: v.id("presentations"), slideId: v.optional(v.id("slides")), title: v.string(), body: v.string(), imageUrl: v.optional(v.string()), imageSourceUrl: v.optional(v.string()) }, returns: v.id("slides"),
  handler: async (ctx, args) => {
    await requireOwner(ctx,args.presentationId);
    const title=args.title.trim(); const body=args.body.trim();
    if(!title || title.length>100 || body.length>2000)throw new Error("Use a title up to 100 characters and body up to 2000 characters");
    const imageUrl = args.imageUrl?.trim();
    const imageSourceUrl = args.imageSourceUrl?.trim();
    if ((imageUrl && !/^https:\/\//i.test(imageUrl)) || (imageSourceUrl && !/^https?:\/\//i.test(imageSourceUrl))) throw new Error("Use a valid image URL");
    const imagePatch = { imageUrl: imageUrl || undefined, imageSourceUrl: imageSourceUrl || undefined };
    if(args.slideId){await requireSlide(ctx,args.presentationId,args.slideId);await ctx.db.patch(args.slideId,{title,body,...imagePatch});return args.slideId;}
    const last=await ctx.db.query("slides").withIndex("by_presentation_and_order",q=>q.eq("presentationId",args.presentationId)).order("desc").first();
    if((last?.order??0)>=49)throw new Error("This deck has reached its 50 slide limit");
    const slideId=await ctx.db.insert("slides",{presentationId:args.presentationId,title,body,kind:"content",order:(last?.order??0)+1,...imagePatch});
    await ctx.db.patch(args.presentationId,{currentSlideId:slideId,showConclusions:false});return slideId;
  },
});
