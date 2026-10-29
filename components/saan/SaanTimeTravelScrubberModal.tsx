"use client";

import React, { useState, useEffect } from "react";
import { PointInTimeReconstruction } from "@/lib/saan/memory-benchmark-bitemporal";

interface SaanTimeTravelScrubberModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SaanTimeTravelScrubberModal({ isOpen, onClose }: SaanTimeTravelScrubberModalProps) {
  const [offsetDays, setOffsetDays] = useState(0); // 0 = now, -7 = 7 days ago
  const [state, setState] = useState<PointInTimeReconstruction | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchState = async (days: number) => {
    setLoading(true);
    const targetMs = days === 0 ? Date.now() : Date.now() + days * 86400000;
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_time_travel_state", asOfTimestamp: targetMs }),
      });
      const data = await res.json();
      if (data.ok && data.state) {
        setState(data.state);
      }
    } catch (err) {
      console.error("Failed to load time travel state:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchState(offsetDays);
    }
  }, [isOpen, offsetDays]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-5xl h-[88vh] bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⏱️</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-white">Bi-Temporal Point-in-Time State Scrubber</h2>
                <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Datapace Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Point-in-Time Worldview Reconstruction & Epistemic Uncertainty Evaluator (Zero future leakage)
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

        {/* Master Timeline Scrubber Slider Bar */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-sky-400">⏳ Temporal Scrubber:</span>
              <span className="text-xs font-mono text-white font-bold">
                {offsetDays === 0 ? "Present Reality (Now)" : `${Math.abs(offsetDays)} days in the past`}
              </span>
            </div>
            {state && (
              <span className="text-xs font-mono text-slate-400">
                Target: {new Date(state.targetTimestamp).toLocaleDateString()} {new Date(state.targetTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>

          <input
            type="range"
            min="-14"
            max="0"
            step="1"
            value={offsetDays}
            onChange={(e) => setOffsetDays(Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
          />

          <div className="flex justify-between text-[10px] font-mono text-slate-500">
            <span>-14 Days</span>
            <span>-7 Days</span>
            <span>-3 Days</span>
            <span>-1 Day</span>
            <span className="text-sky-400 font-bold">Now (Present)</span>
          </div>
        </div>

        {/* Datapace Benchmark KPI Badges */}
        {state && (
          <div className="px-6 py-2.5 bg-slate-900/20 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <div className="px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-800/50 text-emerald-300">
                Active Facts: <span className="font-bold">{state.stats.totalActive}</span>
              </div>
              <div className="px-2.5 py-1 rounded-md bg-amber-950/40 border border-amber-800/50 text-amber-300">
                Future Locked: <span className="font-bold">{state.stats.totalFutureLocked}</span> 🔒
              </div>
              <div className="px-2.5 py-1 rounded-md bg-rose-950/40 border border-rose-800/50 text-rose-300">
                Invalidated: <span className="font-bold">{state.stats.totalInvalidated}</span> ❌
              </div>
              <div className="px-2.5 py-1 rounded-md bg-cyan-950/40 border border-cyan-800/50 text-cyan-300">
                Active Graph Edges: <span className="font-bold">{state.stats.activeEdgesCount}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-400">
                Epistemic Accuracy: <span className="text-sky-400 font-bold">{state.epistemicUncertaintyScore}%</span>
              </span>
              <span className="text-[11px] text-slate-400">
                Temporal Consistency: <span className="text-emerald-400 font-bold">{state.temporalConsistencyScore}%</span>
              </span>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Reconstructed Knowledge State as of Target Date */}
          <div className="flex-1 flex flex-col p-6 overflow-y-auto border-r border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-300">
                Reconstructed Active Memories as of {offsetDays === 0 ? "Now" : `${Math.abs(offsetDays)}d ago`}
              </span>
              <span className="text-xs font-mono text-slate-500">
                Zero future leakage guaranteed
              </span>
            </div>

            {loading ? (
              <div className="text-center py-16 text-slate-500 text-xs font-mono animate-pulse">
                Reconstructing point-in-time memory state...
              </div>
            ) : state && state.activeMemories.length > 0 ? (
              <div className="space-y-2.5">
                {state.activeMemories.map((mem) => (
                  <div
                    key={mem.id}
                    className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-sky-500/30 transition flex flex-col gap-1 text-xs"
                  >
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 uppercase font-semibold">
                        {mem.category}
                      </span>
                      <span className="text-slate-500">
                        Learned: {new Date(mem.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-slate-200 font-medium leading-relaxed pt-0.5">{mem.point}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-slate-500 text-xs font-mono">
                No active memories existed at this historical point.
              </div>
            )}
          </div>

          {/* Right Column: Future Locked Facts & Active Knowledge Graph Edges */}
          <div className="w-88 flex flex-col bg-slate-900/40 p-5 overflow-y-auto space-y-5">
            {/* Future Knowledge Guard Card */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-amber-400">🔒</span>
                <span className="text-xs font-mono font-bold text-slate-200">Future Knowledge Guard</span>
              </div>
              <p className="text-xs text-slate-400 leading-snug">
                Datapace benchmark prevents temporal causality leakage. There are{" "}
                <span className="text-amber-300 font-bold font-mono">{state?.futureLockedCount ?? 0}</span> facts
                formed after this date that Saan cannot observe when scrubbed back in time.
              </p>
            </div>

            {/* Point-in-Time Knowledge Graph Edges */}
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold text-cyan-400">Active Bi-Temporal Edges</span>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {state?.activeEdges.map((edge) => (
                  <div key={edge.id} className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className="text-cyan-400 font-semibold">{edge.source}</span>
                      <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[9px] font-bold">
                        {edge.relation}
                      </span>
                      <span className="text-purple-400 font-semibold">{edge.target}</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-tight">{edge.fact}</p>
                  </div>
                ))}

                {(!state || state.activeEdges.length === 0) && (
                  <div className="text-center py-6 text-slate-500 text-xs font-mono">
                    No active edges at this date.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
