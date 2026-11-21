import assert from "node:assert/strict";
import test from "node:test";
import { readFile, writeFile, unlink } from "node:fs/promises";
import React from "react";
import { act, create } from "react-test-renderer";
import { transformWithOxc } from "vite";

// Exercise the real component; only browser recording and remote transport are
// replaced, so these tests never request a microphone or send audio externally.
const componentURL = new URL("../components/jd-voice.tsx", import.meta.url);
let source = await readFile(componentURL, "utf8");
source = source.replace('import { useAction } from "convex/react";', 'const useAction = action => action === "voiceReply" ? globalThis.__jdTest.voice : globalThis.__jdTest.talk;')
  .replace('import { api } from "@slidex/backend/api";', 'const api = { jd: { talk: "talk", voiceReply: "voiceReply" } };')
  .replace('import { JDCharacter } from "./jd-character";', 'const JDCharacter = () => null;')
  .replace('import { tr, useLocale } from "../i18n/provider";', 'const tr = key => key; const useLocale = () => "es";');
const compiled = await transformWithOxc(source, componentURL.pathname, { jsx: { runtime: "automatic" } });
const temporary = new URL(`.jd-recording-${process.pid}.mjs`, import.meta.url);
let JDVoice;
try { await writeFile(temporary, compiled.code); ({ JDVoice } = await import(temporary.href)); }
finally { await unlink(temporary).catch(() => {}); }
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function fixture(run, { deferred = false, naturalVoice = false, deferredVoice = false } = {}) {
  const descriptors = Object.fromEntries(["window", "navigator", "MediaRecorder", "Audio", "__jdTest"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const calls = [], recordings = [], players = [];
  let resolveVoice;
  class AudioPlayer { paused = false; constructor() { players.push(this); } async play() {} pause() { this.paused = true; } }
  let stopped = 0, allow;
  const stream = { getTracks: () => [{ stop: () => { stopped++; } }] };
  class Recorder {
    static isTypeSupported() { return true; }
    state = "inactive"; mimeType = "audio/webm";
    constructor() { recordings.push(this); }
    start() { this.state = "recording"; this.ondataavailable?.({ data: new Blob(["x".repeat(200)]) }); }
    stop() { this.state = "inactive"; this.onstop?.(); }
  }
  const globals = { window: { speechSynthesis: { cancel() {} } }, navigator: { mediaDevices: { getUserMedia: () => deferred ? new Promise(resolve => { allow = () => resolve(stream); }) : Promise.resolve(stream) } }, MediaRecorder: Recorder, Audio: AudioPlayer, __jdTest: { voice: async () => deferredVoice ? new Promise(resolve => { resolveVoice = resolve; }) : naturalVoice ? new Uint8Array(100).buffer : null, talk: async payload => { calls.push(payload); return { transcript: "hola", reply: "listo" }; } } };
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true });
  let renderer;
  try {
    await act(async () => { renderer = create(React.createElement(JDVoice, { presentationId: "presentation-test" })); });
    const button = className => renderer.root.findAllByType("button").find(node => node.props.className?.split(" ").includes(className));
    await run({ button, calls, recordings, stopped: () => stopped, allow: () => allow(), players, resolveVoice: () => resolveVoice(new Uint8Array(100).buffer) });
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    for (const [key, descriptor] of Object.entries(descriptors)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
}

test("JD cancellation discards audio, stops microphone and permits a fresh recording", async () => {
  await fixture(async ({ button, calls, recordings, stopped }) => {
    await act(async () => { await button("jd-talk").props.onClick(); });
    const oldStop = recordings[0].onstop;
    assert.equal(button("jd-cancel").props["aria-label"], "Cancelar escucha sin enviar");
    await act(async () => { button("jd-cancel").props.onClick(); oldStop(); });
    assert.equal(calls.length, 0);
    assert.equal(recordings[0].state, "inactive");
    assert.equal(stopped(), 1);
    assert.equal(button("jd-cancel"), undefined);
    await act(async () => { await button("jd-talk").props.onClick(); });
    assert.equal(recordings[1].state, "recording");
    await act(async () => { button("jd-talk").props.onClick(); await new Promise(resolve => setImmediate(resolve)); });
    assert.equal(calls.length, 1, "explicit stop-and-send still works");
    assert.equal(calls[0].audio.byteLength, 200);
  });
});

test("JD cancellation while permission is pending stops a late microphone without recording", async () => {
  await fixture(async ({ button, calls, recordings, stopped, allow }) => {
    await act(async () => { button("jd-talk").props.onClick(); });
    await act(async () => { button("jd-cancel").props.onClick(); allow(); });
    assert.equal(recordings.length, 0);
    assert.equal(calls.length, 0);
    assert.equal(stopped(), 1);
    assert.equal(button("jd-talk").props.disabled, false);
  }, { deferred: true });
});

test("closing JD while recording also discards audio", async () => {
  await fixture(async ({ button, calls, stopped }) => {
    await act(async () => { await button("jd-talk").props.onClick(); });
    await act(async () => { button("jd-close").props.onClick(); });
    assert.equal(calls.length, 0);
    assert.equal(stopped(), 1);
    assert.equal(button("jd-close"), undefined);
  });
});

test("collapsing JD cancels a live recording without sending and leaves a usable handle", async () => {
  await fixture(async ({ button, calls, stopped }) => {
    await act(async () => { await button("jd-talk").props.onClick(); });
    await act(async () => { button("jd-collapse-tab").props.onClick(); });
    assert.equal(calls.length, 0);
    assert.equal(stopped(), 1);
    assert.equal(button("jd-collapse-tab").props["aria-expanded"], false);
    assert.equal(button("jd-cancel"), undefined);
    await act(async () => { button("jd-collapse-tab").props.onClick(); });
    assert.equal(button("jd-collapse-tab").props["aria-expanded"], true);
    assert.equal(button("jd-talk").props.disabled, false);
  });
});


test("closing JD stops natural audio, and collapsing cancels a late speech response", async () => {
  await fixture(async ({button,players})=>{
    await act(async()=>{await button("jd-talk").props.onClick();});
    await act(async()=>{button("jd-talk").props.onClick();await new Promise(resolve=>setImmediate(resolve));});
    assert.equal(players.length,1);
    await act(async()=>button("jd-close").props.onClick());
    assert.equal(players[0].paused,true);
  },{naturalVoice:true});
  await fixture(async ({button,players,resolveVoice})=>{
    await act(async()=>{await button("jd-talk").props.onClick();});
    await act(async()=>{button("jd-talk").props.onClick();await new Promise(resolve=>setImmediate(resolve));});
    await act(async()=>{button("jd-collapse-tab").props.onClick();resolveVoice();});
    assert.equal(players.length,0,"a cancelled reply must not start speaking later");
  },{deferredVoice:true});
});
