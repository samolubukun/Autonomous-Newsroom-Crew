import FirecrawlApp from "@mendable/firecrawl-js";

/**
 * Scraper Factory
 *  1. Firecrawl (Required)
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

	if (!firecrawlKey) {
		return {
			success: false,
			error: "FIRECRAWL_API_KEY is not set. Scraper disabled.",
		};
	}

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
		return {
			success: false,
			error: error instanceof Error ? error.message : "Firecrawl failed",
		};
	}
}
