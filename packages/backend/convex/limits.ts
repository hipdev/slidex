import { RateLimiter, MINUTE, HOUR } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";
export const limits = new RateLimiter(components.rateLimiter, {
  rooms: {kind:"token bucket",rate:6,period:HOUR,capacity:3},
  contributions: {kind:"token bucket",rate:12,period:MINUTE,capacity:5},
  reactions: {kind:"token bucket",rate:60,period:MINUTE,capacity:12},
  ai: {kind:"token bucket",rate:6,period:MINUTE,capacity:3},
  jdVoice: {kind:"token bucket",rate:30,period:MINUTE,capacity:8},
  jdSpeech: {kind:"token bucket",rate:30,period:MINUTE,capacity:8},
  otpSendGlobal: {kind:"fixed window",rate:100,period:HOUR},
  otpSendEmail: {kind:"fixed window",rate:5,period:HOUR},
  otpCooldown: {kind:"token bucket",rate:1,period:MINUTE,capacity:1},
  otpVerifyGlobal: {kind:"fixed window",rate:1000,period:HOUR},
  otpVerifyEmail: {kind:"fixed window",rate:30,period:HOUR},
});
