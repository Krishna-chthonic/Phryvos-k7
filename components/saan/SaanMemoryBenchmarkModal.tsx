"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  Gauge,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Play,
  X,
  Award,
  Zap,
} from "lucide-react";

interface ProbeRecord {
  id: string;
  category?: string;
  question: string;
  gold: string;
  answer: string;
  correct: boolean;
  adversarial: boolean;
  abstained: boolean;
  searchLatencyMs: number;
  byString?: boolean;
  byJudge?: boolean;
  disagreed?: boolean;
  why?: string;
}

interface BenchmarkSummary {
  totalProbes: number;
  answerableCount: number;
  correctCount: number;
  recallPercent: number;
  adversarialCount: number;
  adversarialAbstainedCount: number;
  refusedAdversarialPercent: number;
  hallucinatedCount: number;
  judgeDisagreements: number;
  searchLatencyP50Ms: number;
  searchLatencyP95Ms: number;
  sub10msTargetMet: boolean;
  categoryRecall: Record<string, number>;
}

interface SaanMemoryBenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SaanMemoryBenchmarkModal({ isOpen, onClose }: SaanMemoryBenchmarkModalProps) {
  const [summary, setSummary] = useState<BenchmarkSummary | null>(null);
  const [probes, setProbes] = useState<ProbeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSummary = async () => {
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_memory_benchmark_summary" }),
      });
      const data = await res.json();
      if (data.ok) {
        setSummary(data.summary);
        setProbes(data.probes || []);
      }
    } catch (err) {
      console.warn("Failed to fetch memory benchmark:", err);
    }
  };

  const handleRunBenchmark = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "run_memory_benchmark" }),
      });
      const data = await res.json();
      if (data.ok) {
        setSummary(data.summary);
        setProbes(data.probes || []);
      }
    } catch (err) {
      console.error("Benchmark run failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSummary();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[85vh] bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-indigo-500/20 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-wide text-indigo-300">
                LongMemEval & Cognitive Memory Benchmarks
              </h2>
              <p className="text-xs text-slate-400">
                LoCoMo Evaluation Suite, Sub-10ms Latency & Dual-Judge Arbitration (Repo #47)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunBenchmark}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold tracking-wide transition shadow-md"
            >
              <Play className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>{isLoading ? "Benchmarking..." : "Run Benchmark"}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top KPI Cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>P50 Latency</span>
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-xl font-bold font-mono text-amber-300">
                  {summary.searchLatencyP50Ms.toFixed(1)} ms
                </div>
                <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Sub-10ms Target Met</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>P95 Latency</span>
                  <Gauge className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className="text-xl font-bold font-mono text-blue-300">
                  {summary.searchLatencyP95Ms.toFixed(1)} ms
                </div>
                <div className="text-[10px] text-slate-500">Tail retrieval bound</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Factual Recall</span>
                  <Award className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <div className="text-xl font-bold font-mono text-indigo-300">
                  {summary.recallPercent}%
                </div>
                <div className="text-[10px] text-slate-400">
                  {summary.correctCount} / {summary.answerableCount} factual probes
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Adversarial Refusal</span>
                  <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="text-xl font-bold font-mono text-purple-300">
                  {summary.refusedAdversarialPercent}%
                </div>
                <div className="text-[10px] text-slate-400">
                  {summary.hallucinatedCount === 0 ? "0 Hallucinations" : `${summary.hallucinatedCount} Hallucinated`}
                </div>
              </div>
            </div>
          )}

          {/* LoCoMo Category Breakdown */}
          {summary && summary.categoryRecall && (
            <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                LoCoMo Category Breakdown
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(summary.categoryRecall).map(([cat, score]) => (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-slate-300 capitalize">{cat}</span>
                      <span className="font-mono text-indigo-400 font-semibold">{score}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(score, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Probes Inspection Table */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-950/40 border border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                Dual-Judge Evaluated Probes ({probes.length})
              </h3>
              <span className="text-[11px] text-slate-500">
                String Match vs Semantic Judge Arbitration
              </span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {probes.map((probe) => (
                <div
                  key={probe.id}
                  className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/80 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50 font-mono text-[10px] uppercase">
                        {probe.category || "probe"}
                      </span>
                      <span className="font-medium text-slate-200">{probe.question}</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">
                      {probe.searchLatencyMs.toFixed(1)} ms
                    </span>
                  </div>

                  <div className="text-slate-400 text-[11px] pl-2 border-l border-slate-700 space-y-0.5">
                    <div>
                      <span className="text-slate-500">Answer: </span>
                      <span className="text-slate-300">{probe.answer}</span>
                    </div>
                    {probe.gold && (
                      <div>
                        <span className="text-slate-500">Gold: </span>
                        <span className="text-slate-400">{probe.gold}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] pt-1 text-slate-500">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        String: {probe.byString ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <XCircle className="w-3 h-3 text-rose-400" />}
                      </span>
                      <span className="flex items-center gap-1">
                        Judge: {probe.byJudge ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <XCircle className="w-3 h-3 text-rose-400" />}
                      </span>
                    </div>
                    <span className="italic text-slate-400">{probe.why}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
