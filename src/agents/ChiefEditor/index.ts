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
			.map((a, i) => {
				const dateInfo = (a as any).date_posted ? ` (Posted: ${(a as any).date_posted})` : '';
				return `[${i}] "${a.headline}" (URL: ${a.link}) — Summary: ${a.summary}${dateInfo}`;
			})
			.join("\n");

		const publishedContext = publishedStories.length > 0
			? publishedStories
				.slice(0, 20) // cap at 20 to keep prompt short
				.map((s, i) => `[P${i}] "${s.headline}"`)
				.join("\n")
			: "None";

		// ONE call — batch relevance + duplicate check + priority ranking for all articles
		const today = new Date();
		const fiveDaysAgo = new Date(today);
		fiveDaysAgo.setDate(today.getDate() - 5);
		const todayStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
		const fiveDaysAgoStr = fiveDaysAgo.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

		const { object } = await generateObject({
			model: getAiModel(),
			schema: BatchFilterSchema,
			prompt: `You are the Chief Editor of a world-class AI & tech newsroom. Your job is to curate the "Daily Front Page."

RULES:
1. isRelevant=true only if the article is about: LLMs, AI Agents, AI research breakthroughs, significant AI industry news, or AI ethics/policy. Be extremely selective.
2. ONLY include stories from TODAY (${todayStr}) or the past few days (no earlier than ${fiveDaysAgoStr}). Reject any story older than 5 days. Focus on fresh news only.
3. Freshness priority is strict: stories from today rank highest, then yesterday, then older (within 5 days). When choosing lead/report/brief, prioritize recency first and editorial weight second.
4. isDuplicate=true if the article covers the same core story as one of the PUBLISHED articles below.
5. Assign a priority score (1-10) to each relevant article based on its editorial weight:
   - 10: MANDATORY LEAD. Pick exactly ONE story to be today's Investigative Feature. Choose the one with the most global or technical impact.
   - 7-9: CORE REPORTS. These are the supporting analytical pieces. Limit these to the top 2-3 strongest stories.
   - 1-6: BRIEFS. All other relevant news. These will be kept as short summaries.
6. If no story is truly groundbreaking, still pick the best one as priority 9 or 10 to lead the edition.
7. For each article, identify the "cleanSource"—a professional name for the publisher (e.g., 'The Verge' instead of 'https://theverge.com/feed').
8. NEVER use emojis (😀, 🚀, 📰, etc.) in any headline or text. Use plain text only.
9. Return one result per article, using its 0-based index.

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

		const parseDateFromLink = (link: string): Date | null => {
			const match = link.match(/\/(20\d{2})\/(\d{1,2})\/(\d{1,2})\//);
			if (!match) return null;
			const year = Number(match[1]);
			const month = Number(match[2]);
			const day = Number(match[3]);
			if (!year || !month || !day) return null;
			const parsed = new Date(year, month - 1, day);
			return isNaN(parsed.getTime()) ? null : parsed;
		};

		const getArticleDate = (article: Article): Date | null => {
			const posted = (article as any).date_posted as string | undefined;
			if (posted) {
				const parsed = new Date(posted);
				if (!isNaN(parsed.getTime())) return parsed;
			}
			return parseDateFromLink(article.link);
		};

		const isStoryOld = (article: Article): boolean => {
			const parsed = getArticleDate(article);
			if (!parsed) return false;
			const diffDays = Math.floor((today.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24));
			return diffDays > 5;
		};

		const freshnessRank = (article: Article): number => {
			const parsed = getArticleDate(article);
			if (!parsed) return 0;
			const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
			const storyStart = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
			const diffDays = Math.floor((todayStart.getTime() - storyStart.getTime()) / (1000 * 60 * 60 * 24));
			if (diffDays <= 0) return 3; // today
			if (diffDays === 1) return 2; // yesterday
			if (diffDays <= 5) return 1; // recent but older
			return 0;
		};

		const freshnessSorted = [...sortedResults].sort((a, b) => {
			const articleA = articles[a.index];
			const articleB = articles[b.index];
			if (!articleA || !articleB) return 0;

			const rankA = freshnessRank(articleA);
			const rankB = freshnessRank(articleB);
			if (rankA !== rankB) return rankB - rankA;
			return b.priority - a.priority;
		});

		for (const result of freshnessSorted) {
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
			if (isStoryOld(article)) {
				const articleDate = getArticleDate(article);
				console.log(`Filter: Skipped (too old) — "${article.headline}" (date: ${articleDate ? articleDate.toISOString().slice(0, 10) : "unknown"})`);
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
