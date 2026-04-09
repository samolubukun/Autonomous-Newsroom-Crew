import { podcast, type PodcastTranscript } from "../../lib/data/podcast";
import fs from "node:fs/promises";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || "";
const VOICE_MAP = {
	"Host": "aura-asteria-en",
	"Expert": "aura-orion-en"
};
const CHUNK_SIZE = 1950; // Deepgram free limit is 2000 chars per request

// Initialize DigitalOcean Spaces client (S3-compatible via AWS SDK)
const spacesClient = new S3Client({
	region: "us-east-1",
	endpoint: `https://${process.env.DO_SPACES_ENDPOINT || ""}`,
	credentials: {
		accessKeyId: process.env.DO_SPACES_KEY || "",
		secretAccessKey: process.env.DO_SPACES_SECRET || "",
	},
	forcePathStyle: false,
});

const SPACES_BUCKET = process.env.DO_SPACES_BUCKET || "";

interface DialogueChunk {
	speaker: "Host" | "Expert";
	text: string;
}

/**
 * Split dialogue into sentence-aware chunks of max CHUNK_SIZE chars.
 * Splits on sentence boundaries (". ", "! ", "? ") to avoid cutting mid-sentence
 * while preserving the correct speaker voice mapping.
 */
function chunkDialogue(dialogue: PodcastTranscript["dialogue"], maxLen = CHUNK_SIZE): DialogueChunk[] {
	const chunks: DialogueChunk[] = [];

	for (const turn of dialogue) {
		if (turn.text.length <= maxLen) {
			chunks.push(turn);
			continue;
		}

		let remaining = turn.text;
		while (remaining.length > maxLen) {
			// Find the last sentence boundary within maxLen
			let cutAt = maxLen;
			const lastPeriod = Math.max(
				remaining.lastIndexOf(". ", maxLen),
				remaining.lastIndexOf("! ", maxLen),
				remaining.lastIndexOf("? ", maxLen),
			);

			if (lastPeriod > maxLen * 0.6) {
				cutAt = lastPeriod + 2; // include the punctuation + space
			}

			chunks.push({ speaker: turn.speaker, text: remaining.slice(0, cutAt).trim() });
			remaining = remaining.slice(cutAt).trim();
		}

		if (remaining.length > 0) {
			chunks.push({ speaker: turn.speaker, text: remaining });
		}
	}

	return chunks;
}

/**
 * Generate audio for a single dialogue chunk via Deepgram
 */
async function generateAudioChunk(chunk: DialogueChunk): Promise<ArrayBuffer> {
	const url = `https://api.deepgram.com/v1/speak?model=${VOICE_MAP[chunk.speaker]}`;

	const maxAttempts = 5;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 45000);

		try {
			const response = await fetch(url, {
				method: "POST",
				headers: {
					Authorization: `Token ${DEEPGRAM_API_KEY}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ text: chunk.text }),
				signal: controller.signal,
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Deepgram API error: ${response.status} ${errorText}`);
			}

			return response.arrayBuffer();
		} catch (error) {
			if (attempt === maxAttempts) {
				throw error;
			}

			const waitMs = 1000 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 350);
			console.warn(`PodcastVoice: Chunk request failed (attempt ${attempt}/${maxAttempts}), retrying in ${waitMs}ms...`, error);
			await new Promise((resolve) => setTimeout(resolve, waitMs));
		} finally {
			clearTimeout(timeout);
		}
	}

	throw new Error("Deepgram chunk generation failed after retries");
}

/**
 * Generate full podcast audio — splits into chunks, TTS each with correct speaker model, concatenates buffers.
 */
