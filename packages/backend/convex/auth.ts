import { components, internal } from "./_generated/api";
import { getAuthUserId, setupConvexAuth } from "@convex-dev/auth/server";
import { createFunctionHandle } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const sessionLifetimeSeconds = 30 * 24 * 60 * 60;
const ttl = {
  accessTokenTtlSeconds: 60,
  refreshInactivityTimeoutSeconds: sessionLifetimeSeconds,
  sessionMaxLifetimeSeconds: sessionLifetimeSeconds,
};
const tokens = v.object({ accessToken: v.string(), refreshToken: v.string(), refreshTokenExpiresAt: v.number(), userId: v.string() });
type Tokens = { accessToken: string; refreshToken: string; refreshTokenExpiresAt: number; userId: string };
const core = setupConvexAuth({ component: components.auth, ...ttl });
export const { signOut, refreshSession, isAuthenticated } = core;

// Keep the existing anonymous sessions; OTP upgrades the same app identity.
export const signInAnonymous = mutation({
  args: {}, returns: tokens,
  handler: async (ctx): Promise<Tokens> => await ctx.runMutation(components.auth.public._internal_dangerous_signUp, {
    claims: { method: "anonymous", profile: {} }, componentPath: "auth",
    createUserHandle: await createFunctionHandle(internal.users.createUserAnonymous), ...ttl,
  }),
});

// Tranky's email OTP flow, using the mounted Auth 2.0 core and browser sessions.
// There are deliberately no public password or username sign-in endpoints.
export const signInWithEmailOtp = mutation({
  args: { email: v.string(), code: v.string() },
  returns: v.union(
    v.object({ status: v.literal("complete"), tokens, handoffId: v.optional(v.id("authSessionHandoffs")) }),
    v.object({ status: v.literal("error"), userError: v.object({ error: v.literal("INVALID_CODE") }) }),
  ),
  handler: async (ctx, args): Promise<{ status: "complete"; tokens: Tokens; handoffId?: Id<"authSessionHandoffs"> } | { status: "error"; userError: { error: "INVALID_CODE" } }> => {
    const requesterId = await getAuthUserId(ctx);
    const verified: { email: string } | null = await ctx.runMutation(internal.authOtp.consume, { ...args, requesterId: requesterId ?? undefined });
    // Returning an error, rather than throwing, commits failed-attempt counters.
    if (!verified) return { status: "error", userError: { error: "INVALID_CODE" } };
    const current = requesterId ? await ctx.db.get(requesterId) : null;
    const guest = current?.isAnonymous ? current : null;
    const previousSessions = guest ? await ctx.runQuery(components.auth.public.listSessions, { userId: guest._id }) : [];
    const existing = await ctx.db.query("users").withIndex("by_email", q => q.eq("email", verified.email)).unique();
    const options = {
      claims: { method: "email-otp", profile: { ...verified, ...(guest ? { guestUserId: guest._id } : {}) } },
      componentPath: "email-otp", onSignInHandle: await createFunctionHandle(internal.users.emailOtpSignedIn), ...ttl,
    };
    const session: Tokens = existing
      ? await ctx.runMutation(components.auth.public._internal_dangerous_signIn, { ...options, userId: existing._id })
      : await ctx.runMutation(components.auth.public._internal_dangerous_signUp, { ...options, createUserHandle: await createFunctionHandle(internal.users.createUserEmailOtp) });
    if (guest && guest._id !== session.userId) {
      const targetId = session.userId as Id<"users">;
      await ctx.db.patch(guest._id, { mergedInto: targetId });
      await ctx.runMutation(internal.users.moveGuestPresentations, { guestId: guest._id, targetId });
    }
    // Do not revoke a session still used by the browser's reactive auth watcher.
    // Bind cleanup to the newly minted (server-owned) session, never a caller ID.
    let handoffId: Id<"authSessionHandoffs"> | undefined;
    if (previousSessions.length) {
      const payload = session.accessToken.split(".")[1]!;
      const { sub: sessionId } = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
      if (typeof sessionId !== "string") throw new Error("Invalid minted session");
      handoffId = await ctx.db.insert("authSessionHandoffs", {
        sessionId, oldSessionIds: previousSessions.map(session => session.sessionId), expiresAt: Date.now() + 60_000,
      });
      await ctx.scheduler.runAfter(60_000, internal.auth.expireSessionHandoff, { handoffId });
    }
    return { status: "complete", tokens: session, handoffId };
  },
});

// This query becomes true only after the websocket has authenticated with the
// replacement token. setSession() persisting tokens alone does not prove that.
export const sessionHandoffReady = query({
  args: { handoffId: v.id("authSessionHandoffs") }, returns: v.boolean(),
  handler: async (ctx, { handoffId }) => {
    const row = await ctx.db.get(handoffId);
    const identity = await ctx.auth.getUserIdentity();
    return !!row && identity?.subject === row.sessionId && await getAuthUserId(ctx) !== null;
  },
});

export const completeSessionHandoff = mutation({
  args: { handoffId: v.id("authSessionHandoffs") }, returns: v.null(),
  handler: async (ctx, { handoffId }) => {
    const row = await ctx.db.get(handoffId);
    if (!row) return null;
    const identity = await ctx.auth.getUserIdentity();
    if (identity?.subject !== row.sessionId || await getAuthUserId(ctx) === null) throw new ConvexError("INVALID_SESSION_HANDOFF");
    await ctx.runMutation(components.auth.public.revokeSessions, { sessionIds: row.oldSessionIds });
    await ctx.db.delete(handoffId);
    return null;
  },
});

// Abandoned transitions still retire the old credentials after a bounded grace.
export const expireSessionHandoff = internalMutation({
  args: { handoffId: v.id("authSessionHandoffs") }, returns: v.null(),
  handler: async (ctx, { handoffId }) => {
    const row = await ctx.db.get(handoffId);
    if (row && row.expiresAt <= Date.now()) {
      await ctx.runMutation(components.auth.public.revokeSessions, { sessionIds: row.oldSessionIds });
      await ctx.db.delete(handoffId);
    }
    return null;
  },
});
