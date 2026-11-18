import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, query } from "./_generated/server";
import schema from "./schema";
import { components } from "./_generated/api";

export const createUserAnonymous = internalMutation({
  args: {
    method: v.object({ name: v.literal("anonymous"), profile: v.object({}) }),
  },
  returns: v.id("users"),
  handler: async (ctx) => {
    return await ctx.db.insert("users", { isAnonymous: true, createdAt: Date.now() });
  },
});

export const createUserPassword = internalMutation({
  args: {
    method: v.object({ name: v.literal("usernamePassword"), profile: v.object({ username: v.optional(v.string()), guestUserId: v.optional(v.id("users")) }) }),
  },
  returns: v.id("users"),
  handler: async (ctx, { method }) => {
    // A password created while anonymous upgrades the existing app user. The
    // auth component attaches the new password account to this same user id,
    // so presentation ownership and history remain intact.
    const currentUserId = method.profile.guestUserId;
    if (currentUserId) {
      const currentUser = await ctx.db.get("users", currentUserId);
      if (currentUser?.isAnonymous) {
        await ctx.db.patch(currentUserId, { email: method.profile.username, isAnonymous: false });
        return currentUserId;
      }
    }

    return await ctx.db.insert("users", { email: method.profile.username, isAnonymous: false, createdAt: Date.now() });
  },
});

export const me = query({
  args: {},
  returns: v.union(v.null(), schema.doc("users")),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get("users", userId);
    if (!user || user.isAnonymous) return user;
    const username = await ctx.runQuery(components.authUsername.public.getUsername, { userId });
    return { ...user, email: username ?? user.email };
  },
});
