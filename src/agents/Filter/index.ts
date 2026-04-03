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
		})
	),
});

/**
 * Filter Agent
 *
 * Optimization: ONE AI call that evaluates ALL articles for relevance
 * AND duplicate detection simultaneously, instead of 2 calls per article.
 */
export async function runFilter(options: { articles?: Article[] } = {}) {
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
			.map((a, i) => `[${i}] "${a.headline}" — ${a.summary}`)
			.join("\n");

		const publishedContext = publishedStories.length > 0
			? publishedStories
				.slice(0, 20) // cap at 20 to keep prompt short
				.map((s, i) => `[P${i}] "${s.headline}"`)
				.join("\n")
			: "None";

		// ONE call — batch relevance + duplicate check for all articles
		const { object } = await generateObject({
			model: getAiModel(),
			schema: BatchFilterSchema,
			prompt: `You are an AI news curator. Evaluate each of the following candidate articles.

RULES:
1. isRelevant=true only if the article is about: LLMs, AI Agents, AI research breakthroughs, significant AI industry news, or AI ethics/policy.
2. isDuplicate=true if the article covers the same core story as one of the PUBLISHED articles below.
3. Return one result per article, using its 0-based index.

CANDIDATE ARTICLES:
${articlesContext}

ALREADY PUBLISHED (check for duplicates against these):
${publishedContext}`,
		});

		const filteredStories: Story[] = [];

		for (const result of object.results) {
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

			await addStory(article as any);
			filteredStories.push(article as Story);
			console.log(`Filter: ✅ Kept — "${article.headline}" (confidence: ${result.confidence})`);
		}

		console.log(`Filter: Done. ${filteredStories.length} new relevant stories saved.`);
		return { stories: filteredStories };
	} catch (error) {
		console.error("Error in FilterAgent:", error);
		throw error;
	}
}
