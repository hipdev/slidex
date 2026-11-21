import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";
import { ConvexAuthProvider, useAuthActions } from "@convex-dev/auth/react";
import { api } from "@slidex/backend/api";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const bundle = (sessionId, issued) => ({
  accessToken: ["header", Buffer.from(JSON.stringify({ sub:sessionId, iat:issued })).toString("base64url"), "signature"].join("."),
  refreshToken:`test-refresh-${sessionId}-${issued}`, refreshTokenExpiresAt:Date.now()+60_000, userId:"same-app-user",
});

test("the real auth provider reconnects Convex when replacing an authenticated session, but not for token rotation", async () => {
  let actions, renderer;
  const authentications = [];
  const values = new Map();
  const storage = { getItem:key=>values.get(key)??null, setItem:(key,value)=>{values.set(key,value);}, removeItem:key=>{values.delete(key);} };
  // A transport boundary, not a mock of the provider: record the real bridge's
  // setAuth calls. No credentials, provider RPCs or external network are used.
  const client = {
    url:"https://auth-test.convex.cloud", logger:console,
    setAuth(fetchToken,onChange) { authentications.push(fetchToken); void fetchToken({forceRefreshToken:false}).then(()=>onChange(true)); },
    clearAuth() {},
    watchQuery() { return { onUpdate:()=>()=>{}, localQueryResult:()=>true, localQueryLogs:()=>[], journal:()=>undefined }; },
  };
  function Actions() { actions=useAuthActions(); return null; }
  try {
    await act(async()=>{ renderer=create(React.createElement(ConvexAuthProvider,{client,api:{refreshSession:api.auth.refreshSession,signOut:api.auth.signOut,isAuthenticated:api.auth.isAuthenticated},storage,ambientSignIns:[]},React.createElement(Actions))); });
    await act(async()=>{ await actions.setSession(bundle("guest",1)); });
    assert.equal(authentications.length,1);
    await act(async()=>{ await actions.setSession(bundle("email-otp",2)); });
    assert.equal(authentications.length,2,"an already authenticated guest must switch the websocket to the OTP session");
    await act(async()=>{ await actions.setSession(bundle("email-otp",3)); });
    assert.equal(authentications.length,2,"refreshing the same session must not cause a reconnect/refresh loop");
  } finally { if(renderer) await act(async()=>renderer.unmount()); }
});
