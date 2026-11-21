/// <reference types="vite/client" />
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import schema from "./schema";
import { registerCore, sessionIdentity } from "@convex-dev/auth/test";
const modules=import.meta.glob("./**/*.ts");
async function fixture(){
  const t=convexTest(schema,modules);
  rateLimiterTest.register(t);
  registerCore(t);
  const hostTokens = await t.mutation(api.auth.signInAnonymous, {});
  const guestTokens = await t.mutation(api.auth.signInAnonymous, {});
  const host=t.withIdentity(sessionIdentity(hostTokens));const guest=t.withIdentity(sessionIdentity(guestTokens));
  const room=await host.mutation(api.presentations.createDemo,{ownerName:"Host"});
  const data=(await host.query(api.presentations.getBySlug,{slug:room.slug}))!;
  return {t,host,guest,room,data};
}
test("audience can propose, host incorporates exactly once and votes toggle",async()=>{
  const {host,guest,room,data}=await fixture();
  const id=await guest.mutation(api.live.contribute,{presentationId:room.presentationId,slideId:data.slides[0]._id,authorName:"Guest",kind:"suggestion",text:"A concrete example."});
  await expect(guest.mutation(api.live.moderate,{contributionId:id,accept:true})).rejects.toThrow("Only the presentation host");
  await guest.mutation(api.live.endorse,{contributionId:id});
  expect((await guest.query(api.live.list,{presentationId:room.presentationId}))[0]).toMatchObject({votes:1,endorsed:true});
  await guest.mutation(api.live.endorse,{contributionId:id});
  expect((await guest.query(api.live.list,{presentationId:room.presentationId}))[0].votes).toBe(0);
  await host.mutation(api.live.moderate,{contributionId:id,accept:true});
  await host.mutation(api.live.moderate,{contributionId:id,accept:true});
  const updated=(await guest.query(api.presentations.getBySlug,{slug:room.slug}))!;
  expect(updated.slides[0].body.split("A concrete example.")).toHaveLength(2);
  expect(updated.isHost).toBe(false);
});
test("room boundaries and host controls are enforced by the backend",async()=>{
  const {host,guest,room,data}=await fixture();
  const second=await host.mutation(api.presentations.createDemo,{ownerName:"Other"});
  await expect(host.mutation(api.presentations.setCurrentSlide,{presentationId:second.presentationId,slideId:data.slides[0]._id})).rejects.toThrow("not in an active room");
  await expect(guest.mutation(api.presentations.setCurrentSlide,{presentationId:room.presentationId,slideId:data.slides[1]._id})).rejects.toThrow("Only the presentation host");
  await expect(guest.mutation(api.live.settings,{presentationId:room.presentationId,showConclusions:true})).rejects.toThrow("Only the presentation host");
  await expect(guest.mutation(api.presentations.vote,{presentationId:room.presentationId,slideId:data.slides[1]._id,choiceId:"invented"})).rejects.toThrow("Invalid poll choice");
});
test("conclusions stay separate from slide copy and only accepted ones qualify for closing",async()=>{
  const {host,guest,room,data}=await fixture();
  const id=await guest.mutation(api.live.contribute,{presentationId:room.presentationId,slideId:data.slides[0]._id,authorName:"Guest",kind:"conclusion",text:"We learned together."});
  await host.mutation(api.live.moderate,{contributionId:id,accept:true});
  await host.mutation(api.live.settings,{presentationId:room.presentationId,showConclusions:true});
  const updated=(await guest.query(api.presentations.getBySlug,{slug:room.slug}))!;
  expect(updated.presentation.showConclusions).toBe(true);
  expect(updated.slides[0].body).toBe(data.slides[0].body);
  expect((await guest.query(api.live.list,{presentationId:room.presentationId}))[0].status).toBe("accepted");
});
test("moments require opt in before any AI job is scheduled",async()=>{
  const {host,guest,room}=await fixture();
  await expect(host.mutation(api.moments.request,{presentationId:room.presentationId,transcript:"meme sobre café"})).rejects.toThrow("Activate live moments");
  await expect(guest.mutation(api.moments.request,{presentationId:room.presentationId,transcript:"meme"})).rejects.toThrow("Only the presentation host");
});

