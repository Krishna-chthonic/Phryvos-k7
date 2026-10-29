"use client";

import * as React from "react";
import {
  X,
  Sparkles,
  Mic,
  BookOpen,
  Share2,
  Compass,
  Zap,
  Flame,
  Brain,
  BookmarkCheck,
  Film,
  Timer,
  Download,
  Upload,
  ShieldCheck,
  Network,
  GitBranch,
  Layers,
  Briefcase,
  Clock,
  UserCheck,
  Inbox,
  HardDriveDownload,
  BrainCircuit,
  Activity,
  Wrench,
  Sun,
  Scale,
  Workflow,
  Lock,
  ShieldAlert,
  RotateCcw,
  Webhook,
  Globe,
  Target,
  EyeOff,
  Cpu,
  Music,
  Archive,
  PenTool,
  Crown,
  ChevronRight,
  Sliders,
} from "lucide-react";
import type { SaanStudioTab } from "./SaanContainer";

interface SaanSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: SaanStudioTab;
  onSelectTab: (tab: SaanStudioTab) => void;
  loreCount?: number;
  memoryCount?: number;
  bondScore?: number;
  openDeedsCount?: number;
  flashbulbCount?: number;
  huginnCount?: number;
  tokenBudget?: {
    inputTokens: number;
    maxContextTokens: number;
    wasPruned?: boolean;
  } | null;
  providerUsed?: string;
  coreMemPct?: number;
  mem0Count?: number;
  bufferedQueueCount?: number;
  pendingGateCount?: number;
  activeRetryCount?: number;
  activeHookCount?: number;
  blockedThreatCount?: number;
  pipecatQueueCount?: number;
  voiceFsmState?: string;
  onOpenModal: (modalId: string) => void;
  onExportCard?: () => void;
  onImportCard?: () => void;
  onNudgeBeat?: () => void;
}

