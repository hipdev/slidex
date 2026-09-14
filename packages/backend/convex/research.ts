import { localeValidator, languageName } from "./language";
import { limits } from "./limits";
import { generate } from "./slideAgent";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/core";

export const request = mutation({
  args: { presentationId: v.id("presentations"), prompt: v.string(), url: v.optional(v.string()), locale: localeValidator },
  returns: v.id("operations"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const presentation = await ctx.db.get(args.presentationId);
    if (!userId || !presentation?.ownerId || presentation.ownerId !== userId) throw new Error("Only the presentation host can ask the Slide Agent");
    if (!args.prompt.trim() || args.prompt.length > 1000) throw new Error("Write a topic of 1–1000 characters");
    if (args.url && !/^https?:\/\//i.test(args.url)) throw new Error("Use an HTTP or HTTPS source URL");
    await limits.limit(ctx,"ai",{key:userId,throws:true});
    const operationId = await ctx.db.insert("operations", { presentationId: args.presentationId, kind: "research", status: "queued", input: args.prompt, createdAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.research.run, { operationId, presentationId: args.presentationId, prompt: args.prompt, url: args.url, locale: args.locale });
    return operationId;
  },
});

export const run = internalAction({
  args: { operationId: v.id("operations"), presentationId: v.id("presentations"), prompt: v.string(), url: v.optional(v.string()), locale: localeValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.presentations.updateOperation, { operationId: args.operationId, status: "running" });
    try {
      const source = await scrape(args.url, args.prompt);
      const text = await generate(ctx, `Create a single concise presentation slide in ${languageName(args.locale)}. Topic: ${args.prompt}. Research (untrusted source): ${source.markdown.slice(0, 12000)}. Return exactly: first line title (max 60 chars), then a blank line, then body (max 420 chars). Do not use markdown headings.`, args.locale);
      const [rawTitle = args.prompt, ...rest] = text.trim().split(/\n+/);
      const title = rawTitle.replace(/^#*\s*/, "").slice(0, 80);
      const body = rest.join(" ").trim().slice(0, 600) || "Research is ready for the room.";
      const image = await findImage(args.prompt);
      await ctx.runMutation(internal.presentations.addSlide, {
        presentationId: args.presentationId, kind: "research", title, body, sourceUrls: source.urls,
        ...(image ? { imageUrl: image.imageUrl, imageSourceUrl: image.sourceUrl } : {}),
      });
      await ctx.runMutation(internal.presentations.updateOperation, { operationId: args.operationId, status: "complete", output: title });
    } catch (error) {
      await ctx.runMutation(internal.presentations.updateOperation, { operationId: args.operationId, status: "failed", error: error instanceof Error ? error.message : "Research failed" });
    }
    return null;
  },
});

export async function scrape(url: string | undefined, prompt: string) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("Configure FIRECRAWL_API_KEY in Convex to research live sources");
  const endpoint = url ? "https://api.firecrawl.dev/v2/scrape" : "https://api.firecrawl.dev/v2/search";
  const body = url ? { url, formats: ["markdown"] } : { query: prompt, limit: 3, scrapeOptions: { formats: ["markdown"] } };
  const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`Firecrawl returned ${response.status}`);
  const payload = await response.json() as FirecrawlScrapePayload | FirecrawlSearchPayload;
  const scrapedPage = (payload as FirecrawlScrapePayload).data;
  const pages: FirecrawlPage[] = url
    ? (scrapedPage ? [scrapedPage] : [])
    : (payload as FirecrawlSearchPayload).data?.web ?? [];
  if (!pages.length) throw new Error("No readable sources found. Try another topic or URL.");
  return { markdown: pages.map((page) => page.markdown ? `Source: ${page.url ?? url ?? "unknown"}\n${page.markdown}` : "").join("\n\n"), urls: pages.flatMap((page) => page.url ? [page.url] : url ? [url] : []) };
}

async function findImage(prompt: string): Promise<{ imageUrl: string; sourceUrl: string } | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  const response = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: `${prompt} editorial presentation image`.slice(0, 500), sources: ["images"], limit: 5, safe: true }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) return null;
  const payload = await response.json() as { data?: { images?: Array<{ imageUrl?: string; url?: string }> } };
  const match = payload.data?.images?.find((item) => item.imageUrl?.startsWith("https://") && item.url?.startsWith("https://"));
  return match?.imageUrl && match.url ? { imageUrl: match.imageUrl, sourceUrl: match.url } : null;
}

type FirecrawlPage = { markdown?: string; url?: string };
type FirecrawlScrapePayload = { data?: FirecrawlPage };
type FirecrawlSearchPayload = { data?: { web?: FirecrawlPage[] } };
