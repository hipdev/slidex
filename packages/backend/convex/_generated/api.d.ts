/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as authOtp from "../authOtp.js";
import type * as http from "../http.js";
import type * as inbox from "../inbox.js";
import type * as interventions from "../interventions.js";
import type * as jd from "../jd.js";
import type * as language from "../language.js";
import type * as lib_emailSecurity from "../lib/emailSecurity.js";
import type * as lib_jd_reactions from "../lib/jd_reactions.js";
import type * as limits from "../limits.js";
import type * as live from "../live.js";
import type * as moments from "../moments.js";
import type * as presentations from "../presentations.js";
import type * as research from "../research.js";
import type * as slideAgent from "../slideAgent.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authOtp: typeof authOtp;
  http: typeof http;
  inbox: typeof inbox;
  interventions: typeof interventions;
  jd: typeof jd;
  language: typeof language;
  "lib/emailSecurity": typeof lib_emailSecurity;
  "lib/jd_reactions": typeof lib_jd_reactions;
  limits: typeof limits;
  live: typeof live;
  moments: typeof moments;
  presentations: typeof presentations;
  research: typeof research;
  slideAgent: typeof slideAgent;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  auth: import("@convex-dev/auth/_generated/component.js").ComponentApi<"auth">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
