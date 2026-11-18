import { components, internal } from "./_generated/api";
import { getAuthUserId, setupConvexAuth } from "@convex-dev/auth/server";
import { setupUsernamePassword, type SignUpResult } from "@convex-dev/auth/methods/username-password/server";
import { DEFAULT_MIN_PASSWORD_LENGTH } from "@convex-dev/auth/methods/username-password";
import { createFunctionHandle } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";

const sessionLifetimeSeconds = 30 * 24 * 60 * 60;
const ttl = {
  accessTokenTtlSeconds: 60,
  refreshInactivityTimeoutSeconds: sessionLifetimeSeconds,
  sessionMaxLifetimeSeconds: sessionLifetimeSeconds,
};
const tokens = v.object({
  accessToken: v.string(), refreshToken: v.string(),
  refreshTokenExpiresAt: v.number(), userId: v.string(),
});
type Tokens = { accessToken: string; refreshToken: string; refreshTokenExpiresAt: number; userId: string };
const credentials = { username: v.string(), password: v.string() };
const signupError = v.union(
  v.object({ error: v.literal("USERNAME_TAKEN") }),
  v.object({ error: v.literal("USERNAME_TOO_SHORT"), minimumLength: v.number() }),
  v.object({ error: v.literal("USERNAME_TOO_LONG"), maximumLength: v.number() }),
  v.object({ error: v.literal("USERNAME_HAS_SURROUNDING_WHITESPACE") }),
  v.object({ error: v.literal("USERNAME_HAS_INVALID_CHARACTERS") }),
  v.object({ error: v.literal("PASSWORD_TOO_SHORT"), minimumLength: v.number() }),
  v.object({ error: v.literal("PASSWORD_TOO_LONG"), maximumLength: v.number() }),
  v.object({ error: v.literal("PASSWORD_HAS_SURROUNDING_WHITESPACE") }),
  v.object({ error: v.literal("PASSWORD_TOO_COMMON") }),
);
const core = setupConvexAuth({ component: components.auth, ...ttl });
export const { signOut, refreshSession, isAuthenticated } = core;

// Auth 2.0 does not publicly export its anonymous method yet. Keep guest
// creation in this server-only adapter; credentials and sessions belong to Auth.
export const signInAnonymous = mutation({
  args: {},
  returns: tokens,
  handler: async (ctx): Promise<Tokens> => await ctx.runMutation(components.auth.public._internal_dangerous_signUp, {
    claims: { method: "anonymous", profile: {} },
    componentPath: "auth",
    createUserHandle: await createFunctionHandle(internal.users.createUserAnonymous),
    ...ttl,
  }),
});

export const { signInWithUsernamePassword, changePassword } = setupUsernamePassword(core, {
  component: components.authPasswordProvider,
  usernameComponent: components.authUsername,
}).attachUserCallbacks({ createUser: internal.users.createUserPassword });

// Component callbacks do not inherit the caller's identity. Resolve the guest
// here and pass it only through an internal mutation so upgrading keeps its ID.
export const signUpWithUsernamePassword = mutation({
  args: credentials,
  returns: v.union(
    v.object({ status: v.literal("complete"), tokens }),
    v.object({ status: v.literal("error"), userError: signupError }),
  ),
  handler: async (ctx, args): Promise<SignUpResult> => {
    const username = args.username.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) {
      return { status: "error", userError: { error: "USERNAME_HAS_INVALID_CHARACTERS" } };
    }
    const guestUserId = await getAuthUserId(ctx);
    try {
      const result: Tokens = await ctx.runMutation(internal.auth.createPasswordAccount, {
        ...args, username, guestUserId: guestUserId ?? undefined,
      });
      return { status: "complete", tokens: result };
    } catch (error) {
      if (error instanceof ConvexError) {
        // Only the private mutation below emits this validated error shape.
        return { status: "error", userError: error.data as Extract<SignUpResult, { status: "error" }>["userError"] };
      }
      throw error;
    }
  },
});

export const createPasswordAccount = internalMutation({
  args: { ...credentials, guestUserId: v.optional(v.id("users")) },
  returns: tokens,
  handler: async (ctx, { username, password, guestUserId }): Promise<Tokens> => {
    const existing = await ctx.runQuery(components.authUsername.public.getUserIdByUsername, { username });
    if (existing !== null) throw new ConvexError({ error: "USERNAME_TAKEN" });
    const result = await ctx.runMutation(components.auth.public._internal_dangerous_signUp, {
      claims: { method: "usernamePassword", profile: { username, ...(guestUserId ? { guestUserId } : {}) } },
      componentPath: "authPasswordProvider",
      createUserHandle: await createFunctionHandle(internal.users.createUserPassword),
      ...ttl,
    });
    const named = await ctx.runMutation(components.authUsername.public.setUsername, { userId: result.userId, username });
    if (!named.success) throw new ConvexError(named.userError);
    const secured = await ctx.runMutation(components.authPasswordProvider.public._internal_dangerous_setPassword, { userId: result.userId, password, minimumLength: DEFAULT_MIN_PASSWORD_LENGTH });
    if (!secured.success) throw new ConvexError(secured.userError);
    // A throw rolls back the user upgrade, username and session together.
    return result;
  },
});
