"use client";

import React, { useState, useEffect } from "react";
import {
  Mic,
  Languages,
  Sliders,
  Sparkles,
  RefreshCw,
  X,
  Thermometer,
  Play,
  Check,
} from "lucide-react";

interface AsrDecodingConfig {
  language: string;
  task: "transcribe" | "translate";
  temperatureCascade: number[];
  promptPrefix?: string;
  suppressNonSpeechTokens: boolean;
}

interface SaanWhisperAsrModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SaanWhisperAsrModal({
  isOpen,
  onClose,
}: SaanWhisperAsrModalProps) {
  const [activeTab, setActiveTab] = useState<"normalizer" | "decoding" | "fallback">("normalizer");
  const [loading, setLoading] = useState(false);

  // Normalizer state
  const [rawTranscript, setRawTranscript] = useState(
    "[laughter] Haan bilkul theek hai (applause), let us do this [cough] now! Ｈｅｌｌｏ [music]"
  );
  const [cleanedTranscript, setCleanedTranscript] = useState("");

  // Decoding config state
  const [selectedLang, setSelectedLang] = useState("hinglish");
  const [contextPrompt, setContextPrompt] = useState("Saan sovereign AI, conversation about tea and programming");
  const [config, setConfig] = useState<AsrDecodingConfig | null>(null);

  // Temperature fallback state
  const [currentTemp, setCurrentTemp] = useState<number>(0.0);
  const [repetitionDetected, setRepetitionDetected] = useState(true);
  const [logprob, setLogprob] = useState<number>(-0.45);
  const [fallbackResult, setFallbackResult] = useState<any>(null);

  const handleNormalize = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "normalize_whisper_transcript",
          transcript: rawTranscript,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setCleanedTranscript(data.normalized);
      }
    } catch (e) {
      console.error("Failed to normalize transcript", e);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "get_whisper_config",
          lang: selectedLang,
          prompt: contextPrompt,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setConfig(data.config);
      }
    } catch (e) {
      console.error("Failed to fetch decoding config", e);
    } finally {
      setLoading(false);
    }
  };

  const handleTestFallback = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "evaluate_whisper_temperature_fallback",
          currentTemperature: currentTemp,
          repetitionDetected,
          avgLogprob: logprob,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setFallbackResult(data);
        if (data.shouldFallback) {
          setCurrentTemp(data.nextTemperature);
        }
      }
    } catch (e) {
      console.error("Failed to evaluate fallback", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      handleNormalize();
      handleFetchConfig();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="relative w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl bg-zinc-950 border border-teal-500/30 shadow-2xl overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold tracking-tight text-white">
                  Whisper ASR Normalizer & Multilingual Engine
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Repo #38
                </span>
                <span className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-300 font-mono">
                  {selectedLang.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Non-speech audio cue stripping, Indic/Hinglish heuristics & decoding temperature cascade
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                handleNormalize();
                handleFetchConfig();
              }}
              disabled={loading}
              className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
              title="Refresh Whisper state"
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

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 px-6 pt-3 pb-2 border-b border-zinc-800/80 bg-zinc-900/40 text-xs">
          <button
            onClick={() => setActiveTab("normalizer")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === "normalizer"
                ? "bg-teal-600/20 text-teal-300 border border-teal-500/40"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Audio Cue Stripper</span>
          </button>
          <button
            onClick={() => setActiveTab("decoding")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === "decoding"
                ? "bg-teal-600/20 text-teal-300 border border-teal-500/40"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
            }`}
          >
            <Languages className="w-3.5 h-3.5" />
            <span>Hinglish & Multilingual Config</span>
          </button>
          <button
            onClick={() => setActiveTab("fallback")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === "fallback"
                ? "bg-teal-600/20 text-teal-300 border border-teal-500/40"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
            }`}
          >
            <Thermometer className="w-3.5 h-3.5" />
            <span>Temperature Cascade</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === "normalizer" && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">
                  Raw ASR Transcript (with bracketed sounds, applause, stutters)
                </label>
                <textarea
                  rows={3}
                  value={rawTranscript}
                  onChange={(e) => setRawTranscript(e.target.value)}
                  className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-zinc-200 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleNormalize}
                  disabled={loading}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold transition"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Clean & Normalize NFKC</span>
                </button>
              </div>

              {cleanedTranscript && (
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                  <span className="text-zinc-400 block font-semibold">Cleaned Spoken Dialogue:</span>
                  <p className="font-mono text-teal-300 text-sm leading-relaxed">
                    {cleanedTranscript}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "decoding" && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Target Language Preset</label>
                  <select
                    value={selectedLang}
                    onChange={(e) => {
                      setSelectedLang(e.target.value);
                      setTimeout(handleFetchConfig, 50);
                    }}
                    className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-teal-500 font-mono"
                  >
                    <option value="hinglish">Hinglish (Hindi code-switch)</option>
                    <option value="hi">Hindi (Devanagari)</option>
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="ja">Japanese</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Context Conditioning Prompt</label>
                  <input
                    type="text"
                    value={contextPrompt}
                    onChange={(e) => setContextPrompt(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {config && (
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3 font-mono">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
                      <span className="text-zinc-500 block text-[10px]">Resolved Lang Code</span>
                      <span className="text-teal-400 font-bold text-sm">{config.language}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
                      <span className="text-zinc-500 block text-[10px]">Task Type</span>
                      <span className="text-teal-400 font-bold text-sm">{config.task}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
                      <span className="text-zinc-500 block text-[10px]">Suppress Non-Speech</span>
                      <span className="text-teal-400 font-bold text-sm">
                        {config.suppressNonSpeechTokens ? "TRUE" : "FALSE"}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
                    <span className="text-zinc-500 block text-[10px] mb-1">Temperature Cascade</span>
                    <span className="text-zinc-300">[{config.temperatureCascade.join(", ")}]</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "fallback" && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Current Temperature</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={currentTemp}
                    onChange={(e) => setCurrentTemp(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Repetition Loop Detected</label>
                  <button
                    onClick={() => setRepetitionDetected(!repetitionDetected)}
                    className={`w-full p-2.5 rounded-xl border font-semibold transition ${
                      repetitionDetected
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        : "bg-zinc-900 text-zinc-400 border-zinc-800"
                    }`}
                  >
                    {repetitionDetected ? "REPETITION: YES" : "REPETITION: NO"}
                  </button>
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Avg Logprob Confidence</label>
                  <input
                    type="number"
                    step="0.1"
                    value={logprob}
                    onChange={(e) => setLogprob(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleTestFallback}
                  disabled={loading}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold transition"
                >
                  <Thermometer className="w-4 h-4" />
                  <span>Evaluate Fallback Step</span>
                </button>
              </div>

              {fallbackResult && (
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2 font-mono">
                  <div className="flex items-center space-x-3">
                    <span className="text-zinc-400">Fallback Triggered:</span>
                    <span
                      className={`font-bold ${
                        fallbackResult.shouldFallback ? "text-amber-400" : "text-zinc-400"
                      }`}
                    >
                      {fallbackResult.shouldFallback ? "YES" : "NO"}
                    </span>
                    <span className="text-zinc-500">|</span>
                    <span className="text-zinc-400">Next Temperature:</span>
                    <span className="text-teal-400 font-bold">{fallbackResult.nextTemperature}</span>
                  </div>
                  {fallbackResult.reason && (
                    <p className="text-xs text-amber-300/90">{fallbackResult.reason}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            <span>OpenAI Whisper & OpenVoiceOS Native Speech Heuristics Active</span>
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
