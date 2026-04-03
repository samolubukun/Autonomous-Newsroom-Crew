import { generateText } from "ai";
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
		for (const story of reportStories) {
			if (story.body && story.body.length > 200) {
				console.log(`Reporter: Report already has body, skipping — "${story.headline}"`);
				continue;
			}
			await writeAnalyticalReport(story);
			
			// Rate limit protection for free tier
			console.log("Reporter: Buffering for 10s to respect AI rate limits...");
			await new Promise(resolve => setTimeout(resolve, 10000));
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
