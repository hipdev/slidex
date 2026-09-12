import { httpRouter } from "convex/server";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { components, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { auth } from "./auth";
import { Webhook, WebhookVerificationError } from "svix";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/agentmail",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.AGENTMAIL_WEBHOOK_SECRET;
    if (!secret) return new Response("AgentMail webhook secret is not configured", { status: 503 });

    const rawBody = await request.text();
    try {
      new Webhook(secret).verify(rawBody, {
        "svix-id": request.headers.get("svix-id") ?? "",
        "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
        "svix-signature": request.headers.get("svix-signature") ?? "",
      });
    } catch (error) {
      if (error instanceof WebhookVerificationError) return new Response("Invalid AgentMail signature", { status: 400 });
      throw error;
    }

    let body: unknown;
    try { body = JSON.parse(rawBody); } catch { return new Response("Invalid JSON", { status: 400 }); }
    if (!isAgentMailEvent(body)) return new Response("Invalid AgentMail payload", { status: 400 });
    if (body.event_type !== "message.received") return json({ ok: true, ignored: true });

    const routedId = body.message.inbox_id ? await ctx.runQuery(internal.inbox.resolveRoom, { inboxId: body.message.inbox_id }) : null;
    const presentationId = routedId ?? request.headers.get("x-slidex-presentation-id");
    if (!presentationId) return new Response("Missing X-Slidex-Presentation-Id", { status: 400 });

    await ctx.runMutation(internal.presentations.recordInbox, {
      presentationId: presentationId as Id<"presentations">,
      sender: body.message.from ?? body.message.from_?.[0] ?? "Unknown sender",
      subject: body.message.subject ?? "Incoming topic",
      text: body.message.text ?? body.message.preview ?? "AgentMail received an email without an inline text body.",
      agentMailEventId: body.message.inbox_id && body.message.message_id ? `mail:${body.message.inbox_id}:${body.message.message_id}` : body.event_id,
    });
    return json({ ok: true });
  }),
});

type AgentMailEvent = {
  event_type: string;
  event_id: string;
  message: { from?: string; from_?: string[]; inbox_id?: string; message_id?: string; subject?: string; preview?: string; text?: string };
};

function isAgentMailEvent(value: unknown): value is AgentMailEvent {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  if (typeof body.event_type !== "string" || typeof body.event_id !== "string" || !body.message || typeof body.message !== "object") return false;
  const message = body.message as Record<string, unknown>;
  return (typeof message.from === "string" || (Array.isArray(message.from_) && message.from_.every((address) => typeof address === "string")))
    && (message.inbox_id === undefined || typeof message.inbox_id === "string")
    && (message.message_id === undefined || typeof message.message_id === "string")
    && (message.subject === undefined || typeof message.subject === "string")
    && (message.preview === undefined || typeof message.preview === "string")
    && (message.text === undefined || typeof message.text === "string");
}

function json(body: Record<string, boolean>) {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}

registerStaticRoutes(http, components.staticHosting);

export default http;
