"use client";

import React, { useState, useEffect } from "react";
import {
  Music,
  Clock,
  Sliders,
  Sparkles,
  RefreshCw,
  X,
  Volume2,
  Play,
  Check,
  Split,
  Sun,
  Moon,
  Sunset,
  Sunrise,
} from "lucide-react";

interface CadenceSettings {
  speed: number;
  periodPauseMs: number;
  commaPauseMs: number;
  tone: "energetic" | "focused" | "warm" | "gentle";
  timeSlot: "morning" | "day" | "evening" | "night";
}

interface SentencePacing {
  index: number;
  text: string;
  pauseAfterMs: number;
  speed: number;
}

interface SaanKokoroCadenceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SaanKokoroCadenceModal({
  isOpen,
  onClose,
}: SaanKokoroCadenceModalProps) {
  const [activeTab, setActiveTab] = useState<"circadian" | "splitter">("circadian");
  const [loading, setLoading] = useState(false);
  const [hourOfDay, setHourOfDay] = useState<number>(new Date().getHours());
  const [settings, setSettings] = useState<CadenceSettings | null>(null);

  // Splitter & Cadence test state
  const [sampleText, setSampleText] = useState<string>(
    'Good morning! Dr. Sharma confirmed that at 9:30 a.m. we meet. "Are you ready? Let us begin!" she smiled warmly.'
  );
  const [pacingResult, setPacingResult] = useState<{
    settings: CadenceSettings;
    sentenceCount: number;
    sentences: SentencePacing[];
  } | null>(null);

  const fetchCadenceSettings = async (hour: number) => {
    try {
      setLoading(true);
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "get_cadence_settings",
          hourOfDay: hour,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSettings(data.settings);
      }
    } catch (e) {
      console.error("Failed to fetch cadence settings", e);
    } finally {
      setLoading(false);
    }
  };

  const handlePaceText = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "pace_text_cadence",
          text: sampleText,
          hourOfDay: hourOfDay,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setPacingResult(data.result);
      }
    } catch (e) {
      console.error("Failed to pace text", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCadenceSettings(hourOfDay);
      handlePaceText();
    }
  }, [isOpen, hourOfDay]);

  if (!isOpen) return null;

  const getSlotIcon = (slot: string) => {
    switch (slot) {
      case "morning":
        return <Sunrise className="w-5 h-5 text-amber-400" />;
      case "day":
        return <Sun className="w-5 h-5 text-yellow-400" />;
      case "evening":
        return <Sunset className="w-5 h-5 text-orange-400" />;
      case "night":
        return <Moon className="w-5 h-5 text-indigo-400" />;
      default:
        return <Clock className="w-5 h-5 text-purple-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#121216] border border-white/10 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/30">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-tr from-pink-500/20 to-purple-500/20 border border-pink-500/30 rounded-xl text-pink-400">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-white font-semibold text-lg">Kokoro TTS Cadence & Pacing</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                  Repo #39
                </span>
              </div>
              <p className="text-xs text-white/50">
                Circadian bio-rhythm prosody, AST nesting quote tracker, and micro-pause synthesis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-black/20 px-4">
          <button
            onClick={() => setActiveTab("circadian")}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === "circadian"
                ? "border-pink-500 text-pink-400"
                : "border-transparent text-white/60 hover:text-white"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Circadian Cadence Profiler</span>
          </button>
          <button
            onClick={() => setActiveTab("splitter")}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === "splitter"
                ? "border-pink-500 text-pink-400"
                : "border-transparent text-white/60 hover:text-white"
            }`}
          >
            <Split className="w-4 h-4" />
            <span>AST Sentence Splitter & Pause Lab</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-white/80">
          {/* Circadian Tab */}
          {activeTab === "circadian" && (
            <div className="space-y-6">
              {/* Hour-of-Day Slider */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-pink-400" />
                    <label className="text-xs font-semibold text-white/90">
                      Simulated Circadian Hour of Day:
                    </label>
                  </div>
                  <span className="text-xs font-mono font-bold text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded border border-pink-500/20">
                    {hourOfDay.toString().padStart(2, "0")}:00 ({hourOfDay >= 12 ? "PM" : "AM"})
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="23"
                  value={hourOfDay}
                  onChange={(e) => setHourOfDay(parseInt(e.target.value, 10))}
                  className="w-full accent-pink-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-white/40">
                  <span>00:00 (Night)</span>
                  <span>06:00 (Dawn)</span>
                  <span>12:00 (Noon)</span>
                  <span>18:00 (Evening)</span>
                  <span>23:00 (Midnight)</span>
                </div>
              </div>

              {/* Active Settings Cards */}
              {settings && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-white/50 text-xs">
                      <span>Time Slot</span>
                      {getSlotIcon(settings.timeSlot)}
                    </div>
                    <div className="mt-2 text-base font-semibold capitalize text-white">
                      {settings.timeSlot}
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-white/50 text-xs">
                      <span>Prosodic Tone</span>
                      <Sparkles className="w-4 h-4 text-pink-400" />
                    </div>
                    <div className="mt-2 text-base font-semibold capitalize text-pink-300">
                      {settings.tone}
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-white/50 text-xs">
                      <span>Speech Rate</span>
                      <Sliders className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="mt-2 text-base font-mono font-semibold text-emerald-300">
                      {settings.speed.toFixed(2)}x
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-white/50 text-xs">
                      <span>Period Pause</span>
                      <Volume2 className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="mt-2 text-base font-mono font-semibold text-cyan-300">
                      {settings.periodPauseMs} ms
                    </div>
                  </div>
                </div>
              )}

              {/* Circadian Presets Reference */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                  Saan Adaptive Circadian Slots
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                    <div className="flex items-center justify-between font-semibold text-amber-300">
                      <span className="flex items-center space-x-1.5">
                        <Sunrise className="w-3.5 h-3.5" />
                        <span>Morning (05:00 - 08:59)</span>
                      </span>
                      <span>1.10x Speed</span>
                    </div>
                    <p className="text-[11px] text-white/60 mt-1">
                      Crisp, energetic waking prosody, 180ms period pause, 80ms comma cadence.
                    </p>
                  </div>

                  <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                    <div className="flex items-center justify-between font-semibold text-yellow-300">
                      <span className="flex items-center space-x-1.5">
                        <Sun className="w-3.5 h-3.5" />
                        <span>Workday (09:00 - 17:59)</span>
                      </span>
                      <span>1.00x Speed</span>
                    </div>
                    <p className="text-[11px] text-white/60 mt-1">
                      Focused, precise, standard companion cadence, 240ms period pause, 110ms comma.
                    </p>
                  </div>

                  <div className="p-3 bg-orange-500/5 border border-orange-500/20 rounded-lg">
                    <div className="flex items-center justify-between font-semibold text-orange-300">
                      <span className="flex items-center space-x-1.5">
                        <Sunset className="w-3.5 h-3.5" />
                        <span>Evening (18:00 - 21:59)</span>
                      </span>
                      <span>0.95x Speed</span>
                    </div>
                    <p className="text-[11px] text-white/60 mt-1">
                      Warm, reflective, unhurried companionship, 360ms period pause, 160ms comma.
                    </p>
                  </div>

                  <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-lg">
                    <div className="flex items-center justify-between font-semibold text-indigo-300">
                      <span className="flex items-center space-x-1.5">
                        <Moon className="w-3.5 h-3.5" />
                        <span>Late Night (22:00 - 04:59)</span>
                      </span>
                      <span>0.88x Speed</span>
                    </div>
                    <p className="text-[11px] text-white/60 mt-1">
                      Soft, hushed, gentle whispering prosody, 500ms period pause, 220ms comma.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Splitter Tab */}
          {activeTab === "splitter" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-white/80 block mb-1">
                  Test Text Input (Supports Abbreviations, Quotes & Punctuation):
                </label>
                <textarea
                  value={sampleText}
                  onChange={(e) => setSampleText(e.target.value)}
                  rows={3}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-pink-500 transition-colors font-mono"
                  placeholder="Enter text with quotes or abbreviations..."
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handlePaceText}
                  disabled={loading}
                  className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all shadow-md shadow-pink-500/20 disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  <span>Run Kokoro Text Splitter</span>
                </button>
              </div>

              {pacingResult && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white/70">
                      Split Segments ({pacingResult.sentenceCount} sentence{pacingResult.sentenceCount !== 1 ? "s" : ""}):
                    </span>
                    <span className="text-xs text-pink-400 font-mono">
                      Tone: {pacingResult.settings.tone} ({pacingResult.settings.speed}x)
                    </span>
                  </div>

                  <div className="space-y-2">
                    {pacingResult.sentences.map((sentence) => (
                      <div
                        key={sentence.index}
                        className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-start justify-between space-x-3"
                      >
                        <div className="flex items-start space-x-2 flex-1">
                          <span className="px-1.5 py-0.5 bg-white/10 rounded text-[10px] font-mono text-white/60">
                            #{sentence.index + 1}
                          </span>
                          <span className="text-xs text-white leading-relaxed">
                            {sentence.text}
                          </span>
                        </div>
                        {sentence.pauseAfterMs > 0 && (
                          <div className="flex items-center space-x-1 text-[11px] text-cyan-400 font-mono whitespace-nowrap bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                            <Clock className="w-3 h-3" />
                            <span>+{sentence.pauseAfterMs}ms</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-black/30 flex justify-between items-center text-xs text-white/40">
          <span>Clean-room AST Nesting & Circadian Prosody • Kokoro (dfb907a)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
