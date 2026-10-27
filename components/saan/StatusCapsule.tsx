"use client";

import React, { useState } from "react";
import { Sparkles, Activity, Heart, Moon, Sun, Sunset, Zap } from "lucide-react";

export interface StatusCapsuleProps {
  moodLabel?: string;
  pad?: { valence: number; arousal: number; dominance: number };
  circadianPhase?: string;
  bondStage?: string;
  bondScore?: number;
  activityStatus?: string;
  onRefresh?: () => void;
}

export function StatusCapsule({
  moodLabel = "Balanced",
  pad = { valence: 0.1, arousal: 0.0, dominance: 0.2 },
  circadianPhase = "active",
  bondStage = "Companion",
  bondScore = 42,
  activityStatus = "online",
  onRefresh,
}: StatusCapsuleProps) {
  const [open, setOpen] = useState(false);

  // Circadian Icon selection
  const getPhaseIcon = () => {
    switch (circadianPhase.toLowerCase()) {
      case "morning":
      case "dawn":
        return <Sun className="w-3.5 h-3.5 text-amber-400" />;
      case "afternoon":
      case "peak":
        return <Zap className="w-3.5 h-3.5 text-yellow-400" />;
      case "evening":
      case "dusk":
        return <Sunset className="w-3.5 h-3.5 text-orange-400" />;
      case "night":
      case "dormant":
      case "sleep":
        return <Moon className="w-3.5 h-3.5 text-indigo-400" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-purple-400" />;
    }
  };

  // Activity pulse color
  const getStatusColor = () => {
    switch (activityStatus) {
      case "thinking":
        return "bg-amber-400 animate-pulse";
      case "speaking":
        return "bg-cyan-400 animate-ping";
      case "idle":
        return "bg-emerald-400";
      default:
        return "bg-emerald-400";
    }
  };

  return (
    <div className="relative inline-block text-xs select-none">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800/90 border border-zinc-800/80 backdrop-blur-md transition-all shadow-sm text-zinc-300 hover:text-white"
        title="Saan Consciousness Status"
      >
        <span className="relative flex h-2 w-2">
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${getStatusColor()}`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${getStatusColor()}`} />
        </span>

        <span className="flex items-center gap-1 font-medium">
          {getPhaseIcon()}
          <span className="capitalize">{moodLabel}</span>
        </span>

        <span className="text-zinc-600">|</span>

        <span className="flex items-center gap-1 text-zinc-400">
          <Heart className="w-3 h-3 text-rose-400 fill-rose-400/20" />
          <span>{bondStage}</span>
        </span>
      </button>

      {/* Expanded Consciousness Capsule Popover */}
      {open && (
        <div className="absolute left-0 mt-2 w-72 rounded-xl bg-zinc-950/95 border border-zinc-800/80 backdrop-blur-xl p-4 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60 mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              <span className="font-semibold text-zinc-200 text-sm">Saan Inner State</span>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-950/50 text-purple-300 border border-purple-800/40 capitalize">
              {circadianPhase}
            </span>
          </div>

          {/* PAD 3-Axis Coordinates */}
          <div className="space-y-2 mb-3">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-zinc-400">Valence (Pleasure)</span>
              <span className={`font-mono ${pad.valence >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {pad.valence > 0 ? `+${pad.valence.toFixed(2)}` : pad.valence.toFixed(2)}
              </span>
            </div>
            <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(0, Math.min(100, (pad.valence + 1) * 50))}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[11px]">
              <span className="text-zinc-400">Arousal (Energy)</span>
              <span className="font-mono text-amber-400">
                {pad.arousal > 0 ? `+${pad.arousal.toFixed(2)}` : pad.arousal.toFixed(2)}
              </span>
            </div>
            <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(0, Math.min(100, (pad.arousal + 1) * 50))}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[11px]">
              <span className="text-zinc-400">Dominance (Agency)</span>
              <span className="font-mono text-cyan-400">
                {pad.dominance > 0 ? `+${pad.dominance.toFixed(2)}` : pad.dominance.toFixed(2)}
              </span>
            </div>
            <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-cyan-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(0, Math.min(100, (pad.dominance + 1) * 50))}%` }}
              />
            </div>
          </div>

          {/* Bond Progress */}
          <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-400">
            <span>Attachment: <span className="text-zinc-200">{bondStage}</span></span>
            <span className="font-mono text-purple-400">{bondScore} pts</span>
          </div>
        </div>
      )}
    </div>
  );
}
