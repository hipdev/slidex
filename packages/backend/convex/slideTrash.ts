import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwner } from "./presentations";

export const list = query({
  args: { presentationId: v.id("presentations") },
  returns: v.array(v.object({ _id: v.id("slides"), title: v.string() })),
  handler: async (ctx, { presentationId }) => {
    await requireOwner(ctx, presentationId);
    const rows = await ctx.db.query("slides").withIndex("by_presentation_and_archived_and_order", q=>q.eq("presentationId",presentationId).eq("archived",true)).order("desc").take(50);
    return rows.map(({_id,title})=>({_id,title}));
  },
});

export const remove = mutation({
  args: { presentationId: v.id("presentations"), slideId: v.id("slides") }, returns: v.null(),
  handler: async (ctx, { presentationId, slideId }) => {
    const room = await requireOwner(ctx, presentationId);
    const slide = await ctx.db.get("slides",slideId);
    if (!slide || slide.presentationId!==presentationId) throw new Error("Slide not found");
    if (slide.archived) return null;
    const slides = await ctx.db.query("slides").withIndex("by_presentation_and_archived_and_order", q=>q.eq("presentationId",presentationId).eq("archived",undefined)).take(50);
    if (slides.length<=1) throw new Error("Conserva al menos una diapositiva");
    const index=slides.findIndex(s=>s._id===slideId);
    const remaining=slides.filter(s=>s._id!==slideId);
    await ctx.db.patch("slides",slideId,{archived:true});
    for(let order=0;order<remaining.length;order++) if(remaining[order].order!==order) await ctx.db.patch("slides",remaining[order]._id,{order});
    if(room.currentSlideId===slideId) await ctx.db.patch("presentations",presentationId,{currentSlideId:remaining[Math.max(0,index-1)]._id,showConclusions:false});
    return null;
  },
});

export const restore = mutation({
  args: { presentationId: v.id("presentations"), slideId: v.id("slides") }, returns: v.null(),
  handler: async (ctx, {presentationId,slideId}) => {
    await requireOwner(ctx,presentationId);
    const slide=await ctx.db.get("slides",slideId);
    if(!slide || slide.presentationId!==presentationId) throw new Error("Slide not found");
    if(!slide.archived) return null;
    const last=await ctx.db.query("slides").withIndex("by_presentation_and_archived_and_order",q=>q.eq("presentationId",presentationId).eq("archived",undefined)).order("desc").first();
    if((last?.order??-1)>=49) throw new Error("Máximo de 50 slides");
    await ctx.db.patch("slides",slideId,{archived:undefined,order:(last?.order??-1)+1});
    return null;
  },
});
