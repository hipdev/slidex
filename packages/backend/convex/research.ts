import { generateText } from "ai";
import { convexGateway } from "@convex-dev/ai-sdk-provider";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const request = mutation({
  args: { presentationId: v.id("presentations"), prompt: v.string(), url: v.optional(v.string()) },
  returns: v.id("operations"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const presentation = await ctx.db.get(args.presentationId);
    if (!userId || !presentation?.ownerId || presentation.ownerId !== userId) throw new Error("Only the presentation host can ask the Slide Agent");
    const operationId = await ctx.db.insert("operations", { presentationId: args.presentationId, kind: "research", status: "queued", input: args.prompt, createdAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.research.run, { operationId, presentationId: args.presentationId, prompt: args.prompt, url: args.url });
    return operationId;
  },
});

export const run = internalAction({
  args: { operationId: v.id("operations"), presentationId: v.id("presentations"), prompt: v.string(), url: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.presentations.updateOperation, { operationId: args.operationId, status: "running" });
    try {
      const source = await scrape(args.url, args.prompt);
      const result = await generateText({
        model: convexGateway("openai/gpt-4o-mini"),
        prompt: `Create a single concise presentation slide. Topic: ${args.prompt}. Research: ${source.markdown.slice(0, 12000)}. Return exactly: first line title (max 60 chars), then a blank line, then body (max 420 chars). Do not use markdown headings.`,
      });
      const [rawTitle = args.prompt, ...rest] = result.text.trim().split(/\n+/);
      const title = rawTitle.replace(/^#*\s*/, "").slice(0, 80);
      const body = rest.join(" ").trim().slice(0, 600) || "Research is ready for the room.";
      await ctx.runMutation(internal.presentations.addSlide, { presentationId: args.presentationId, kind: "research", title, body, sourceUrls: source.urls });
      await ctx.runMutation(internal.presentations.updateOperation, { operationId: args.operationId, status: "complete", output: title });
    } catch (error) {
      await ctx.runMutation(internal.presentations.updateOperation, { operationId: args.operationId, status: "failed", error: error instanceof Error ? error.message : "Research failed" });
    }
    return null;
  },
});

async function scrape(url: string | undefined, prompt: string) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return { markdown: `No Firecrawl key is configured yet. Create a compelling live slide about ${prompt} using the presenter's request as the source.`, urls: url ? [url] : [] };
  const endpoint = url ? "https://api.firecrawl.dev/v2/scrape" : "https://api.firecrawl.dev/v2/search";
  const body = url ? { url, formats: ["markdown"] } : { query: prompt, limit: 3, scrapeOptions: { formats: ["markdown"] } };
  const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Firecrawl returned ${response.status}`);
  const payload = await response.json() as FirecrawlScrapePayload | FirecrawlSearchPayload;
  const scrapedPage = (payload as FirecrawlScrapePayload).data;
  const pages: FirecrawlPage[] = url
    ? (scrapedPage ? [scrapedPage] : [])
    : (payload as FirecrawlSearchPayload).data?.web ?? [];
  return { markdown: pages.map((page) => page.markdown ?? "").join("\n\n"), urls: pages.flatMap((page) => page.url ? [page.url] : url ? [url] : []) };
}

type FirecrawlPage = { markdown?: string; url?: string };
type FirecrawlScrapePayload = { data?: FirecrawlPage };
type FirecrawlSearchPayload = { data?: { web?: FirecrawlPage[] } };
