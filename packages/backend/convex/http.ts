import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/agentmail",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.AGENTMAIL_WEBHOOK_SECRET;
    if (!secret || request.headers.get("x-slidex-webhook-secret") !== secret) return new Response("Unauthorized", { status: 401 });
    const body: unknown = await request.json();
    if (!isInboundEmail(body)) return new Response("presentationId and text are required", { status: 400 });
    await ctx.runMutation(internal.presentations.recordInbox, { presentationId: body.presentationId as Id<"presentations">, sender: body.from ?? "Unknown sender", subject: body.subject ?? "Incoming topic", text: body.text });
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  }),
});

function isInboundEmail(value: unknown): value is { presentationId: string; text: string; from?: string; subject?: string } {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return typeof body.presentationId === "string" && typeof body.text === "string" && (body.from === undefined || typeof body.from === "string") && (body.subject === undefined || typeof body.subject === "string");
}

export default http;
