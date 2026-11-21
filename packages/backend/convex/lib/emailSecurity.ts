import { env, type MutationCtx } from "../_generated/server";
import { limits } from "../limits";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const validEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
export const emailToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export const emailDigest = async (email: string) => hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email))));

// Tranky's rejection sampling avoids modulo bias in six-digit codes.
export function otpCode() {
  const data = new Uint32Array(1);
  do { crypto.getRandomValues(data); } while (data[0]! >= 4_294_000_000);
  return String(data[0]! % 1_000_000).padStart(6, "0");
}
export async function otpDigest(email: string, nonce: string, code: string) {
  if (!env.EMAIL_OTP_SECRET) throw new Error("EMAIL_UNAVAILABLE");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.EMAIL_OTP_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`slidex:email-otp:v1:${nonce}:${email}:${code}`))));
}
export function equalDigest(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
type BudgetName = "otpSendGlobal" | "otpSendEmail" | "otpCooldown" | "otpVerifyGlobal" | "otpVerifyEmail";
export async function emailBudget(ctx: MutationCtx, rules: { name: BudgetName; key: string }[]) {
  // Check every budget before consuming any. Mutation OCC makes the checks and
  // reservations atomic, without exhausting the global budget on cooldown spam.
  const checks = await Promise.all(rules.map(rule => limits.check(ctx, rule.name, { key: rule.key })));
  if (checks.some(check => !check.ok)) return false;
  for (const rule of rules) await limits.limit(ctx, rule.name, { key: rule.key, throws: true });
  return true;
}
