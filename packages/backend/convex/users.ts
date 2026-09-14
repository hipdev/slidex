import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/core";
import { internalMutation, query } from "./_generated/server";
import schema from "./schema";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const createUserAnonymous = internalMutation({
  args: {
    provider: v.literal("anonymous"),
    providerAccountId: v.string(),
    profile: v.object({}),
  },
  returns: v.id("users"),
  handler: async (ctx) => {
    return await ctx.db.insert("users", { isAnonymous: true, createdAt: Date.now() });
  },
});

export const createUserPassword = internalMutation({
  args: {
    provider: v.literal("password"),
    providerAccountId: v.string(),
    profile: v.object({ username: v.string() }),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const email = args.profile.username.trim().toLowerCase();
    if (!emailPattern.test(email)) throw new Error("Enter a valid email address");

    // A password created while anonymous upgrades the existing app user. The
    // auth component attaches the new password account to this same user id,
    // so presentation ownership and history remain intact.
    const currentUserId = await getAuthUserId(ctx);
    if (currentUserId) {
      const currentUser = await ctx.db.get("users", currentUserId);
      if (currentUser?.isAnonymous) {
        await ctx.db.patch(currentUserId, { email, isAnonymous: false });
        return currentUserId;
      }
    }

    return await ctx.db.insert("users", { email, isAnonymous: false, createdAt: Date.now() });
  },
});

export const me = query({
  args: {},
  returns: v.union(v.null(), schema.doc("users")),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    return userId ? await ctx.db.get("users", userId) : null;
  },
});