test("AgentMail signatures, inbox routing and delivery deduplication",async()=>{
  const {t,host,room}=await fixture();
  const {Webhook}=await import("svix");
  const {vi}=await import("vitest");
  const secret=`whsec_${btoa("slidex-test-signing-secret-only")}`;
  vi.stubEnv("AGENTMAIL_WEBHOOK_SECRET",secret);
  try {
    await t.run(async ctx=>{await ctx.db.patch(room.presentationId,{agentInboxId:"test-inbox",agentInboxAddress:"test@example.com"});});
    const payload=JSON.stringify({event_type:"message.received",event_id:"evt-test",message:{inbox_id:"test-inbox",message_id:"msg-test",from:"Guest <guest@example.com>",subject:"A useful question",text:"How does realtime collaboration help learning?"}});
    const date=new Date();
    const headers={"svix-id":"msg-delivery","svix-timestamp":String(Math.floor(date.getTime()/1000)),"svix-signature":new Webhook(secret).sign("msg-delivery",date,payload)};
    expect((await t.fetch("/agentmail",{method:"POST",headers,body:payload})).status).toBe(200);
    expect((await t.fetch("/agentmail",{method:"POST",headers,body:payload})).status).toBe(200);
    expect((await host.query(api.presentations.getBySlug,{slug:room.slug}))!.inbox).toHaveLength(1);
    expect((await t.fetch("/agentmail",{method:"POST",headers:{...headers,"svix-signature":"invalid"},body:payload})).status).toBe(400);
    const broken="{";
    expect((await t.fetch("/agentmail",{method:"POST",headers:{...headers,"svix-signature":new Webhook(secret).sign("msg-delivery",date,broken)},body:broken})).status).toBe(400);
  } finally {vi.unstubAllEnvs();}
});

test("clarity requests deduplicate people, keep identities private and remain slide scoped", async () => {
  const { host, guest, room, data } = await fixture();
  const args = { presentationId: room.presentationId, slideId: data.slides[0]._id, kind: "lost" as const };
  const id = await guest.mutation(api.interventions.propose, args);
  expect(await guest.mutation(api.interventions.propose, args)).toBe(id);
  await host.mutation(api.interventions.propose, args);
  const rows = await host.query(api.interventions.list, { slideId: args.slideId });
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ votes: 2, supported: true });
  expect(rows[0]).not.toHaveProperty("userId");
  expect(await guest.query(api.interventions.list, { slideId: data.slides[1]._id })).toEqual([]);
  await guest.mutation(api.interventions.support, { id });
  expect((await guest.query(api.interventions.list, { slideId: args.slideId }))[0]).toMatchObject({ votes: 1, supported: false });
  await expect(guest.mutation(api.interventions.prepare, { id })).rejects.toThrow("Only the presentation host");
  await expect(guest.mutation(api.interventions.resolve, { id, publish: false })).rejects.toThrow("Only the presentation host");
  await expect(guest.mutation(api.interventions.propose, { ...args, slideId: data.slides[1]._id })).rejects.toThrow("El slide cambió");
});

test("AI drafts stay private, dismiss cancels late results and publishing is atomic and idempotent", async () => {
  const { t, host, guest, room, data } = await fixture();
  const { internal } = await import("./_generated/api");
  const id = await guest.mutation(api.interventions.propose, { presentationId: room.presentationId, slideId: data.slides[0]._id, kind: "twist", text: "¿Y si la colaboración también produce sesgos?" });
  await expect(host.mutation(api.interventions.resolve, { id, publish: true })).rejects.toThrow("Espera");
  await t.run(ctx => ctx.db.patch(id, { status: "running" }));
  await t.mutation(internal.interventions.finish, { id, title: "Un contrapunto", body: "Una explicación revisable.", sourceUrls: ["https://example.com/evidence"] });
  expect((await guest.query(api.interventions.list, { slideId: data.slides[0]._id }))[0].body).toBeUndefined();
  expect((await host.query(api.interventions.list, { slideId: data.slides[0]._id }))[0].body).toBe("Una explicación revisable.");
  await host.mutation(api.interventions.resolve, { id, publish: true });
  await host.mutation(api.interventions.resolve, { id, publish: true });
  const updated = (await host.query(api.presentations.getBySlug, { slug: room.slug }))!;
  expect(updated.slides).toHaveLength(4);
  expect(updated.presentation.currentSlideId).toBe(updated.slides[3]._id);
  expect(updated.slides[0].body).toBe(data.slides[0].body);
  const lostId = await guest.mutation(api.interventions.propose, { presentationId: room.presentationId, slideId: updated.slides[3]._id, kind: "lost" });
  await t.run(ctx => ctx.db.patch(lostId, { status: "running" }));
  await host.mutation(api.interventions.resolve, { id: lostId, publish: false });
  await t.mutation(internal.interventions.finish, { id: lostId, title: "Late", body: "Must not reappear" });
  expect((await host.query(api.interventions.list, { slideId: updated.slides[3]._id }))[0].status).toBe("dismissed");
});

test("informational visuals cannot create slides; English rooms preserve their language", async () => {
  const { host, room, data } = await fixture();
  const en = await host.mutation(api.presentations.createDemo, { ownerName: "Presenter", locale: "en" });
  const english = (await host.query(api.presentations.getBySlug, { slug: en.slug }))!;
  expect(english.slides[0].title).toBe("The next big idea is in this room.");
  expect(english.slides[1].choices?.[1].label).toBe("Live research");
  await expect(host.mutation(makeFunctionReference<"mutation">("live:addVisual"), { presentationId: en.presentationId, visual: "pulse", locale: "en" })).rejects.toThrow();
  const updated = (await host.query(api.presentations.getBySlug, { slug: en.slug }))!;
  expect(updated.slides).toEqual(english.slides);
  expect(updated.presentation.currentSlideId).toBe(english.presentation.currentSlideId);
  expect((await host.query(api.presentations.getBySlug, { slug: room.slug }))!.slides[0].body).toBe(data.slides[0].body);
});

