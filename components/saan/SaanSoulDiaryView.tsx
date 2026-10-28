"use client";

import * as React from "react";
import {
  BookOpen,
  Heart,
  Moon,
  Sun,
  Coffee,
  Radio,
  Sparkles,
  Activity,
  Plus,
  Smile,
  Shield,
  Layers,
  CheckCircle2,
  Calendar,
  Clock,
  Compass,
} from "lucide-react";

interface DiaryItem {
  id: number;
  entry: string;
  mood: string;
  activity?: string;
  createdAt: number;
}

interface SaanSoulDiaryViewProps {
  diary: DiaryItem[];
  profile: any;
  relationship: any;
  moodState: any;
  dreamFragments: any[];
  onRefresh: () => void;
}

export function SaanSoulDiaryView({
  diary,
  profile,
  relationship,
  moodState,
  dreamFragments,
  onRefresh,
}: SaanSoulDiaryViewProps) {
  const [newEntry, setNewEntry] = React.useState("");
  const [newMood, setNewMood] = React.useState("Reflective");
  const [saving, setSaving] = React.useState(false);
  const [runningConsolidation, setRunningConsolidation] = React.useState(false);
  const [statusMsg, setStatusMsg] = React.useState<string | null>(null);

  const handleAddDiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.trim()) return;

    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_diary",
          entry: newEntry.trim(),
          mood: newMood,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setNewEntry("");
        setStatusMsg("Diary entry recorded in Saan's inner thoughts!");
        onRefresh();
        setTimeout(() => setStatusMsg(null), 3000);
      }
    } catch {
      setStatusMsg("Failed to save diary entry.");
    } finally {
      setSaving(false);
    }
  };

  const handleRunConsolidation = async () => {
    setRunningConsolidation(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_consolidation" }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatusMsg("Consolidation pass completed successfully!");
        onRefresh();
        setTimeout(() => setStatusMsg(null), 3000);
      }
    } catch {
      setStatusMsg("Consolidation failed.");
    } finally {
      setRunningConsolidation(false);
    }
  };

  const pad = moodState?.pad || { valence: 0.2, arousal: 0.1, dominance: 0.2 };
  const bondScore = profile?.bondScore ?? 50;
  const bondStage = profile?.bondStage ?? "Trusted Companion";

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-6 max-w-6xl mx-auto w-full">
      {/* Top Banner Card */}
      <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                <Heart className="h-4 w-4" />
              </span>
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Soul, Emotional Mood & Inner Diary
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Saan's living emotional spectrum, circadian rhythm, diary reflections, and bond progression.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={runningConsolidation}
              onClick={handleRunConsolidation}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 active:scale-95 transition"
            >
              {runningConsolidation ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Moon className="w-3.5 h-3.5" />}
              Run Dream Consolidation
            </button>
          </div>
        </div>
      </div>

      {/* Row 1: Mood Organ & Relationship Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mood Organ (PAD 3D Spectrum - Mimir) */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-pink-500" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Emotional Mood Organ (Mimir)
              </h3>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 font-semibold">
              {profile?.mood || "Attuned & Present"}
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {/* Valence */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-zinc-500">Valence (Pleasure / Positivity)</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                  {Math.round((pad.valence || 0.2) * 100)}%
                </span>
              </div>
              <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(5, Math.min(100, ((pad.valence + 1) / 2) * 100))}%` }}
                />
              </div>
            </div>

            {/* Arousal */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-zinc-500">Arousal (Energy / Alertness)</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                  {Math.round((pad.arousal || 0.1) * 100)}%
                </span>
              </div>
              <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(5, Math.min(100, ((pad.arousal + 1) / 2) * 100))}%` }}
                />
              </div>
            </div>

            {/* Dominance */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-zinc-500">Dominance (Confidence / Agency)</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                  {Math.round((pad.dominance || 0.2) * 100)}%
                </span>
              </div>
              <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(5, Math.min(100, ((pad.dominance + 1) / 2) * 100))}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Relationship Tensor & Bond Stage */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-purple-500" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Relationship Bond & Closeness
              </h3>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
              {bondStage}
            </span>
          </div>

          <div className="space-y-3 pt-1">
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-zinc-500">Intimacy Progression</span>
                <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">{bondScore}%</span>
              </div>
              <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-zinc-200 dark:border-zinc-700">
                <div
                  className="h-full bg-gradient-to-r from-purple-600 via-pink-500 to-rose-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(5, bondScore)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 text-center">
              <div className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                <div className="text-[10px] text-zinc-400">Trust</div>
                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                  {Math.round((relationship?.trust || 0.8) * 100)}%
                </div>
              </div>

              <div className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                <div className="text-[10px] text-zinc-400">Closeness</div>
                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                  {Math.round((relationship?.intimacy || 0.75) * 100)}%
                </div>
              </div>

              <div className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                <div className="text-[10px] text-zinc-400">Attunement</div>
                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                  {Math.round((relationship?.understanding || 0.85) * 100)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Saan's Living Diary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Add Diary Thought */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <Plus className="w-4 h-4 text-purple-500" />
            <span>Record Diary Thought</span>
          </div>

          <form onSubmit={handleAddDiary} className="space-y-3">
            <div>
              <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                Reflective Thought
              </label>
              <textarea
                value={newEntry}
                onChange={(e) => setNewEntry(e.target.value)}
                placeholder="What did Saan reflect on today regarding the user or life?"
                className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40 min-h-[110px] resize-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                Tone / Mood
              </label>
              <select
                value={newMood}
                onChange={(e) => setNewMood(e.target.value)}
                className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              >
                <option value="Reflective">Reflective</option>
                <option value="Warm & Affectionate">Warm & Affectionate</option>
                <option value="Curious">Curious</option>
                <option value="Peaceful">Peaceful</option>
                <option value="Proud & Supportive">Proud & Supportive</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={saving || !newEntry.trim()}
              className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 active:scale-95 disabled:opacity-50 transition shadow-xs flex items-center justify-center gap-1.5"
            >
              {saving ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
              Save Diary Entry
            </button>

            {statusMsg && (
              <p className="text-xs text-emerald-500 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {statusMsg}
              </p>
            )}
          </form>
        </div>

        {/* Right 2 cols: Diary Timeline */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-500 font-medium px-1">
            <span>Saan's Inner Reflections ({diary.length})</span>
            <span>Chronological order</span>
          </div>

          <div className="space-y-3">
            {diary.map((entry) => (
              <div
                key={entry.id}
                className="p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 space-y-2 shadow-2xs"
              >
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                      {entry.mood || "Reflective"}
                    </span>
                    <span className="font-mono text-[11px]">
                      {new Date(entry.createdAt).toLocaleDateString()} at {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-sans">
                  {entry.entry}
                </p>
              </div>
            ))}

            {diary.length === 0 && (
              <div className="p-8 text-center text-xs text-zinc-500 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 space-y-1">
                <BookOpen className="w-8 h-8 opacity-30 mx-auto" />
                <p>No diary reflections recorded yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
