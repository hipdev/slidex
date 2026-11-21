import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, query } from "./_generated/server";
import schema from "./schema";
import { internal } from "./_generated/api";
import { normalizeEmail, validEmail } from "./lib/emailSecurity";

const emailMethod = v.object({ name: v.literal("email-otp"), profile: v.object({ email: v.string(), guestUserId: v.optional(v.id("users")) }) });

export const createUserAnonymous = internalMutation({
  args: { method: v.object({ name: v.literal("anonymous"), profile: v.object({}) }) },
  returns: v.id("users"),
  handler: async ctx => await ctx.db.insert("users", { isAnonymous: true, createdAt: Date.now() }),
});

// This callback can only be reached after the email challenge was consumed.
export const createUserEmailOtp = internalMutation({
  args: { method: emailMethod }, returns: v.id("users"),
  handler: async (ctx, { method }) => {
    const email = normalizeEmail(method.profile.email);
    if (!validEmail(email)) throw new ConvexError("INVALID_EMAIL_ACCOUNT");
    const existing = await ctx.db.query("users").withIndex("by_email", q => q.eq("email", email)).unique();
    if (existing) return existing._id;
    const guestId = method.profile.guestUserId;
    if (guestId) {
      const guest = await ctx.db.get(guestId);
      if (guest?.isAnonymous && !guest.mergedInto) {
        await ctx.db.patch(guestId, { email, emailVerificationTime: Date.now(), isAnonymous: false });
        return guestId;
      }
    }
    return await ctx.db.insert("users", { email, emailVerificationTime: Date.now(), isAnonymous: false, createdAt: Date.now() });
  },
});

export const emailOtpSignedIn = internalMutation({
  args: { method: emailMethod, userId: v.id("users") }, returns: v.null(),
  handler: async (ctx, { method, userId }) => {
    const user = await ctx.db.get(userId);
    if (!user || user.email !== method.profile.email) throw new ConvexError("INVALID_EMAIL_ACCOUNT");
    await ctx.db.patch(userId, { emailVerificationTime: user.emailVerificationTime ?? Date.now(), isAnonymous: false });
    return null;
  },
});

export const moveGuestPresentations = internalMutation({
  args: { guestId: v.id("users"), targetId: v.id("users") }, returns: v.null(),
  handler: async (ctx, { guestId, targetId }) => {
    const guest = await ctx.db.get(guestId), target = await ctx.db.get(targetId);
    if (!guest?.isAnonymous || guest.mergedInto !== targetId || !target?.emailVerificationTime || target.isAnonymous) throw new ConvexError("INVALID_ACCOUNT_MERGE");
    const rooms = await ctx.db.query("presentations").withIndex("by_ownerId", q => q.eq("ownerId", guestId)).take(100);
    await Promise.all(rooms.map(room => ctx.db.patch(room._id, { ownerId: targetId })));
    if (rooms.length === 100) await ctx.scheduler.runAfter(0, internal.users.moveGuestPresentations, { guestId, targetId });
    return null;
  },
});

export const me = query({
  args: {}, returns: v.union(v.null(), schema.doc("users")),
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    return userId ? await ctx.db.get(userId) : null;
  },
});
