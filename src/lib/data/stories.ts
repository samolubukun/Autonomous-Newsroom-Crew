import { sql } from "../db";

export interface Story {
	headline: string;
	summary: string;
	body?: string;
	tags?: string[];
	category?: string;
	link: string;
	source: string;
	original_headline?: string;
	published_at?: string;
}

/**
 * Stories Data Access Layer (Neon Postgres Implementation)
 */
export const stories = {
	/**
	 * Check if a story has already been processed
	 */
	exists: async (link: string): Promise<boolean> => {
		try {
			const rows = await sql`SELECT 1 FROM stories WHERE link = ${link}`;
			return rows.length > 0;
		} catch (error) {
			console.error(`Stories: Failed to check existence of ${link}:`, error);
			return false;
		}
	},

	/**
	 * Save an enhanced/published story
	 */
	save: async (story: Story) => {
		console.log(`Stories: Saving published story "${story.headline}"`);

		try {
			await sql`
				INSERT INTO stories (
					link, headline, summary, body, tags, category, source, original_headline
				) VALUES (
					${story.link}, 
					${story.headline}, 
					${story.summary}, 
					${story.body || null}, 
					${story.tags || null}, 
					${story.category || null}, 
					${story.source}, 
					${story.original_headline || null}
				) ON CONFLICT (link) DO UPDATE SET
					headline = EXCLUDED.headline,
					summary = EXCLUDED.summary,
					body = EXCLUDED.body,
					tags = EXCLUDED.tags,
					category = EXCLUDED.category
			`;
		} catch (error) {
			console.error(`Stories: Failed to save story ${story.link}:`, error);
		}
	},

	/**
	 * Get published stories from the last 24 hours
	 */
	getPublishedStories: async (): Promise<Story[]> => {
		try {
			const rows = await sql`
				SELECT * FROM stories 
				WHERE published_at >= NOW() - INTERVAL '24 hours'
				ORDER BY published_at DESC
			`;
			return rows as any as Story[];
		} catch (error) {
			console.error("Stories: Failed to fetch published stories:", error);
			return [];
		}
	},

	/**
	 * Get unpublished stories (from research table)
	 */
	getUnpublishedStories: async (): Promise<any[]> => {
		try {
			const rows = await sql`
				SELECT r.* FROM research r
				LEFT JOIN stories s ON r.link = s.link
				WHERE s.link IS NULL
				AND r.date_found >= NOW() - INTERVAL '24 hours'
				ORDER BY r.date_found DESC
			`;
			return rows;
		} catch (error) {
			console.error("Stories: Failed to fetch unpublished stories:", error);
			return [];
		}
	}
};

// Aliases for compatibility
export const getUnpublishedStories = stories.getUnpublishedStories;
export const getPublishedStories = stories.getPublishedStories;
export const exists = stories.exists;
export const addStory = stories.save;
export const markAsPublished = async (link: string) => {
	// In SQL version, save() handles publishing
	return true;
};
