import { task, schedules } from "@trigger.dev/sdk";
import { runInvestigator } from "../agents/Investigator/index";
import { runChiefEditor } from "../agents/ChiefEditor/index";
import { runEditor } from "../agents/Editor/index";
import { runReporter } from "../agents/Reporter/index";
import { runPodcastEditor } from "../agents/PodcastEditor/index";
import { runPodcastVoice } from "../agents/PodcastVoice/index";
import { postPodcastToSlack } from "../lib/notifications";

// Payload interface for the newsroom pipeline
export interface NewsroomPayload {
  dynamicSources?: string[];
}

/**
 * Newsroom Pipeline Task
 * Coordinates the 6-agent newsroom crew to:
 * 1. Investigate and discover new articles.
 * 2. Filter, curate, and tier stories.
 * 3. Edit and enhance content.
 * 4. Generate long-form investigative articles/reports.
 * 5. Draft the dual-voice podcast transcript.
 * 6. Generate the realistic text-to-speech audio track and upload it.
 * 7. Post the completed podcast and summary to Slack (if configured).
 */
export const newsroomPipeline = task({
  id: "newsroom-pipeline",
  run: async (payload: NewsroomPayload) => {
    console.log("🚀 Starting Newsroom Pipeline via Trigger.dev");

    // 1. Investigation Phase
    console.log("\n--- PHASE 1: INVESTIGATION ---");
    const { articles } = await runInvestigator({ dynamicSources: payload.dynamicSources });
    
    if (!articles || articles.length === 0) {
      console.log("No new articles found. Exiting pipeline.");
      return {
        success: true,
        message: "No new articles found.",
        results: { articlesFound: 0, storiesCurated: 0, podcastProduced: false }
      };
    }

    // 2. Curation & Filtering Phase
    console.log("\n--- PHASE 2: FILTERING & CURATION ---");
    const { stories } = await runChiefEditor({ articles });
    
    if (!stories || stories.length === 0) {
      console.log("No relevant or unique stories found after filtering. Exiting pipeline.");
      return {
        success: true,
        message: "No relevant or unique stories found after filtering.",
        results: { articlesFound: articles.length, storiesCurated: 0, podcastProduced: false }
      };
    }

    // 3. Editing Phase
    console.log("\n--- PHASE 3: EDITING & ENHANCEMENT ---");
    const { links: editedLinks } = await runEditor({ stories });
    
    if (!editedLinks || editedLinks.length === 0) {
      console.log("No stories were successfully edited. Skipping remaining phases.");
      return {
        success: true,
        message: "No stories were successfully edited.",
        results: { articlesFound: articles.length, storiesCurated: stories.length, podcastProduced: false }
      };
    }

    // 4. Investigative Reporting Phase
    console.log("\n--- PHASE 4: INVESTIGATIVE REPORTING ---");
    await runReporter();

    // 5. Podcast Script Phase
    console.log("\n--- PHASE 5: PODCAST SCRIPT GENERATION ---");
    const { transcript } = await runPodcastEditor();

    let podcastProduced = false;
    let audioUrl = "";

    if (transcript) {
      // 6. Podcast Voice Phase
      console.log("\n--- PHASE 6: PODCAST VOICE PRODUCTION ---");
      const voiceResult = await runPodcastVoice({ transcript });

      if (voiceResult.success && voiceResult.audioUrl) {
        podcastProduced = true;
        audioUrl = voiceResult.audioUrl;
        console.log(`\n✅ Podcast produced successfully: ${voiceResult.audioUrl}`);

        // 7. Slack Notification Phase
        if (process.env.SLACK_WEBHOOK_URL) {
          console.log("Publishing completed episode to Slack...");
          await postPodcastToSlack(
            process.env.SLACK_WEBHOOK_URL,
            transcript as any,
            voiceResult.audioUrl
          );
        }
      }
    }

    console.log("\n✨ Trigger.dev Newsroom pipeline completed successfully!");
    return {
      success: true,
      message: "Pipeline completed successfully!",
      results: {
        articlesFound: articles.length,
        storiesCurated: stories.length,
        podcastProduced,
        audioUrl
      }
    };
  }
});

/**
 * Scheduled Newsroom Pipeline
 * Automatically triggers the newsroom-pipeline task at 8:00 AM UTC every 3 days.
 */
export const threeDayNewsroomPipeline = schedules.task({
  id: "three-day-newsroom-pipeline",
  cron: {
    pattern: "0 8 */3 * *", // 8:00 AM every 3 days UTC
    timezone: "UTC",
  },
  run: async (payload) => {
    console.log(`⏰ Scheduled run triggered at ${payload.timestamp}`);
    // Trigger the main pipeline task
    await newsroomPipeline.trigger({});
  }
});

