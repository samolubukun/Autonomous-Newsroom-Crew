import { z } from "zod";
import { generateObject } from "ai";
import { getAiModel } from "../../lib/ai";
import { getPublishedStories } from "../../lib/data/stories";
import { podcast } from "../../lib/data/podcast";

const tierRank: Record<string, number> = {
	lead: 0,
	report: 1,
	brief: 2,
};

function sortStoriesForPodcast(stories: any[]) {
	return [...stories].sort((a, b) => {
		const aRank = tierRank[a?.tier ?? "brief"] ?? 2;
		const bRank = tierRank[b?.tier ?? "brief"] ?? 2;

		if (aRank !== bRank) {
			return aRank - bRank;
		}

		const aPriority = typeof a?.priority === "number" ? a.priority : 0;
		const bPriority = typeof b?.priority === "number" ? b.priority : 0;
		if (aPriority !== bPriority) {
			return bPriority - aPriority;
		}

		return 0;
	});
}

/**
 * Creates a podcast transcript from stories
 */
async function createPodcastTranscript(storiesToProcess: any[]) {
	console.log("PodcastEditor: Creating script using Gemini...");

	// We use Gemini (power: true) for scriptwriting as it requires high reasoning and a larger context.
	const { object } = await generateObject({
		model: getAiModel({ power: true }),
		schema: z.object({
			dialogue: z.array(
				z.object({
					speaker: z.enum(["Host", "Expert"]),
					text: z.string(),
				})
			),
		}),
		prompt: `
You are the lead writers and voice actors for the "Daily Edition" podcast.
Your goal is to create a high-end, conversational audio script covering today's top stories.

The two speakers are:
1. "Host" - Professional, drives the flow, keeps the energy high.
2. "Expert" - Analytical, provides deep context, stays grounded.

IMPORTANT RULES FOR SCRIPTING:
- NEVER mention the words "Host", "Expert", "analyst", or their roles in the dialogue. 
- Do not say "Welcome back to the show" or "Thanks for having me" in every segment. 
- Speak like two friends or colleagues who are experts in the field. 
- Ensure a steady, natural, and efficient pace. Avoid long-winded monologues. 
- DO NOT USE ELLIPSES (...): Avoid any hesitation marks. Keep the sentences clean and flowing directly into each other.
- The dialogue should be punchy and informative. One person explains a fact, the other provides a "wow" point or a "so what" implication.
- Do not use overly formal transitions like "Now moving on to our next story". Instead, use natural topical pivots.
- Cover stories in this exact sequence: LEAD feature first, then ANALYTICAL reports, then BRIEFS.
- Keep transitions clear so listeners can follow the editorial priority order.

For each story, spend a robust amount of time (200-300 words combined) discussing it naturally.
End the podcast with a crisp, efficient sign-off.

Here are today's stories to unpack:
${storiesToProcess.map(s => `- [${(s.tier || "brief").toUpperCase()}] ${s.headline}: ${s.summary}`).join("\n")}
`,
	});

	return object;
}

/**
 * PodcastEditor Agent - Creates podcast transcripts from stories.
 */
export async function runPodcastEditor() {
	console.log("PodcastEditor: Starting...");

	const publishedStories = await getPublishedStories();
	if (publishedStories.length === 0) {
		console.log("PodcastEditor: No stories to process.");
		return { transcript: null };
	}

	const orderedStories = sortStoriesForPodcast(publishedStories);

	// Generate and save
	const transcript = await createPodcastTranscript(orderedStories);
	const savedTranscript = await podcast.save(transcript as any, orderedStories);

	return {
		transcript: savedTranscript,
	};
}
