"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
import { CopyIcon, CheckCircle2Icon, ExternalLinkIcon, Play, Pause, Radio, Cpu, Activity, Clock, Radar, Layers, BrainCircuit, ScrollText, AudioWaveform } from "lucide-react";
import { motion, AnimatePresence, Variants } from "framer-motion";

export function DashboardClient({ published, latestPodcast }: { published: any[], latestPodcast: any }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const waveformRef = useRef<HTMLDivElement>(null);

  // Time formatter (MM:SS)
  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.MouseEvent | React.TouchEvent) => {
    if (!audioRef.current || !waveformRef.current || (duration === 0)) return;

    const rect = waveformRef.current.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const position = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
    
    audioRef.current.currentTime = position * duration;
    setProgress(position * 100);
  };

  // Audio Handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      setCurrentTime(audio.currentTime);
      setDuration(audio.duration);
      setProgress((audio.currentTime / audio.duration) * 100);
    };

    const setAudioDuration = () => {
      setDuration(audio.duration);
    };

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("loadedmetadata", setAudioDuration);
    audio.addEventListener("ended", () => setIsPlaying(false));
    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("loadedmetadata", setAudioDuration);
      audio.removeEventListener("ended", () => setIsPlaying(false));
    };
  }, []);

  const toggleVolume = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const waveformBars = 40;
  const waveformHeights = useMemo(() => {
    return Array.from({ length: waveformBars }, (_, i) => {
      const base = Math.sin((i / waveformBars) * Math.PI * 4) * 0.2 + 0.4;
      const pseudoRandom = Math.abs(Math.sin(i * 123.456)) * 0.4;
      return Math.min(Math.max(base + pseudoRandom, 0.15), 1.0);
    });
  }, []);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 350, damping: 30 } }
  };

  return (
    <div className="flex flex-col gap-6 md:gap-10">
      
      {/* Top Banner: Hero & Podcast Player */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full relative overflow-hidden rounded-[2rem] border border-zinc-200/50 dark:border-white/10 bg-white dark:bg-black/40 shadow-xl flex flex-col lg:flex-row items-center p-6 md:p-12 gap-8"
      >
        <div className="flex-1 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-bold uppercase tracking-widest">
            <Radio size={14} className="animate-pulse" />
            Today's Deep Dive
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-zinc-900 dark:text-white leading-[1.1]">
            Your Daily AI <br /> <span className="gradient-text">Briefing</span>
          </h1>
          <p className="text-zinc-700 dark:text-zinc-400 max-w-md text-lg">
            Listen to the curated audio edition of today's top research breakthroughs and industry news.
          </p>
        </div>

        {/* Premium Player Module */}
        <div className="w-full lg:w-[400px] flex-shrink-0 bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-white/10 rounded-[1.5rem] p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-2xl relative z-10">
          {latestPodcast?.audio_url ? (
            <>
              <div className="flex justify-between items-center mb-6">
                <div className="flex flex-col">
                  <span className="text-zinc-600 dark:text-zinc-400 text-xs font-bold uppercase tracking-widest mb-1">Episode date</span>
                  <span className="text-zinc-900 dark:text-white font-semibold">
                    {new Date(latestPodcast.created_at).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-[10px] font-bold text-zinc-700 dark:text-zinc-400 bg-zinc-200/50 dark:bg-white/5 px-2 py-1 rounded-md uppercase tracking-widest">
                    Daily Edition
                  </div>
                </div>
              </div>

              {/* Top Tier Waveform Visualizer - INTERACTIVE */}
              <div 
                ref={waveformRef}
                onMouseDown={(e) => { setIsDragging(true); handleSeek(e); }}
                onMouseMove={(e) => { if (isDragging) handleSeek(e); }}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
                className="w-full h-16 md:h-20 mb-8 flex items-end gap-[1.5px] md:gap-[3px] group cursor-pointer select-none"
              >
                {waveformHeights.map((h, i) => {
                  const isActive = (i / waveformBars) * 100 <= progress;
                  const barHeight = Number((h * 100).toFixed(2));
                  return (
                    <motion.div
                      key={i}
                      className={`flex-1 rounded-full transition-colors duration-300 ${
                        isActive 
                          ? 'bg-gradient-to-t from-purple-600 to-blue-500 shadow-[0_0_10px_rgba(168,85,247,0.4)]' 
                          : 'bg-zinc-200 dark:bg-white/10'
                      }`}
                      initial={{ height: `${barHeight}%` }}
                      animate={{ 
                        height: isPlaying && isActive 
                          ? [`${barHeight}%`, `${Math.min(barHeight + 25, 100)}%`, `${barHeight}%`] 
                          : `${barHeight}%` 
                      }}
                      transition={{ 
                        duration: 0.6 + Math.abs(Math.sin(i * 789)) * 0.4, 
                        repeat: Infinity, 
                        ease: "easeInOut",
                        delay: Math.abs(Math.cos(i * 321)) * 0.2
                      }}
                    />
                  );
                })}
              </div>

              {/* Controls & Time */}
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center justify-center gap-6">
                  <button 
                    onClick={toggleVolume}
                    className="w-16 h-16 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-lg"
                  >
                    {isPlaying ? <Pause className="fill-current" size={24} /> : <Play className="fill-current ml-1" size={24} />}
                  </button>
                </div>
                
                <div className="flex items-center gap-3 text-[11px] font-bold text-zinc-500 dark:text-zinc-500 tabular-nums tracking-tighter">
                  <span>{formatTime(currentTime)}</span>
                  <div className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-800" />
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
              <audio ref={audioRef} src={latestPodcast.audio_url} className="hidden" />
            </>
          ) : (
             <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="mb-4 text-zinc-300 dark:text-zinc-600" size={32} />
                <span className="text-zinc-500 font-medium">No podcast generated today.</span>
             </div>
          )}
        </div>
      </motion.div>

      {/* Autonomous Agents Showcase */}
      <div className="w-full mt-2 mb-4 flex flex-col items-center border-b border-zinc-200/50 dark:border-white/5 pb-10">
        <div className="text-center mb-8 md:mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-widest">
            <Cpu size={14} className="animate-pulse" />
            The Engine Room
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white">
            5 Agents. <span className="text-zinc-400 dark:text-zinc-500">1 Goal.</span>
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto text-lg">
            A fully autonomous relay team working in perfect synchronization to turn the world's raw data into your daily audio briefing.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 w-full">
           {[
             { name: "Investigator", icon: Radar, desc: "Scours the web for vital facts." },
             { name: "Filter", icon: Layers, desc: "Drops all noise for clear signal." },
             { name: "Editor", icon: BrainCircuit, desc: "Refines raw data into crisp stories." },
             { name: "Podcast Editor", icon: ScrollText, desc: "Drafts fluid scripts for audio output." },
             { name: "Podcast Voice", icon: AudioWaveform, desc: "Generates realistic voice for the podcast." },
           ].map((agent, i) => (
             <motion.div 
                key={agent.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, ease: "easeOut" }}
                className="flex flex-col items-center text-center p-6 rounded-3xl border border-zinc-200 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02] hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-all duration-300 hover:-translate-y-2 shadow-sm hover:shadow-xl dark:shadow-none"
             >
               <div className="w-14 h-14 rounded-2xl bg-white dark:bg-white/10 flex items-center justify-center mb-6 text-zinc-900 dark:text-white shadow-sm border border-zinc-200/50 dark:border-white/5">
                 <agent.icon size={26} strokeWidth={1.5} />
               </div>
               <h3 className="font-bold text-lg text-zinc-900 dark:text-white mb-3">{agent.name}</h3>
               <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">{agent.desc}</p>
             </motion.div>
           ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col gap-8">
        
        {/* System Vitals (Desktop: Top, Mobile: Bottom) */}
        <div className="w-full order-last md:order-first mb-8 md:mb-0 mt-8 md:mt-0">
          <h2 className="text-xl md:text-2xl font-bold mb-6 text-zinc-900 dark:text-white text-left">System Vitals</h2>
          <div className="p-6 md:p-8 rounded-[2rem] border border-zinc-200/50 dark:border-white/10 bg-white dark:bg-white/[0.02] shadow-xl dark:shadow-none flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="flex-1 w-full max-w-4xl">
              <h3 className="font-bold text-xs uppercase tracking-widest text-zinc-600 dark:text-zinc-400 mb-6 flex items-center gap-2">
                 <Cpu size={14} /> Pipeline Engines
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { name: "Researcher Engine", status: "Online" },
                  { name: "Content Editor", status: "Online" },
                  { name: "Audio Synthesis", status: "Ready" }
                ].map((engine) => (
                  <div key={engine.name} className="flex items-center justify-between p-3 rounded-xl bg-zinc-100 dark:bg-black/50 border border-zinc-200 dark:border-white/5">
                    <span className="text-zinc-800 dark:text-zinc-300 text-sm font-medium flex items-center gap-3">
                      <Activity size={14} className="text-zinc-500 dark:text-zinc-400" />
                      {engine.name}
                    </span>
                    <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] font-bold uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      {engine.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="pt-6 md:pt-0 border-t md:border-t-0 md:border-l border-zinc-200 dark:border-white/10 md:pl-8 flex justify-start md:justify-center min-w-[200px]">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Clock size={16} className="text-blue-500" />
                 </div>
                 <div className="flex flex-col">
                   <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Next Auto Run</span>
                   <span className="text-zinc-900 dark:text-white font-semibold">08:00 AM UTC</span>
                 </div>
               </div>
            </div>
          </div>
        </div>

        {/* Stories Masonry (Desktop: Bottom, Mobile: Top) */}
        <div className="w-full order-first md:order-last">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              Curated Stories
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs font-bold text-purple-600 dark:text-purple-400">
              {published.length}
            </span>
          </div>

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {published.length === 0 ? (
              <div className="col-span-full p-12 text-center rounded-[2rem] border border-dashed border-zinc-300 dark:border-white/10">
                <p className="text-zinc-500">No stories curated yet. Run the pipeline to populate the feed.</p>
              </div>
            ) : (
              published.map((story, i) => (
                <motion.div 
                  key={story.link}
                  variants={itemVariants}
                  className="group flex flex-col justify-between p-6 rounded-3xl border border-zinc-200/60 dark:border-white/10 bg-white dark:bg-white/[0.02] hover:bg-zinc-50/50 dark:hover:bg-white/[0.04] transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:shadow-none h-full"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="font-bold text-lg leading-snug text-black dark:text-white group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">
                        {story.headline}
                      </h3>
                      <a 
                        href={story.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-zinc-100 dark:bg-white/5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                      >
                        <ExternalLinkIcon size={16} />
                      </a>
                    </div>
                    <p className="text-zinc-800 dark:text-zinc-300 text-sm leading-relaxed line-clamp-3">
                      {story.summary}
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 dark:border-white/5 pt-4 mt-6">
                    <div className="flex flex-wrap gap-2">
                       {story.tags?.slice(0, 2).map((tag: string) => (
                         <span key={tag} className="text-[10px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-400 px-2.5 py-1 rounded-md bg-zinc-200/50 dark:bg-white/5">
                            {tag}
                         </span>
                       ))}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#0088ff] flex items-center gap-1.5 bg-blue-500/10 px-2 py-1 rounded-md">
                      <CheckCircle2Icon size={12} /> Curated
                    </span>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        </div>

      </div>
    </div>
  );
}
