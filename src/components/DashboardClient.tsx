"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { CopyIcon, CheckCircle2Icon, ExternalLinkIcon, Play, Pause, Radio, Cpu, Activity, Clock, Radar, Layers, BrainCircuit, ScrollText, AudioWaveform, BookOpen, X, ChevronRight, Newspaper } from "lucide-react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function DashboardClient({ published, latestPodcast }: { published: any[], latestPodcast: any }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedStory, setSelectedStory] = useState<any | null>(null);
  const waveformRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (selectedStory) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [selectedStory]);

  // Time and Source formatters
  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const cleanSource = (source: string) => {
    if (!source) return "Unknown Source";
    // If it's a URL, extract the domain
    if (source.includes("://") || source.includes("www.")) {
      try {
        const url = new URL(source.startsWith('http') ? source : `https://${source}`);
        return url.hostname.replace('www.', '').split('.')[0].toUpperCase();
      } catch {
        return source.toUpperCase();
      }
    }
    return source;
  };

  const handleSeek = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if (!audioRef.current || !waveformRef.current || (duration === 0)) return;

    const rect = waveformRef.current.getBoundingClientRect();
    let clientX = 0;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
    } else if ('clientX' in e) {
      clientX = e.clientX;
    }

    const position = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    
    audioRef.current.currentTime = position * duration;
    setCurrentTime(audioRef.current.currentTime);
    setProgress(position * 100);
  };

  // Improved Audio Handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateUI = () => {
      if (!isDragging) {
        setCurrentTime(audio.currentTime);
        if (audio.duration) {
          setDuration(audio.duration);
          setProgress((audio.currentTime / audio.duration) * 100);
        }
      }
    };

    const handleDataLoaded = () => {
      if (audio.duration) setDuration(audio.duration);
    };

    audio.addEventListener("timeupdate", updateUI);
    audio.addEventListener("loadedmetadata", handleDataLoaded);
    audio.addEventListener("durationchange", handleDataLoaded);
    audio.addEventListener("canplay", handleDataLoaded);
    audio.addEventListener("ended", () => setIsPlaying(false));
    
    // Initial check in case it's already loaded
    if (audio.duration) setDuration(audio.duration);

    return () => {
      audio.removeEventListener("timeupdate", updateUI);
      audio.removeEventListener("loadedmetadata", handleDataLoaded);
      audio.removeEventListener("durationchange", handleDataLoaded);
      audio.removeEventListener("canplay", handleDataLoaded);
      audio.removeEventListener("ended", () => setIsPlaying(false));
    };
  }, [isDragging, latestPodcast?.audio_url]);

  // Window-level drag listener for "Elite" scrubbing experience
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
      handleSeek(e);
    };

    const handleGlobalUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleGlobalMove);
    window.addEventListener("touchmove", handleGlobalMove);
    window.addEventListener("mouseup", handleGlobalUp);
    window.addEventListener("touchend", handleGlobalUp);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMove);
      window.removeEventListener("touchmove", handleGlobalMove);
      window.removeEventListener("mouseup", handleGlobalUp);
      window.removeEventListener("touchend", handleGlobalUp);
    };
  }, [isDragging, duration]);

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
                onTouchStart={(e) => { setIsDragging(true); handleSeek(e); }}
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
              <audio 
                ref={audioRef} 
                src={latestPodcast.audio_url} 
                className="hidden" 
                onTimeUpdate={(e) => {
                  const audio = e.currentTarget;
                  if (!isDragging) {
                    setCurrentTime(audio.currentTime);
                    if (audio.duration) {
                      setDuration(audio.duration);
                      setProgress((audio.currentTime / audio.duration) * 100);
                    }
                  }
                }}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onDurationChange={(e) => setDuration(e.currentTarget.duration)}
                onEnded={() => setIsPlaying(false)}
              />
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
            6 Agents. <span className="text-zinc-400 dark:text-zinc-500">1 Goal.</span>
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto text-lg">
            By scouring the web for raw data on emerging AI technologies and flawlessly relaying it through a highly specialized crew of agents, it automatically publishes curated daily news roundups alongside ultra-realistic auto-generated podcasts.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 md:gap-6 w-full">
           {[
             { name: "Investigator", icon: Radar, desc: "Scours the web for vital facts." },
             { name: "Chief Editor", icon: Layers, desc: "Ranks stories by editorial impact." },
             { name: "Editor", icon: BrainCircuit, desc: "Refines raw data into crisp stories." },
             { name: "Reporter", icon: Newspaper, desc: "Writes long-form investigative features." },
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
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white mb-3">{agent.name}</h3>
               <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">{agent.desc}</p>
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

        {/* Stories — Tiered Magazine Layout */}
        <div className="w-full order-first md:order-last">
          <div className="flex items-center gap-3 mb-8">
            <h2 className="text-2xl font-bold flex items-center gap-3">Today's Edition</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs font-bold text-purple-600 dark:text-purple-400">
              {published.length}
            </span>
          </div>

          {published.length === 0 ? (
            <div className="p-12 text-center rounded-[2rem] border border-dashed border-zinc-300 dark:border-white/10">
              <p className="text-zinc-500">No stories curated yet. Run the pipeline to populate the feed.</p>
            </div>
          ) : (() => {
            const lead = published.find(s => s.tier === 'lead');
            const reports = published.filter(s => s.tier === 'report');
            const briefs = published.filter(s => s.tier === 'brief' || !s.tier);
            return (
              <div className="space-y-10">
                {/* LEAD FEATURE — Hero Layout */}
                {lead && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="group relative rounded-[2rem] border border-purple-500/30 bg-gradient-to-br from-purple-500/5 via-white dark:via-white/[0.02] to-blue-500/5 dark:to-blue-500/5 p-8 md:p-10 hover:shadow-2xl dark:shadow-none transition-all duration-500"
                  >
                    <div className="flex items-center gap-2 mb-5">
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-600 text-white text-[10px] font-bold uppercase tracking-widest">
                        <Newspaper size={10} /> Lead Feature
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{cleanSource(lead.source)}</span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black leading-tight text-zinc-900 dark:text-white mb-4 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">
                      {lead.headline}
                    </h2>
                    <p className="text-zinc-600 dark:text-zinc-300 text-base leading-relaxed mb-6 max-w-3xl">
                      {lead.summary}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {lead.body && (
                        <button
                          onClick={() => setSelectedStory(lead)}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 transition-colors"
                        >
                          <BookOpen size={14} /> Read Full Investigation
                        </button>
                      )}
                      <a href={lead.link} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300 text-sm font-bold hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors">
                        <ExternalLinkIcon size={14} /> Source
                      </a>
                    </div>
                    {lead.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-6">
                        {lead.tags.slice(0, 4).map((tag: string) => (
                          <span key={tag} className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 px-2.5 py-1 rounded-md bg-purple-500/10">{tag}</span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ANALYTICAL REPORTS — Card Grid */}
                {reports.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                      <ChevronRight size={14} /> Analytical Reports
                    </h3>
                    <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {reports.map((story) => (
                        <motion.div key={story.link} variants={itemVariants}
                          className="group flex flex-col justify-between p-6 rounded-2xl border border-zinc-200/60 dark:border-white/10 bg-white dark:bg-white/[0.02] hover:bg-zinc-50/50 dark:hover:bg-white/[0.04] transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:shadow-none"
                        >
                          <div className="space-y-3">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">{cleanSource(story.source)}</span>
                            <h3 className="font-bold text-base leading-snug text-black dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">{story.headline}</h3>
                            <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed line-clamp-3">{story.summary}</p>
                          </div>
                          <div className="flex items-center justify-between gap-2 border-t border-zinc-100 dark:border-white/5 pt-4 mt-5">
                            {story.body ? (
                              <button onClick={() => setSelectedStory(story)}
                                className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
                                <BookOpen size={12} /> Read Analysis
                              </button>
                            ) : <div />}
                            <a href={story.link} target="_blank" rel="noopener noreferrer"
                              className="p-1.5 rounded-lg bg-zinc-100 dark:bg-white/5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                              <ExternalLinkIcon size={14} />
                            </a>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  </div>
                )}

                {/* BRIEFS — Compact Feed */}
                {briefs.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                      <ChevronRight size={14} /> Briefs
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {briefs.map((story) => (
                        <div key={story.link} className="group p-5 rounded-2xl border border-zinc-200/60 dark:border-white/10 bg-white dark:bg-white/[0.02] hover:bg-zinc-50/50 dark:hover:bg-white/[0.04] transition-all duration-300">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">{cleanSource(story.source)}</span>
                          <h4 className="font-semibold text-sm leading-snug text-black dark:text-white group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors mb-2">{story.headline}</h4>
                          <p className="text-zinc-500 text-xs leading-relaxed line-clamp-2">{story.summary}</p>
                          <a href={story.link} target="_blank" rel="noopener noreferrer"
                            className="mt-3 flex items-center gap-1 text-[10px] font-bold text-zinc-400 hover:text-zinc-700 dark:hover:text-white uppercase tracking-wider transition-colors">
                            Source <ExternalLinkIcon size={10} />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

      </div>

      {/* Elite Footer */}
      <footer className="w-full mt-12 pb-6 border-t border-zinc-300/60 dark:border-white/10 pt-10 flex flex-col items-center">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-10 h-10 relative overflow-hidden rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm transition-transform hover:scale-105 duration-300">
             <Image src="/logo.png" alt="AI Newsroom Logo" fill sizes="40px" className="object-cover" />
          </div>
          <div className="flex flex-col items-center">
            <span className="font-black text-lg tracking-tighter text-zinc-900 dark:text-white">AI Newsroom</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-purple-600 dark:text-purple-400">Autonomous Edition</span>
          </div>
        </div>
        
        <div className="flex flex-col items-center gap-8">
          <a 
            href="https://github.com/samolubukun/Autonomous-Newsroom-Crew" 
            target="_blank" 
            rel="noopener noreferrer"
            className="group flex items-center gap-2.5 px-6 py-2.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-sm shadow-lg hover:scale-105 hover:shadow-xl transition-all duration-300"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-90"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.28 1.15-.28 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg>
            GitHub
          </a>
          
          <div className="flex flex-col items-center gap-2 text-center">
            <a 
              href="https://samuelolubukun.netlify.app/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs font-bold text-zinc-500 hover:text-[#00d2ff] transition-colors"
            >
              Developed by <span className="text-[#00d2ff] underline underline-offset-4 decoration-[#00d2ff]/40">Samuel Olubukun</span>
            </a>
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">© 2026 AI Newsroom</span>
          </div>
        </div>
      </footer>

      {/* Article Deep-Dive Modal */}
      <AnimatePresence>
        {selectedStory && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-10"
            onClick={() => setSelectedStory(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-white dark:bg-zinc-950 rounded-[2rem] p-8 md:p-12 shadow-2xl border border-zinc-200 dark:border-white/10 scrollbar-hide"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setSelectedStory(null)}
                className="absolute top-6 right-6 p-2 rounded-full bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/20 transition-colors">
                <X size={18} />
              </button>
              <div className="flex items-center gap-2 mb-5">
                {selectedStory.tier === 'lead' ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-600 text-white text-[10px] font-bold uppercase tracking-widest">
                    <Newspaper size={10} /> Lead Feature
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-widest">
                    Analytical Report
                  </span>
                )}
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{selectedStory.source}</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black leading-tight text-zinc-900 dark:text-white mb-6">{selectedStory.headline}</h2>
              <div className="prose prose-zinc dark:prose-invert prose-sm md:prose-base max-w-none">
                {selectedStory.body ? (
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({node, ...props}) => <h1 className="text-2xl font-black mt-8 mb-4 text-zinc-900 dark:text-white" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-8 mb-3 text-zinc-900 dark:text-white" {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-lg font-bold mt-6 mb-2 text-zinc-900 dark:text-white" {...props} />,
                      p: ({node, ...props}) => <p className="mb-4 text-zinc-700 dark:text-zinc-300 leading-relaxed" {...props} />,
                      blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-purple-500 pl-4 italic text-zinc-600 dark:text-zinc-400 my-6 bg-zinc-50 dark:bg-white/5 py-2 rounded-r-lg" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-2 text-zinc-700 dark:text-zinc-300" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-2 text-zinc-700 dark:text-zinc-300" {...props} />,
                      li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
                      strong: ({node, ...props}) => <strong className="font-bold text-zinc-900 dark:text-white" {...props} />,
                    }}
                  >
                    {selectedStory.body}
                  </ReactMarkdown>
                ) : <p className="text-zinc-500">Full article not yet written.</p>}
              </div>
              <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-white/10">
                <a href={selectedStory.link} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300 text-sm font-bold hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors">
                  <ExternalLinkIcon size={14} /> View Original Source
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
