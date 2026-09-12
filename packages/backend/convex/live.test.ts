/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import schema from "./schema";
const modules=import.meta.glob("./**/*.ts");
async function fixture(){
  const t=convexTest(schema,modules);
  rateLimiterTest.register(t);
  const [hostId,guestId]=await t.run(async ctx=>[await ctx.db.insert("users",{}),await ctx.db.insert("users",{})]);
  const host=t.withIdentity({subject:hostId});const guest=t.withIdentity({subject:guestId});
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
