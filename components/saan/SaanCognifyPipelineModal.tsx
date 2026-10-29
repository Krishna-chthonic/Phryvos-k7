"use client";

import React, { useState, useEffect } from "react";
import { CognifyPipelineArtifacts, CognifyStageResult } from "@/lib/saan/cognify-pipeline";

interface SaanCognifyPipelineModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SaanCognifyPipelineModal({ isOpen, onClose }: SaanCognifyPipelineModalProps) {
  const [history, setHistory] = useState<CognifyPipelineArtifacts[]>([]);
  const [selectedRun, setSelectedRun] = useState<CognifyPipelineArtifacts | null>(null);
  const [loading, setLoading] = useState(false);

  // Ingestion runner inputs
  const [inputText, setInputText] = useState(
    "User prefers strong adrak chai at 8 AM. Lives in Jaipur pink city and does deep work sessions in the afternoon."
  );
  const [simulateFailure, setSimulateFailure] = useState<"none" | "extract" | "disambiguate" | "topology">("none");
  const [isRunning, setIsRunning] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_cognify_status" }),
      });
      const data = await res.json();
      if (data.ok && data.history) {
        setHistory(data.history);
        if (data.history.length > 0 && !selectedRun) {
          setSelectedRun(data.history[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch Cognify history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  const handleRunPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setIsRunning(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "run_cognify_pipeline",
          text: inputText,
          simulateFailureStage: simulateFailure === "none" ? undefined : simulateFailure,
        }),
      });
      const data = await res.json();
      if (data.ok && data.report) {
        setSelectedRun(data.report);
        if (data.history) {
          setHistory(data.history);
        }
      }
    } catch (err) {
      console.error("Failed to run cognify pipeline:", err);
    } finally {
      setIsRunning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-5xl h-[88vh] bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-white">Cognify Multi-Stage Pipeline</h2>
                <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  Cognee Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                5-Stage Ingestion, Entity Disambiguation & Two-Phase Atomic Rollback (Zero partial corruption)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            ✕ Close
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Pipeline Stepper & Active Run Details */}
          <div className="flex-1 flex flex-col p-6 overflow-y-auto border-r border-slate-800 space-y-6">
            {/* Live Run Pipeline Stepper */}
            {selectedRun ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-slate-300">Run: {selectedRun.runId}</span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded border ${
                        selectedRun.status === "completed"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : selectedRun.status === "rolled_back"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                      }`}
                    >
                      {selectedRun.status.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">{selectedRun.totalDurationMs} ms total</span>
                </div>

                {/* Source Input Text Quote */}
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300 italic">
                  &ldquo;{selectedRun.sourceText}&rdquo;
                </div>

                {/* Stage Progression Cards */}
                <div className="space-y-2.5">
                  {selectedRun.stages.map((stage, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border transition-all ${
                        stage.status === "completed"
                          ? "bg-slate-900/40 border-slate-800 hover:border-emerald-500/30"
                          : stage.status === "rolled_back"
                          ? "bg-amber-950/20 border-amber-800/50"
                          : "bg-rose-950/20 border-rose-800/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-400">0{idx + 1}.</span>
                          <span className="text-xs font-bold text-white tracking-wide">{stage.stageName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-slate-400">{stage.durationMs}ms</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold uppercase ${
                              stage.status === "completed"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : stage.status === "rolled_back"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-rose-500/20 text-rose-300"
                            }`}
                          >
                            {stage.status}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300">{stage.outputSummary}</p>
                    </div>
                  ))}
                </div>

                {/* Disambiguation Results Box */}
                {selectedRun.disambiguatedEntities && selectedRun.disambiguatedEntities.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-800/40 space-y-2">
                    <span className="text-xs font-mono font-semibold text-purple-300">
                      🔗 Entity Disambiguation & Alias Merging:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {selectedRun.disambiguatedEntities.map((d, i) => (
                        <div
                          key={i}
                          className="px-2.5 py-1 rounded-md bg-purple-900/40 border border-purple-700/50 text-xs font-mono flex items-center gap-1.5"
                        >
                          <span className="text-slate-400 italic">&ldquo;{d.alias}&rdquo;</span>
                          <span className="text-purple-400">➔</span>
                          <span className="text-purple-200 font-bold">{d.canonical}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16 text-slate-500 text-xs font-mono">
                No active Cognify execution selected.
              </div>
            )}
          </div>

          {/* Right Column: Ingestion Sandbox & Run History */}
          <div className="w-88 flex flex-col bg-slate-900/40 p-5 overflow-y-auto space-y-5">
            {/* Ingestion Sandbox */}
            <form onSubmit={handleRunPipeline} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-purple-400">▶ Live Ingestion Sandbox</span>
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400">Input Memory / Turn Text</label>
                <textarea
                  rows={3}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="w-full mt-1 p-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 resize-none focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400">Rollback Failure Simulator</label>
                <select
                  value={simulateFailure}
                  onChange={(e) => setSimulateFailure(e.target.value as any)}
                  className="w-full mt-1 px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                >
                  <option value="none">None (Happy Path - 100% Success)</option>
                  <option value="extract">Simulate Failure at Stage 3 (Extraction)</option>
                  <option value="disambiguate">Simulate Failure at Stage 4 (Disambiguation)</option>
                  <option value="topology">Simulate Failure at Stage 5 (Topology)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isRunning}
                className="w-full py-2 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-50"
              >
                {isRunning ? "Cognifying..." : "Execute Cognify Pipeline"}
              </button>
            </form>

            {/* Execution History */}
            <div className="space-y-2">
              <span className="text-xs font-mono font-semibold text-slate-400">Execution History</span>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {history.map((run) => (
                  <div
                    key={run.runId}
                    onClick={() => setSelectedRun(run)}
                    className={`p-2.5 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between ${
                      selectedRun?.runId === run.runId
                        ? "bg-purple-950/40 border-purple-500 text-purple-200"
                        : "bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex flex-col truncate pr-2">
                      <span className="font-mono text-[11px] truncate font-semibold">{run.runId}</span>
                      <span className="text-[10px] text-slate-400 truncate">{run.sourceText}</span>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 ${
                        run.status === "completed"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : run.status === "rolled_back"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-rose-500/20 text-rose-300"
                      }`}
                    >
                      {run.status === "completed" ? "OK" : "REVERTED"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
