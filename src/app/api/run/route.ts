import { NextResponse } from "next/server";
import { runInvestigator } from "../../../agents/Investigator";
import { runChiefEditor } from "../../../agents/ChiefEditor";
import { runEditor } from "../../../agents/Editor";
import { runReporter } from "../../../agents/Reporter";
import { runPodcastEditor } from "../../../agents/PodcastEditor";
import { runPodcastVoice } from "../../../agents/PodcastVoice";
import { postPodcastToSlack } from "../../../lib/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes (Vercel Pro)

async function isCronAuthorized(request: Request) {
	const configuredSecret = process.env.CRON_SECRET;

	if (!configuredSecret) {
		return true;
	}

	const authHeader = request.headers.get("authorization");
	const headerSecret = request.headers.get("x-cron-secret");
	const url = new URL(request.url);
	const querySecret = url.searchParams.get("secret") ?? url.searchParams.get("cron_secret");

	if (authHeader === `Bearer ${configuredSecret}` || headerSecret === configuredSecret || querySecret === configuredSecret) {
		return true;
	}

	if (request.method === "POST") {
		const contentType = request.headers.get("content-type") || "";
		if (contentType.includes("application/json")) {
			try {
				const body = await request.clone().json();
				if (body?.secret === configuredSecret || body?.cronSecret === configuredSecret) {
					return true;
				}
			} catch {
				return false;
			}
		}
	}

	return false;
}

async function runPipeline(request: Request) {
	const authorized = await isCronAuthorized(request);
	if (!authorized) {
		return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
	}

	console.log("🚀 Starting Newsroom Standalone Pipeline via API");

	try {
		// 1. Investigation Phase
		console.log("\n--- PHASE 1: INVESTIGATION ---");
		const { articles } = await runInvestigator();
		
		if (!articles || articles.length === 0) {
			return NextResponse.json({ success: true, message: "No new articles found." });
		}

		// 2. Filtering Phase
		console.log("\n--- PHASE 2: FILTERING & CURATION ---");
		const { stories } = await runChiefEditor({ articles });
		
		if (!stories || stories.length === 0) {
			return NextResponse.json({ success: true, message: "No relevant or unique stories found after filtering." });
		}

		// 3. Editing Phase
		console.log("\n--- PHASE 3: EDITING & ENHANCEMENT ---");
		const { links: editedLinks } = await runEditor({ stories });
		
		let podcastProduced = false;
		let audioUrl = "";

		if (editedLinks && editedLinks.length > 0) {
			// 4. Investigative Reporting Phase
			console.log("\n--- PHASE 4: INVESTIGATIVE REPORTING ---");
			await runReporter();

			// 5. Podcast Script Phase
			console.log("\n--- PHASE 5: PODCAST SCRIPT GENERATION ---");
			const { transcript } = await runPodcastEditor();

			if (transcript) {
				// 6. Podcast Voice Phase
				console.log("\n--- PHASE 6: PODCAST VOICE PRODUCTION ---");
				const voiceResult = await runPodcastVoice({ transcript });

				if (voiceResult.success && voiceResult.audioUrl) {
					podcastProduced = true;
					audioUrl = voiceResult.audioUrl;
					console.log(`\n✅ Podcast produced successfully: ${voiceResult.audioUrl}`);

					// 7. Notification Phase
					if (process.env.SLACK_WEBHOOK_URL) {
						console.log("Publishing to Slack...");
						await postPodcastToSlack(
							process.env.SLACK_WEBHOOK_URL,
							transcript as any,
							voiceResult.audioUrl
						);
					}
				}
			}
		}

		return NextResponse.json({
			success: true,
			message: "Pipeline completed successfully!",
			results: {
				articlesFound: articles.length,
				storiesCurated: stories.length,
				podcastProduced,
				audioUrl
			}
		});
	} catch (error) {
		console.error("\n❌ Pipeline failed with error:", error);
		return NextResponse.json({
			success: false,
			message: error instanceof Error ? error.message : "Unknown error occurred"
		}, { status: 500 });
	}
}

export async function GET(request: Request) {
	return runPipeline(request);
}

// Also allow POST
export async function POST(request: Request) {
	return runPipeline(request);
}
