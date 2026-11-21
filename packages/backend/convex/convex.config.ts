import { defineApp } from "convex/server";
import { v } from "convex/values";
import agent from "@convex-dev/agent/convex.config";
import staticHosting from "@convex-dev/static-hosting/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import auth from "@convex-dev/auth/convex.config.js";
import passwordProvider from "@convex-dev/auth/components/password/convex.config.js";
import username from "@convex-dev/auth/components/username/convex.config.js";

const app = defineApp({ env: {
  CLOUDFLARE_TRANSCRIPTION_API_URL: v.optional(v.string()),
  CLOUDFLARE_TRANSCRIPTION_API_TOKEN: v.optional(v.string()),
  CLOUDFLARE_AI_API_URL: v.optional(v.string()),
  CLOUDFLARE_AI_API_TOKEN: v.optional(v.string()),
} });

app.use(auth);
app.use(passwordProvider, { name: "authPasswordProvider" });
app.use(username);
app.use(agent);
app.use(staticHosting);
app.use(rateLimiter);
export default app;
