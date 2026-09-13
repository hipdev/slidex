import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const slideKind = v.union(
  v.literal("title"),
  v.literal("content"),
  v.literal("poll"),
  v.literal("research"),
  v.literal("visual"),
);

export default defineSchema({
  ...authTables,
  presentations: defineTable({
    title: v.string(),
    slug: v.string(),
    ownerName: v.string(),
    ownerId: v.optional(v.id("users")),
    status: v.union(v.literal("draft"), v.literal("live"), v.literal("ended")),
    currentSlideId: v.optional(v.id("slides")),
    agentInboxAddress: v.optional(v.string()),
    createdAt: v.number(),
    showConclusions: v.optional(v.boolean()),
    voiceEnabled: v.optional(v.boolean()),
    agentInboxId: v.optional(v.string()),
    moment: v.optional(v.object({ caption: v.string(), imageUrl: v.optional(v.string()), sourceUrl: v.optional(v.string()), createdAt: v.number() })),
  }).index("by_slug", ["slug"]).index("by_agentInboxId", ["agentInboxId"]),
  slides: defineTable({
    presentationId: v.id("presentations"),
    order: v.number(),
    kind: slideKind,
    title: v.string(),
    body: v.string(),
    choices: v.optional(v.array(v.object({ id: v.string(), label: v.string() }))),
    sourceUrls: v.optional(v.array(v.string())),
    generatedAt: v.optional(v.number()),
    visual: v.optional(v.union(v.literal("constellation"), v.literal("pulse"))),
  }).index("by_presentation_and_order", ["presentationId", "order"]),
  contributions: defineTable({
    presentationId: v.id("presentations"),
    slideId: v.id("slides"),
    authorId: v.id("users"),
    authorName: v.string(),
    kind: v.union(v.literal("suggestion"), v.literal("conclusion"), v.literal("question"), v.literal("fact")),
    text: v.string(),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("dismissed")),
    votes: v.number(),
  }).index("by_presentationId", ["presentationId"]),
  interventions: defineTable({
    presentationId: v.id("presentations"), slideId: v.id("slides"),
    kind: v.union(v.literal("lost"), v.literal("twist")),
    text: v.string(), votes: v.number(),
    status: v.union(v.literal("pending"), v.literal("running"), v.literal("ready"), v.literal("published"), v.literal("dismissed"), v.literal("failed")),
    title: v.optional(v.string()), body: v.optional(v.string()),
    sourceUrls: v.optional(v.array(v.string())), error: v.optional(v.string()),
    publishedSlideId: v.optional(v.id("slides")),
  }).index("by_slideId", ["slideId"]),
  interventionVotes: defineTable({
    interventionId: v.id("interventions"), userId: v.id("users"),
  }).index("by_interventionId_and_userId", ["interventionId", "userId"]),
  endorsements: defineTable({
    contributionId: v.id("contributions"),
    userId: v.id("users"),
  }).index("by_contributionId_and_userId", ["contributionId", "userId"]),
  audience: defineTable({
    presentationId: v.id("presentations"),
    attendeeId: v.string(),
    name: v.optional(v.string()),
    lastSeenAt: v.number(),
  }).index("by_presentation_and_attendee", ["presentationId", "attendeeId"]),
  reactions: defineTable({
    presentationId: v.id("presentations"),
    slideId: v.id("slides"),
    attendeeId: v.string(),
    emoji: v.union(v.literal("fire"), v.literal("mind"), v.literal("heart"), v.literal("question")),
    createdAt: v.number(),
  }).index("by_presentation_and_slide", ["presentationId", "slideId"]),
  votes: defineTable({
    presentationId: v.id("presentations"),
    slideId: v.id("slides"),
    attendeeId: v.string(),
    choiceId: v.string(),
    createdAt: v.number(),
  })
    .index("by_presentation_and_slide", ["presentationId", "slideId"])
    .index("by_presentation_slide_and_attendee", ["presentationId", "slideId", "attendeeId"]),
  operations: defineTable({
    presentationId: v.id("presentations"),
    kind: v.union(v.literal("research"),
  v.literal("visual"), v.literal("inbox"), v.literal("slide-agent")),
    status: v.union(v.literal("queued"), v.literal("running"), v.literal("complete"), v.literal("failed")),
    input: v.string(),
    output: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_presentation_and_creation", ["presentationId"]),
  inboxItems: defineTable({
    presentationId: v.id("presentations"),
    sender: v.string(),
    subject: v.string(),
    text: v.string(),
    agentMailEventId: v.optional(v.string()),
    receivedAt: v.number(),
    status: v.union(v.literal("received"), v.literal("processed")),
  })
    .index("by_presentation_and_received", ["presentationId"])
    .index("by_agent_mail_event_id", ["agentMailEventId"]),
});
