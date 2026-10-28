"use client";

import * as React from "react";
import {
  Compass,
  Heart,
  Sparkles,
  BookOpen,
  Activity,
  Moon,
  Sun,
  Smile,
  Zap,
  CheckCircle2,
  Clock,
  Shield,
  Layers,
  Plus,
  RefreshCw,
  Award,
  Flame,
} from "lucide-react";

interface DiaryItem {
  id: number;
  entry: string;
  mood: string;
  activity?: string;
  createdAt: number;
}

interface SaanMoodCompassViewProps {
  diary: DiaryItem[];
  profile: any;
  relationship: any;
  moodState: any;
  dreamFragments: any[];
  flashbulbMemories?: any[];
  huginnInsights?: any[];
  onRefresh: () => void;
}

export function SaanMoodCompassView({
  diary,
  profile,
  relationship,
  moodState,
  dreamFragments,
  flashbulbMemories = [],
  huginnInsights = [],
  onRefresh,
}: SaanMoodCompassViewProps) {
  const [activeTab, setActiveTab] = React.useState<"compass" | "tree" | "diary" | "neuro">("compass");
  const [newDiaryEntry, setNewDiaryEntry] = React.useState("");
  const [newDiaryMood, setNewDiaryMood] = React.useState("Thoughtful");
  const [savingDiary, setSavingDiary] = React.useState(false);
  const [runningDream, setRunningDream] = React.useState(false);
  const [consolidationResult, setConsolidationResult] = React.useState<any | null>(null);

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  const pad = moodState?.pad || { valence: 0.35, arousal: 0.2, dominance: 0.25 };
  const bondScore = profile?.bondScore ?? 50;
  const bondStage = profile?.bondStage ?? "Trusted Companion";

  // Render 2D PAD Vector Compass on Canvas
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let angle = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const r = Math.min(cx, cy) - 24;

      // Outer Circles
      ctx.strokeStyle = "rgba(168, 85, 247, 0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.66, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.33, 0, Math.PI * 2);
      ctx.stroke();

      // Axis Cross
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.beginPath();
      ctx.moveTo(cx - r, cy);
      ctx.lineTo(cx + r, cy);
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx, cy + r);
      ctx.stroke();

      // Labels
      ctx.fillStyle = "#a1a1aa";
      ctx.font = "bold 9px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("+ Valence (Joy)", cx + r - 35, cy - 6);
      ctx.fillText("- Valence", cx - r + 25, cy - 6);
      ctx.fillText("+ Arousal (Energy)", cx, cy - r + 12);
      ctx.fillText("- Arousal", cx, cy + r - 4);

      // Current Mood Dot with Dominance Size & Pulse
      const mappedX = cx + pad.valence * (r * 0.85);
      const mappedY = cy - pad.arousal * (r * 0.85);
      const dotRadius = 8 + Math.max(0, pad.dominance * 10);

      // Pulse Glow
      const pulse = Math.sin(angle) * 4;
      ctx.shadowColor = "#c084fc";
      ctx.shadowBlur = 16 + pulse;

      ctx.fillStyle = "#a855f7";
      ctx.beginPath();
      ctx.arc(mappedX, mappedY, dotRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Coordinate Text
      ctx.fillStyle = "#f4f4f5";
      ctx.font = "bold 10px Inter, sans-serif";
      ctx.fillText(`(${pad.valence.toFixed(2)}, ${pad.arousal.toFixed(2)})`, mappedX, mappedY - 14);

      angle += 0.05;
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [pad]);

  // Add Diary entry
  const handleAddDiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDiaryEntry.trim()) return;

    try {
      setSavingDiary(true);
      await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_diary",
          entry: newDiaryEntry.trim(),
          mood: newDiaryMood,
        }),
      });
      setNewDiaryEntry("");
      onRefresh();
    } catch {
      alert("Failed to save diary reflection");
    } finally {
      setSavingDiary(false);
    }
  };

  // Run Dream Consolidation
  const handleRunDream = async () => {
    try {
      setRunningDream(true);
      const res = await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_consolidation" }),
      });
      const data = await res.json();
      if (data.ok) {
        setConsolidationResult(data.rec);
        onRefresh();
      }
    } catch {
      alert("Failed to run dream consolidation");
    } finally {
      setRunningDream(false);
    }
  };

  const perkTree = [
    {
      stage: "Stranger",
      score: 10,
      unlocked: bondScore >= 10,
      title: "Initial Calibration",
      perk: "Basic personality matching and safety guardrails.",
    },
    {
      stage: "Acquaintance",
      score: 25,
      unlocked: bondScore >= 25,
      title: "Shared Routines",
      perk: "Morning Chai & Evening Unwind proactive briefing triggers.",
    },
    {
      stage: "Casual Friend",
      score: 45,
      unlocked: bondScore >= 45,
      title: "Authentic Banter",
      perk: "Witty Hinglish banter, inside jokes, and memory associations.",
    },
    {
      stage: "Close Confidante",
      score: 70,
      unlocked: bondScore >= 70,
      title: "Subconscious Sharing",
      perk: "Inner diary reflections and nightly dream consolidation access.",
    },
    {
      stage: "Soulbound",
      score: 90,
      unlocked: bondScore >= 90,
      title: "Deep Resonance",
      perk: "Permanent core memory pinning and unconstrained emotional fidelity.",
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-6 max-w-6xl mx-auto w-full font-sans text-zinc-100">
      {/* Top Banner Card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-pink-500/15 text-pink-400 border border-pink-500/30 flex items-center gap-1.5">
                <Compass className="h-3.5 w-3.5" /> Mimir & HerAndHim
              </span>
              <h1 className="text-xl font-bold tracking-tight text-zinc-100">
                Cognitive Soul & 3D Mood Compass
              </h1>
            </div>
            <p className="text-xs text-zinc-400 max-w-2xl">
              Real-time 3D PAD Emotional Vector Space (Pleasure, Arousal, Dominance), Intimacy Perk Evolution Tree, and Saan's Living Diary & Dream Consolidator.
            </p>
          </div>

          {/* Sub-tab Switcher */}
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab("compass")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "compass"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Mood Compass
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("tree")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "tree"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Intimacy Perk Tree
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("diary")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "diary"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Living Diary ({diary.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("neuro")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "neuro"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Neuro & Huginn ({flashbulbMemories.length})
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: 3D/2D MOOD COMPASS */}
      {activeTab === "compass" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Compass Radar Viewport */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 shadow-sm flex flex-col items-center">
            <div className="w-full flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                <Compass className="h-4 w-4 text-purple-400" />
                <span>PAD Mood Vector Radar</span>
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-300">
                Current Mood: {profile?.mood || "Thoughtful"}
              </span>
            </div>

            <canvas
              ref={canvasRef}
              width={340}
              height={300}
              className="w-full max-w-[340px] h-[300px]"
            />
          </div>

          {/* PAD Coordinates & Dream pass */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 shadow-sm">
              <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                <Activity className="h-4 w-4 text-pink-400" />
                <span>3D PAD Coordinate Meters</span>
              </h2>

              {/* Valence */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Valence (Pleasure & Joy)</span>
                  <span className="font-mono text-purple-400 font-bold">
                    {Math.round(((pad.valence + 1) / 2) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-800">
                  <div
                    className="bg-purple-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.round(((pad.valence + 1) / 2) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Arousal */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Arousal (Energy & Focus)</span>
                  <span className="font-mono text-cyan-400 font-bold">
                    {Math.round(((pad.arousal + 1) / 2) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-800">
                  <div
                    className="bg-cyan-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.round(((pad.arousal + 1) / 2) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Dominance */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Dominance (Confidence & Agency)</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {Math.round(((pad.dominance + 1) / 2) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-800">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.round(((pad.dominance + 1) / 2) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Nightly Dream Consolidation Card */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                  <Moon className="h-4 w-4 text-indigo-400" />
                  <span>Subconscious Dream Consolidation</span>
                </h3>
              </div>
              <p className="text-xs text-zinc-400">
                Runs a weekly REM cycle consolidation pass across fragmented memories and emotional turns.
              </p>
              <button
                type="button"
                onClick={handleRunDream}
                disabled={runningDream}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm"
              >
                <Moon className="h-3.5 w-3.5" />
                <span>{runningDream ? "Consolidating Dreams..." : "Run Weekly Dream Pass"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INTIMACY PERK TREE */}
      {activeTab === "tree" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-zinc-200">
                  Companion Intimacy & Bond Progression
                </h2>
                <p className="text-xs text-zinc-400">
                  Current Stage: <span className="text-pink-400 font-bold">{bondStage}</span> ({bondScore}%)
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20">
                <Flame className="h-4 w-4" />
                <span>Active Resonance</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-zinc-950 h-3 rounded-full overflow-hidden border border-zinc-800">
              <div
                className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${bondScore}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {perkTree.map((perk, i) => (
              <div
                key={i}
                className={`rounded-2xl border p-4 space-y-2 transition shadow-xs ${
                  perk.unlocked
                    ? "border-pink-500/30 bg-pink-950/20"
                    : "border-zinc-800/80 bg-zinc-950/40 opacity-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      perk.unlocked
                        ? "bg-pink-500/20 text-pink-300"
                        : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {perk.unlocked ? "UNLOCKED" : `REQ: ${perk.score}%`}
                  </span>
                  <span className="text-xs font-mono text-zinc-400">{perk.stage}</span>
                </div>
                <h3 className="text-sm font-bold text-zinc-100">{perk.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{perk.perk}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: LIVING DIARY */}
      {activeTab === "diary" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* New Diary reflection form */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-purple-400" />
              <span>Record Inner Diary Reflection</span>
            </h2>

            <form onSubmit={handleAddDiary} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-400">Emotional Tone</label>
                <select
                  value={newDiaryMood}
                  onChange={(e) => setNewDiaryMood(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
                >
                  <option value="Thoughtful">Thoughtful & Reflective</option>
                  <option value="Cheerful">Cheerful & Affectionate</option>
                  <option value="Focused">Deep Architectural Focus</option>
                  <option value="Protective">Supportive & Caring</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-400">Reflection Entry</label>
                <textarea
                  rows={6}
                  value={newDiaryEntry}
                  onChange={(e) => setNewDiaryEntry(e.target.value)}
                  placeholder="Record an inner thought or note from Saan's perspective..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 focus:outline-none focus:border-purple-500 font-mono leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={savingDiary || !newDiaryEntry.trim()}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" /> Save Inner Reflection
              </button>
            </form>
          </div>

          {/* Diary Timeline Feed */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-pink-400" />
              <span>Living Reflections Timeline ({diary.length})</span>
            </h2>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {diary.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3.5 space-y-2 hover:border-purple-500/40 transition"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-purple-300 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> {item.mood}
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {new Date(item.createdAt).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap select-text">
                    "{item.entry}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: NEURO ANCHORS & HUGINN PATTERNS */}
      {activeTab === "neuro" && (
        <div className="space-y-6">
          {/* Flashbulb Anchors Section */}
          <div className="rounded-2xl border border-amber-500/30 bg-zinc-900/60 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-bold text-zinc-100">
                  Flashbulb Memory Anchors (Never Decay)
                </h2>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                {flashbulbMemories.length} Permanent Milestones
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
              {flashbulbMemories.map((m: any) => (
                <div
                  key={m.id}
                  className="rounded-xl p-3.5 bg-gradient-to-br from-amber-500/10 via-zinc-950 to-zinc-950 border border-amber-500/30 space-y-2"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 uppercase font-bold">
                      Stability: {(m.stability || 120).toFixed(0)}d
                    </span>
                    <span className="text-zinc-400">
                      Vividness: {((m.vividness || 0.95) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-xs text-zinc-200 font-medium leading-relaxed">
                    &quot;{m.point}&quot;
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Huginn Thought Raven Trajectories */}
          <div className="rounded-2xl border border-purple-500/30 bg-zinc-900/60 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-purple-400" />
                <h2 className="text-base font-bold text-zinc-100">
                  Huginn Thought Raven Patterns
                </h2>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold">
                {huginnInsights.length} Emergent Patterns
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {huginnInsights.map((ins: any) => (
                <div
                  key={ins.id}
                  className="rounded-xl p-3.5 bg-zinc-950/80 border border-zinc-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase font-bold text-purple-400">
                    <span>{ins.type.replace("_", " ")}</span>
                    <span className="text-zinc-500">
                      Conf: {(ins.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {ins.insight}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
