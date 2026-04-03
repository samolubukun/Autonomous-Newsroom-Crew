import { z } from "zod";
import { generateObject } from "ai";
import { getAiModel } from "../../lib/ai";
import { getUnpublishedStories, addStory, type Story } from "../../lib/data/stories";

const BatchEnhancedSchema = z.object({
	stories: z.array(
		z.object({
			index: z.number().describe("The 0-based index of the original story"),
			headline: z.string().describe("A catchy, journalistic headline"),
			summary: z.string().describe("A concise 2-3 sentence summary"),
			body: z.string().describe("Full article in clean Markdown (3-5 paragraphs)"),
			tags: z.array(z.string()).describe("3-5 relevant topic tags"),
			category: z.string().describe("One of: AI Research, Industry News, LLMs, AI Agents, AI Ethics"),
		})
	),
});

/**
 * Editor Agent
 *
 * Optimization: ONE AI call to batch-enhance all stories at once
 * instead of one call per story. Scraping is skipped to save time —
 * the summary from investigation is enough for the editor to work with.
 */
export async function runEditor(options: { stories?: Story[] } = {}) {
	console.log("Editor: Starting enhancement phase...");

	let storiesToProcess = options.stories;
	if (!storiesToProcess) {
		storiesToProcess = await getUnpublishedStories();
	}

	if (!storiesToProcess || storiesToProcess.length === 0) {
		console.log("Editor: No new stories to enhance.");
		return { links: [] };
	}

	// Cap at 10 stories to keep prompt manageable
	const stories = storiesToProcess.slice(0, 10);
	console.log(`Editor: Batch-enhancing ${stories.length} stories (1 AI call)...`);

	const storiesContext = stories
		.map((s, i) => `[${i}] Headline: ${s.headline}\nSummary: ${s.summary}\nSource: ${s.source}`)
		.join("\n\n");

	try {
		const { object } = await generateObject({
			model: getAiModel(),
			schema: BatchEnhancedSchema,
			prompt: `You are a senior AI news editor. Rewrite and enhance each of the following stories to be professional, engaging, and well-structured. 

			For each story:
			1. Write a catchy headline.
			2. Write a concise 2-3 sentence summary.
			3. ONLY if the story is a "brief" (standard news), write a 3-5 paragraph Markdown body. If the story is marked as a "lead" or "report", leave the body field as an empty string ("") as it will be handled by our investigative team.
			
			Return one result per story using its 0-based index.\n\n${storiesContext}`,
		});

		const editedLinks: string[] = [];

		for (const enhanced of object.stories) {
			const original = stories[enhanced.index];
			if (!original) continue;

			const isHighFidelity = original.tier === "lead" || original.tier === "report";

			await addStory({
				headline: enhanced.headline,
				summary: enhanced.summary,
				body: isHighFidelity ? undefined : enhanced.body,
				tags: enhanced.tags,
				category: enhanced.category,
				link: original.link,
				source: original.source,
				original_headline: original.headline,
				priority: original.priority,
				tier: original.tier,
			});

			editedLinks.push(original.link);
			console.log(`Editor: ✅ Enhanced — "${enhanced.headline}"`);
		}

		return { links: editedLinks };
	} catch (error) {
		console.error("Editor: Batch enhancement failed:", error instanceof Error ? error.message : error);
		// Fallback: return original story links so the pipeline can continue
		const fallbackLinks = stories.map((s) => s.link);
		return { links: fallbackLinks };
	}
}
