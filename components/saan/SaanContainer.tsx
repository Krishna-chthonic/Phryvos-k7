"use client";

import * as React from "react";
import {
  Sparkles,
  MessageSquare,
  BookOpen,
  Share2,
  Compass,
  Zap,
  Mic,
  Activity,
  Sliders,
} from "lucide-react";
import { SaanStageChatView } from "./SaanStageChatView";
import { SaanPersonaStudioView } from "./SaanPersonaStudioView";
import { SaanKnowledgeGraphView } from "./SaanKnowledgeGraphView";
import { SaanMoodCompassView } from "./SaanMoodCompassView";
import { SaanActionInspectorView } from "./SaanActionInspectorView";

export type SaanStudioTab = "stage" | "persona" | "graph" | "soul" | "tools";

export function SaanContainer() {
  const [activeTab, setActiveTab] = React.useState<SaanStudioTab>("stage");
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
    starterChips: [],
    characterCard: null,
    authorsNote: null,
    coreMemory: null,
    lorebookEntries: [],
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

  const memoryCount = soulData.memories?.length ?? 0;
  const diaryCount = soulData.diary?.length ?? 0;
  const loreCount = soulData.lorebookEntries?.length ?? 0;
  const bondScore = soulData.profile?.bondScore ?? 50;

  return (
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden bg-zinc-950 font-sans text-zinc-100 select-none">
      {/* Universal 5-Pillar Studio Header Bar */}
      <header className="h-12 shrink-0 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between z-20">
        {/* Left Branding */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-400 font-bold text-xs border border-purple-500/20 shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Saan 50-Studio</span>
          </div>
          <span className="text-zinc-700 hidden sm:inline">|</span>
          <span className="text-xs text-zinc-400 font-medium hidden md:inline">
            Living Companion Matrix
          </span>
        </div>

        {/* Studio Switcher Segmented Control */}
        <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 shadow-inner overflow-x-auto">
          {/* 1. Living Stage & Chat */}
          <button
            type="button"
            onClick={() => setActiveTab("stage")}
            className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
              activeTab === "stage"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Living Stage</span>
          </button>

          {/* 2. Persona & Lorebook Studio */}
          <button
            type="button"
            onClick={() => setActiveTab("persona")}
            className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
              activeTab === "persona"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Persona & Lore</span>
            {loreCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-500/20 text-purple-300 font-mono">
                {loreCount}
              </span>
            )}
          </button>

          {/* 3. Knowledge Graph */}
          <button
            type="button"
            onClick={() => setActiveTab("graph")}
            className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
              activeTab === "graph"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Knowledge Graph</span>
            {memoryCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-500/20 text-purple-300 font-mono">
                {memoryCount}
              </span>
            )}
          </button>

          {/* 4. Soul & Mood Compass */}
          <button
            type="button"
            onClick={() => setActiveTab("soul")}
            className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
              activeTab === "soul"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Mood Compass</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-pink-500/20 text-pink-300 font-mono">
              {bondScore}%
            </span>
          </button>

          {/* 5. Autonomous Action & Vault */}
          <button
            type="button"
            onClick={() => setActiveTab("tools")}
            className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
              activeTab === "tools"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Action & Vault</span>
          </button>
        </div>
      </header>

      {/* Main Studio Viewport */}
      <main className="flex-1 min-h-0 min-w-0 overflow-hidden relative">
        {activeTab === "stage" && (
          <SaanStageChatView
            profile={soulData.profile}
            starterChips={soulData.starterChips || []}
            deeds={soulData.deeds || []}
            openDeedsCount={soulData.openDeedsCount || 0}
            activeArcs={soulData.activeArcs || []}
            storyRecap={soulData.storyRecap}
            onRefreshSoul={refreshSoulData}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}
        {activeTab === "persona" && (
          <SaanPersonaStudioView
            characterCard={soulData.characterCard}
            authorsNote={soulData.authorsNote}
            coreMemory={soulData.coreMemory}
            lorebookEntries={soulData.lorebookEntries || []}
            onRefresh={refreshSoulData}
          />
        )}
        {activeTab === "graph" && (
          <SaanKnowledgeGraphView
            memories={soulData.memories || []}
            onRefresh={refreshSoulData}
          />
        )}
        {activeTab === "soul" && (
          <SaanMoodCompassView
            diary={soulData.diary || []}
            profile={soulData.profile}
            relationship={soulData.relationship}
            moodState={soulData.moodState}
            dreamFragments={soulData.dreamFragments || []}
            onRefresh={refreshSoulData}
          />
        )}
        {activeTab === "tools" && (
          <SaanActionInspectorView
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
