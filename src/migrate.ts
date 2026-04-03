import "dotenv/config";
import { sql } from "./lib/db";

async function migrate() {
	try {
		await sql`ALTER TABLE stories ADD COLUMN IF NOT EXISTS priority INT DEFAULT 5`;
		await sql`ALTER TABLE stories ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'brief'`;
		console.log("✅ Migration complete: added priority and tier columns.");
	} catch (error) {
		console.error("❌ Migration failed:", error);
	}
	process.exit(0);
}

migrate();