export function SaanSidebar({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  loreCount = 0,
  memoryCount = 0,
  bondScore = 65,
  openDeedsCount = 0,
  flashbulbCount = 0,
  huginnCount = 0,
  tokenBudget,
  providerUsed = "Vault Cascade",
  coreMemPct = 25,
  mem0Count = 0,
  bufferedQueueCount = 0,
  pendingGateCount = 0,
  activeRetryCount = 0,
  activeHookCount = 0,
  blockedThreatCount = 0,
  pipecatQueueCount = 0,
  voiceFsmState = "IDLE",
  onOpenModal,
  onExportCard,
  onImportCard,
  onNudgeBeat,
}: SaanSidebarProps) {
  if (!isOpen) return null;

  const handleTabClick = (tab: SaanStudioTab) => {
    onSelectTab(tab);
  };

  const handleModalClick = (modalId: string) => {
    onOpenModal(modalId);
  };

  return (
    <>
      {/* Backdrop Overlay for mobile & desktop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out Sidebar Drawer */}
      <aside className="fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] bg-zinc-950/98 border-r border-zinc-800/90 shadow-2xl flex flex-col font-sans text-zinc-100 backdrop-blur-2xl transition-transform duration-300 ease-in-out select-none">
        {/* Drawer Header */}
        <div className="h-14 px-4 border-b border-zinc-800/80 flex items-center justify-between shrink-0 bg-zinc-900/60">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-400 font-bold text-xs border border-purple-500/20 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Saan Studio Menu</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition"
            title="Close Sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-5 custom-scrollbar">
          {/* SECTION 1: STUDIO NAVIGATION TABS */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-2">
              Studio Navigation
            </span>

            {/* Tab 1: Living Stage */}
            <button
              type="button"
              onClick={() => handleTabClick("stage")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "stage"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                  : "text-zinc-300 hover:text-white hover:bg-zinc-900/80"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Mic className="w-4 h-4 text-purple-300" />
                <span>Living Stage & Chat</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            </button>

            {/* Tab 2: Persona & Lore Studio */}
            <button
              type="button"
              onClick={() => handleTabClick("persona")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "persona"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                  : "text-zinc-300 hover:text-white hover:bg-zinc-900/80"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-purple-300" />
                <span>Persona & Lore Studio</span>
              </div>
              {loreCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/20 text-purple-200 font-mono font-bold">
                  {loreCount}
                </span>
              )}
            </button>

            {/* Tab 3: Knowledge Graph */}
            <button
              type="button"
              onClick={() => handleTabClick("graph")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "graph"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                  : "text-zinc-300 hover:text-white hover:bg-zinc-900/80"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Share2 className="w-4 h-4 text-purple-300" />
                <span>Knowledge Graph</span>
              </div>
              {memoryCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/20 text-purple-200 font-mono font-bold">
                  {memoryCount}
                </span>
              )}
            </button>

            {/* Tab 4: Mood Compass */}
            <button
              type="button"
              onClick={() => handleTabClick("soul")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "soul"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                  : "text-zinc-300 hover:text-white hover:bg-zinc-900/80"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Compass className="w-4 h-4 text-pink-300" />
                <span>Mood Compass</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-pink-500/20 text-pink-200 font-mono font-bold">
                {bondScore}%
              </span>
            </button>

            {/* Tab 5: Action & Vault */}
            <button
              type="button"
              onClick={() => handleTabClick("tools")}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "tools"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                  : "text-zinc-300 hover:text-white hover:bg-zinc-900/80"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-amber-300" />
                <span>Action & Vault</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            </button>
          </div>

          <hr className="border-zinc-800/80 my-2" />

          {/* SECTION 2: 50-REPO COMPANION TOOLS & INSPECTORS */}
          <div className="space-y-3">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-2">
              Companion AI Tools & Inspectors
            </span>

            {/* Group A: Mimir & Memory */}
            <div className="space-y-1 bg-zinc-900/40 p-2 rounded-xl border border-zinc-800/60">
              <span className="text-[10px] text-purple-400 font-semibold px-1">
                🧠 Mimir & Cognitive Memory
              </span>
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleModalClick("flashbulb")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-amber-500/10 text-amber-300 border border-zinc-800 hover:border-amber-500/30 transition text-left"
                >
                  <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">Flashbulb ({flashbulbCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModalClick("huginn")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-purple-500/10 text-purple-300 border border-zinc-800 hover:border-purple-500/30 transition text-left"
                >
                  <Brain className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="truncate">Huginn ({huginnCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModalClick("coreMem")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-purple-500/10 text-purple-300 border border-zinc-800 hover:border-purple-500/30 transition text-left"
                >
                  <Brain className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="truncate">CoreRAM ({coreMemPct}%)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModalClick("mem0")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-emerald-500/10 text-emerald-300 border border-zinc-800 hover:border-emerald-500/30 transition text-left"
                >
                  <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Mem0 ({mem0Count})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModalClick("graphiti")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-cyan-500/10 text-cyan-300 border border-zinc-800 hover:border-cyan-500/30 transition text-left"
                >
                  <GitBranch className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">Graphiti</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModalClick("cognify")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-purple-500/10 text-purple-300 border border-zinc-800 hover:border-purple-500/30 transition text-left"
                >
                  <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="truncate">Cognify</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModalClick("hindsight")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-amber-500/10 text-amber-300 border border-zinc-800 hover:border-amber-500/30 transition text-left"
                >
                  <Briefcase className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">Hindsight</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModalClick("timeTravel")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-sky-500/10 text-sky-300 border border-zinc-800 hover:border-sky-500/30 transition text-left"
                >
                  <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="truncate">Scrubber</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModalClick("summary")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-indigo-500/10 text-indigo-300 border border-zinc-800 hover:border-indigo-500/30 transition text-left"
                >
                  <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">Summary</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModalClick("profile")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-teal-500/10 text-teal-300 border border-zinc-800 hover:border-teal-500/30 transition text-left"
                >
                  <UserCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span className="truncate">Profile</span>
                </button>
              </div>
            </div>

            {/* Group B: Chronicler, Narrative & Pacing */}
            <div className="space-y-1 bg-zinc-900/40 p-2 rounded-xl border border-zinc-800/60">
              <span className="text-[10px] text-amber-400 font-semibold px-1">
                📜 Narrative & Pacing Engine
              </span>
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleModalClick("ledger")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-amber-500/10 text-amber-300 border border-zinc-800 hover:border-amber-500/30 transition text-left"
                >
                  <BookmarkCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">Promises ({openDeedsCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModalClick("recap")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-purple-500/10 text-purple-300 border border-zinc-800 hover:border-purple-500/30 transition text-left"
                >
                  <Film className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="truncate">Story Recap</span>
                </button>

                {onNudgeBeat && (
                  <button
                    type="button"
                    onClick={onNudgeBeat}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-cyan-500/10 text-cyan-300 border border-zinc-800 hover:border-cyan-500/30 transition text-left"
                  >
                    <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="truncate">Nudge Beat</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleModalClick("scratchpad")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-purple-500/10 text-purple-300 border border-zinc-800 hover:border-purple-500/30 transition text-left"
                >
                  <BrainCircuit className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="truncate">Scratchpad</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModalClick("actionTimeline")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-orange-500/10 text-orange-300 border border-zinc-800 hover:border-orange-500/30 transition text-left"
                >
                  <Activity className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <span className="truncate">Timeline</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModalClick("proactiveTrigger")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-amber-500/10 text-amber-300 border border-zinc-800 hover:border-amber-500/30 transition text-left"
                >
                  <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">Proactive</span>
                </button>
              </div>
            </div>

            {/* Group C: Audio, Voice & Prosody */}
            <div className="space-y-1 bg-zinc-900/40 p-2 rounded-xl border border-zinc-800/60">
              <span className="text-[10px] text-teal-400 font-semibold px-1">
                🎙️ Voice & Audio Stream
              </span>
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleModalClick("pipecat")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-yellow-500/10 text-yellow-300 border border-zinc-800 hover:border-yellow-500/30 transition text-left"
                >
                  <Zap className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                  <span className="truncate">Pipecat ({pipecatQueueCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModalClick("voiceFsm")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-amber-500/10 text-amber-300 border border-zinc-800 hover:border-amber-500/30 transition text-left"
                >
                  <Mic className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">VoiceFSM ({voiceFsmState})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModalClick("whisper")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-teal-500/10 text-teal-300 border border-zinc-800 hover:border-teal-500/30 transition text-left"
                >
                  <Mic className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span className="truncate">Whisper ASR</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModalClick("kokoro")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-pink-500/10 text-pink-300 border border-zinc-800 hover:border-pink-500/30 transition text-left"
                >
                  <Music className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                  <span className="truncate">Kokoro Cadence</span>
                </button>
              </div>
            </div>

            {/* Group D: System, Security & MCP */}
            <div className="space-y-1 bg-zinc-900/40 p-2 rounded-xl border border-zinc-800/60">
              <span className="text-[10px] text-cyan-400 font-semibold px-1">
                🛡️ Security, MCP & Network
              </span>
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleModalClick("securityFence")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-emerald-500/10 text-emerald-300 border border-zinc-800 hover:border-emerald-500/30 transition text-left"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Shield ({blockedThreatCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModalClick("mcp")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-violet-500/10 text-violet-300 border border-zinc-800 hover:border-violet-500/30 transition text-left"
                >
                  <Cpu className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  <span className="truncate">MCP Bridge</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModalClick("stealth")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-cyan-500/10 text-cyan-300 border border-zinc-800 hover:border-cyan-500/30 transition text-left"
                >
                  <EyeOff className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">Stealth</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModalClick("vaultBackup")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-amber-500/10 text-amber-300 border border-zinc-800 hover:border-amber-500/30 transition text-left"
                >
                  <Archive className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">Vault Backup</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModalClick("preflight")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-emerald-500/10 text-emerald-300 border border-zinc-800 hover:border-emerald-500/30 transition text-left"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Preflight</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModalClick("capstone")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition text-left font-bold"
                >
                  <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">Capstone</span>
                </button>
              </div>
            </div>

            {/* Group E: Persona, Cards & Import/Export */}
            <div className="space-y-1 bg-zinc-900/40 p-2 rounded-xl border border-zinc-800/60">
              <span className="text-[10px] text-emerald-400 font-semibold px-1">
                📇 Persona & Character Specs
              </span>
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {onExportCard && (
                  <button
                    type="button"
                    onClick={onExportCard}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition text-left"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">Export CCv2</span>
                  </button>
                )}

                {onImportCard && (
                  <button
                    type="button"
                    onClick={onImportCard}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition text-left"
                  >
                    <Upload className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="truncate">Import Card</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleModalClick("variables")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-purple-500/10 text-purple-300 border border-zinc-800 hover:border-purple-500/30 transition text-left font-mono font-bold"
                >
                  <span className="text-purple-400">{"{x}"}</span>
                  <span className="truncate">Vars</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModalClick("composerBus")}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-zinc-900 hover:bg-violet-500/10 text-violet-300 border border-zinc-800 hover:border-violet-500/30 transition text-left"
                >
                  <PenTool className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  <span className="truncate">ComposerBus</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-900/40 text-[11px] text-zinc-400 flex items-center justify-between">
          <span className="font-mono">Cascade: {providerUsed}</span>
          <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 font-semibold border border-purple-500/20">
            50-Studio v1.0
          </span>
        </div>
      </aside>
    </>
  );
}
