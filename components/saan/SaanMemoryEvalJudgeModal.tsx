"use client";

import React, { useState, useEffect } from "react";
import {
  MemoryEvalMetrics,
  MemoryEvalRecord,
  MemoryEvalAggregateStats,
} from "@/lib/saan/memory-eval-judge";

interface SaanMemoryEvalJudgeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SaanMemoryEvalJudgeModal({
  isOpen,
  onClose,
}: SaanMemoryEvalJudgeModalProps) {
  const [stats, setStats] = useState<MemoryEvalAggregateStats | null>(null);
  const [history, setHistory] = useState<MemoryEvalRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Sandbox inputs
  const [sandboxUser, setSandboxUser] = useState("yaad hai kal humne cognitive memory test kiya tha?");
  const [sandboxReply, setSandboxReply] = useState("Haan bilkul! Kal humne cognitive memory test suite run kiya tha aur 80 ke 80 tests 100% pass hue the.");
  const [sandboxMemories, setSandboxMemories] = useState("User ran 80 cognitive memory tests yesterday.\nAll tests passed with zero regression.");
  const [sandboxRecord, setSandboxRecord] = useState<MemoryEvalRecord | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  const fetchEvalData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_memory_eval_stats" }),
      });
      const data = await res.json();
      if (data.ok) {
        setStats(data.stats);
        setHistory(data.history || []);
      }
    } catch (e) {
      console.error("Failed to fetch memory eval stats:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchEvalData();
    }
  }, [isOpen]);

  const handleEvaluateSandbox = async () => {
    setEvaluating(true);
    try {
      const memories = sandboxMemories.split("\n").map((m) => m.trim()).filter(Boolean);
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "evaluate_turn_fidelity",
          userMessage: sandboxUser,
          reply: sandboxReply,
          recalledMemories: memories,
        }),
      });
      const data = await res.json();
      if (data.ok && data.record) {
        setSandboxRecord(data.record);
        if (data.stats) setStats(data.stats);
        fetchEvalData();
      }
    } catch (e) {
      console.error("Error evaluating sandbox turn:", e);
    } finally {
      setEvaluating(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("Clear all recorded evaluation records?")) return;
    try {
      await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "clear_memory_eval_history" }),
      });
      fetchEvalData();
      setSandboxRecord(null);
    } catch (e) {
      console.error("Error clearing history:", e);
    }
  };

  if (!isOpen) return null;

  const getGradeBadge = (grade: MemoryEvalMetrics["grade"]) => {
    switch (grade) {
      case "S_TIER":
        return <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">S-TIER (Apex)</span>;
      case "A_TIER":
        return <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">A-TIER (Passed)</span>;
      case "B_TIER":
        return <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">B-TIER (Fair)</span>;
      case "FAIL":
        return <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">FAIL (Hallucination)</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col bg-zinc-950 border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-lg">
              ⚖️
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                Ground-Truth Memory Fidelity Judge & Telemetry
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Repo #22 MemoryEvalJudge
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Sovereign multi-axis evaluation: Faithfulness, Context Relevancy, Temporal Integrity, and Slop Penalty
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 p-2 rounded-lg hover:bg-zinc-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Metrics Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40">
                <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Fidelity</div>
                <div className="text-xl font-bold font-mono text-cyan-300 mt-1">
                  {(stats.avgCompositeFidelity * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Composite Score</div>
              </div>
              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40">
                <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Faithfulness</div>
                <div className="text-xl font-bold font-mono text-emerald-300 mt-1">
                  {(stats.avgFaithfulness * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Context Grounding</div>
              </div>
              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40">
                <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Relevancy</div>
                <div className="text-xl font-bold font-mono text-amber-300 mt-1">
                  {(stats.avgRelevancy * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Query Alignment</div>
              </div>
              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40">
                <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Temporal</div>
                <div className="text-xl font-bold font-mono text-indigo-300 mt-1">
                  {(stats.avgTemporalIntegrity * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Timeline Integrity</div>
              </div>
              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40">
                <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Pass Rate</div>
                <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                  {stats.passRate.toFixed(1)}%
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">≥ A-Tier (0.75)</div>
              </div>
            </div>
          )}

          {/* Interactive Sandbox Evaluator */}
          <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
              <span>🧪 Live Turn Fidelity Sandbox</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1 font-medium">User Message</label>
                <textarea
                  value={sandboxUser}
                  onChange={(e) => setSandboxUser(e.target.value)}
                  rows={3}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-200 resize-none font-sans"
                />
              </div>
              <div>
                <label className="text-zinc-400 block mb-1 font-medium">Companion Reply</label>
                <textarea
                  value={sandboxReply}
                  onChange={(e) => setSandboxReply(e.target.value)}
                  rows={3}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-200 resize-none font-sans"
                />
              </div>
              <div>
                <label className="text-zinc-400 block mb-1 font-medium">Recalled Memories (1 per line)</label>
                <textarea
                  value={sandboxMemories}
                  onChange={(e) => setSandboxMemories(e.target.value)}
                  rows={3}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-200 resize-none font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleEvaluateSandbox}
                disabled={evaluating}
                className="py-2 px-5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 hover:bg-cyan-500/30 text-cyan-200 font-semibold text-xs transition flex items-center gap-2"
              >
                ⚖️ Run Fidelity Evaluation
              </button>
              {sandboxRecord && (
                <div className="flex items-center gap-3">
                  {getGradeBadge(sandboxRecord.metrics.grade)}
                  <span className="text-xs text-zinc-300 font-mono">
                    Score: {(sandboxRecord.metrics.compositeFidelity * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>

            {sandboxRecord && (
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/80 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
                    <span className="text-zinc-400 block text-[10px]">Faithfulness</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {(sandboxRecord.metrics.faithfulness * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
                    <span className="text-zinc-400 block text-[10px]">Relevancy</span>
                    <span className="font-mono font-bold text-amber-400">
                      {(sandboxRecord.metrics.relevancy * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
                    <span className="text-zinc-400 block text-[10px]">Temporal Integrity</span>
                    <span className="font-mono font-bold text-indigo-400">
                      {(sandboxRecord.metrics.temporalIntegrity * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="p-2 rounded bg-zinc-900 border border-zinc-800">
                    <span className="text-zinc-400 block text-[10px]">Slop Penalty</span>
                    <span className="font-mono font-bold text-rose-400">
                      -{(sandboxRecord.metrics.slopPenalty * 20).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="text-xs text-zinc-300 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800 font-sans">
                  💡 <span className="font-medium text-zinc-200">Critique:</span> {sandboxRecord.metrics.critique}
                </div>
              </div>
            )}
          </div>

          {/* Historical Evaluations Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <span>📜 Evaluation Audit History ({history.length})</span>
              </h3>
              {history.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="text-xs text-rose-400 hover:text-rose-300 transition"
                >
                  Clear History
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-zinc-800 text-center text-zinc-500 text-xs">
                No evaluation turns recorded yet. Conversations evaluate live automatically.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {history.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 flex items-center justify-between text-xs hover:border-zinc-700 transition"
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2 text-zinc-400 text-[10px]">
                        <span>{new Date(rec.timestamp).toLocaleTimeString()}</span>
                        <span>•</span>
                        <span className="truncate text-zinc-300 font-medium">
                          &quot;{rec.userMessage.slice(0, 50)}...&quot;
                        </span>
                      </div>
                      <div className="text-zinc-400 text-[11px] truncate mt-0.5">
                        ↳ {rec.reply.slice(0, 70)}...
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-bold text-cyan-300">
                        {(rec.metrics.compositeFidelity * 100).toFixed(1)}%
                      </span>
                      {getGradeBadge(rec.metrics.grade)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
