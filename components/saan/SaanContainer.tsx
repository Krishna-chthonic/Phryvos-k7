"use client";

import * as React from "react";
import { MessageSquare, Brain, Sparkles, Zap, Heart, BookOpen, Shield } from "lucide-react";
import { SaanChat } from "./SaanChat";
import { SaanMemoryVaultView } from "./SaanMemoryVaultView";
import { SaanSoulDiaryView } from "./SaanSoulDiaryView";
import { SaanToolsAssistantView } from "./SaanToolsAssistantView";

export type SaanTab = "chat" | "memory" | "soul" | "tools";

export function SaanContainer() {
  const [activeTab, setActiveTab] = React.useState<SaanTab>("chat");
  const [soulData, setSoulData] = React.useState<any>({
    profile: null,
    relationship: null,
    moodState: null,
    memories: [],
    diary: [],
    personalDates: [],
    wishes: [],
    dreamFragments: [],
    recentTasks: [],
    upcomingEvents: [],
  });
  const [loading, setLoading] = React.useState(false);

  const refreshSoulData = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/saan/soul");
      const d = await res.json();
      if (d.ok) {
        setSoulData(d);
      }
    } catch (err) {
      console.error("Failed to load Saan soul data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refreshSoulData();
  }, [refreshSoulData]);

  // Support custom switch events or keyboard shortcuts if needed
  React.useEffect(() => {
    const handleSwitch = (e: CustomEvent<{ tab: SaanTab }>) => {
      if (e.detail?.tab) {
        setActiveTab(e.detail.tab);
      }
    };
    window.addEventListener("saan:switch-tab" as any, handleSwitch);
    return () => window.removeEventListener("saan:switch-tab" as any, handleSwitch);
  }, []);

  const memoryCount = soulData.memories?.length ?? 0;
  const diaryCount = soulData.diary?.length ?? 0;
  const wishesCount = soulData.wishes?.filter((w: any) => !w.fulfilled)?.length ?? 0;
  const datesCount = soulData.personalDates?.length ?? 0;

  return (
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden bg-white dark:bg-zinc-950 font-sans">
      {/* Top Unified Navigation Bar */}
      <header className="h-12 shrink-0 border-b border-zinc-200/80 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between z-20 select-none">
        {/* Left Branding */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold text-xs border border-purple-500/20 shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Saan</span>
          </div>
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium hidden md:inline">
            Living Companion & Memory Matrix
          </span>
        </div>

        {/* Center / Right View Switcher Segmented Control */}
        <div className="flex items-center gap-1 bg-zinc-100/90 dark:bg-zinc-900/90 p-1 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-inner">
          {/* Chat Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "chat"
                ? "bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm border border-zinc-200/60 dark:border-zinc-700/60"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>

          {/* Memory Vault Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("memory")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "memory"
                ? "bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm border border-zinc-200/60 dark:border-zinc-700/60"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Memory Vault</span>
            {memoryCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-purple-500/15 text-purple-600 dark:text-purple-300 font-mono">
                {memoryCount}
              </span>
            )}
          </button>

          {/* Soul & Mood Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("soul")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "soul"
                ? "bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm border border-zinc-200/60 dark:border-zinc-700/60"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Soul & Diary</span>
            {diaryCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-pink-500/15 text-pink-600 dark:text-pink-300 font-mono">
                {diaryCount}
              </span>
            )}
          </button>

          {/* Tools & Sovereign Backup Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("tools")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "tools"
                ? "bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-sm border border-zinc-200/60 dark:border-zinc-700/60"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Assistant & Tools</span>
            {(wishesCount > 0 || datesCount > 0) && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-300 font-mono">
                {wishesCount + datesCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 min-h-0 min-w-0 overflow-hidden relative">
        {activeTab === "chat" && (
          <SaanChat onNavigateTab={(tab) => setActiveTab(tab)} />
        )}
        {activeTab === "memory" && (
          <SaanMemoryVaultView
            memories={soulData.memories || []}
            onRefresh={refreshSoulData}
          />
        )}
        {activeTab === "soul" && (
          <SaanSoulDiaryView
            diary={soulData.diary || []}
            profile={soulData.profile}
            relationship={soulData.relationship}
            moodState={soulData.moodState}
            dreamFragments={soulData.dreamFragments || []}
            onRefresh={refreshSoulData}
          />
        )}
        {activeTab === "tools" && (
          <SaanToolsAssistantView
            personalDates={soulData.personalDates || []}
            wishes={soulData.wishes || []}
            recentTasks={soulData.recentTasks || []}
            upcomingEvents={soulData.upcomingEvents || []}
            onRefresh={refreshSoulData}
          />
        )}
      </main>
    </div>
  );
}
