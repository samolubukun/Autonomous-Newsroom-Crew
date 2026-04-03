import "dotenv/config";
import { runInvestigator } from "./agents/Investigator/index";
import { runFilter } from "./agents/Filter/index";
import { runEditor } from "./agents/Editor/index";
import { runPodcastEditor } from "./agents/PodcastEditor/index";
import { runPodcastVoice } from "./agents/PodcastVoice/index";
import { postPodcastToSlack } from "./lib/notifications";

async function main() {
	console.log("🚀 Starting Newsroom Standalone Pipeline");

	try {
		// 1. Investigation Phase
		console.log("\n--- PHASE 1: INVESTIGATION ---");
		const { articles } = await runInvestigator();
		
		if (!articles || articles.length === 0) {
			console.log("No new articles found. Exiting.");
			return;
		}

		// 2. Filtering Phase
		console.log("\n--- PHASE 2: FILTERING & CURATION ---");
		const { stories } = await runFilter({ articles });
		
		if (!stories || stories.length === 0) {
			console.log("No relevant or unique stories found after filtering. Exiting.");
			return;
		}

		// 3. Editing Phase
		console.log("\n--- PHASE 3: EDITING & ENHANCEMENT ---");
		const { links: editedLinks } = await runEditor({ stories });
		
		if (!editedLinks || editedLinks.length === 0) {
			console.log("No stories were successfully edited. Skipping podcast phase.");
		} else {
			// 4. Podcast Script Phase
			console.log("\n--- PHASE 4: PODCAST SCRIPT GENERATION ---");
			const { transcript } = await runPodcastEditor();

			if (transcript) {
				// 5. Podcast Voice Phase
				console.log("\n--- PHASE 5: PODCAST VOICE PRODUCTION ---");
				const voiceResult = await runPodcastVoice({ transcript });

				if (voiceResult.success && voiceResult.audioUrl) {
					console.log(`\n✅ Podcast produced successfully: ${voiceResult.audioUrl}`);

					// 6. Notification Phase
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

		console.log("\n✨ Newsroom pipeline completed successfully!");
	} catch (error) {
		console.error("\n❌ Pipeline failed with error:", error);
		process.exit(1);
	}
}

main();
