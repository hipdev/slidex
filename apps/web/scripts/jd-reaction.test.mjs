import assert from "node:assert/strict";
import test from "node:test";
import { readFile, writeFile, unlink } from "node:fs/promises";
import React from "react";
import { act, create } from "react-test-renderer";
import { transformWithOxc } from "vite";
const url = new URL("../components/jd-reaction.tsx", import.meta.url);
const source = (await readFile(url, "utf8"))
  .replace('import { useAction, useConvexConnectionState } from "convex/react";', 'const useAction = () => globalThis.__reaction.clock; const useConvexConnectionState = () => ({isWebSocketConnected:true});')
  .replace('import { api } from "@slidex/backend/api";', 'const api = {jd:{clock:null}};');
const temporary = new URL(`.jd-reaction-${process.pid}.mjs`, import.meta.url);
let JDReaction;
try { await writeFile(temporary, (await transformWithOxc(source, url.pathname, { jsx:{runtime:"automatic"} })).code); ({JDReaction} = await import(temporary.href)); }
finally { await unlink(temporary).catch(()=>{}); }
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test("a reaction expires on the server deadline, and late mounts do not replay it", async ctx => {
  ctx.mock.timers.enable({apis:["setTimeout"]});
  const descriptors=Object.fromEntries(["document","Image","__reaction"].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const listeners=new Map();
  const doc={hidden:false,addEventListener:(event,fn)=>listeners.set(event,fn),removeEventListener:event=>listeners.delete(event)};
  let server=100_000;
  Object.defineProperty(globalThis,"document",{configurable:true,value:doc});
  Object.defineProperty(globalThis,"Image",{configurable:true,value:class {}});
  Object.defineProperty(globalThis,"__reaction",{configurable:true,value:{clock:async()=>server}});
  const reaction={kind:"convex_costs",startedAt:100_000,endsAt:110_000,requestId:"one"};
  let renderer;
  try {
    await act(async()=>{renderer=create(React.createElement(JDReaction,{reaction}));});
    assert.ok(renderer.toJSON(),"live viewers see the overlay");
    await act(async()=>{ctx.mock.timers.tick(10_000);});
    assert.equal(renderer.toJSON(),null,"overlay disappears without navigation or a backend write");
    server=120_000;
    await act(async()=>{doc.hidden=true;listeners.get("visibilitychange")();doc.hidden=false;await listeners.get("visibilitychange")();});
    assert.equal(renderer.toJSON(),null,"returning to the tab does not replay an expired reaction");
    await act(async()=>{renderer.unmount();renderer=create(React.createElement(JDReaction,{reaction}));});
    assert.equal(renderer.toJSON(),null,"reload after expiry does not replay");
    server=126_000;
    await act(async()=>{renderer.update(React.createElement(JDReaction,{reaction:{...reaction,requestId:"two",startedAt:120_000,endsAt:130_000}}));});
    assert.ok(renderer.toJSON(),"a late viewer joins only the remaining time");
    await act(async()=>{ctx.mock.timers.tick(4000);});
    assert.equal(renderer.toJSON(),null);
  } finally {
    if(renderer) await act(async()=>renderer.unmount());
    for(const [key,descriptor] of Object.entries(descriptors)) {if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
    ctx.mock.timers.reset();
  }
});
