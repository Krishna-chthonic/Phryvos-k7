"use client";

import * as React from "react";
import { Brain, Heart, ChevronDown, ChevronUp, Sparkles, Clock } from "lucide-react";

interface SaanWorkingMemoryCapsuleProps {
  workingMemoryText?: string;
  moodLabel?: string;
  circadianLabel?: string;
  activeMemoriesCount?: number;
  onOpenMemoryVault?: () => void;
  className?: string;
}

export function SaanWorkingMemoryCapsule({
  workingMemoryText = "Krishna is developing sovereign K7 OS, loves masala chai, prefers concise deep code.",
  moodLabel = "Affectionate & Attentive",
  circadianLabel = "Morning Chai",
  activeMemoriesCount = 12,
  onOpenMemoryVault,
  className = "",
}: SaanWorkingMemoryCapsuleProps) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div
      className={`max-w-4xl mx-auto w-full px-2 sm:px-4 py-1 select-none transition-all ${className}`}
    >
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md px-3 py-1.5 flex flex-col gap-1 shadow-sm">
        <div className="flex items-center justify-between gap-2 text-xs">
          {/* Memory Pill & Recall Status */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-purple-400 shrink-0">
              <Brain className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Active Context:</span>
            </span>

            <p className="text-[11px] text-zinc-300 truncate font-sans">
              {workingMemoryText}
            </p>
          </div>

          {/* Quick Toggle / Meta */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20 font-medium">
              <Heart className="w-2.5 h-2.5 fill-pink-400" />
              <span>{moodLabel}</span>
            </span>

            <button
              type="button"
              onClick={() => setExpanded((p) => !p)}
              className="text-zinc-400 hover:text-zinc-200 p-0.5 rounded transition"
              title="Expand cognitive details"
            >
              {expanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Expanded Cognitive Context Card */}
        {expanded && (
          <div className="pt-2 mt-1 border-t border-zinc-800/80 text-[11px] text-zinc-400 space-y-1.5 font-mono">
            <div className="flex items-center justify-between">
              <span>Bi-Temporal Active Recall: {activeMemoriesCount} memories</span>
              <button
                type="button"
                onClick={onOpenMemoryVault}
                className="text-purple-400 hover:text-purple-300 underline font-sans text-xs"
              >
                Inspect Knowledge Graph →
              </button>
            </div>
            <p className="text-zinc-300 font-sans leading-relaxed">
              &quot;{workingMemoryText}&quot;
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
