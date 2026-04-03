import FirecrawlApp from "@mendable/firecrawl-js";

const CRAWL4AI_BASE = process.env.CRAWL4AI_API_URL as string;

/**
 * Fallback scraper using Self-Hosted Crawl4AI API
 * POST /crawl → returns { results: [{ markdown, html, links }] }
 */
async function crawl4ai(url: string): Promise<{ success: boolean; markdown?: string; error?: string }> {
	console.log(`[Scraper] Using Crawl4AI for: ${url}`);
	const response = await fetch(`${CRAWL4AI_BASE}/crawl`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ urls: [url] }),
	});

	if (!response.ok) {
		throw new Error(`Crawl4AI error: ${response.status} ${response.statusText}`);
	}

	const data = await response.json() as any;

	// The API returns { results: [{ markdown, html, links }] }
	const result = data?.results?.[0];
	const markdown = result?.markdown || result?.html || "";

	if (!markdown) {
		throw new Error("Crawl4AI returned empty content");
	}

	return { success: true, markdown };
}

/**
 * Scraper Factory
 *  1. Firecrawl  (if FIRECRAWL_API_KEY is set)
 *  2. Crawl4AI   (Self-Hosted — always available)
 */
export async function scrapeUrl(url: string, options: {
	formats?: ("markdown" | "html")[];
	prompt?: string;
	schema?: any;
} = {}): Promise<{
	success: boolean;
	markdown?: string;
	metadata?: any;
	error?: string;
	data?: any;
}> {
	const firecrawlKey = process.env.FIRECRAWL_API_KEY;

	// 1. Try Firecrawl if key exists
	if (firecrawlKey) {
		try {
			console.log(`[Scraper] Using Firecrawl for: ${url}`);
			const firecrawl = new FirecrawlApp({ apiKey: firecrawlKey });

			if (options.schema) {
				const result = await firecrawl.extract([url], {
					prompt: options.prompt,
					schema: options.schema,
				});
				return result as any;
			}

			const result = await firecrawl.scrapeUrl(url, {
				formats: options.formats || ["markdown"],
			});
			return result as any;
		} catch (error) {
			console.error(`[Scraper] Firecrawl failed: ${error instanceof Error ? error.message : String(error)}`);
			// fall through to Crawl4AI
		}
	}

	// 2. Fallback — Crawl4AI
	try {
		return await crawl4ai(url);
	} catch (error) {
		console.error(`[Scraper] Crawl4AI failed for ${url}: ${error instanceof Error ? error.message : String(error)}`);
		return {
			success: false,
			error: error instanceof Error ? error.message : "All scraping methods failed",
		};
	}
}
