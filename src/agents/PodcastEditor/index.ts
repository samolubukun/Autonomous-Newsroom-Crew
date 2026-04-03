import { z } from "zod";
import { generateObject } from "ai";
import { getAiModel } from "../../lib/ai";
import { getPublishedStories } from "../../lib/data/stories";
import { podcast } from "../../lib/data/podcast";

/**
 * Creates a podcast transcript from stories
 */
async function createPodcastTranscript(storiesToProcess: any[]) {
	console.log("PodcastEditor: Creating script using Gemini...");

	// We use Gemini (power: true) for scriptwriting as it requires high reasoning and a larger context.
	const { object } = await generateObject({
		model: getAiModel({ power: true }),
		schema: z.object({
			intro: z.string(),
			segments: z.array(
				z.object({
					headline: z.string(),
					content: z.string(),
					transition: z.string().optional(),
				}),
			),
			outro: z.string(),
		}),
		prompt: `
You are an engaging AI podcast host for the "AI Newsroom Daily Deep Dive". 
Your goal is to create a thorough, engaging 5 to 8-minute comprehensive podcast script covering today's top stories.

Do not just read the summaries. Instead:
1. Provide deep analysis and insightful commentary on why these stories matter.
2. Weave the stories together with natural, thoughtful transitions.
3. Be energetic, informative, and professional. 
4. Spend a good amount of time unpacking the implications of each story.
5. Avoid overly hyped words like "revolutionize" or "game-changer". Keep it grounded but fascinating.

For each segment, write a long-form conversational script (at least 200-300 words per segment) that sounds natural when spoken aloud.

Here are today's stories to unpack:
${storiesToProcess.map(s => `- ${s.headline}: ${s.summary}`).join("\n")}
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

	// Generate and save
	const transcript = await createPodcastTranscript(publishedStories);
	const savedTranscript = await podcast.save(transcript as any, publishedStories);

	return {
		transcript: savedTranscript,
	};
}

