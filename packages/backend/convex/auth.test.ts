/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { registerCore, sessionIdentity } from "@convex-dev/auth/test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { Resend } from "@convex-dev/resend";
import { makeFunctionReference } from "convex/server";
import { api, internal } from "./_generated/api";
import schema from "./schema";
const modules = import.meta.glob("./**/*.ts");

function fixture() {
  vi.stubEnv("RESEND_API_KEY", "test-only-resend-key");
  vi.stubEnv("RESEND_FROM", "Slidex <test@example.invalid>");
  vi.stubEnv("EMAIL_OTP_SECRET", "test-only-otp-secret-not-for-production");
  const mail = vi.spyOn(Resend.prototype, "sendEmail").mockResolvedValue("test-only-email" as never);
  const t = convexTest(schema, modules);
  registerCore(t); rateLimiterTest.register(t);
  const code = () => (mail.mock.calls.at(-1)![1] as unknown as { text: string }).text.match(/\b\d{6}\b/)![0];
  const challenge = (email: string) => t.run(ctx => ctx.db.query("emailOtpChallenges").withIndex("by_email", q => q.eq("email", email)).unique());
  return { t, mail, code, challenge };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.useRealTimers(); });

// All delivery is mocked: these exercise the real Auth core and app mutations
// in an isolated database without sending an email or deploying a backend.
test("OTP upgrades the guest in place, preserves presentations, and supports refresh and revocation", async () => {
  const { t, mail, code, challenge } = fixture();
  const guestTokens = await t.mutation(api.auth.signInAnonymous, {});
  const guest = t.withIdentity(sessionIdentity(guestTokens));
  const room = await guest.mutation(api.presentations.createDemo, { ownerName: "Host" });
  await guest.mutation(api.authOtp.request, { email: " HOST@example.com ", locale: "es" });
  const correct = code();
  const row = (await challenge("host@example.com"))!;
  expect(row.digest).toHaveLength(64); expect(row).not.toHaveProperty("code"); expect(row.digest).not.toBe(correct);
  expect(mail.mock.calls[0]![1]).toMatchObject({ to: "host@example.com", subject: "Tu código de acceso a Slidex" });
  expect(await guest.query(api.users.me, {})).toMatchObject({ isAnonymous: true });
  const result = await guest.mutation(api.auth.signInWithEmailOtp, { email: "HOST@example.com", code: correct });
  expect(result.status).toBe("complete"); if (result.status !== "complete") throw new Error("OTP failed");
  expect(result.tokens.userId).toBe(guestTokens.userId);
  const account = t.withIdentity(sessionIdentity(result.tokens));
  expect(await account.query(api.users.me, {})).toMatchObject({ email: "host@example.com", isAnonymous: false, emailVerificationTime: expect.any(Number) });
  expect(await account.query(api.presentations.listMine, {})).toEqual([expect.objectContaining({ slug: room.slug })]);
  expect(await guest.query(api.users.me, {})).toBeNull();
  expect((await account.mutation(api.auth.refreshSession, { refreshToken: result.tokens.refreshToken })).kind).toBe("rotated");
  const loginContext = t.withIdentity(sessionIdentity(result.tokens));
  expect(await loginContext.mutation(api.auth.signInWithEmailOtp, { email: "host@example.com", code: correct })).toMatchObject({ status: "error" });
  await account.mutation(api.auth.signOut, { refreshToken: result.tokens.refreshToken });
  expect(await account.query(api.auth.isAuthenticated, {})).toBe(false);
  await expect(account.mutation(api.presentations.createDemo, { ownerName: "Revoked" })).rejects.toThrow();
});