test("hosts can edit the opening slide, attach an image, and reorder the deck", async () => {
  const { host, guest, room, data } = await fixture();
  await host.mutation(api.live.saveSlide, {
    presentationId: room.presentationId,
    slideId: data.slides[0]._id,
    title: "A better opening",
    body: "An editable opening slide.",
    imageUrl: "https://images.example.com/opening.jpg",
    imageSourceUrl: "https://example.com/opening",
  });
  await expect(guest.mutation(api.presentations.reorderSlides, {
    presentationId: room.presentationId,
    slideIds: [...data.slides].reverse().map((slide) => slide._id),
  })).rejects.toThrow("Only the presentation host");
  const reorderedIds = [data.slides[2]._id, data.slides[0]._id, data.slides[1]._id];
  await host.mutation(api.presentations.reorderSlides, { presentationId: room.presentationId, slideIds: reorderedIds });
  const updated = (await host.query(api.presentations.getBySlug, { slug: room.slug }))!;
  expect(updated.slides.map((slide) => slide._id)).toEqual(reorderedIds);
  expect(updated.slides[1]).toMatchObject({
    title: "A better opening",
    body: "An editable opening slide.",
    imageUrl: "https://images.example.com/opening.jpg",
    imageSourceUrl: "https://example.com/opening",
  });
});

test("room reactions include the latest events after the 200-event window fills", async () => {
  const { t, host, room, data } = await fixture();
  const latest = await t.run(async ctx => {
    for (let i = 0; i < 205; i++) await ctx.db.insert("reactions", { presentationId: room.presentationId, slideId: data.slides[i % 3]._id, attendeeId: "fixture", emoji: "fire", createdAt: i });
    return ctx.db.insert("reactions", { presentationId: room.presentationId, slideId: data.slides[0]._id, attendeeId: "fixture", emoji: "heart", createdAt: 206 });
  });
  const updated = (await host.query(api.presentations.getBySlug, { slug: room.slug }))!;
  expect(updated.reactions).toHaveLength(200);
  expect(updated.reactions[0]._id).toBe(latest);
});

test("slide layouts are owner-controlled and preserved for clients that omit the layout", async () => {
  const {host,guest,room,data}=await fixture();
  const args={presentationId:room.presentationId,slideId:data.slides[2]._id,title:"Visual story",body:"Datos | En vivo",layout:"services" as const};
  await expect(guest.mutation(api.live.saveSlide,args)).rejects.toThrow("Only the presentation host");
  await host.mutation(api.live.saveSlide,args);
  await host.mutation(api.live.saveSlide,{presentationId:args.presentationId,slideId:args.slideId,title:"Updated text",body:args.body});
  const updated=(await host.query(api.presentations.getBySlug,{slug:room.slug}))!;
  expect(updated.slides[2].layout).toBe("services");
  expect(updated.slides[0].layout).toBeUndefined();
});

test("only the owner can rename a presentation; viewers receive the new title", async () => {
  const {host,guest,room}=await fixture();
  await expect(guest.mutation(api.presentations.rename,{presentationId:room.presentationId,title:"Other title"})).rejects.toThrow("Only the presentation host");
  await expect(host.mutation(api.presentations.rename,{presentationId:room.presentationId,title:"   "})).rejects.toThrow("between 1 and 100");
  await expect(host.mutation(api.presentations.rename,{presentationId:room.presentationId,title:"x".repeat(101)})).rejects.toThrow("between 1 and 100");
  await host.mutation(api.presentations.rename,{presentationId:room.presentationId,title:"  De Grandpa a Convex  "});
  const visible=await guest.query(api.presentations.getBySlug,{slug:room.slug});
  expect(visible?.presentation.title).toBe("De Grandpa a Convex");
  expect(visible?.presentation.slug).toBe(room.slug);
});

test("a host can publish a caching story layout without altering the existing deck", async () => {
  const {host,room,data}=await fixture();
  const id=await host.mutation(api.live.saveSlide,{presentationId:room.presentationId,title:"Read sets",body:"Query | Read dependencies",layout:"cache"});
  const updated=(await host.query(api.presentations.getBySlug,{slug:room.slug}))!;
  expect(updated.slides).toHaveLength(data.slides.length+1);
  expect(updated.slides.at(-1)).toMatchObject({_id:id,layout:"cache",kind:"content"});
  expect(updated.slides.slice(0,3)).toEqual(data.slides);
});
