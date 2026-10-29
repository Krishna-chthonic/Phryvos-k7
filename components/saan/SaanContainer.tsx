"use client";

import * as React from "react";
import {
  Sparkles,
  BookOpen,
  Share2,
  Compass,
  Zap,
  Mic,
  PanelLeft,
  Volume2,
  VolumeX,
} from "lucide-react";
import { SaanStageChatView } from "./SaanStageChatView";
import { SaanPersonaStudioView } from "./SaanPersonaStudioView";
import { SaanKnowledgeGraphView } from "./SaanKnowledgeGraphView";
import { SaanMoodCompassView } from "./SaanMoodCompassView";
import { SaanActionInspectorView } from "./SaanActionInspectorView";
import { SaanSidebar } from "./SaanSidebar";
import { SaanLivingAvatar, type AvatarEmotion } from "./SaanLivingAvatar";
import { SaanAffectionBar } from "./SaanAffectionBar";

export type SaanStudioTab = "stage" | "persona" | "graph" | "soul" | "tools";

export function SaanContainer() {
  const [activeTab, setActiveTab] = React.useState<SaanStudioTab>("stage");
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [requestedModal, setRequestedModal] = React.useState<string | null>(null);
  const [avatarEmotion, setAvatarEmotion] = React.useState<AvatarEmotion>("neutral");

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
  const loreCount = soulData.lorebookEntries?.length ?? 0;
  const bondScore = soulData.profile?.bondScore ?? 65;
  const circadian = soulData.profile?.circadianState || "morning_chai";

  const handleOpenModalFromSidebar = (modalId: string) => {
    setRequestedModal(modalId);
    if (activeTab !== "stage") {
      setActiveTab("stage");
    }
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden bg-zinc-950 font-sans text-zinc-100 select-none relative">
      {/* Slideable Sidebar Drawer */}
      <SaanSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setIsSidebarOpen(false);
        }}
        loreCount={loreCount}
        memoryCount={memoryCount}
        bondScore={bondScore}
        openDeedsCount={soulData.openDeedsCount || 0}
        flashbulbCount={soulData.flashbulbMemories?.length || 0}
        huginnCount={soulData.huginnInsights?.length || 0}
        tokenBudget={soulData.tokenBudget}
        providerUsed={soulData.providerUsed || "Vault Cascade"}
        onOpenModal={handleOpenModalFromSidebar}
      />

      {/* BAR 1: TOP CLEAN HEADER BAR */}
      <header className="h-12 shrink-0 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between z-20">
        {/* Left Side: Sidebar Toggle & Branding */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-purple-900/40 text-zinc-300 hover:text-purple-200 border border-zinc-800 hover:border-purple-500/40 transition flex items-center gap-1.5 text-xs font-semibold"
            title="Toggle Sidebar Menu"
          >
            <PanelLeft className="w-4 h-4 text-purple-400" />
            <span className="hidden sm:inline">Menu</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-400 font-bold text-xs border border-purple-500/20 shadow-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Saan 50-Studio</span>
            </div>
            <span className="text-zinc-700 hidden sm:inline">|</span>
            <span className="text-xs text-zinc-400 font-medium hidden md:inline">
              Living Companion Matrix
            </span>
          </div>
        </div>

        {/* Right Side: Active Tab Indicator & Quick Stats */}
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-purple-300 font-mono font-medium">
            {activeTab === "stage" && "🎙️ Living Stage"}
            {activeTab === "persona" && "📚 Persona & Lore"}
            {activeTab === "graph" && "🕸️ Knowledge Graph"}
            {activeTab === "soul" && "🧭 Mood Compass"}
            {activeTab === "tools" && "⚡ Action & Vault"}
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-pink-500/20 text-pink-300 font-mono font-bold border border-pink-500/30">
            {bondScore}% Bond
          </span>
        </div>
      </header>

      {/* BAR 2: SUB-HEADER BAR WITH ONLY SAAN'S FACE / AVATAR */}
      <section className="shrink-0 border-b border-zinc-800/80 bg-zinc-950/90 py-2.5 px-4 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          {/* Saan's Face Avatar */}
          <div className="flex items-center gap-3">
            <SaanLivingAvatar
              emotion={avatarEmotion}
              isSpeaking={false}
              isListening={false}
              circadianState={circadian}
              bondStage={soulData.profile?.bondStage || "Soulbound"}
              bondScore={bondScore}
              onPoke={() => setAvatarEmotion("blush")}
              onHeadpat={() => setAvatarEmotion("blush")}
              onCheekPoke={() => setAvatarEmotion("curious")}
            />

            <div className="flex flex-col">
              <span className="text-xs font-bold text-purple-300 flex items-center gap-1">
                Saan Living Companion
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </span>
              <span className="text-[10px] text-zinc-400">
                {soulData.profile?.mood || "Affectionate"} • {circadian}
              </span>
            </div>
          </div>

          {/* Compact Affection Bar */}
          <div className="hidden sm:flex items-center gap-2">
            <SaanAffectionBar
              onTriggerAction={() => setAvatarEmotion("joy")}
              bondScore={bondScore}
            />
          </div>
        </div>
      </section>

      {/* MAIN STUDIO VIEWPORT */}
      <main className="flex-1 min-h-0 min-w-0 overflow-hidden relative">
        {activeTab === "stage" && (
          <SaanStageChatView
            profile={soulData.profile}
            starterChips={soulData.starterChips || []}
            deeds={soulData.deeds || []}
            openDeedsCount={soulData.openDeedsCount || 0}
            activeArcs={soulData.activeArcs || []}
            storyRecap={soulData.storyRecap}
            flashbulbMemories={soulData.flashbulbMemories || []}
            huginnInsights={soulData.huginnInsights || []}
            onRefreshSoul={refreshSoulData}
            onNavigateTab={(tab) => setActiveTab(tab)}
            requestedModal={requestedModal}
            onResetRequestedModal={() => setRequestedModal(null)}
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
            flashbulbMemories={soulData.flashbulbMemories || []}
            huginnInsights={soulData.huginnInsights || []}
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