test("an existing password-era account keeps its identity and receives the verified guest's presentations", async () => {
  const { t, code } = fixture();
  const existingId = await t.run(async ctx => {
    const ownerId = await ctx.db.insert("users", { email: "existing@example.com", isAnonymous: false, createdAt: 123 });
    await ctx.db.insert("presentations", { title: "Saved before OTP", slug: "LIVE-OLD00", ownerName: "Existing", ownerId, status: "live", createdAt: 123 });
    return ownerId;
  });
  const guestTokens = await t.mutation(api.auth.signInAnonymous, {});
  const guest = t.withIdentity(sessionIdentity(guestTokens));
  const room = await guest.mutation(api.presentations.createDemo, { ownerName: "Guest work" });
  await guest.mutation(api.authOtp.request, { email: "existing@example.com" });
  const result = await guest.mutation(api.auth.signInWithEmailOtp, { email: "existing@example.com", code: code() });
  if (result.status !== "complete") throw new Error("Expected OTP session");
  expect(result.tokens.userId).toBe(existingId);
  const account = t.withIdentity(sessionIdentity(result.tokens));
  expect(await account.query(api.users.me, {})).toMatchObject({ createdAt: 123, email: "existing@example.com", emailVerificationTime: expect.any(Number) });
  expect((await account.query(api.presentations.listMine, {})).map(room => room.slug).sort()).toEqual(["LIVE-OLD00", room.slug].sort());
  expect((await account.query(api.presentations.getBySlug, { slug: room.slug }))!.isHost).toBe(true);
  expect(await guest.query(api.users.me, {})).toBeNull();
  expect(await t.run(ctx => ctx.db.query("users").withIndex("by_email", q => q.eq("email", "existing@example.com")).take(3))).toHaveLength(1);
});

test("five incorrect attempts remain committed and prevent guessing or changing the guest identity", async () => {
  const { t, code, challenge } = fixture();
  const tokens = await t.mutation(api.auth.signInAnonymous, {});
  const guest = t.withIdentity(sessionIdentity(tokens));
  await guest.mutation(api.authOtp.request, { email: "guess@example.com" });
  const correct = code(), wrong = correct === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) expect(await guest.mutation(api.auth.signInWithEmailOtp, { email: "guess@example.com", code: wrong })).toMatchObject({ status: "error" });
  expect((await challenge("guess@example.com"))!.attempts).toBe(5);
  expect(await guest.mutation(api.auth.signInWithEmailOtp, { email: "guess@example.com", code: correct })).toMatchObject({ status: "error" });
  expect(await guest.query(api.users.me, {})).toMatchObject({ isAnonymous: true });
  expect((await guest.query(api.users.me, {}))!.email).toBeUndefined();
});

test("codes expire, resend is throttled, replacement invalidates old challenges and stale cleanup cannot erase a new one", async () => {
  const { t, mail, code, challenge } = fixture();
  const email = "resend@example.com";
  await t.mutation(api.authOtp.request, { email }); const firstCode = code(), first = (await challenge(email))!;
  await t.mutation(api.authOtp.request, { email }); expect(mail).toHaveBeenCalledTimes(1);
  await t.run(ctx => ctx.db.patch(first._id, { expiresAt: Date.now() - 1 }));
  expect(await t.mutation(api.auth.signInWithEmailOtp, { email, code: firstCode })).toMatchObject({ status: "error" });
  const now = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61_000);
  try {
    await t.mutation(api.authOtp.request, { email });
    expect(mail).toHaveBeenCalledTimes(2);
    const secondCode = code(), second = (await challenge(email))!;
    expect(second.nonce).not.toBe(first.nonce); expect(second.digest).not.toBe(first.digest);
    await t.mutation(internal.authOtp.expire, { challengeId: first._id, nonce: first.nonce });
    expect(await challenge(email)).not.toBeNull();
    if (firstCode !== secondCode) expect(await t.mutation(api.auth.signInWithEmailOtp, { email, code: firstCode })).toMatchObject({ status: "error" });
    expect(await t.mutation(api.auth.signInWithEmailOtp, { email, code: secondCode })).toMatchObject({ status: "complete" });
  } finally { now.mockRestore(); }
});

