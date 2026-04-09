import { generateObject, generateText } from "ai";
import { z } from "zod";
import { getAiModel } from "../../lib/ai";
import { getPublishedStories, type Story } from "../../lib/data/stories";
import { sql } from "../../lib/db";
import { scrapeUrl } from "../../lib/scraper";

/**
 * Investigative Reporter Agent
 *
 * Takes curated stories and writes tiered long-form articles:
 * - LEAD (tier=lead, priority 9-10): 1,500+ word investigative feature
 * - REPORT (tier=report, priority 7-8): ~500 word analytical piece
 * - BRIEF (tier=brief, priority <7): already has a crisp summary; skip
 */
export async function runReporter() {
	console.log("Reporter: Starting investigative reporting phase...");

	try {
		// Get today's stories that need deep reporting
		const stories = await getPublishedStories();

		if (!stories || stories.length === 0) {
			console.log("Reporter: No stories to report on.");
			return { success: true };
		}

		const leadStories = stories.filter((s) => s.tier === "lead");
		const reportStories = stories.filter((s) => s.tier === "report");

		console.log(`Reporter: Found ${leadStories.length} lead(s), ${reportStories.length} report(s) to write.`);

		// Write Lead Features (1500+ words)
		for (const story of leadStories) {
			if (story.body && story.body.length > 500) {
				console.log(`Reporter: Lead already has body, skipping — "${story.headline}"`);
				continue;
			}
			await writeLeadFeature(story);
		}

		// Write Analytical Reports (~500 words)
		const reportsToWrite = reportStories.filter((story) => {
			if (story.body && story.body.length > 200) {
				console.log(`Reporter: Report already has body, skipping — "${story.headline}"`);
				return false;
			}
			return true;
		});

		if (reportsToWrite.length > 0) {
			await writeAnalyticalReportsBatched(reportsToWrite);
		}

		console.log("Reporter: All reporting complete.");
		return { success: true };
	} catch (error) {
		console.error("Reporter: Error during reporting phase:", error);
		throw error;
	}
}

async function writeLeadFeature(story: Story) {
	console.log(`Reporter: ✍️  Writing LEAD FEATURE — "${story.headline}"`);

	// Fetch full content for high-fidelity reporting
	let rawContent = "No full content available.";
	try {
		const scrapeResult = await scrapeUrl(story.link);
		if (scrapeResult.success && scrapeResult.markdown) {
			rawContent = scrapeResult.markdown;
			console.log(`Reporter: Scraped ${rawContent.length} chars of raw content.`);
		}
	} catch (error) {
		console.log(`Reporter: Scraping failed, falling back to summary. Error: ${error}`);
	}

	const { text } = await generateText({
		model: getAiModel(),
		prompt: `You are a senior investigative journalist at a world-class technology newsroom.
Your task is to write a deep-dive, high-fidelity feature article based on the raw source material provided.

STORY HEADLINE: ${story.headline}
STORY SUMMARY: ${story.summary}
SOURCE: ${story.source}

RAW SOURCE MATERIAL (Scraped Content):
---
${rawContent}
---

GUIDELINES:
- Write a compelling, authoritative lead feature article (1,200–2,000 words).
- Use the RAW SOURCE MATERIAL for specific facts, technical details, and quotes. Do NOT hallucinate or use generic filler.
- Tone: Sophisticated, authoritative broadsheet tone (The Atlantic, MIT Tech Review, Wired).
- Structure: Opening hook → Background context → Core analysis → Technical depth → Broader implications → Future outlook.
- DO NOT use marketing language. Be factually grounded and intellectually rigorous.
- Provide meaningful historical context: Why does this represent a shift?
- Analyze second-order effects: Who benefits? Who is disrupted? 
- Use markdown: ## for section headers, **bold** for key terms, > for quotes.
- Do NOT include a byline. Write only the body of the article.

Write the full investigation now:`,
	});

	await updateStoryBody(story.link, text);
	console.log(`Reporter: ✅ Lead Feature written (${text.length} chars) — "${story.headline}"`);
}

