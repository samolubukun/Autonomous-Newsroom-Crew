import "dotenv/config";
import { sql } from "../lib/db";

async function clearDatabase() {
    console.log("🧹 Clearing database for a fresh pipeline run...");
    try {
        await sql`TRUNCATE stories, research RESTART IDENTITY;`;
        console.log("✅ Database cleared successfully.");
        process.exit(0);
    } catch (error) {
        console.error("❌ Failed to clear database:", error);
        process.exit(1);
    }
}

clearDatabase();