test("OTP is bound to the requesting browser identity; caller-supplied user ids are never accepted", async () => {
  const { t, code } = fixture();
  const first = t.withIdentity(sessionIdentity(await t.mutation(api.auth.signInAnonymous, {})));
  const otherTokens = await t.mutation(api.auth.signInAnonymous, {});
  const other = t.withIdentity(sessionIdentity(otherTokens));
  await first.mutation(api.authOtp.request, { email: "browser@example.com" }); const correct = code();
  expect(await other.mutation(api.auth.signInWithEmailOtp, { email: "browser@example.com", code: correct })).toMatchObject({ status: "error" });
  expect(await t.mutation(api.auth.signInWithEmailOtp, { email: "browser@example.com", code: correct })).toMatchObject({ status: "error" });
  await expect(first.mutation(api.auth.signInWithEmailOtp, {
    email: "browser@example.com", code: correct,
    // @ts-expect-error Identity is derived from the verified session, never the request.
    guestUserId: otherTokens.userId,
  })).rejects.toThrow();
  expect(await first.mutation(api.auth.signInWithEmailOtp, { email: "browser@example.com", code: correct })).toMatchObject({ status: "complete" });
});

test("failed email queueing rolls back the challenge and send budgets; invalid emails never send", async () => {
  const { t, mail, code, challenge } = fixture();
  await t.mutation(api.authOtp.request, { email: "not-an-email" }); expect(mail).not.toHaveBeenCalled();
  mail.mockRejectedValueOnce(new Error("Synthetic delivery failure"));
  await expect(t.mutation(api.authOtp.request, { email: "retry@example.com" })).rejects.toThrow();
  expect(await challenge("retry@example.com")).toBeNull();
  await t.mutation(api.authOtp.request, { email: "retry@example.com" });
  expect(await t.mutation(api.auth.signInWithEmailOtp, { email: "retry@example.com", code: code() })).toMatchObject({ status: "complete" });
});

test("password login, password signup and password changes are no longer public endpoints", async () => {
  const { t } = fixture();
  for (const name of ["signInWithUsernamePassword", "signUpWithUsernamePassword", "changePassword"]) {
    const reference = makeFunctionReference<"mutation">(`auth:${name}`);
    await expect(t.mutation(reference, { username: "old@example.com", password: "unused" })).rejects.toThrow();
  }
});

test("large guest histories merge in bounded batches without transferring anyone else's rooms", async () => {
  const { t, code } = fixture();
  const email = "history@example.com";
  const targetId = await t.run(ctx => ctx.db.insert("users", { email, isAnonymous: false, createdAt: Date.now() }));
  const guestTokens = await t.mutation(api.auth.signInAnonymous, {});
  const guest = t.withIdentity(sessionIdentity(guestTokens));
  const otherTokens = await t.mutation(api.auth.signInAnonymous, {});
  const other = t.withIdentity(sessionIdentity(otherTokens));
  const otherRoom = await other.mutation(api.presentations.createDemo, { ownerName: "Other guest" });
  await t.run(async ctx => {
    for (let i = 0; i < 103; i++) await ctx.db.insert("presentations", {
      ownerId: guestTokens.userId as typeof targetId, title: `Guest ${i}`, slug: `TEST-${i}`, ownerName: "Guest", status: "live", createdAt: Date.now(),
    });
  });
  await guest.mutation(api.authOtp.request, { email });
  const result = await guest.mutation(api.auth.signInWithEmailOtp, { email, code: code() });
  expect(result.status).toBe("complete");
  // Execute the same server-only continuation a scheduler would run, without
  // advancing the unrelated five-minute OTP cleanup timer.
  await t.mutation(internal.users.moveGuestPresentations, { guestId: guestTokens.userId as typeof targetId, targetId });
  expect(await t.run(ctx => ctx.db.query("presentations").withIndex("by_ownerId", q => q.eq("ownerId", targetId)).take(104))).toHaveLength(103);
  expect((await other.query(api.presentations.getBySlug, { slug: otherRoom.slug }))!.isHost).toBe(true);
  await expect(t.mutation(internal.users.moveGuestPresentations, { guestId: otherTokens.userId as typeof targetId, targetId })).rejects.toThrow("INVALID_ACCOUNT_MERGE");
});
