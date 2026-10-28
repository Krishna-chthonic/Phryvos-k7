"use client";

import * as React from "react";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Layers,
  Sparkles,
  X,
  RefreshCw,
  Compass,
  ArrowRight,
  Zap,
} from "lucide-react";

export interface HuginnInsightItem {
  id: string;
  type: "sentiment_arc" | "recurring_theme" | "open_thread";
  entity?: string | null;
  insight: string;
  confidence: number;
  createdAt: number;
}

interface SaanHuginnRavenDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  insights: HuginnInsightItem[];
  onTriggerScan?: () => void;
  onFollowUp?: (topic: string) => void;
}

export function SaanHuginnRavenDashboard({
  isOpen,
  onClose,
  insights = [],
  onTriggerScan,
  onFollowUp,
}: SaanHuginnRavenDashboardProps) {
  const [scanning, setScanning] = React.useState(false);

  if (!isOpen) return null;

  const handleScanClick = async () => {
    setScanning(true);
    await onTriggerScan?.();
    setTimeout(() => setScanning(false), 800);
  };

  const sentimentArcs = insights.filter((i) => i.type === "sentiment_arc");
  const recurringThemes = insights.filter((i) => i.type === "recurring_theme");
  const openThreads = insights.filter((i) => i.type === "open_thread");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-zinc-950 border border-purple-500/40 p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 shadow-inner">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-zinc-100">
                  Huginn Thought Raven
                </h2>
                <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold uppercase">
                  Pattern Engine
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Emergent relationship trajectory arcs & cognitive recurring themes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleScanClick}
              disabled={scanning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-purple-300 border border-zinc-800 hover:border-purple-500/40 transition active:scale-95 disabled:opacity-40"
              title="Run on-demand cognitive pattern scan"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
              <span>{scanning ? "Scanning..." : "Rescan Patterns"}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Tabs / Sections */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {insights.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-xs space-y-1">
              <Sparkles className="w-8 h-8 mx-auto text-zinc-600" />
              <p>No emergent patterns detected yet.</p>
              <p className="text-[11px] text-zinc-600">
                As you chat and form memories, Huginn will automatically track warming trajectories and themes.
              </p>
            </div>
          ) : (
            <>
              {/* 1. Entity Sentiment Trajectory Arcs */}
              {sentimentArcs.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Relational Trajectories (Warming vs Cooling)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {sentimentArcs.map((arc) => {
                      const isWarming = arc.insight.toLowerCase().includes("warming");
                      return (
                        <div
                          key={arc.id}
                          className="rounded-xl p-3 bg-zinc-900/90 border border-zinc-800/90 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-zinc-200 capitalize">
                              {arc.entity || "Krishna"}
                            </span>
                            <span
                              className={`px-2 py-0.2 rounded-full text-[10px] font-mono font-bold uppercase flex items-center gap-1 ${
                                isWarming
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                  : "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                              }`}
                            >
                              {isWarming ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : (
                                <TrendingDown className="w-3 h-3" />
                              )}
                              <span>{isWarming ? "Warming" : "Cooling"}</span>
                            </span>
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                            {arc.insight}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. Recurring Theme Clusters */}
              {recurringThemes.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    <Layers className="w-3.5 h-3.5 text-purple-400" />
                    <span>Recurring Cognitive Themes (&ge; 3 Mentions)</span>
                  </div>
                  <div className="space-y-2">
                    {recurringThemes.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-xl p-3 bg-zinc-900/70 border border-zinc-800/80 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <span className="text-[10px] font-mono text-purple-400 uppercase font-bold">
                            Recurring Cluster
                          </span>
                          <p className="text-zinc-200 font-medium truncate">
                            {t.insight}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onFollowUp?.(t.insight);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-[11px] font-semibold flex items-center gap-1 shrink-0 transition"
                        >
                          <span>Explore</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Open Intentions & Unfinished Threads */}
              {openThreads.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Open Intentions & Unresolved Threads</span>
                  </div>
                  <div className="space-y-2">
                    {openThreads.map((th) => (
                      <div
                        key={th.id}
                        className="rounded-xl p-3 bg-amber-500/5 border border-amber-500/20 text-xs flex items-center justify-between gap-3"
                      >
                        <p className="text-zinc-300 leading-relaxed font-sans">
                          {th.insight}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            onFollowUp?.(th.insight);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-semibold shrink-0 transition"
                        >
                          Check In
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
