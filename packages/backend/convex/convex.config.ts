import { defineApp } from "convex/server";
import { v } from "convex/values";
import agent from "@convex-dev/agent/convex.config";
import staticHosting from "@convex-dev/static-hosting/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import auth from "@convex-dev/auth/convex.config.js";
import resend from "@convex-dev/resend/convex.config.js";

const app = defineApp({ env: {
  CLOUDFLARE_TRANSCRIPTION_API_URL: v.optional(v.string()),
  CLOUDFLARE_TRANSCRIPTION_API_TOKEN: v.optional(v.string()),
  CLOUDFLARE_AI_API_URL: v.optional(v.string()),
  CLOUDFLARE_AI_API_TOKEN: v.optional(v.string()),
  RESEND_API_KEY: v.optional(v.string()),
  RESEND_FROM: v.optional(v.string()),
  EMAIL_OTP_SECRET: v.optional(v.string()),
} });

app.use(auth);
app.use(resend);
app.use(agent);
app.use(staticHosting);
app.use(rateLimiter);
export default app;
