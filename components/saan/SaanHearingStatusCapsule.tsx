"use client";

import * as React from "react";
import { Mic, MicOff, Volume2, Sparkles, Brain, Radio, Activity } from "lucide-react";

export type HearingState = "idle" | "listening" | "transcribing" | "thinking" | "speaking";

interface SaanHearingStatusCapsuleProps {
  state?: HearingState;
  isListening?: boolean;
  isSpeaking?: boolean;
  audioLevel?: number; // 0 to 100
  onToggleMic?: () => void;
  className?: string;
}

export function SaanHearingStatusCapsule({
  state = "idle",
  isListening = false,
  isSpeaking = false,
  audioLevel = 0,
  onToggleMic,
  className = "",
}: SaanHearingStatusCapsuleProps) {
  // Determine computed state
  const computedState: HearingState = isSpeaking
    ? "speaking"
    : isListening
    ? audioLevel > 15
      ? "transcribing"
      : "listening"
    : state;

  const getStateMeta = () => {
    switch (computedState) {
      case "listening":
        return {
          label: "Hearing & Listening",
          color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
          dotColor: "bg-emerald-400",
          icon: Mic,
        };
      case "transcribing":
        return {
          label: "Transcribing Voice",
          color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
          dotColor: "bg-cyan-400 animate-ping",
          icon: Activity,
        };
      case "thinking":
        return {
          label: "Reasoning & Cognitive Synthesis",
          color: "text-purple-400 bg-purple-500/10 border-purple-500/30",
          dotColor: "bg-purple-400 animate-pulse",
          icon: Brain,
        };
      case "speaking":
        return {
          label: "Synthesizing Speech (Natural AST)",
          color: "text-pink-400 bg-pink-500/10 border-pink-500/30",
          dotColor: "bg-pink-400 animate-pulse",
          icon: Volume2,
        };
      default:
        return {
          label: "Living Ambient Presence",
          color: "text-zinc-400 bg-zinc-900/80 border-zinc-800",
          dotColor: "bg-zinc-500",
          icon: Radio,
        };
    }
  };

  const meta = getStateMeta();
  const Icon = meta.icon;

  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      {/* Outer Status Capsule */}
      <div
        className={`px-2.5 py-1 rounded-xl text-xs font-medium border flex items-center gap-2 transition-all duration-300 shadow-xs backdrop-blur-md ${meta.color}`}
      >
        <span className={`w-2 h-2 rounded-full ${meta.dotColor}`} />
        <Icon className="w-3.5 h-3.5" />
        <span className="font-semibold tracking-tight">{meta.label}</span>

        {/* Live Mic Sensitivity VU Meter bars */}
        {isListening && (
          <div className="flex items-center gap-0.5 ml-1 h-3.5">
            {[0.3, 0.6, 1.0, 0.7, 0.4].map((multiplier, i) => {
              const barHeight = Math.max(3, Math.min(14, (audioLevel / 100) * 14 * multiplier + Math.random() * 2));
              return (
                <div
                  key={i}
                  className="w-0.5 rounded-full bg-emerald-400 transition-all duration-75"
                  style={{ height: `${barHeight}px` }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Mic Push-to-Talk Toggle */}
      <button
        type="button"
        onClick={onToggleMic}
        className={`p-1.5 rounded-xl border transition active:scale-95 ${
          isListening
            ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20 shadow-md animate-pulse"
            : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:bg-zinc-800"
        }`}
        title={isListening ? "Listening... click to stop" : "Start Voice Input"}
      >
        {isListening ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
