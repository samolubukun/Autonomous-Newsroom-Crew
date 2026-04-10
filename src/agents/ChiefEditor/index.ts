import { generateObject } from "ai";
import { z } from "zod";
import { getAiModel } from "../../lib/ai";
import { research, type Article } from "../../lib/data/research";
import { addStory, getPublishedStories, type Story } from "../../lib/data/stories";

const BatchFilterSchema = z.object({
	results: z.array(
		z.object({
			index: z.number().describe("The 0-based index of the article from the input list"),
			isRelevant: z.boolean(),
			isDuplicate: z.boolean(),
			confidence: z.number().min(0).max(1),
			reason: z.string(),
			priority: z.number().min(0).max(10).describe("Editorial importance score 0-10. 9-10 = front-page lead, 7-8 = analytical report, below 7 = brief digest. Use 0 for duplicates."),
			cleanSource: z.string().describe("A clean, professional name for the publisher (e.g., 'TechCrunch', 'The Verge', 'AI Secret')"),
		})
	),
});

/**
 * Chief Editor Agent (formerly Filter)
 *
 * ONE AI call that evaluates ALL articles for relevance, duplicate detection,
 * AND assigns priority rankings for the tiered reporting system.
 */
export async function runChiefEditor(options: { articles?: Article[] } = {}) {
	try {
		console.log("Filter: Starting to filter stories");
		let articles = options.articles;
		if (!articles) {
			articles = await research.getToday();
		}

		if (!articles || articles.length === 0) {
			console.log("Filter: No articles to filter");
			return { stories: [] };
		}

		// Deduplicate by link before even calling AI
		const seen = new Set<string>();
		articles = articles.filter((a) => {
			if (seen.has(a.link)) return false;
			seen.add(a.link);
			return true;
		});

		console.log(`Filter: Processing ${articles.length} unique articles (1 AI call)...`);

		const publishedStories = await getPublishedStories();

		// Build context for the single batch call
		const articlesContext = articles
			.map((a, i) => `[${i}] "${a.headline}" (URL: ${a.link}) — Summary: ${a.summary}`)
			.join("\n");

		const publishedContext = publishedStories.length > 0
			? publishedStories
				.slice(0, 20) // cap at 20 to keep prompt short
				.map((s, i) => `[P${i}] "${s.headline}"`)
				.join("\n")
			: "None";

		// ONE call — batch relevance + duplicate check + priority ranking for all articles
		const { object } = await generateObject({
			model: getAiModel(),
			schema: BatchFilterSchema,
			prompt: `You are the Chief Editor of a world-class AI & tech newsroom. Your job is to curate the "Daily Front Page."

RULES:
1. isRelevant=true only if the article is about: LLMs, AI Agents, AI research breakthroughs, significant AI industry news, or AI ethics/policy. Be extremely selective.
2. isDuplicate=true if the article covers the same core story as one of the PUBLISHED articles below.
3. Assign a priority score (1-10) to each relevant article based on its editorial weight:
   - 10: MANDATORY LEAD. Pick exactly ONE story to be today's Investigative Feature. Choose the one with the most global or technical impact.
   - 7-9: CORE REPORTS. These are the supporting analytical pieces. Limit these to the top 2-3 strongest stories.
   - 1-6: BRIEFS. All other relevant news. These will be kept as short summaries.
4. If no story is truly groundbreaking, still pick the best one as priority 9 or 10 to lead the edition.
7.5. For each article, identify the "cleanSource"—a professional name for the publisher (e.g., 'The Verge' instead of 'https://theverge.com/feed').
5. Return one result per article, using its 0-based index.

CANDIDATE ARTICLES:
${articlesContext}

ALREADY PUBLISHED (check for duplicates against these):
${publishedContext}`,
		});

		const filteredStories: Story[] = [];

		// Track if we've already assigned a lead (priority 9-10)
		let leadAssigned = false;

		// Sort by priority descending so we process the highest-impact story first
		const sortedResults = [...object.results].sort((a, b) => b.priority - a.priority);

		for (const result of sortedResults) {
			const article = articles[result.index];
			if (!article) continue;

			if (!result.isRelevant || result.confidence < 0.6) {
				console.log(`Filter: Skipped (not relevant) — "${article.headline}"`);
				continue;
			}
			if (result.isDuplicate) {
				console.log(`Filter: Skipped (duplicate) — "${article.headline}"`);
				continue;
			}

			// Determine tier and enforce only one lead
			let tier: "lead" | "report" | "brief" = "brief";
			let priority = result.priority;

			if (priority >= 9 && !leadAssigned) {
				tier = "lead";
				leadAssigned = true;
			} else if (priority >= 7) {
				tier = "report";
				if (priority >= 9) priority = 8; // cap if lead already taken
			} else {
				tier = "brief";
			}

			// Clean the source
			const cleanArticle = { 
				...(article as any), 
				source: result.cleanSource || article.source, 
				priority, 
				tier 
			};

			await addStory(cleanArticle);
			filteredStories.push(cleanArticle as Story);
			console.log(`Filter: ✅ Kept [${tier.toUpperCase()} P${priority}] — "${article.headline}" (source: ${cleanArticle.source})`);
		}

		console.log(`Filter: Done. ${filteredStories.length} new relevant stories saved.`);
		return { stories: filteredStories };
	} catch (error) {
		console.error("Error in FilterAgent:", error);
		throw error;
	}
}
