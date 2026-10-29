"use client";

import React, { useState, useEffect } from "react";
import {
  KnapsackBudgetReport,
  CausalLink,
  DateBoundingInterval,
} from "@/lib/saan/temporal-query-engine";

interface SaanHindsightBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SaanHindsightBudgetModal({ isOpen, onClose }: SaanHindsightBudgetModalProps) {
  const [budgetCap, setBudgetCap] = useState(1200);
  const [report, setReport] = useState<KnapsackBudgetReport | null>(null);
  const [causalLinks, setCausalLinks] = useState<CausalLink[]>([]);
  const [loading, setLoading] = useState(false);

  // Temporal Query Sandbox
  const [queryInput, setQueryInput] = useState("What chai did we talk about yesterday?");
  const [parsedBounds, setParsedBounds] = useState<DateBoundingInterval | null>(null);
  const [parsing, setParsing] = useState(false);

  // Causal Link Form
  const [causeInput, setCauseInput] = useState("");
  const [effectInput, setEffectInput] = useState("");
  const [descInput, setDescInput] = useState("");

  const fetchBudget = async (cap: number) => {
    setLoading(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_hindsight_budget", budgetCap: cap }),
      });
      const data = await res.json();
      if (data.ok) {
        setReport(data.report);
        setCausalLinks(data.causalLinks || []);
      }
    } catch (err) {
      console.error("Failed to load Hindsight budget:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleParseQuery = async (queryToParse: string) => {
    setParsing(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "parse_temporal_query", query: queryToParse }),
      });
      const data = await res.json();
      if (data.ok && data.bounds) {
        setParsedBounds(data.bounds);
      }
    } catch (err) {
      console.error("Failed to parse temporal query:", err);
    } finally {
      setParsing(false);
    }
  };

  const handleAddCausalLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!causeInput || !effectInput || !descInput) return;

    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "add_causal_link",
          cause: causeInput,
          effect: effectInput,
          description: descInput,
        }),
      });
      const data = await res.json();
      if (data.ok && data.causalLinks) {
        setCausalLinks(data.causalLinks);
        setCauseInput("");
        setEffectInput("");
        setDescInput("");
      }
    } catch (err) {
      console.error("Failed to add causal link:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBudget(budgetCap);
      handleParseQuery(queryInput);
    }
  }, [isOpen, budgetCap]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-5xl h-[88vh] bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎒</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-white">Knapsack Fact Budgeting & Causal Grounding</h2>
                <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Hindsight Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Rank-Order Knapsack Packing, Top-Rank Floor Rule & Normalized ISO Temporal Bounding
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
          {/* Left Column: Knapsack Budget Bar & Category Allocation */}
          <div className="flex-1 flex flex-col p-6 overflow-y-auto border-r border-slate-800 space-y-6">
            {/* Budget Cap Slider */}
            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-300">Knapsack Budget Cap</span>
                <span className="text-xs font-mono font-bold text-amber-400">{budgetCap} tokens</span>
              </div>
              <input
                type="range"
                min="100"
                max="3200"
                step="50"
                value={budgetCap}
                onChange={(e) => setBudgetCap(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>100 tok (Tight Crunch)</span>
                <span>1200 tok (Standard)</span>
                <span>3200 tok (Extended RAG)</span>
              </div>
            </div>

            {/* Stacked Allocation Bar */}
            {report && (
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-300">Token Headroom Consumption</span>
                    <p className="text-xs text-slate-500">
                      Packing {report.selectedMemoryCount} of {report.totalAvailableCount} memories
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-mono font-bold text-white">
                      {report.usedTokens} / {report.budgetCapTokens} tok
                    </span>
                    <span className="text-xs font-mono text-slate-400 ml-1.5">({report.utilizationPct}%)</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
                  {report.categories.map((cat, i) => (
                    <div
                      key={i}
                      style={{
                        width: `${(cat.tokens / (report.budgetCapTokens || 1)) * 100}%`,
                        backgroundColor: cat.color,
                      }}
                      className="h-full transition-all duration-300 hover:opacity-80"
                      title={`${cat.category}: ${cat.tokens} tok (${cat.count} items)`}
                    />
                  ))}
                </div>

                {/* Legend Chips */}
                <div className="flex flex-wrap gap-3 pt-1">
                  {report.categories.map((cat, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs font-mono">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-slate-300 font-medium">{cat.category}:</span>
                      <span className="text-white font-bold">{cat.tokens}t</span>
                      <span className="text-slate-500 text-[10px]">({cat.count})</span>
                    </div>
                  ))}
                </div>

                {/* Top-Rank Floor Rule Badge */}
                {report.floorRuleActive && (
                  <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/40 flex items-center gap-2.5">
                    <span className="text-amber-400 text-lg">⚠️</span>
                    <div>
                      <span className="text-xs font-bold text-amber-300">Top-Rank Floor Rule Enforced</span>
                      <p className="text-[11px] text-amber-200/80 leading-snug">
                        Token budget was smaller than individual memories. Hindsight returned the top-ranked memory whole to prevent hallucinated amnesia.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Relative Temporal Query Sandbox */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
              <span className="text-xs font-mono font-bold text-cyan-400">⏳ Relative Temporal Query Parser</span>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={queryInput}
                  onChange={(e) => {
                    setQueryInput(e.target.value);
                    handleParseQuery(e.target.value);
                  }}
                  placeholder="e.g. What did we discuss 3 days ago?"
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Preset Chips */}
              <div className="flex flex-wrap gap-1.5">
                {["Today", "Yesterday", "Last Week", "3 days ago", "Last Month"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      const q = `Recap ${preset.toLowerCase()}`;
                      setQueryInput(q);
                      handleParseQuery(q);
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Parsed Result Box */}
              {parsedBounds && (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Temporal Match:</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        parsedBounds.hasConstraint ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {parsedBounds.hasConstraint ? `PHRASE: "${parsedBounds.matchedPhrase}"` : "UNCONSTRAINED"}
                    </span>
                  </div>
                  {parsedBounds.hasConstraint && (
                    <div className="text-[11px] text-slate-300 space-y-0.5 pt-1">
                      <div>
                        <span className="text-cyan-400">Start (00:00:00.000):</span> {parsedBounds.isoStart}
                      </div>
                      <div>
                        <span className="text-cyan-400">End &nbsp;(23:59:59.999):</span> {parsedBounds.isoEnd}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Causal Event Linkage Web */}
          <div className="w-88 flex flex-col bg-slate-900/40 p-5 overflow-y-auto space-y-5">
            <span className="text-xs font-mono font-bold text-purple-400">🔗 Causal Linkage Web</span>

            {/* Add Link Form */}
            <form onSubmit={handleAddCausalLink} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
              <span className="text-[11px] font-mono font-semibold text-slate-300">+ Link Cause & Effect</span>

              <div>
                <label className="text-[9px] font-mono text-slate-400">Cause Memory ID / Topic</label>
                <input
                  type="text"
                  placeholder="e.g. morning_chai"
                  value={causeInput}
                  onChange={(e) => setCauseInput(e.target.value)}
                  className="w-full mt-0.5 px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="text-[9px] font-mono text-slate-400">Effect Memory ID / Topic</label>
                <input
                  type="text"
                  placeholder="e.g. deep_focus_boost"
                  value={effectInput}
                  onChange={(e) => setEffectInput(e.target.value)}
                  className="w-full mt-0.5 px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="text-[9px] font-mono text-slate-400">Causal Description</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Chai triggers dopamine boost for programming"
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  className="w-full mt-0.5 px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-slate-100 resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-colors"
              >
                Record Causal Link
              </button>
            </form>

            {/* Causal Links Directory */}
            <div className="space-y-2">
              <span className="text-xs font-mono font-semibold text-slate-400">Active Causal Links</span>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {causalLinks.map((link) => (
                  <div key={link.id} className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className="text-cyan-400 truncate max-w-[90px]">{link.causeMemoryId}</span>
                      <span className="text-purple-400">➔</span>
                      <span className="text-amber-400 truncate max-w-[90px]">{link.effectMemoryId}</span>
                      <span className="text-emerald-400 font-bold">{Math.round(link.confidence * 100)}%</span>
                    </div>
                    <p className="text-[11px] text-slate-300">{link.description}</p>
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
