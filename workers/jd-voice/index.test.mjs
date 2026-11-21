import test from "node:test";
import assert from "node:assert/strict";
import { createVoiceWorker } from "./index.mjs";

test("speech verifies signed, bounded, expiring requests before using the AI binding",async()=>{
  const pair=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
  const worker=createVoiceWorker(await crypto.subtle.exportKey("jwk",pair.publicKey));
  const calls=[];
  const env={AI:{run:async(...args)=>{calls.push(args);return new Response(new Uint8Array([1,2,3]),{headers:{"content-type":"audio/mpeg"}});}}};
  const request=async(payload,signatureOverride)=>{
    const text=JSON.stringify(payload);
    const signature=await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},pair.privateKey,new TextEncoder().encode(text));
    return new Request("https://voice.example/v1/speech",{method:"POST",body:JSON.stringify({payload:text,signature:signatureOverride??Buffer.from(signature).toString("base64")})});
  };
  const payload={text:"Así, tal cual.",locale:"es",aud:"slidex-jd-voice",expiresAt:Date.now()+15000};
  assert.equal((await worker.fetch(await request(payload,"AAAA"),env)).status,401);
  assert.equal((await worker.fetch(await request({...payload,expiresAt:Date.now()-1}),env)).status,401);
  assert.equal((await worker.fetch(await request({...payload,text:"x".repeat(801)}),env)).status,400);
  assert.equal(calls.length,0);
  const result=await worker.fetch(await request(payload),env);
  assert.equal(result.status,200);
  assert.equal(result.headers.get("content-type"),"audio/mpeg");
  assert.equal(calls[0][0],"@cf/deepgram/aura-2-es");
  assert.equal(calls[0][1].speaker,"alvaro");
});
