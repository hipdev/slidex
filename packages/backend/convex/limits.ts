import { RateLimiter, MINUTE, HOUR } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";
export const limits = new RateLimiter(components.rateLimiter, {
  rooms: {kind:"token bucket",rate:6,period:HOUR,capacity:3},
  contributions: {kind:"token bucket",rate:12,period:MINUTE,capacity:5},
  reactions: {kind:"token bucket",rate:60,period:MINUTE,capacity:12},
  ai: {kind:"token bucket",rate:6,period:MINUTE,capacity:3},
  jdVoice: {kind:"token bucket",rate:30,period:MINUTE,capacity:8},
});
