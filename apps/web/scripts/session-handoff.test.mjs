import assert from "node:assert/strict";
import test from "node:test";
import { finishSessionHandoff } from "../components/session-handoff.ts";

test("OTP handoff waits for websocket identity before retiring the guest session", async () => {
  let ready = false, listener, unsubscribed = 0, completions = 0;
  const client = {
    watchQuery: () => ({ localQueryResult: () => ready, onUpdate: fn => { listener = fn; return () => unsubscribed++; } }),
    mutation: async () => { completions++; },
  };
  const finished = finishSessionHandoff(client, "handoff-id");
  await Promise.resolve();
  assert.equal(completions, 0);
  listener(); // An update from the old guest identity must not finish sign-in.
  assert.equal(completions, 0);
  ready = true; listener();
  await finished;
  assert.equal(completions, 1);
  assert.equal(unsubscribed, 1);
});

test("failed authentication observations never revoke the guest session", async () => {
  let listener, unsubscribed = false, completions = 0, failed = false;
  const client = {
    watchQuery: () => ({ localQueryResult: () => { if (failed) throw new Error("Connection failed"); return false; }, onUpdate: fn => { listener = fn; return () => { unsubscribed = true; }; } }),
    mutation: async () => { completions++; },
  };
  const finished = finishSessionHandoff(client, "handoff-id");
  failed = true; listener();
  await assert.rejects(finished, /Connection failed/);
  assert.equal(completions, 0); assert.equal(unsubscribed, true);
});
