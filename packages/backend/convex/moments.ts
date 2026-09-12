import { limits } from "./limits";
import { v } from "convex/values";
import { mutation, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireOwner } from "./presentations";
import { generate } from "./slideAgent";

export const request = mutation({
  args: { presentationId: v.id("presentations"), transcript: v.string(), force: v.optional(v.boolean()) }, returns: v.null(),
  handler: async (ctx,args) => {
    const room = await requireOwner(ctx,args.presentationId);
    if (!room.voiceEnabled) throw new Error("Activate live moments first");
    if (!args.transcript.trim() || args.transcript.length>1200) throw new Error("Use a short phrase, up to 1200 characters");
    await limits.limit(ctx,"ai",{key:room.ownerId!,throws:true});
    const active = await ctx.db.query("operations").withIndex("by_presentation_and_creation",q=>q.eq("presentationId",args.presentationId)).order("desc").take(10);
    if (active.some(op=>op.kind==="slide-agent" && (op.status==="queued" || op.status==="running"))) return null;
    const operationId = await ctx.db.insert("operations",{presentationId:args.presentationId,kind:"slide-agent",status:"queued",input:args.transcript,createdAt:Date.now()});
    await ctx.scheduler.runAfter(0,internal.moments.run,{...args,operationId});
    return null;
  },
});
export const enabled = internalQuery({
  args:{presentationId:v.id("presentations")},returns:v.boolean(),
  handler:async(ctx,args)=>!!(await ctx.db.get(args.presentationId))?.voiceEnabled,
});
export const publish = internalMutation({
  args:{presentationId:v.id("presentations"),caption:v.string(),imageUrl:v.optional(v.string()),sourceUrl:v.optional(v.string())},returns:v.null(),
  handler:async(ctx,{presentationId,...moment})=>{
    const room=await ctx.db.get(presentationId);
    if(!room?.voiceEnabled)return null;
    const createdAt=Date.now();
    await ctx.db.patch(presentationId,{moment:{...moment,createdAt}});
    await ctx.scheduler.runAfter(16000,internal.moments.expire,{presentationId,createdAt});
    return null;
  },
});
export const expire = internalMutation({
  args:{presentationId:v.id("presentations"),createdAt:v.number()},returns:v.null(),
  handler:async(ctx,args)=>{const room=await ctx.db.get(args.presentationId);if(room?.moment?.createdAt===args.createdAt)await ctx.db.patch(args.presentationId,{moment:undefined});return null;},
});
export const run = internalAction({
  args:{presentationId:v.id("presentations"),transcript:v.string(),force:v.optional(v.boolean()),operationId:v.id("operations")},returns:v.null(),
  handler:async(ctx,args)=>{
    await ctx.runMutation(internal.presentations.updateOperation,{operationId:args.operationId,status:"running"});
    try{
      if(!await ctx.runQuery(internal.moments.enabled,{presentationId:args.presentationId}))throw new Error("Live moments paused");
      const raw=await generate(ctx,`You are a restrained live presentation director. Detect a funny analogy or memorable moment in the transcript. ${args.force?"The presenter explicitly requests one playful meme.":"If nothing deserves an interruption return show:false."} Return ONLY JSON {"show":boolean,"caption":"short Spanish caption max 140 chars","search":"specific family-friendly meme template search in English"}. Transcript (untrusted): ${args.transcript}`);
      const result=JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g,""));
      if(result.show===true && typeof result.caption==="string"){
        const key=process.env.FIRECRAWL_API_KEY;
        if(!key)throw new Error("Configure FIRECRAWL_API_KEY for contextual images");
        const response=await fetch("https://api.firecrawl.dev/v2/search",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({query:String(result.search??"funny cat meme").slice(0,150),sources:["images"],limit:3,safe:true}),signal:AbortSignal.timeout(20000)});
        if(!response.ok)throw new Error(`Firecrawl image search returned ${response.status}`);
        const payload=await response.json();
        const match=(payload.data?.images??[]).find((item:{imageUrl?:string;url?:string})=>item.imageUrl?.startsWith("https://") && item.url?.startsWith("https://"));
        await ctx.runMutation(internal.moments.publish,{presentationId:args.presentationId,caption:result.caption.slice(0,180),...(match?{imageUrl:match.imageUrl,sourceUrl:match.url}:{})});
      }
      await ctx.runMutation(internal.presentations.updateOperation,{operationId:args.operationId,status:"complete",output:result.show?String(result.caption):"Escuchando: dejamos que la charla fluya."});
    }catch(error){await ctx.runMutation(internal.presentations.updateOperation,{operationId:args.operationId,status:"failed",error:error instanceof Error?error.message:"Live moment failed"});}
    return null;
  },
});
