import { podcast, type PodcastTranscript } from "../../lib/data/podcast";
import fs from "node:fs/promises";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || "";
const DEEPGRAM_URL = "https://api.deepgram.com/v1/speak?model=aura-2-thalia-en";
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

/**
 * Format a podcast transcript into a single string for TTS
 */
function formatTranscriptForVoice(transcript: PodcastTranscript): string {
	let scriptText = `${transcript.intro}\n\n`;

	transcript.segments.forEach((segment, index) => {
		scriptText += `${segment.headline}\n`;
		scriptText += `${segment.content}\n`;

		if (segment.transition && index < transcript.segments.length - 1) {
			scriptText += `${segment.transition}\n\n`;
		}
	});

	scriptText += transcript.outro;
	return scriptText;
}

/**
 * Split text into sentence-aware chunks of max CHUNK_SIZE chars.
 * Splits on sentence boundaries (". ", "! ", "? ") to avoid cutting mid-sentence.
 */
function chunkText(text: string, maxLen = CHUNK_SIZE): string[] {
	if (text.length <= maxLen) return [text];

	const chunks: string[] = [];
	let remaining = text;

	while (remaining.length > maxLen) {
		// Find the last sentence boundary within maxLen
		let cutAt = maxLen;
		const sentenceEnd = remaining.slice(0, maxLen).search(/[.!?]\s[^.!?\s]/g);
		const lastPeriod = Math.max(
			remaining.lastIndexOf(". ", maxLen),
			remaining.lastIndexOf("! ", maxLen),
			remaining.lastIndexOf("? ", maxLen),
		);

		if (lastPeriod > maxLen * 0.6) {
			cutAt = lastPeriod + 2; // include the punctuation + space
		}

		chunks.push(remaining.slice(0, cutAt).trim());
		remaining = remaining.slice(cutAt).trim();
	}

	if (remaining.length > 0) chunks.push(remaining);
	return chunks;
}

/**
 * Generate audio for a single chunk of text via Deepgram
 */
async function generateAudioChunk(text: string): Promise<ArrayBuffer> {
	const response = await fetch(DEEPGRAM_URL, {
		method: "POST",
		headers: {
			Authorization: `Token ${DEEPGRAM_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ text }),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Deepgram API error: ${response.status} ${errorText}`);
	}

	return response.arrayBuffer();
}

/**
 * Generate full podcast audio — splits into chunks, TTS each, concatenates buffers.
 */
async function generateAudio(text: string): Promise<ArrayBuffer> {
	const chunks = chunkText(text);
	console.log(`PodcastVoice: Generating audio in ${chunks.length} chunk(s)...`);

	const buffers: Buffer[] = [];

	for (let i = 0; i < chunks.length; i++) {
		console.log(`PodcastVoice: Chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`);
		const audioBuffer = await generateAudioChunk(chunks[i]);
		buffers.push(Buffer.from(audioBuffer));

		// Small delay between Deepgram requests to avoid rate limits
		if (i < chunks.length - 1) {
			await new Promise(r => setTimeout(r, 500));
		}
	}

	// Concatenate all MP3 buffers into one
	const combined = Buffer.concat(buffers);
	console.log(`PodcastVoice: Combined ${buffers.length} chunks into ${combined.length} bytes of audio`);
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
 * PodcastVoice Agent - Generates audio from podcast transcripts using Deepgram and DO Spaces.
 */
export async function runPodcastVoice(options: { transcript?: PodcastTranscript } = {}) {
	console.log("PodcastVoice: Starting to generate audio for podcast");

	const transcript = options.transcript || (await podcast.getLatest()) as any;

	if (!transcript) {
		console.error("PodcastVoice: No transcript found");
		return { success: false, error: "No transcript found" };
	}

	if (transcript.audio_url) {
		console.log("PodcastVoice: Transcript already has audio");
		return { success: true, message: "Transcript already has audio", audioUrl: transcript.audio_url };
	}

	const scriptText = formatTranscriptForVoice(transcript);
	console.log(`PodcastVoice: Script is ${scriptText.length} chars`);

	// Chunk + generate + concatenate
	const audioBuffer = await generateAudio(scriptText);

	const date = new Date().toISOString().split("T")[0];
	const filename = `podcast-${date}.mp3`;

	// Save locally so you can listen during testing
	await saveLocally(filename, audioBuffer);

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
