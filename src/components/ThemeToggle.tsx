"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";

export function ThemeToggle() {
	const { theme, setTheme, resolvedTheme } = useTheme();
	const [mounted, setMounted] = React.useState(false);

	React.useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return <div className="w-[104px] h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse border border-zinc-300 dark:border-white/10" />;
	}

	return (
		<div className="flex items-center p-1 rounded-full bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 relative shadow-inner">
			<button
				onClick={() => setTheme("system")}
				className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
					theme === "system" ? "text-zinc-900 dark:text-white" : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
				}`}
				aria-label="System theme"
			>
				<Monitor size={14} strokeWidth={2.5} />
			</button>
			<button
				onClick={() => setTheme("light")}
				className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
					theme === "light" ? "text-zinc-900 dark:text-white" : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
				}`}
				aria-label="Light theme"
			>
				<Sun size={14} strokeWidth={2.5} />
			</button>
			<button
				onClick={() => setTheme("dark")}
				className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
					theme === "dark" ? "text-zinc-900 dark:text-white" : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
				}`}
				aria-label="Dark theme"
			>
				<Moon size={14} strokeWidth={2.5} />
			</button>

			{/* Active Background Pill Animation */}
			<motion.div
				className="absolute top-1 left-1 bottom-1 w-8 rounded-full bg-white dark:bg-white/10 shadow-sm border border-zinc-200 dark:border-transparent"
				initial={false}
				animate={{
					x: theme === "system" ? 0 : theme === "light" ? 32 : 64,
				}}
				transition={{ type: "spring", stiffness: 400, damping: 25 }}
			/>
		</div>
	);
}
