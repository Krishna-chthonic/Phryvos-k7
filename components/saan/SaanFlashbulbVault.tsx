"use client";

import * as React from "react";
import {
  Flame,
  Sparkles,
  X,
  Compass,
  Star,
  RotateCcw,
  RefreshCw,
  Check,
  Heart,
} from "lucide-react";

export interface FlashbulbMemory {
  id: number;
  point: string;
  category: string;
  importance: number;
  vividness: number;
  stability: number;
  isFlashbulb: boolean;
  isCherished: boolean;
  isReframed: boolean;
  reframeReason?: string;
  emotionPad?: [number, number, number];
  createdAt: number;
}

interface SaanFlashbulbVaultProps {
  isOpen: boolean;
  onClose: () => void;
  memories: FlashbulbMemory[];
  onRelive?: (memory: FlashbulbMemory) => void;
  onRefresh: () => void;
}

export function SaanFlashbulbVault({
  isOpen,
  onClose,
  memories = [],
  onRelive,
  onRefresh,
}: SaanFlashbulbVaultProps) {
  const [reframingId, setReframingId] = React.useState<number | null>(null);
  const [newEmotion, setNewEmotion] = React.useState("calm_confidence");
  const [reframeReason, setReframeReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  if (!isOpen) return null;

  const handleCherishToggle = async (id: number, currentCherished: boolean) => {
    try {
      await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: currentCherished ? "uncherish_memory" : "cherish_memory",
          id,
        }),
      });
      onRefresh();
    } catch (err) {
      console.error("Failed to toggle cherished state", err);
    }
  };

  const handleReframeSubmit = async (id: number) => {
    try {
      setSubmitting(true);
      await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reframe_memory",
          id,
          newEmotion,
          reason: reframeReason,
        }),
      });
      setReframingId(null);
      setReframeReason("");
      onRefresh();
    } catch (err) {
      console.error("Failed to reframe memory", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-zinc-950 border border-amber-500/30 p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-inner">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-zinc-100">
                  Flashbulb Memory Vault
                </h2>
                <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase">
                  Mimir Neuro Engine
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Permanent indelible emotional milestones that never decay
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500/10 via-purple-500/5 to-transparent border border-amber-500/20 text-xs text-zinc-300">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Memories with <strong>Importance &ge; 8</strong> receive permanent stability floor (120.0d) and 95% vividness.
            </span>
          </div>
          <span className="font-mono text-amber-300 font-bold text-[11px]">
            {memories.length} Anchors
          </span>
        </div>

        {/* Memory Grid */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {memories.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-xs space-y-1">
              <Flame className="w-8 h-8 mx-auto text-zinc-600" />
              <p>No Flashbulb memories recorded yet.</p>
              <p className="text-[11px] text-zinc-600">
                Deep milestones and heartfelt moments will automatically crystallize here.
              </p>
            </div>
          ) : (
            memories.map((m) => {
              const isReframing = reframingId === m.id;
              const pad = m.emotionPad || [0.5, 0.5, 0.5];

              return (
                <div
                  key={m.id}
                  className={`rounded-xl p-3.5 border transition-all duration-300 ${
                    m.isFlashbulb
                      ? "bg-gradient-to-br from-amber-500/10 via-zinc-900 to-zinc-950 border-amber-500/40 shadow-xs"
                      : "bg-zinc-900/90 border-zinc-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="px-2 py-0.2 rounded-md font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase flex items-center gap-1">
                          <Flame className="w-2.5 h-2.5" />
                          <span>Flashbulb Anchor</span>
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono">
                          Stability: {m.stability.toFixed(0)}d
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono">
                          Vividness: {(m.vividness * 100).toFixed(0)}%
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-mono">
                          PAD: [{pad[0].toFixed(1)}, {pad[1].toFixed(1)}, {pad[2].toFixed(1)}]
                        </span>
                        {m.isReframed && (
                          <span className="px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono">
                            Reframed 🧠
                          </span>
                        )}
                      </div>

                      {/* Memory Content */}
                      <p className="text-xs sm:text-sm font-medium text-zinc-100 leading-relaxed font-sans">
                        &quot;{m.point}&quot;
                      </p>

                      {m.reframeReason && (
                        <p className="text-[11px] text-cyan-300/80 font-mono italic">
                          Reframed perspective: {m.reframeReason}
                        </p>
                      )}
                    </div>

                    {/* Quick Interactive Actions */}
                    <div className="flex flex-col sm:flex-row items-center gap-1.5 shrink-0">
                      {/* Relive Button */}
                      <button
                        type="button"
                        onClick={() => {
                          onRelive?.(m);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 active:scale-95 transition"
                        title="Relive this moment with Saan in vivid present tense"
                      >
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>Relive</span>
                      </button>

                      {/* Cherish / Star */}
                      <button
                        type="button"
                        onClick={() => handleCherishToggle(m.id, m.isCherished)}
                        className={`p-1.5 rounded-lg border transition ${
                          m.isCherished
                            ? "bg-pink-500/20 text-pink-300 border-pink-500/40"
                            : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-200"
                        }`}
                        title={m.isCherished ? "Cherished forever" : "Mark cherished"}
                      >
                        <Star className={`w-3.5 h-3.5 ${m.isCherished ? "fill-pink-400 text-pink-400" : ""}`} />
                      </button>

                      {/* Reframe Trigger */}
                      <button
                        type="button"
                        onClick={() => setReframingId(isReframing ? null : m.id)}
                        className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-cyan-300 hover:border-cyan-500/40 transition"
                        title="Cognitive Reappraisal (Reframe)"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Cognitive Reappraisal Editor */}
                  {isReframing && (
                    <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-2 animate-in fade-in">
                      <div className="flex items-center justify-between text-xs text-zinc-300">
                        <span className="font-semibold text-cyan-300">
                          Cognitive Reappraisal (Reframe):
                        </span>
                        <select
                          value={newEmotion}
                          onChange={(e) => setNewEmotion(e.target.value)}
                          className="bg-zinc-900 border border-zinc-800 rounded px-2 py-0.5 text-xs text-zinc-200 focus:outline-hidden"
                        >
                          <option value="calm_confidence">Calm Confidence</option>
                          <option value="warm_affection">Warm Affection</option>
                          <option value="pride_accomplishment">Pride & Accomplishment</option>
                          <option value="serene_acceptance">Serene Acceptance</option>
                          <option value="philosophical_curiosity">Philosophical Curiosity</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={reframeReason}
                          onChange={(e) => setReframeReason(e.target.value)}
                          placeholder="Reframe this memory with emotional maturity..."
                          className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-hidden focus:border-cyan-500"
                        />
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleReframeSubmit(m.id)}
                          className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs transition"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
