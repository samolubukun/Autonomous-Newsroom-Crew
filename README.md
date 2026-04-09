<div align="center">
    <h2>AI Newsroom: Autonomous News Crew</h2>
    <strong>6 Agents. 1 Goal. AI Agent News & Research Breakthroughs.</strong> <br/>
<br />
<a href="https://nextjs.org/"><img alt="Next.js" src="https://img.shields.io/badge/Next.js-14+-black?logo=next.js&logoColor=white"></a>
<a href="https://reactjs.org/"><img alt="React" src="https://img.shields.io/badge/React-18-blue?logo=react&logoColor=white"></a>
<a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white"></a>
<a href="https://tailwindcss.com/"><img alt="TailwindCSS" src="https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwind-css&logoColor=white"></a>
<a href="https://deepgram.com/"><img alt="Deepgram" src="https://img.shields.io/badge/Deepgram-Aura-purple"></a>
<a href="https://ai.google.dev/"><img alt="Gemini" src="https://img.shields.io/badge/Google_Gemini-2.5_Flash-4285F4?logo=googlegemini&logoColor=white"></a>
<img alt="License" src="https://badgen.now.sh/badge/license/MIT">
</div>

<br/>

## Overview

**AI Newsroom** is a fully automated, multi-agent content generation **crew** targeting the latest in **AI Agents, LLM research, and industry developments**. By scouring the web for raw data on emerging AI technologies and flawlessly relaying it through a highly specialized crew of agents, it automatically publishes curated daily news roundups alongside ultra-realistic auto-generated podcasts.

## Tech Stack

The high-performance architecture guarantees seamless processing from extraction to audio rendering.

- **Frontend & App Layer:** Next.js 14 (App Router), React 18, Framer Motion
- **Styling:** Tailwind CSS (Premium Dark Mode UI & Glassmorphism)
- **AI Brain:** Google Gemini 2.5 Flash / Pro (Core agent intelligence)
- **Audio Synthesis:** Deepgram Aura (Ultra-realistic TTS voice generation)
- **Scraping Layer:** Crawl4AI / Firecrawl integration
- **Database & Storage:** PostgreSQL (Neon) & DigitalOcean Spaces (S3 compatible)
- **Caching & State:** Upstash (Serverless Redis)

## The Engine Room (6 Core Agents)

The **crew** isn't just a simple script—it's a relay team of autonomous agents operating under a single instruction.

- **Investigator** - Scours the web for vital facts and raw developments.
- **Chief Editor** - Performs tiered triage of news items into Lead features, Analytical reports, or Briefs.
- **Editor** - Refines raw data into crisp stories and summaries for rapid-fire consumption.
- **Investigative Reporter** - Conducts deep-dive research and writes high-fidelity long-form features.
- **Podcast Editor** - Drafts fluid conversational scripts explicitly tailored for audio output.
- **Podcast Voice** - Generates realistic voice narration using Deepgram TTS for the final broadcast.

## Setup & Installation

Follow these standard instructions to hook up the engine locally.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/samolubukun/Autonomous-Newsroom-Crew.git
   cd Autonomous-Newsroom-Crew
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Configure the Environment:**
   Copy the example environment template and populate it with your API keys.
   ```bash
   cp .env.example .env
   ```
   > **Note:** You must provide adequate credentials for PostgreSQL (`DATABASE_URL`), Audio routing (`DEEPGRAM_API_KEY`, `DO_SPACES_KEY`), and Core Intelligence (`GOOGLE_GENERATIVE_AI_API_KEY`).

4. **Initialize the Database:**
   ```bash
   npm run init-db
   ```
   *(Note: Ensure your schema is properly structured and tables synced before running the pipeline)*

5. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   *Your local newsroom will be live at `http://localhost:3000`.*

6. **Trigger the News Crew (Manual):**
   Inside the project directory, run:
   ```bash
   npm run newsroom
   ```
   *This will execute the full 6-agent news crew from digital research to high-fidelity audio generation.*


---

## Usage

Once the server is running, the **AI Newsroom Dashboard** gives you immediate feedback. Simply click the **RUN NEWS CREW** button in the navigation header to kick off the sequence manually. 

- **Lead Feature:** The single most significant AI development of the session, featuring high-fidelity research.
- **Analytical Reports:** Deep-dive investigations with professional Markdown rendering and data-driven insights.
- **News Briefs:** Concise summaries and quick-hit developments for rapid-fire consumption.
- **Audio Broadcast:** An ultra-realistic dual-voice podcast player generated dynamically for every news cycle.

## Deployment

Ensure all your `.env` secrets are configured in your Vercel or deployment dashboard before committing. Remember to set the Cron Jobs correctly if you wish the crew to operate fully autonomously daily without requiring manual triggering (the `/api/run` route is already exposed for cron services).

### Daily Scheduling Across Platforms

The pipeline endpoint is `GET/POST /api/run`.

To keep scheduled runs private across Vercel, Netlify, Render, Railway, Pipedream, Pipedream-like cron services, or custom schedulers:

1. Set `CRON_SECRET` in your deployment environment variables.
2. Configure your scheduler to call `/api/run` once daily and pass one of these auth options:
   - `Authorization: Bearer <CRON_SECRET>` header (recommended)
   - `x-cron-secret: <CRON_SECRET>` header
   - `?secret=<CRON_SECRET>` query parameter
   - For `POST` JSON calls: `{ "secret": "<CRON_SECRET>" }`

This keeps the same API route compatible with different hosting and cron providers.

### GitHub Actions Scheduler (every day at 08:00 UTC)

This repository includes `.github/workflows/scheduled-pipeline.yml` so the pipeline can be triggered automatically on any hosting provider.

1. Add these repository secrets in GitHub:
   - `PIPELINE_URL` = your deployed endpoint (example: `https://your-domain.com/api/run`)
   - `CRON_SECRET` = the same secret configured in your deployment environment
2. The workflow runs every day at `08:00 UTC` (`0 8 * * *`) and can also be run manually from the Actions tab.
3. If you want to use Vercel Cron instead, add this block to `vercel.json`:
   ```json
   {
     "crons": [
       {
         "path": "/api/run",
         "schedule": "0 8 * * *"
       }
     ]
   }
   ```
4. This repository currently relies on GitHub Actions scheduling (Vercel Cron removed) to avoid duplicate triggers.
5. The workflow includes healthcheck/log steps that print run metadata, HTTP status, response body, and validates `success: true`.

## License
This project is securely licensed under the MIT License.
