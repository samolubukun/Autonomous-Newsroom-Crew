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

const MONTHS: Record<string, number> = {
	jan: 0,
	feb: 1,
	mar: 2,
	apr: 3,
	may: 4,
	jun: 5,
	jul: 6,
	aug: 7,
	sep: 8,
	oct: 9,
	nov: 10,
	dec: 11,
};

function parseDateFromText(text: string): Date | null {
	if (!text) return null;

	const monthDayYear = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2}),\s*(\d{4})\b/i);
	if (monthDayYear) {
		const monthKey = monthDayYear[1].toLowerCase().slice(0, 3);
		const month = MONTHS[monthKey];
		const day = Number(monthDayYear[2]);
		const year = Number(monthDayYear[3]);
		if (month !== undefined) {
			const d = new Date(year, month, day);
			if (!isNaN(d.getTime())) return d;
		}
	}

	const yearMonthDay = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
	if (yearMonthDay) {
		const year = Number(yearMonthDay[1]);
		const month = Number(yearMonthDay[2]) - 1;
		const day = Number(yearMonthDay[3]);
		const d = new Date(year, month, day);
		if (!isNaN(d.getTime())) return d;
	}

	const dayMonthYear = text.match(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(20\d{2})\b/i);
	if (dayMonthYear) {
		const day = Number(dayMonthYear[1]);
		const monthKey = dayMonthYear[2].toLowerCase().slice(0, 3);
		const month = MONTHS[monthKey];
		const year = Number(dayMonthYear[3]);
		if (month !== undefined) {
			const d = new Date(year, month, day);
			if (!isNaN(d.getTime())) return d;
		}
	}

	return null;
}

function toIsoDate(value: Date): string {
	return value.toISOString().slice(0, 10);
}

function isWithinLastDays(date: Date, days: number): boolean {
	const now = new Date();
	const start = new Date(now);
	start.setDate(now.getDate() - days);
	return date >= start && date <= now;
}

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
	const today = new Date();
	const fiveDaysAgo = new Date(today);
	fiveDaysAgo.setDate(today.getDate() - 5);
	const todayStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
	const fiveDaysAgoStr = fiveDaysAgo.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

	let articles: Article[] = [];

	try {
		const { object } = await generateObject({
			model: getAiModel(),
			schema: StoriesSchema,
			prompt: `You are an AI news investigator. Extract all unique news stories about AI, LLMs, AI agents, and AI industry developments from the following content scraped from multiple websites. For each story, include which source it came from. NEVER use emojis (😀, 🚀, 📰, etc.) in any headline or summary. Use plain text only.

IMPORTANT: 
1. Only extract stories that are RECENT - from today (${todayStr}) or the past few days (no earlier than ${fiveDaysAgoStr}). Ignore any story that is older than 5 days. Focus on fresh news only.
2. When extracting, look for the article's publication date in the source content (e.g., "March 12, 2026" or "12/3/2026" or similar). If found, include it in the date_posted field. This helps filter out old stories.\n\n${combinedContent}`,
		});

		articles = (object.stories || []).map((s) => ({
			headline: s.headline,
			summary: s.summary,
			link: s.link.startsWith("http") ? s.link : s.link,
			source: s.source,
			date_posted: s.date_posted,
			date_found: new Date().toISOString(),
		}));

		console.log(`Investigator: Extracted ${articles.length} total stories.`);
	} catch (error) {
		console.error("Investigator: AI extraction failed:", error instanceof Error ? error.message : error);
	}

	if (articles.length > 0) {
		console.log(`Investigator: Enriching ${articles.length} stories with article-page publish dates...`);
		const enriched = await Promise.all(
			articles.map(async (article) => {
				try {
					const detail = await scrapeUrl(article.link, { formats: ["markdown"] });
					const raw = typeof detail.markdown === "string" ? detail.markdown : "";
					const parsed = parseDateFromText(raw.slice(0, 12000));
					if (parsed) {
						return { ...article, date_posted: toIsoDate(parsed) };
					}
				} catch (error) {
					console.log(`Investigator: Date extraction failed for ${article.link}: ${error}`);
				}
				return article;
			})
		);

		const recentOnly = enriched.filter((article) => {
			if (!article.date_posted) return false;
			const parsed = new Date(article.date_posted);
			if (isNaN(parsed.getTime())) return false;
			return isWithinLastDays(parsed, 5);
		});

		console.log(`Investigator: Kept ${recentOnly.length}/${enriched.length} stories from last 5 days with valid publish dates.`);
		articles = recentOnly;

		await research.save(articles, "investigator");
		console.log(`Investigator: Saved ${articles.length} articles to DB.`);
	}

	return { articles, sourcesUsed: sources };
}
