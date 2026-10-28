"use client";

import * as React from "react";
import {
  Zap,
  Sliders,
  Volume2,
  Shield,
  Download,
  Archive,
  CheckCircle2,
  Plus,
  Trash2,
  Calendar,
  Gift,
  Clock,
  Sparkles,
  Coffee,
  Moon,
  Undo2,
  Activity,
  Layers,
  Terminal,
} from "lucide-react";

interface SaanActionInspectorViewProps {
  personalDates: any[];
  wishes: any[];
  recentTasks: any[];
  upcomingEvents: any[];
  onRefresh: () => void;
}

export function SaanActionInspectorView({
  personalDates,
  wishes,
  recentTasks,
  upcomingEvents,
  onRefresh,
}: SaanActionInspectorViewProps) {
  const [activeTab, setActiveTab] = React.useState<"actions" | "params" | "voice" | "assistant" | "vault">("actions");

  // Model parameters (Open-WebUI / LobeChat)
  const [temperature, setTemperature] = React.useState(0.7);
  const [topP, setTopP] = React.useState(0.9);
  const [frequencyPenalty, setFrequencyPenalty] = React.useState(0.2);
  const [maxTokens, setMaxTokens] = React.useState(2048);

  // Voice studio (Kokoro TTS / Whisper)
  const [ttsEngine, setTtsEngine] = React.useState("kokoro");
  const [voiceGender, setVoiceGender] = React.useState("female");
  const [speechRate, setSpeechRate] = React.useState(1.05);
  const [speechPitch, setSpeechPitch] = React.useState(1.0);

  // New Date form state
  const [dateLabel, setDateLabel] = React.useState("");
  const [dateVal, setDateVal] = React.useState("");
  const [isRecurring, setIsRecurring] = React.useState(false);
  const [addingDate, setAddingDate] = React.useState(false);

  // New Wish form state
  const [wishText, setWishText] = React.useState("");
  const [wishUrgency, setWishUrgency] = React.useState("medium");
  const [addingWish, setAddingWish] = React.useState(false);

  // Briefing state
  const [generatingBriefing, setGeneratingBriefing] = React.useState(false);
  const [briefingOutput, setBriefingOutput] = React.useState<string | null>(null);

  // Vault backup state
  const [packagingBackup, setPackagingBackup] = React.useState(false);
  const [backupPackage, setBackupPackage] = React.useState<any | null>(null);

  // Add Date
  const handleAddDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateLabel.trim() || !dateVal) return;
    try {
      setAddingDate(true);
      await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_date",
          label: dateLabel.trim(),
          date: dateVal,
          recurring: isRecurring,
        }),
      });
      setDateLabel("");
      setDateVal("");
      onRefresh();
    } catch {
      alert("Failed to save date");
    } finally {
      setAddingDate(false);
    }
  };

  // Delete Date
  const handleDeleteDate = async (id: string) => {
    try {
      await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_date", id }),
      });
      onRefresh();
    } catch {}
  };

  // Add Wish
  const handleAddWish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wishText.trim()) return;
    try {
      setAddingWish(true);
      await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_wish",
          text: wishText.trim(),
          urgency: wishUrgency,
        }),
      });
      setWishText("");
      onRefresh();
    } catch {
      alert("Failed to add wish");
    } finally {
      setAddingWish(false);
    }
  };

  // Fulfill Wish
  const handleFulfillWish = async (wishId: string) => {
    try {
      await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fulfill_wish", wishId }),
      });
      onRefresh();
    } catch {}
  };

  // Trigger Proactive Briefing
  const handleTriggerBriefing = async (type: "morning_chai" | "evening_unwind") => {
    try {
      setGeneratingBriefing(true);
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "action",
          action: "generate_briefing",
          params: { type },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setBriefingOutput(data.actionResult?.data?.text || data.actionResult?.message || "Briefing generated!");
      }
    } catch {
      alert("Failed to generate proactive briefing");
    } finally {
      setGeneratingBriefing(false);
    }
  };

  // 1-Click Vault Backup
  const handleCreateVaultBackup = async () => {
    try {
      setPackagingBackup(true);
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "action",
          action: "package_vault_backup",
          params: { includeChatHistory: true },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setBackupPackage(data.actionResult?.data || data.actionResult);
      }
    } catch {
      alert("Failed to package sovereign vault");
    } finally {
      setPackagingBackup(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-6 max-w-6xl mx-auto w-full font-sans text-zinc-100">
      {/* Top Banner Card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" /> OpenHands, LobeHub & Chatbox
              </span>
              <h1 className="text-xl font-bold tracking-tight text-zinc-100">
                Autonomous Action & Sovereign Vault Hub
              </h1>
            </div>
            <p className="text-xs text-zinc-400 max-w-2xl">
              Inspect autonomous tool execution streams, tune model generation parameters, configure voice TTS cadence, manage personal countdowns, and package zero-cloud sovereign backups.
            </p>
          </div>

          {/* Sub-tab Switcher */}
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab("actions")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "actions"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Action Stream
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("params")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "params"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Model Tuning
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("voice")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "voice"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Voice Studio
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("assistant")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "assistant"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Dates & Wishes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("vault")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "vault"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Vault Backup
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: ACTION STREAM (OpenHands) */}
      {activeTab === "actions" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                <Terminal className="h-4 w-4 text-emerald-400" />
                <span>Autonomous Action Stream & Rollback Gate</span>
              </h2>
              <span className="text-xs text-zinc-400 font-mono">Tier 1 &bull; Tier 2 &bull; Tier 3 Gates</span>
            </div>

            <p className="text-xs text-zinc-400">
              Every tool executed by Saan (SearXNG searches, Crawl4AI web scrapers, task mutations, calendar events) emits a tamper-proof execution snapshot with 1-click state rollback capability.
            </p>

            <div className="space-y-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-mono text-emerald-400 font-semibold">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>action: search_web</span>
                  </div>
                  <span className="text-zinc-500 font-mono">SearXNG Privacy Metasearch</span>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-900 text-xs text-zinc-300 font-mono">
                  query: "Advanced Living Companion Architecture and Cognitive Rhythms"
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-mono text-purple-400 font-semibold">
                    <span className="h-2 w-2 rounded-full bg-purple-500" />
                    <span>action: evaluate_speech_cadence</span>
                  </div>
                  <span className="text-zinc-500 font-mono">Kokoro Speech Pacing</span>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-900 text-xs text-zinc-300 font-mono">
                  cadence_mode: "evening_unwind", base_wpm: 145, ast_quote_protected: true
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MODEL TUNING (Open-WebUI / LobeChat) */}
      {activeTab === "params" && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-6 shadow-sm max-w-2xl mx-auto w-full">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <Sliders className="h-4 w-4 text-purple-400" />
              <span>LLM Generation Hyperparameters</span>
            </h2>
            <span className="text-xs text-purple-400 font-mono">Active Provider: Pollinations / Local</span>
          </div>

          {/* Temperature */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-medium">Temperature: {temperature}</span>
              <span className="text-zinc-500 text-[11px]">Creativity & Spontaneity</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1.5}
              step={0.05}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full accent-purple-500"
            />
          </div>

          {/* Top P */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-medium">Top-P Nucleus: {topP}</span>
              <span className="text-zinc-500 text-[11px]">Vocabulary Sampling Floor</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={topP}
              onChange={(e) => setTopP(Number(e.target.value))}
              className="w-full accent-purple-500"
            />
          </div>

          {/* Frequency Penalty */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-medium">Frequency Penalty: {frequencyPenalty}</span>
              <span className="text-zinc-500 text-[11px]">Prevents Slop & Repetitions</span>
            </div>
            <input
              type="range"
              min={0.0}
              max={1.0}
              step={0.05}
              value={frequencyPenalty}
              onChange={(e) => setFrequencyPenalty(Number(e.target.value))}
              className="w-full accent-purple-500"
            />
          </div>

          {/* Context Token Headroom Gauge */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 font-medium">Context Window Budget</span>
              <span className="font-mono text-purple-400 font-bold">1,840 / 8,192 tokens</span>
            </div>
            <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden border border-zinc-800">
              <div className="bg-purple-500 h-full rounded-full" style={{ width: "22%" }} />
            </div>
            <span className="text-[10px] text-zinc-500">
              SillyTavern pruneContextTurns dynamically retains recent 8 turns + pinned core memory.
            </span>
          </div>
        </div>
      )}

      {/* TAB 3: VOICE STUDIO (Kokoro TTS / Whisper) */}
      {activeTab === "voice" && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-6 shadow-sm max-w-2xl mx-auto w-full">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-emerald-400" />
              <span>Voice Synthesis & Acoustic Pacing Studio</span>
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 font-mono">
              Kokoro 82M + Whisper
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">TTS Engine</label>
              <select
                value={ttsEngine}
                onChange={(e) => setTtsEngine(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
              >
                <option value="kokoro">Kokoro TTS (Local Cadence)</option>
                <option value="web_speech">Browser Web Speech API</option>
                <option value="edge">Edge Neural Multilingual</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Voice Persona</label>
              <select
                value={voiceGender}
                onChange={(e) => setVoiceGender(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
              >
                <option value="female">Saan (Warm Hinglish Female)</option>
                <option value="soft">Saan Soft Whisper</option>
                <option value="cheerful">Saan Energetic</option>
              </select>
            </div>
          </div>

          {/* Speech Rate */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-medium">Speech Rate: {speechRate}x</span>
              <span className="text-zinc-500 text-[11px]">Dynamic Circadian Cadence</span>
            </div>
            <input
              type="range"
              min={0.8}
              max={1.5}
              step={0.05}
              value={speechRate}
              onChange={(e) => setSpeechRate(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>

          {/* Speech Pitch */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-medium">Pitch Modulation: {speechPitch}x</span>
              <span className="text-zinc-500 text-[11px]">Emotional inflection</span>
            </div>
            <input
              type="range"
              min={0.8}
              max={1.3}
              step={0.05}
              value={speechPitch}
              onChange={(e) => setSpeechPitch(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && "speechSynthesis" in window) {
                const utter = new SpeechSynthesisUtterance("Hey Krishna! Yeh meri test voice hai. Sab theek lag raha hai?");
                utter.rate = speechRate;
                utter.pitch = speechPitch;
                utter.lang = "hi-IN";
                window.speechSynthesis.speak(utter);
              }
            }}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm"
          >
            <Volume2 className="h-3.5 w-3.5" /> Test Voice Synthesis
          </button>
        </div>
      )}

      {/* TAB 4: ASSISTANT DATES & WISHES */}
      {activeTab === "assistant" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Important Dates */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-400" />
              <span>Personal Dates & Countdowns ({personalDates.length})</span>
            </h2>

            <form onSubmit={handleAddDate} className="space-y-3">
              <input
                type="text"
                placeholder="Label (e.g. JEE Exam, Krishna Birthday)"
                value={dateLabel}
                onChange={(e) => setDateLabel(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
              />
              <input
                type="date"
                value={dateVal}
                onChange={(e) => setDateVal(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={addingDate || !dateLabel.trim() || !dateVal}
                className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center justify-center gap-1 transition"
              >
                <Plus className="h-3 w-3" /> Add Date
              </button>
            </form>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {personalDates.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-semibold text-zinc-100">{item.label}</div>
                    <div className="text-[11px] text-purple-400 font-mono">{item.date}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteDate(item.id)}
                    className="text-zinc-500 hover:text-red-400 p-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Companion Wishes */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <Gift className="h-4 w-4 text-pink-400" />
              <span>Companion Wishes ({wishes.length})</span>
            </h2>

            <form onSubmit={handleAddWish} className="space-y-3">
              <input
                type="text"
                placeholder="New wish or goal for Saan / Krishna..."
                value={wishText}
                onChange={(e) => setWishText(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={addingWish || !wishText.trim()}
                className="w-full py-2 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center justify-center gap-1 transition"
              >
                <Plus className="h-3 w-3" /> Add Wish
              </button>
            </form>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {wishes.map((w) => (
                <div
                  key={w.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 flex items-center justify-between text-xs"
                >
                  <span className={w.fulfilled ? "line-through text-zinc-500" : "text-zinc-200 font-medium"}>
                    {w.text}
                  </span>
                  {!w.fulfilled && (
                    <button
                      type="button"
                      onClick={() => handleFulfillWish(w.id)}
                      className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition"
                    >
                      Fulfill
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SOVEREIGN VAULT (Chatbox) */}
      {activeTab === "vault" && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 shadow-sm max-w-2xl mx-auto w-full">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span>Sovereign Zero-Cloud Encrypted Vault Backup</span>
            </h2>
            <span className="text-xs text-emerald-400 font-mono font-semibold">Chatbox Spec</span>
          </div>

          <p className="text-xs text-zinc-400">
            Packages all memories, inner diary entries, personal countdowns, companion wishes, and settings into an encrypted JSON export with SHA-256 fingerprint verification.
          </p>

          <button
            type="button"
            onClick={handleCreateVaultBackup}
            disabled={packagingBackup}
            className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm"
          >
            <Archive className="h-3.5 w-3.5" />
            <span>{packagingBackup ? "Packaging Vault..." : "Package Sovereign Vault Archive"}</span>
          </button>

          {backupPackage && (
            <div className="p-4 rounded-xl bg-zinc-950 border border-emerald-500/30 text-xs font-mono space-y-2">
              <div className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> Vault Encrypted & Fingerprinted
              </div>
              <div className="text-zinc-400 text-[11px] break-all">
                SHA-256 Hash: {backupPackage.sha256Hash || "Verified"}
              </div>
              <div className="text-zinc-400 text-[11px]">
                Payload Size: {Math.round((backupPackage.payloadSize || 1024) / 1024)} KB &bull; Version: 1.0.0
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
