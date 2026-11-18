/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { registerCore, sessionIdentity } from "@convex-dev/auth/test";
import { registerPassword } from "@convex-dev/auth/components/password/test";
import { registerUsername } from "@convex-dev/auth/components/username/test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { api } from "./_generated/api";
import schema from "./schema";
const modules = import.meta.glob("./**/*.ts");

function fixture() {
  const t = convexTest(schema, modules);
  registerCore(t);
  registerPassword(t, "authPasswordProvider");
  registerUsername(t);
  rateLimiterTest.register(t);
  return t;
}

test("guest upgrades to password account without losing room ownership; login, refresh and revocation work", async () => {
  const t = fixture();
  const guestTokens = await t.mutation(api.auth.signInAnonymous, {});
  const guest = t.withIdentity(sessionIdentity(guestTokens));
  const room = await guest.mutation(api.presentations.createDemo, { ownerName: "Host" });
  const credentials = { username: "host@example.com", password: "A unique slide password 48!" };
  const result = await guest.mutation(api.auth.signUpWithUsernamePassword, credentials);
  expect(result.status).toBe("complete");
  if (result.status !== "complete") throw new Error(JSON.stringify(result.userError));
  expect(result.tokens.userId).toBe(guestTokens.userId);
  const account = t.withIdentity(sessionIdentity(result.tokens));
  expect(await account.query(api.users.me, {})).toMatchObject({ email: credentials.username, isAnonymous: false });
  expect(await account.query(api.presentations.listMine, {})).toEqual([expect.objectContaining({ slug: room.slug })]);
  const invalid = await t.mutation(api.auth.signInWithUsernamePassword, { ...credentials, password: "Incorrect password 99!" });
  expect(invalid).toMatchObject({ status: "error", userError: { error: "INVALID_CREDENTIALS" } });
  const login = await t.mutation(api.auth.signInWithUsernamePassword, credentials);
  expect(login.status).toBe("complete");
  if (login.status !== "complete") throw new Error("Login failed");
  expect(login.tokens.userId).toBe(guestTokens.userId);
  const refreshed = await t.mutation(api.auth.refreshSession, { refreshToken: login.tokens.refreshToken });
  expect(refreshed.kind).toBe("rotated");
  await account.mutation(api.auth.signOut, { refreshToken: result.tokens.refreshToken });
  expect(await account.query(api.auth.isAuthenticated, {})).toBe(false);
  expect(await account.query(api.users.me, {})).toBeNull();
  await expect(account.mutation(api.presentations.createDemo, { ownerName: "Revoked" })).rejects.toThrow();
});

test("invalid signup rolls back the guest upgrade and never accepts a caller-supplied user ID", async () => {
  const t = fixture();
  const tokens = await t.mutation(api.auth.signInAnonymous, {});
  const guest = t.withIdentity(sessionIdentity(tokens));
  const before = await guest.query(api.users.me, {});
  const invalid = await guest.mutation(api.auth.signUpWithUsernamePassword, { username: "rollback@example.com", password: "short" });
  expect(invalid).toMatchObject({ status: "error", userError: { error: "PASSWORD_TOO_SHORT" } });
  expect(await guest.query(api.users.me, {})).toEqual(before);
  const valid = await guest.mutation(api.auth.signUpWithUsernamePassword, { username: "rollback@example.com", password: "A unique rollback password 88!" });
  expect(valid.status).toBe("complete");
  const duplicate = await t.mutation(api.auth.signUpWithUsernamePassword, { username: "ROLLBACK@example.com", password: "Another unique password 65!" });
  expect(duplicate).toMatchObject({ status: "error", userError: { error: "USERNAME_TAKEN" } });
  await expect(t.mutation(api.auth.signUpWithUsernamePassword, {
    username: "attacker@example.com", password: "Another unique password 65!",
    // @ts-expect-error Identity must be derived on the server.
    guestUserId: tokens.userId,
  })).rejects.toThrow();
});
