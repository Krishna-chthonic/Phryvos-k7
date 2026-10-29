"use client";

import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  GitCommit,
  Clock,
  Check,
  RotateCcw,
  X,
  ArrowRight,
  ShieldCheck,
  Zap,
} from "lucide-react";

interface TemporalEdge {
  id: string;
  source?: string;
  target?: string;
  relation?: string;
  fact: string;
  validAtMs?: number;
  invalidAtMs?: number | null;
  validAt?: string;
  invalidAt?: string | null;
  expiredAt?: string | null;
}

interface ContradictionPair {
  edgeA: TemporalEdge;
  edgeB: TemporalEdge;
  subject: string;
  relation: string;
  overlapStartMs: number;
  overlapEndMs: number | null;
  reason: string;
}

interface SaanContradictionGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SaanContradictionGraphModal({ isOpen, onClose }: SaanContradictionGraphModalProps) {
  const [edges, setEdges] = useState<TemporalEdge[]>([]);
  const [contradictions, setContradictions] = useState<ContradictionPair[]>([]);
  const [sorted, setSorted] = useState<TemporalEdge[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchGraph = async () => {
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_contradiction_graph" }),
      });
      const data = await res.json();
      if (data.ok) {
        setEdges(data.edges || []);
        setContradictions(data.contradictions || []);
        setSorted(data.sorted || []);
      }
    } catch (err) {
      console.warn("Failed to fetch contradiction graph:", err);
    }
  };

  const handleResolve = async (keepEdgeId: string, invalidateEdgeId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "resolve_contradiction",
          keepEdgeId,
          invalidateEdgeId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setEdges(data.edges || []);
        setContradictions(data.contradictions || []);
        setSorted(data.sorted || []);
      }
    } catch (err) {
      console.error("Resolution failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchGraph();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[85vh] bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-500/20 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-wide text-amber-300">
                Temporal Calculus & Contradiction Graph
              </h2>
              <p className="text-xs text-slate-400">
                Topological Memory Ordering & Bitemporal Invalidation (Repo #48)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchGraph}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition"
              title="Refresh Graph"
            >
              <RotateCcw className="w-4 h-4" />
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
          {/* Contradiction Alert Banner */}
          {contradictions.length > 0 ? (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 space-y-3">
              <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>
                  {contradictions.length} Active Contradiction(s) Detected in Companion Memory
                </span>
              </div>
              <p className="text-xs text-slate-300">
                The bitemporal calculus engine detected simultaneous overlapping facts for the same
                subject. Select which fact supersedes to invalidate the outdated assertion.
              </p>

              <div className="space-y-3 pt-1">
                {contradictions.map((c, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-slate-950/80 border border-rose-800/40 text-xs space-y-3"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                        <div className="text-[10px] uppercase font-mono text-slate-500">
                          Earlier Fact (ID: {c.edgeA.id})
                        </div>
                        <div className="font-medium text-slate-200">{c.edgeA.fact}</div>
                        <div className="text-[10px] text-slate-400">
                          Valid since: {c.edgeA.validAt ? new Date(c.edgeA.validAt).toLocaleDateString() : "Genesis"}
                        </div>
                        <button
                          onClick={() => handleResolve(c.edgeA.id, c.edgeB.id)}
                          disabled={isLoading}
                          className="mt-2 w-full py-1 px-2.5 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-semibold text-[11px] transition"
                        >
                          Keep This & Invalidate Other
                        </button>
                      </div>

                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                        <div className="text-[10px] uppercase font-mono text-slate-500">
                          Recent Fact (ID: {c.edgeB.id})
                        </div>
                        <div className="font-medium text-slate-200">{c.edgeB.fact}</div>
                        <div className="text-[10px] text-slate-400">
                          Valid since: {c.edgeB.validAt ? new Date(c.edgeB.validAt).toLocaleDateString() : "Recent"}
                        </div>
                        <button
                          onClick={() => handleResolve(c.edgeB.id, c.edgeA.id)}
                          disabled={isLoading}
                          className="mt-2 w-full py-1 px-2.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-semibold text-[11px] transition"
                        >
                          Keep This (Supersedes Earlier)
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center gap-3 text-xs text-emerald-300">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <span className="font-semibold">Calculus Clean: 0 Contradictions.</span>
                <span className="text-slate-400 ml-1.5">
                  All temporal facts have consistent, non-overlapping validity bounds.
                </span>
              </div>
            </div>
          )}

          {/* Topologically Sorted Memory Timeline */}
          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                <GitCommit className="w-4 h-4 text-amber-400" />
                <span>Topologically Sorted Memory Stream ({sorted.length} edges)</span>
              </div>
              <span className="text-[11px] text-slate-500">Chronological validity ordering</span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {sorted.map((edge) => {
                const isActive = !edge.invalidAtMs && !edge.invalidAt;
                return (
                  <div
                    key={edge.id}
                    className={`p-3 rounded-lg border text-xs space-y-1.5 transition ${
                      isActive
                        ? "bg-slate-900/80 border-slate-800"
                        : "bg-slate-950/50 border-slate-800/50 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                          {edge.relation || "relates_to"}
                        </span>
                        <span className="font-semibold text-slate-200">{edge.fact}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          isActive
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                            : "bg-rose-950 text-rose-300 border border-rose-800 line-through"
                        }`}
                      >
                        {isActive ? "ACTIVE" : "INVALIDATED"}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                      <span>Valid: {edge.validAt ? new Date(edge.validAt).toLocaleDateString() : "Genesis"}</span>
                      {edge.invalidAt && (
                        <span>Invalidated: {new Date(edge.invalidAt).toLocaleDateString()}</span>
                      )}
                      <span>Edge ID: {edge.id}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