async function writeAnalyticalReport(story: Story) {
	console.log(`Reporter: ✍️  Writing ANALYTICAL REPORT — "${story.headline}"`);

	// Fetch full content
	let rawContent = "No full content available.";
	try {
		const scrapeResult = await scrapeUrl(story.link);
		if (scrapeResult.success && scrapeResult.markdown) {
			rawContent = scrapeResult.markdown;
		}
	} catch (error) {
		console.log(`Reporter: Scraping failed for report. Error: ${error}`);
	}

	const { text } = await generateText({
		model: getAiModel(),
		prompt: `You are a technology analyst and journalist at a respected AI industry publication.
Write a sharp, data-driven analytical report based on the raw source material.

STORY HEADLINE: ${story.headline}
STORY SUMMARY: ${story.summary}

RAW SOURCE MATERIAL (Scraped Content):
---
${rawContent}
---

GUIDELINES:
- Write a focused analytical report (400–600 words).
- Extract specific insights and technical nuances from the RAW SOURCE MATERIAL.
- Tone: Sharp, direct, and confident (Bloomberg/Reuters style).
- Structure: What happened → Why it matters → One key implication to watch.
- Do NOT pad with generic AI hype. Be specific and insightful.
- Use markdown: **bold** for key entities and figures.
- Do NOT include a byline. Write only the body of the article.

Write the report now:`,
	});

	await updateStoryBody(story.link, text);
	console.log(`Reporter: ✅ Analytical Report written (${text.length} chars) — "${story.headline}"`);
}

function chunkStories<T>(items: T[], chunkSize: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += chunkSize) {
		chunks.push(items.slice(i, i + chunkSize));
	}
	return chunks;
}

async function getRawContentForStory(story: Story) {
	let rawContent = "No full content available.";
	try {
		const scrapeResult = await scrapeUrl(story.link);
		if (scrapeResult.success && scrapeResult.markdown) {
			rawContent = scrapeResult.markdown;
		}
	} catch (error) {
		console.log(`Reporter: Scraping failed for report. Error: ${error}`);
	}

	return rawContent.slice(0, 7000);
}

async function writeAnalyticalReportsBatched(stories: Story[]) {
	const maxBatches = 3;
	const batchCount = Math.min(maxBatches, Math.max(1, stories.length));
	const batchSize = Math.ceil(stories.length / batchCount);
	const batches = chunkStories(stories, batchSize);

	console.log(`Reporter: Writing ${stories.length} analytical reports in ${batches.length} AI call(s).`);

	for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
		const batch = batches[batchIndex];
		console.log(`Reporter: ✍️  Batch ${batchIndex + 1}/${batches.length} — ${batch.length} report(s)`);

		const batchWithContent = await Promise.all(
			batch.map(async (story, index) => ({
				index,
				story,
				rawContent: await getRawContentForStory(story),
			}))
		);

		const { object } = await generateObject({
			model: getAiModel(),
			schema: z.object({
				reports: z.array(
					z.object({
						index: z.number().int().nonnegative(),
						body: z.string(),
					})
				),
			}),
			prompt: `You are a technology analyst and journalist at a respected AI industry publication.
Write one analytical report for each story below.

OUTPUT RULES:
- Return JSON matching the schema.
- Return one report per input story using the same 0-based index.
- Each report must be 400-600 words.
- Tone: sharp, direct, and confident (Bloomberg/Reuters style).
- Structure each report as: What happened -> Why it matters -> One key implication to watch.
- Use markdown with **bold** for key entities and figures.
- Do NOT include bylines.

STORIES:
${batchWithContent
	.map(
		(item) => `INDEX: ${item.index}
HEADLINE: ${item.story.headline}
SUMMARY: ${item.story.summary}
SOURCE: ${item.story.source}
RAW SOURCE MATERIAL:
---
${item.rawContent}
---`
	)
	.join("\n\n")}
`,
		});

		const updates = object.reports || [];
		for (const update of updates) {
			const target = batchWithContent[update.index];
			if (!target || !update.body || update.body.trim().length < 200) {
				continue;
			}

			await updateStoryBody(target.story.link, update.body);
			console.log(`Reporter: ✅ Analytical Report written (${update.body.length} chars) — "${target.story.headline}"`);
		}
	}
}

async function updateStoryBody(link: string, body: string) {
	try {
		await sql`
			UPDATE stories SET body = ${body}
			WHERE link = ${link}
		`;
	} catch (error) {
		console.error(`Reporter: Failed to update body for ${link}:`, error);
	}
}
