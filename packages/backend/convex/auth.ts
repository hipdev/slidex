import { components, internal } from "./_generated/api";
import { getAuthUserId, setupConvexAuth } from "@convex-dev/auth/server";
import { createFunctionHandle } from "convex/server";
import { v } from "convex/values";
import { mutation } from "./_generated/server";
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
    v.object({ status: v.literal("complete"), tokens }),
    v.object({ status: v.literal("error"), userError: v.object({ error: v.literal("INVALID_CODE") }) }),
  ),
  handler: async (ctx, args): Promise<{ status: "complete"; tokens: Tokens } | { status: "error"; userError: { error: "INVALID_CODE" } }> => {
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
    // Revoke pre-upgrade guest sessions, never the newly issued OTP session.
    // This also prevents an old guest session from writing into a completed merge.
    if (previousSessions.length) await ctx.runMutation(components.auth.public.revokeSessions, { sessionIds: previousSessions.map(session => session.sessionId) });
    return { status: "complete", tokens: session };
  },
});
