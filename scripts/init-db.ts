import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

/**
 * Database Initialization Script
 * Run this once with: npx ts-node scripts/init-db.ts
 */
async function init() {
	if (!process.env.DATABASE_URL) {
		console.error("DATABASE_URL is missing in .env");
		process.exit(1);
	}

	const sql = neon(process.env.DATABASE_URL);

	console.log("🚀 Initializing Neon Database Tables...");

	try {

		// 1. Research Table (Raw findings)
		await sql`
			CREATE TABLE IF NOT EXISTS research (
				id SERIAL PRIMARY KEY,
				link TEXT UNIQUE NOT NULL,
				headline TEXT,
				summary TEXT,
				body TEXT,
				source TEXT,
				date_posted TEXT,
				date_found TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			);
		`;
		console.log("✅ Created 'research' table");

		// 2. Stories Table (Enhanced/Published stories)
		await sql`
			CREATE TABLE IF NOT EXISTS stories (
				id SERIAL PRIMARY KEY,
				link TEXT UNIQUE NOT NULL,
				headline TEXT NOT NULL,
				summary TEXT NOT NULL,
				body TEXT,
				tags TEXT[],
				category TEXT,
				source TEXT,
				original_headline TEXT,
				published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			);
		`;
		console.log("✅ Created 'stories' table");

		// 3. Podcasts Table (Audio versions)
		await sql`
			CREATE TABLE IF NOT EXISTS podcasts (
				id SERIAL PRIMARY KEY,
				audio_url TEXT,
				transcript JSONB,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			);
		`;
		console.log("✅ Created 'podcasts' table");

		console.log("\n✨ Database initialization complete!");
	} catch (error) {
		console.error("❌ Error initializing database:", error);
		process.exit(1);
	}
}

init();
