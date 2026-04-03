"use client";

import * as React from "react";
import Image from "next/image";
import { Zap, Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function Navbar() {
	const [isRunning, setIsRunning] = useState(false);
	const router = useRouter();

	const handleRunPipeline = async () => {
		if (isRunning) return;
		
		setIsRunning(true);
		console.log("🚀 Starting Pipeline via Dashboard Trigger...");

		try {
			const response = await fetch("/api/run", { method: "GET" });
			const data = await response.json();
			
			if (data.success) {
				console.log("✅ Pipeline Finished Successfully:", data.message);
				// Delay a tiny bit to show success feel before refresh
				setTimeout(() => {
					router.refresh();
					setIsRunning(false);
				}, 1000);
			} else {
				console.error("❌ Pipeline Failed:", data.message);
				setIsRunning(false);
			}
		} catch (error) {
			console.error("❌ Network Error during Pipeline:", error);
			setIsRunning(false);
		}
	};

	return (
		<div className="flex justify-center w-full py-6 px-4">
			<nav className="pointer-events-auto flex flex-col md:flex-row items-center justify-between w-full max-w-7xl bg-[#0a0a0a]/70 backdrop-blur-xl border border-white/10 rounded-3xl md:rounded-[2rem] px-4 py-4 md:py-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-300 gap-4 md:gap-0">
				
				{/* Logo Section */}
				<div className="flex items-center gap-3 md:gap-4 pl-0 md:pl-2 w-full justify-center md:w-auto md:justify-start text-zinc-900 group">
					<div className="relative w-10 h-10 md:w-14 md:h-14 flex-shrink-0 overflow-hidden rounded-xl md:rounded-2xl border border-zinc-200/80 dark:border-white/10 shadow-sm bg-gradient-to-tr from-purple-500/10 to-blue-500/10 transition-transform group-hover:scale-105">
						<Image src="/logo.png" alt="AI Newsroom Logo" fill sizes="56px" className="object-cover" />
					</div>
					<div className="flex flex-col justify-center text-center md:text-left">
						<span className="font-extrabold text-2xl tracking-tight leading-none text-white mb-0.5 md:mb-1">AI Newsroom</span>
						<span className="text-[11px] font-bold uppercase tracking-widest text-purple-400">Autonomous Edition</span>
					</div>
				</div>

				{/* Actions Section */}
				<div className="flex items-center gap-4 w-full md:w-auto justify-center md:justify-end">
					<button 
						onClick={handleRunPipeline}
						disabled={isRunning}
						className={`group relative flex items-center justify-center gap-2.5 px-6 md:px-8 py-2.5 md:py-3 w-full md:w-auto rounded-full font-extrabold transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.15)] overflow-hidden border
							${isRunning 
								? "bg-zinc-800 text-purple-400 border-zinc-700 cursor-wait animate-pulse" 
								: "bg-white text-zinc-900 border-white hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_10px_30px_rgba(255,255,255,0.3)]"
							}`}
					>
						<div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
						
						{isRunning ? (
							<Loader2 size={16} className="relative z-10 animate-spin text-purple-400" />
						) : (
							<Zap size={16} className="relative z-10 text-zinc-900 group-hover:text-purple-600 group-hover:fill-purple-600 transition-all duration-300 drop-shadow-sm" />
						)}
						
						<span className="relative z-10 transition-colors duration-300 uppercase tracking-[0.2em] text-xs md:text-sm pr-0.5">
							{isRunning ? "Processing..." : "Run Pipeline"}
						</span>
					</button>
				</div>
			</nav>
		</div>
	);
}