async function generateAudio(dialogue: PodcastTranscript["dialogue"]): Promise<ArrayBuffer> {
	const chunks = chunkDialogue(dialogue);
	console.log(`PodcastVoice: Generating audio in ${chunks.length} chunk(s) across different speakers...`);

	const buffers: Buffer[] = [];

	for (let i = 0; i < chunks.length; i++) {
		console.log(`PodcastVoice: Processing ${chunks[i].speaker} - Chunk ${i + 1}/${chunks.length} (${chunks[i].text.length} chars)`);
		const audioBuffer = await generateAudioChunk(chunks[i]);
		buffers.push(Buffer.from(audioBuffer));

		// Small delay between Deepgram requests to avoid rate limits
		if (i < chunks.length - 1) {
			await new Promise(r => setTimeout(r, 900));
		}
	}

	// Concatenate all MP3 buffers into one master track
	const combined = Buffer.concat(buffers);
	console.log(`PodcastVoice: Stitched ${buffers.length} segments into ${combined.length} bytes of dialogue`);
	return combined.buffer.slice(combined.byteOffset, combined.byteOffset + combined.byteLength) as ArrayBuffer;
}

/**
 * Save audio file locally for testing
 */
async function saveLocally(filename: string, audioBuffer: ArrayBuffer) {
	const localDir = path.join(process.cwd(), "tmp");
	await fs.mkdir(localDir, { recursive: true });
	await fs.writeFile(path.join(localDir, filename), Buffer.from(audioBuffer));
	console.log(`PodcastVoice: Saved locally to: tmp/${filename}`);
}

/**
 * Upload audio to DigitalOcean Spaces
 */
async function uploadToSpaces(filename: string, audioBuffer: ArrayBuffer): Promise<string> {
	const key = `podcasts/${filename}`;

	await spacesClient.send(
		new PutObjectCommand({
			Bucket: SPACES_BUCKET,
			Key: key,
			Body: Buffer.from(audioBuffer),
			ContentType: "audio/mpeg",
			ACL: "public-read",
		})
	);

	const endpoint = process.env.DO_SPACES_ENDPOINT || "";
	const publicUrl = `https://${SPACES_BUCKET}.${endpoint}/${key}`;
	console.log(`PodcastVoice: Uploaded to DigitalOcean Spaces: ${publicUrl}`);
	return publicUrl;
}

/**
 * PodcastVoice Agent - Generates dynamic dual-voice audio from podcast transcripts.
 */
export async function runPodcastVoice(options: { transcript?: PodcastTranscript } = {}) {
	console.log("PodcastVoice: Starting to generate conversational audio");

	const transcript = options.transcript || (await podcast.getLatest()) as any;

	if (!transcript || !transcript.dialogue) {
		console.error("PodcastVoice: No valid script/dialogue found");
		return { success: false, error: "No valid dialogue found" };
	}

	if (transcript.audio_url) {
		console.log("PodcastVoice: Transcript already has audio");
		return { success: true, message: "Transcript already has audio", audioUrl: transcript.audio_url };
	}

	// Process dialogue text logic
	const totalChars = transcript.dialogue.reduce((acc: number, val: {text: string}) => acc + val.text.length, 0);
	console.log(`PodcastVoice: Dialogue length is ${totalChars} chars across ${transcript.dialogue.length} exchanges`);

	// Chunk + generate + concatenate
	const audioBuffer = await generateAudio(transcript.dialogue);

	const date = new Date().toISOString().split("T")[0];
	const filename = `podcast-${date}.mp3`;

	// Save locally for testing (only in development)
	if (process.env.NODE_ENV !== "production") {
		await saveLocally(filename, audioBuffer);
	}

	// Upload to DigitalOcean Spaces
	let audioUrl: string;
	try {
		audioUrl = await uploadToSpaces(filename, audioBuffer);
		await podcast.updateAudioUrl(transcript.id, audioUrl);
		console.log("PodcastVoice: Updated podcast record with audio URL");
	} catch (error) {
		console.error("PodcastVoice: Failed to upload to DigitalOcean Spaces", error);
		return {
			success: true,
			filename,
			audioUrl: `file://tmp/${filename}`,
			warning: `Upload failed, audio saved locally: ${error}`,
		};
	}

	return { success: true, filename, audioUrl };
}
