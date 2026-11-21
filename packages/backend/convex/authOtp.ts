import { Resend } from "@convex-dev/resend";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import { env, internalMutation, mutation } from "./_generated/server";
import { emailBudget, emailDigest, emailToken, equalDigest, normalizeEmail, otpCode, otpDigest, validEmail } from "./lib/emailSecurity";

export const request = mutation({
  args: { email: v.string(), locale: v.optional(v.union(v.literal("es"), v.literal("en"))) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!validEmail(email)) return null;
    if (!env.RESEND_API_KEY || !env.RESEND_FROM || !env.EMAIL_OTP_SECRET) throw new ConvexError("EMAIL_UNAVAILABLE");
    const key = await emailDigest(email);
    if (!await emailBudget(ctx, [{ name: "otpSendGlobal", key: "global" }, { name: "otpSendEmail", key }, { name: "otpCooldown", key }])) return null;
    const requesterId = await getAuthUserId(ctx);
    const previous = await ctx.db.query("emailOtpChallenges").withIndex("by_email", q => q.eq("email", email)).unique();
    const code = otpCode(), nonce = emailToken();
    const value = { email, nonce, digest: await otpDigest(email, nonce, code), attempts: 0, consumed: false, expiresAt: Date.now() + 5 * 60_000, requesterId: requesterId ?? undefined };
    let challengeId;
    if (previous) { await ctx.db.replace(previous._id, value); challengeId = previous._id; }
    else challengeId = await ctx.db.insert("emailOtpChallenges", value);
    const es = args.locale !== "en";
    const title = es ? "Tu código de acceso a Slidex" : "Your Slidex sign-in code";
    const explanation = es ? "Vence en 5 minutos y solo funciona una vez. Si solicitaste varios, usa el más reciente. Nunca compartas este código. Si no lo solicitaste, ignora este correo." : "This code expires in 5 minutes and works once. If you requested several, use the newest one. Never share it. If you didn't request it, ignore this email.";
    // Resend's component queues delivery transactionally; no plaintext code is
    // stored in the application's challenge table or returned to the client.
    const resend = new Resend(components.resend, { testMode: false, apiKey: env.RESEND_API_KEY });
    await resend.sendEmail(ctx, {
      from: env.RESEND_FROM, to: email, subject: title,
      text: `${title}: ${code}\n\n${explanation}`,
      html: `<div style="background:#fffaf4;padding:40px 24px;font-family:Arial,sans-serif;color:#3c281f"><div style="max-width:480px;margin:auto"><p style="letter-spacing:4px;font-size:12px;color:#805b49">SLIDEX / ${es ? "TU ACCESO" : "YOUR ACCESS"}</p><h1 style="font-family:Georgia,serif;font-size:32px">${title}</h1><p style="font-size:40px;letter-spacing:12px;font-family:monospace;color:#c92e26">${code}</p><p style="line-height:1.7;color:#73574a">${explanation}</p></div></div>`,
    });
    await ctx.scheduler.runAfter(5 * 60_000, internal.authOtp.expire, { challengeId, nonce });
    return null;
  },
});

export const consume = internalMutation({
  args: { email: v.string(), code: v.string(), requesterId: v.optional(v.id("users")) },
  returns: v.union(v.null(), v.object({ email: v.string() })),
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!validEmail(email)) return null;
    const key = await emailDigest(email);
    if (!await emailBudget(ctx, [{ name: "otpVerifyGlobal", key: "global" }, { name: "otpVerifyEmail", key }])) return null;
    const row = await ctx.db.query("emailOtpChallenges").withIndex("by_email", q => q.eq("email", email)).unique();
    if (!row || row.consumed || row.expiresAt <= Date.now() || row.attempts >= 5 || row.requesterId !== args.requesterId) return null;
    if (!/^\d{6}$/.test(args.code) || !equalDigest(row.digest, await otpDigest(email, row.nonce, args.code))) {
      await ctx.db.patch(row._id, { attempts: row.attempts + 1 });
      return null;
    }
    await ctx.db.patch(row._id, { consumed: true });
    return { email };
  },
});

export const expire = internalMutation({
  args: { challengeId: v.id("emailOtpChallenges"), nonce: v.string() }, returns: v.null(),
  handler: async (ctx, { challengeId, nonce }) => {
    const row = await ctx.db.get(challengeId);
    if (row?.nonce === nonce && row.expiresAt <= Date.now()) await ctx.db.delete(challengeId);
    return null;
  },
});
