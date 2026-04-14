import { generateObject } from "ai";
import { z } from "zod";
import { research, type Article } from "../../lib/data/research";
import { scrapeUrl } from "../../lib/scraper";
import { getAiModel } from "../../lib/ai";

const DEFAULT_SOURCES = [
	"https://news.ycombinator.com/",
	"https://techcrunch.com/latest/",
	"https://openai.com/news/",
	"https://www.anthropic.com/news",
	"https://aisecret.us/",
	"https://www.theneurondaily.com/",
];

const StoriesSchema = z.object({
	stories: z.array(
		z.object({
			headline: z.string(),
			summary: z.string(),
			link: z.string(),
			source: z.string().describe("The source website URL this story came from"),
			date_posted: z.string().optional(),
		})
	),
});

/**
 * Investigator Agent
 *
 * Optimization: scrape ALL sources concurrently, combine their markdown,
 * then make a SINGLE AI call to extract all stories at once.
 */
export async function runInvestigator(options: { dynamicSources?: string[] } = {}) {
	console.log("Investigator: Starting discovery...");
	const sources = [...DEFAULT_SOURCES, ...(options.dynamicSources ?? [])];

	// Return cached research if already done today
	if (!options.dynamicSources?.length) {
		const todaysResearch = await research.getToday();
		if (todaysResearch && todaysResearch.length > 0) {
			console.log(`Investigator: Using ${todaysResearch.length} cached articles for today.`);
			return { articles: todaysResearch };
		}
	}

	// 1. Scrape ALL sources concurrently (no AI calls yet)
	console.log(`Investigator: Scraping ${sources.length} sources in parallel...`);
	const scrapeResults = await Promise.allSettled(
		sources.map(async (source) => {
			const result = await scrapeUrl(source, { formats: ["markdown"] });
			return { source, result };
		})
	);

	console.log("Investigator: Scrape Results Recap:", scrapeResults.map(r => {
		if (r.status === "rejected") return "REJECTED";
		return `${r.value.source}: ${r.value.result.success ? "SUCCESS" : "FAILED"} (chars: ${String(r.value.result.markdown || "").length})`;
	}));

	// 2. Combine all markdown into one prompt, truncated per source
	const combinedContent = scrapeResults
		.map((r) => {
			if (r.status !== "fulfilled") {
				console.error("Investigator: Scrape Promise rejected:", r.reason);
				return null;
			}
			if (!r.value.result.success) {
				console.error(`Investigator: Scrape failed for ${r.value.source}:`, r.value.result.error || "Unknown error");
				return null;
			}
			const { source, result } = r.value;
			let rawMarkdown = typeof result.markdown === "string" ? result.markdown : (result.data?.markdown || "");
			if (typeof rawMarkdown !== "string") {
			    rawMarkdown = String(rawMarkdown);
			}
			const markdown = rawMarkdown.slice(0, 8000); // 8k chars per source
			if (!markdown || markdown === "[object Object]") return null;
			return `=== SOURCE: ${source} ===\n${markdown}`;
		})
		.filter(Boolean)
		.join("\n\n");

	if (!combinedContent) {
		console.log("Investigator: No content scraped from any source.");
		return { articles: [] };
	}

	// 3. ONE AI call to extract all stories from all sources
	console.log("Investigator: Extracting stories from all sources (1 AI call)...");
	let articles: Article[] = [];

	try {
		const { object } = await generateObject({
			model: getAiModel(),
			schema: StoriesSchema,
			prompt: `You are an AI news investigator. Extract all unique news stories about AI, LLMs, AI agents, and AI industry developments from the following content scraped from multiple websites. For each story, include which source it came from. NEVER use emojis (😀, 🚀, 📰, etc.) in any headline or summary. Use plain text only.

IMPORTANT: Only extract stories that are RECENT - from today (April 14, 2026) or the past few days (no earlier than April 10, 2026). Ignore any story that is older than 5 days. Focus on fresh news only.\n\n${combinedContent}`,
		});

		articles = (object.stories || []).map((s) => ({
			headline: s.headline,
			summary: s.summary,
			link: s.link.startsWith("http") ? s.link : s.link,
			source: s.source,
			date_found: new Date().toISOString(),
		}));

		console.log(`Investigator: Extracted ${articles.length} total stories.`);
	} catch (error) {
		console.error("Investigator: AI extraction failed:", error instanceof Error ? error.message : error);
	}

	if (articles.length > 0) {
		await research.save(articles, "investigator");
		console.log(`Investigator: Saved ${articles.length} articles to DB.`);
	}

	return { articles, sourcesUsed: sources };
}
