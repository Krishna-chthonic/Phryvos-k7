"use client";

import React, { useState, useEffect } from "react";
import {
  WorkingScratchpadSession,
  ScratchpadStep,
  ScratchpadPhase,
  TieredMemoryMetrics,
} from "@/lib/saan/working-scratchpad";

interface SaanWorkingScratchpadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SaanWorkingScratchpadModal({
  isOpen,
  onClose,
}: SaanWorkingScratchpadModalProps) {
  const [currentSession, setCurrentSession] = useState<WorkingScratchpadSession | null>(null);
  const [recentSessions, setRecentSessions] = useState<WorkingScratchpadSession[]>([]);
  const [metrics, setMetrics] = useState<TieredMemoryMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  // Simulation Form
  const [simPrompt, setSimPrompt] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedSession, setSelectedSession] = useState<WorkingScratchpadSession | null>(null);

  const fetchScratchpadData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_working_scratchpad" }),
      });
      const data = await res.json();
      if (data.ok) {
        setCurrentSession(data.current);
        setRecentSessions(data.recent || []);
        setMetrics(data.metrics);
        if (!selectedSession && data.current) {
          setSelectedSession(data.current);
        }
      }
    } catch (err) {
      console.error("Failed to load scratchpad data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchScratchpadData();
    }
  }, [isOpen]);

  const handleSimulateTrace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simPrompt.trim()) return;

    setIsSimulating(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "simulate_scratchpad_trace",
          prompt: simPrompt.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok && data.current) {
        setSimPrompt("");
        setCurrentSession(data.current);
        setSelectedSession(data.current);
        await fetchScratchpadData();
      }
    } catch (err) {
      console.error("Simulation error:", err);
    } finally {
      setIsSimulating(false);
    }
  };

  if (!isOpen) return null;

  const getPhaseBadge = (phase: ScratchpadPhase) => {
    switch (phase) {
      case "HYPOTHESIS":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "RECURSIVE_RECALL":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
      case "FACT_CHECK":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      case "PLAN":
        return "bg-purple-500/20 text-purple-300 border-purple-500/40";
      case "SYNTHESIS":
        return "bg-rose-500/20 text-rose-300 border-rose-500/40";
    }
  };

  const activeDisplay = selectedSession || currentSession;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧠</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-zinc-100">
                  MemGPT v2 Ephemeral Working Scratchpad
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-800/60 text-purple-300">
                  Repo #18
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Recursive tiered memory recall & multi-step cognitive reasoning traces before response synthesis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 3-Tier OS Memory Hierarchy Banner */}
          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border border-purple-800/40 bg-purple-950/20 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-purple-300">
                    <span>📌 TIER 1: CORE MEMORY</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300">
                      Pinned RAM
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Always visible in context window (Persona + Human blocks).
                  </p>
                </div>
                <div className="text-xs font-mono text-purple-400 mt-2">
                  {metrics.coreMemoryChars} characters in RAM
                </div>
              </div>

              <div className="p-3 rounded-xl border border-cyan-800/40 bg-cyan-950/20 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-cyan-300">
                    <span>📝 TIER 2: WORKING SCRATCHPAD</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-900/50 text-cyan-300">
                      In-Flight
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Ephemeral multi-step deductions, temporal checks & planning.
                  </p>
                </div>
                <div className="text-xs font-mono text-cyan-400 mt-2">
                  {metrics.workingScratchpadSteps} steps executed | {metrics.recursiveQueriesExecuted} recalls
                </div>
              </div>

              <div className="p-3 rounded-xl border border-emerald-800/40 bg-emerald-950/20 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-300">
                    <span>🗄️ TIER 3: ARCHIVAL VAULT</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-300">
                      Persistent
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    SQLite long-term episodic vault & bi-temporal knowledge graph.
                  </p>
                </div>
                <div className="text-xs font-mono text-emerald-400 mt-2">
                  {metrics.archivalFactCount} active memories
                </div>
              </div>
            </div>
          )}

          {/* Interactive Reasoning Trace Sandbox */}
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="text-xs font-semibold text-zinc-200 flex items-center justify-between">
              <span>✍️ Simulate Cognitive Turn Reasoning Trace</span>
              <span className="text-[10px] text-zinc-500 font-mono">HYPOTHESIS ➔ RECALL ➔ CHECK ➔ PLAN ➔ SYNTHESIS</span>
            </div>

            <form onSubmit={handleSimulateTrace} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter user turn prompt to simulate multi-step planning (e.g. Schedule a review tomorrow after chai)"
                value={simPrompt}
                onChange={(e) => setSimPrompt(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={isSimulating || !simPrompt.trim()}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white shadow-lg shadow-purple-600/20 transition-all whitespace-nowrap"
              >
                {isSimulating ? "Reasoning..." : "Simulate Trace"}
              </button>
            </form>
          </div>

          {/* Session Switcher Pills */}
          {recentSessions.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-zinc-500 whitespace-nowrap text-[11px]">Traces:</span>
              {recentSessions.map((sess) => (
                <button
                  key={sess.turnId}
                  onClick={() => setSelectedSession(sess)}
                  className={`px-2.5 py-1 rounded-lg font-mono text-[11px] whitespace-nowrap border transition-all ${
                    activeDisplay?.turnId === sess.turnId
                      ? "bg-purple-950/80 border-purple-600 text-purple-300 font-medium"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {sess.turnId.slice(-8)} ({sess.steps.length} steps)
                </button>
              ))}
            </div>
          )}

          {/* Live Scratchpad Steps Trace */}
          {activeDisplay && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <div>
                  <div className="text-xs text-zinc-400">Context Prompt:</div>
                  <div className="text-sm font-semibold text-zinc-200 mt-0.5">
                    &quot;{activeDisplay.userPrompt}&quot;
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-mono text-zinc-500">
                    {new Date(activeDisplay.startedAt).toLocaleTimeString()}
                  </div>
                  {activeDisplay.totalDurationMs !== undefined && (
                    <div className="text-[11px] font-mono text-emerald-400">
                      Total: {activeDisplay.totalDurationMs}ms
                    </div>
                  )}
                </div>
              </div>

              {/* Steps Stepper */}
              <div className="space-y-3 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-800">
                {activeDisplay.steps.map((step, idx) => (
                  <div key={step.id} className="relative pl-8 space-y-1">
                    {/* Stepper node circle */}
                    <div className="absolute left-2 top-1.5 w-3.5 h-3.5 rounded-full bg-zinc-950 border-2 border-purple-500 flex items-center justify-center -translate-x-1/2">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-mono px-2 py-0.5 rounded border ${getPhaseBadge(
                            step.phase
                          )}`}
                        >
                          Step {idx + 1}: {step.phase}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {Math.round(step.confidence * 100)}% conf
                        </span>
                        {step.durationMs !== undefined && (
                          <span className="text-[10px] font-mono text-zinc-500">
                            {step.durationMs}ms
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-zinc-600">ID: {step.id}</span>
                    </div>

                    <div className="text-xs text-zinc-200 bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/60">
                      {step.content}
                    </div>

                    {step.recalledFactIds && step.recalledFactIds.length > 0 && (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className="text-[10px] text-zinc-500">Recalled Facts:</span>
                        {step.recalledFactIds.map((fid) => (
                          <span
                            key={fid}
                            className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/40"
                          >
                            {fid}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Final Synthesis Banner */}
              {activeDisplay.synthesisResult && (
                <div className="p-3 rounded-lg border border-rose-800/40 bg-rose-950/20 flex items-center justify-between">
                  <div className="text-xs text-rose-300">
                    <span className="font-semibold">Final Output Synthesis: </span>
                    {activeDisplay.synthesisResult}
                  </div>
                  <span className="text-[10px] font-mono text-rose-400 whitespace-nowrap">✓ Ready to Speak</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/40 flex items-center justify-between text-xs text-zinc-500">
          <div>MemGPT v2 scratchpad guarantees reflective planning before dialogue execution.</div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
