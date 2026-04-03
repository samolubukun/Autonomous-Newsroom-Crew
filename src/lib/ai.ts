import { google } from "@ai-sdk/google";

/**
 * Google AI configuration
 */
const googleAi = google;

/**
 * Get the appropriate AI model based on the task requirements.
 *
 * - Default (no options): Gemini 2.5 Flash-Lite — handles structured JSON (generateObject) reliably.
 * - { power: true }: Gemini 2.5 Flash-Lite — explicitly for complex/long-form tasks.
 */
export function getAiModel(options: { power?: boolean } = {}) {
	return googleAi("gemini-2.5-flash-lite");
}

export { googleAi };
