"use client";

import React, { useState, useEffect } from "react";
import {
  CyclicWorkflowRun,
  CyclicWorkflowStep,
} from "@/lib/saan/schedule-research-planner";

interface SaanResearchWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SaanResearchWorkflowModal({
  isOpen,
  onClose,
}: SaanResearchWorkflowModalProps) {
  const [history, setHistory] = useState<CyclicWorkflowRun[]>([]);
  const [currentRun, setCurrentRun] = useState<CyclicWorkflowRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [queryInput, setQueryInput] = useState(
    "Deep research on temporal knowledge graph causality and autonomous memory consolidation"
  );
  const [maxCycles, setMaxCycles] = useState(3);
  const [targetConfidence, setTargetConfidence] = useState(0.75);
  const [executing, setExecuting] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_research_workflows" }),
      });
      const data = await res.json();
      if (data.ok) {
        setHistory(data.history || []);
        if (data.latest && !currentRun) {
          setCurrentRun(data.latest);
        }
      }
    } catch (e) {
      console.error("Failed to load research workflows:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  const handleExecute = async () => {
    if (!queryInput.trim()) return;
    setExecuting(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "execute_research_workflow",
          query: queryInput,
          options: { maxCycles, targetConfidence },
        }),
      });
      const data = await res.json();
      if (data.ok && data.run) {
        setCurrentRun(data.run);
        if (data.history) setHistory(data.history);
      }
    } catch (e) {
      console.error("Error executing cyclic graph workflow:", e);
    } finally {
      setExecuting(false);
    }
  };

  if (!isOpen) return null;

  const getNodeColor = (node: string) => {
    switch (node) {
      case "PLAN": return "text-blue-400 bg-blue-500/10 border-blue-500/30";
      case "INVESTIGATE": return "text-purple-400 bg-purple-500/10 border-purple-500/30";
      case "VERIFY": return "text-amber-400 bg-amber-500/10 border-amber-500/30";
      case "SYNTHESIZE": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
      default: return "text-zinc-400 bg-zinc-800 border-zinc-700";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col bg-zinc-950 border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-lg">
              🗺️
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                Cyclic Multi-Agent Research Planner
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Repo #25 LangGraph
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Cyclic state graphs, conditional branch routing, step checkpoints & verification loops
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
          {/* Cyclic Architecture Diagram Card */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
            <div className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
              <span>Cyclic Multi-Agent DAG Topology</span>
              <span className="text-[10px] text-zinc-500 font-mono">Loop-back routing: Verify &lt; Target</span>
            </div>
            <div className="flex items-center justify-between gap-2 overflow-x-auto py-2">
              <div className="flex-1 p-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 text-center">
                <div className="text-[10px] font-mono text-blue-300">Stage 1</div>
                <div className="text-xs font-bold text-blue-200 mt-0.5">PLAN</div>
                <div className="text-[9px] text-zinc-400 mt-1">Decompose Sub-Probes</div>
              </div>
              <div className="text-zinc-600 font-bold">➔</div>
              <div className="flex-1 p-2.5 rounded-xl border border-purple-500/30 bg-purple-500/10 text-center">
                <div className="text-[10px] font-mono text-purple-300">Stage 2</div>
                <div className="text-xs font-bold text-purple-200 mt-0.5">INVESTIGATE</div>
                <div className="text-[9px] text-zinc-400 mt-1">Memory & Docs Retrieval</div>
              </div>
              <div className="text-zinc-600 font-bold">➔</div>
              <div className="flex-1 p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-center relative">
                <div className="text-[10px] font-mono text-amber-300">Stage 3</div>
                <div className="text-xs font-bold text-amber-200 mt-0.5">VERIFY</div>
                <div className="text-[9px] text-zinc-400 mt-1">Fidelity Gate & Score</div>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[9px] text-amber-400 font-mono">
                  ↺ if &lt; {(targetConfidence * 100).toFixed(0)}%
                </div>
              </div>
              <div className="text-zinc-600 font-bold">➔</div>
              <div className="flex-1 p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-center">
                <div className="text-[10px] font-mono text-emerald-300">Stage 4</div>
                <div className="text-xs font-bold text-emerald-200 mt-0.5">SYNTHESIZE</div>
                <div className="text-[9px] text-zinc-400 mt-1">Consolidated Brief</div>
              </div>
            </div>
          </div>

          {/* Launcher Panel */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-3">
            <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
              Launch Cyclic Research Workflow
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Investigation Query</label>
                <input
                  type="text"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-zinc-400 block mb-1">Max Iteration Cycles</label>
                  <select
                    value={maxCycles}
                    onChange={(e) => setMaxCycles(parseInt(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200"
                  >
                    <option value={1}>1 Cycle (Single Pass)</option>
                    <option value={2}>2 Cycles (Verified)</option>
                    <option value={3}>3 Cycles (Deep Cyclic)</option>
                    <option value={5}>5 Cycles (Exhaustive)</option>
                  </select>
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Target Confidence Gate</label>
                  <select
                    value={targetConfidence}
                    onChange={(e) => setTargetConfidence(parseFloat(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200"
                  >
                    <option value={0.65}>65% (Fast Passing)</option>
                    <option value={0.75}>75% (Standard Gate)</option>
                    <option value={0.85}>85% (High Precision)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleExecute}
                disabled={executing}
                className="py-2 px-5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 hover:bg-indigo-500/30 text-indigo-200 font-semibold text-xs transition flex items-center gap-2"
              >
                🗺️ Execute Cyclic Graph
              </button>
              {currentRun && (
                <div className="text-xs text-zinc-400 font-mono">
                  Cycles: {currentRun.totalCycles} • Score: {(currentRun.verificationScore * 100).toFixed(0)}% • Duration: {currentRun.durationMs}ms
                </div>
              )}
            </div>
          </div>

          {/* Current Run Step Checkpoints Stream */}
          {currentRun && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-2">
                <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">
                  ✨ Synthesized Intelligence Brief
                </div>
                <div className="text-xs text-zinc-200 font-sans leading-relaxed">
                  {currentRun.synthesis}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Graph Step Checkpoints ({currentRun.steps.length})
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {currentRun.steps.map((step) => (
                    <div
                      key={step.stepId}
                      className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getNodeColor(step.node)}`}>
                            {step.node}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">{step.stepId}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[10px]">
                          <span className="text-zinc-400">Next: {step.nextRoute}</span>
                          <span className="text-emerald-400 font-bold">{(step.confidenceScore * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="text-zinc-300 text-[11px] font-mono bg-zinc-950 p-2 rounded border border-zinc-800/60 truncate">
                        {JSON.stringify(step.outputState)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
