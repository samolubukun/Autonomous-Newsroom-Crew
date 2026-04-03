import { NextResponse } from "next/server";
import { sql } from "../../../lib/db";

export const dynamic = "force-dynamic";

/**
 * One-time migration to add priority and tier columns to the stories table.
 * Hit GET /api/migrate once to run.
 */
export async function GET() {
	try {
		await sql`
			ALTER TABLE stories 
			ADD COLUMN IF NOT EXISTS priority INT DEFAULT 5,
			ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'brief'
		`;
		return NextResponse.json({ success: true, message: "Migration complete: added priority and tier columns." });
	} catch (error) {
		console.error("Migration failed:", error);
		return NextResponse.json({ success: false, message: String(error) }, { status: 500 });
	}
}
