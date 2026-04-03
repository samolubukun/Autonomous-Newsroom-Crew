import { sql } from "../db";

export interface PodcastTranscript {
	intro: string;
	segments: Array<{
		headline: string;
		content: string;
		transition?: string;
	}>;
	outro: string;
	audio_url?: string;
	created_at?: string;
}

/**
 * Podcast Data Access Layer (Neon Postgres Implementation)
 */
export const podcast = {
	/**
	 * Save a new podcast transcript and audio URL
	 */
	save: async (transcript: PodcastTranscript, stories: any[]) => {
		console.log("Podcast: Saving new transcript and audio URL");

		try {
			const rows = await sql`
				INSERT INTO podcasts (audio_url, transcript)
				VALUES (${transcript.audio_url || null}, ${transcript as any})
				RETURNING *
			`;
			const row = rows[0];
			// Return the full transcript shape with the DB-assigned id
			return {
				...(row.transcript as any),
				id: row.id,
				audio_url: row.audio_url,
				created_at: row.created_at,
			} as PodcastTranscript & { id: number };
		} catch (error) {
			console.error("Podcast: Failed to save to database:", error);
			throw error;
		}
	},

	/**
	 * Get the latest podcast
	 */
	getLatest: async (): Promise<PodcastTranscript | null> => {
		try {
			const rows = await sql`
				SELECT * FROM podcasts 
				ORDER BY created_at DESC 
				LIMIT 1
			`;
			
			if (rows.length === 0) return null;
			
			const row = rows[0];
			return {
				...(row.transcript as any),
				audio_url: row.audio_url,
				created_at: row.created_at
			};
		} catch (error) {
			console.error("Podcast: Failed to get latest:", error);
			return null;
		}
	},

	/**
	 * Get podcast by date (for lookup)
	 */
	getByDate: async (date: Date): Promise<PodcastTranscript | null> => {
		try {
			const rows = await sql`
				SELECT * FROM podcasts 
				WHERE created_at::date = ${date.toISOString().split('T')[0]}::date
				ORDER BY created_at DESC 
				LIMIT 1
			`;
			
			if (rows.length === 0) return null;

			const row = rows[0];
			return {
				...(row.transcript as any),
				audio_url: row.audio_url,
				created_at: row.created_at
			};
		} catch (error) {
			console.error("Podcast: Failed to get by date:", error);
			return null;
		}
	},

	/**
	 * Update the audio URL for a podcast
	 */
	updateAudioUrl: async (id: number, audioUrl: string) => {
		try {
			await sql`
				UPDATE podcasts 
				SET audio_url = ${audioUrl} 
				WHERE id = ${id}
			`;
			return true;
		} catch (error) {
			console.error("Podcast: Failed to update audio URL:", error);
			return false;
		}
	}
};
