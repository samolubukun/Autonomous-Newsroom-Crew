import { sql } from "../db";

export interface Article {
	headline: string;
	summary: string;
	link: string;
	body?: string;
	source: string;
	date_posted?: string;
	date_found?: string;
}

/**
 * Research Data Access Layer (Neon Postgres Implementation)
 */
export const research = {
	/**
	 * Save articles discovered by the investigator
	 */
	save: async (articles: Article[], agentId: string) => {
		console.log(`Research: Saving ${articles.length} articles from ${agentId}`);

		for (const article of articles) {
			try {
				await sql`
					INSERT INTO research (link, headline, summary, body, source, date_posted)
					VALUES (${article.link}, ${article.headline}, ${article.summary}, ${article.body || null}, ${article.source}, ${article.date_posted || null})
					ON CONFLICT (link) DO NOTHING
				`;
			} catch (error) {
				console.error(`Research: Failed to save article ${article.link}:`, error);
			}
		}
	},

	/**
	 * Get today's research findings
	 */
	getToday: async (): Promise<Article[]> => {
		try {
			const rows = await sql`
				SELECT * FROM research 
				WHERE date_found >= CURRENT_DATE 
				ORDER BY date_found DESC
			`;
			return rows as any as Article[];
		} catch (error) {
			console.error("Research: Failed to fetch today's research:", error);
			return [];
		}
	}
};
