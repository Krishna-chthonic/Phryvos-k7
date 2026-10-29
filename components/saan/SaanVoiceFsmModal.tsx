"use client";

import React, { useState, useEffect } from "react";
import {
  Mic,
  Headphones,
  Sparkles,
  Activity,
  Play,
  RefreshCw,
  X,
  Zap,
  Check,
  RotateCcw,
} from "lucide-react";

type VoiceState = "IDLE" | "LISTENING" | "THINKING" | "SPEAKING";

interface TurnTransitionResult {
  previousState: VoiceState;
  currentState: VoiceState;
  event: string;
  bargeInDetected: boolean;
  timestampMs: number;
}

interface SaanVoiceFsmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStateChange?: (state: VoiceState) => void;
}

export function SaanVoiceFsmModal({
  isOpen,
  onClose,
  onStateChange,
}: SaanVoiceFsmModalProps) {
  const [currentState, setCurrentState] = useState<VoiceState>("IDLE");
  const [lastTransition, setLastTransition] = useState<TurnTransitionResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Normalizer test
  const [rawText, setRawText] = useState("Um, I I like really think we should, uh, start building!");
  const [normalizedText, setNormalizedText] = useState("");

  const fetchState = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_voice_fsm_state" }),
      });
      const data = await res.json();
      if (data.ok) {
        setCurrentState(data.state);
        if (onStateChange) onStateChange(data.state);
      }
    } catch (e) {
      console.error("Failed to load Voice FSM state", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchState();
      handleNormalize();
    }
  }, [isOpen]);

  const handleTriggerEvent = async (event: string) => {
    try {
      setLoading(true);
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "trigger_voice_fsm_event", event }),
      });
      const data = await res.json();
      if (data.ok) {
        setCurrentState(data.currentState);
        setLastTransition(data.result);
        if (onStateChange) onStateChange(data.currentState);
      }
    } catch (e) {
      console.error("Failed to trigger FSM event", e);
    } finally {
      setLoading(false);
    }
  };

  const handleNormalize = async () => {
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "normalize_spoken_utterance",
          text: rawText,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setNormalizedText(data.normalized);
      }
    } catch (e) {
      console.error("Failed to normalize utterance", e);
    }
  };

  if (!isOpen) return null;

  const STATES: VoiceState[] = ["IDLE", "LISTENING", "THINKING", "SPEAKING"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="relative w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl bg-zinc-950 border border-amber-500/30 shadow-2xl overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold tracking-tight text-white">
                  Voice Turn-Taking FSM & Spoken Normalizer
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Repo #37
                </span>
                <span className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-300 font-mono">
                  State: {currentState}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                LiveKit Agents conversational state machine with OVOS Core speech disfluency scrubbing
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchState}
              disabled={loading}
              className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
              title="Refresh FSM state"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* FSM State Nodes Diagram */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Conversational Turn-Taking Lifecycle
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {STATES.map((st) => {
                const isActive = currentState === st;
                return (
                  <div
                    key={st}
                    className={`relative p-4 rounded-xl border text-center transition flex flex-col items-center justify-center space-y-1 ${
                      isActive
                        ? "bg-amber-950/40 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.25)]"
                        : "bg-zinc-900/60 border-zinc-800 opacity-60"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 animate-ping" />
                    )}
                    <span className="text-xs font-mono font-bold tracking-wider text-white">
                      {st}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {st === "IDLE" && "Awaiting speech"}
                      {st === "LISTENING" && "VAD capturing"}
                      {st === "THINKING" && "Cognitive turn"}
                      {st === "SPEAKING" && "TTS stream active"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Event Triggers */}
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3 text-xs">
            <span className="font-semibold text-zinc-300 block">
              Simulate Turn-Taking Events & Barge-In
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleTriggerEvent("user_speech_start")}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-medium transition"
              >
                user_speech_start (VAD)
              </button>
              <button
                onClick={() => handleTriggerEvent("user_speech_end")}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 font-medium transition"
              >
                user_speech_end (Silence)
              </button>
              <button
                onClick={() => handleTriggerEvent("llm_response_ready")}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 font-medium transition"
              >
                llm_response_ready
              </button>
              <button
                onClick={() => handleTriggerEvent("bot_speech_end")}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-medium transition"
              >
                bot_speech_end
              </button>
              <button
                onClick={() => handleTriggerEvent("force_reset")}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
              >
                force_reset
              </button>
            </div>

            {lastTransition && (
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 font-mono text-zinc-300">
                <div className="flex items-center space-x-2">
                  <span className="text-zinc-500">Transition:</span>
                  <span className="text-amber-400 font-bold">{lastTransition.previousState}</span>
                  <span className="text-zinc-600">→</span>
                  <span className="text-amber-300 font-bold">{lastTransition.currentState}</span>
                  <span className="text-zinc-500">via</span>
                  <span className="text-cyan-400">{lastTransition.event}</span>
                </div>
                {lastTransition.bargeInDetected && (
                  <span className="mt-1 inline-block px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                    ⚡ BARGE-IN DETECTED: BOT SPEECH CANCELLED
                  </span>
                )}
              </div>
            )}
          </div>

          {/* OVOS Core Speech Disfluency Normalizer Playground */}
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-zinc-300">
                OVOS Core Spoken Utterance Normalizer (Stutter & Filler Scrubbing)
              </span>
              <button
                onClick={handleNormalize}
                className="flex items-center space-x-1 px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Clean Utterance</span>
              </button>
            </div>

            <textarea
              rows={2}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-zinc-200 focus:outline-none focus:border-amber-500"
              placeholder="Spoken text with stutters or fillers..."
            />

            {normalizedText && (
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
                <span className="text-zinc-500 block mb-1">Clean Normalized Result:</span>
                <p className="font-mono text-amber-300 font-medium">{normalizedText}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Deterministic Microsecond Turn Transitions Active</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
