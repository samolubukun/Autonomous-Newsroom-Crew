import { getUnpublishedStories, getPublishedStories } from "../lib/data/stories";
import { podcast } from "../lib/data/podcast";
import { DashboardClient } from "../components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [published, latestPodcast] = await Promise.all([
    getPublishedStories(),
    podcast.getLatest()
  ]);

  return (
    <main className="min-h-screen relative overflow-hidden pb-32 pt-[200px] md:pt-[120px]">
      {/* Background Animated Gradient Mesh - Adaptive to System Theme */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-50 dark:opacity-40 transition-opacity duration-1000">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600/20 dark:bg-purple-600/10 blur-[120px] mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute top-[20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-blue-500/20 dark:bg-blue-500/10 blur-[150px] mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute bottom-[-20%] left-[20%] w-[400px] h-[400px] rounded-full bg-teal-500/20 dark:bg-teal-500/10 blur-[100px] mix-blend-multiply dark:mix-blend-screen" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <DashboardClient published={published} latestPodcast={latestPodcast} />
      </div>
    </main>
  );
}
