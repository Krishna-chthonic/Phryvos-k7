"use client";

import React, { useState, useEffect } from "react";
import { IncrementalSummarySnapshot, EntityTag } from "@/lib/saan/incremental-summary";

interface SaanIncrementalSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SaanIncrementalSummaryModal({ isOpen, onClose }: SaanIncrementalSummaryModalProps) {
  const [snapshot, setSnapshot] = useState<IncrementalSummarySnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  // Manual summary fold-in
  const [newSummaryText, setNewSummaryText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_incremental_summary", currentTokens: 3200 }),
      });
      const data = await res.json();
      if (data.ok && data.snapshot) {
        setSnapshot(data.snapshot);
      }
    } catch (err) {
      console.error("Failed to load incremental summary:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFoldInSummary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSummaryText.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "trigger_incremental_summary",
          newText: newSummaryText,
          messageIds: [`msg_${Date.now()}`],
        }),
      });
      const data = await res.json();
      if (data.ok && data.snapshot) {
        setSnapshot(data.snapshot);
        setNewSummaryText("");
      }
    } catch (err) {
      console.error("Failed to fold in summary:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSummary();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredTags = snapshot?.entityTags.filter(
    (t) => categoryFilter === "ALL" || t.category.toUpperCase() === categoryFilter
  ) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-5xl h-[88vh] bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📜</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-white">Incremental Running Summary</h2>
                <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Zep / LangMem Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Turn-by-turn narrative compaction, 75% memory pressure warning & extracted entity tag directory
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

        {/* Context Pressure Bar */}
        {snapshot && (
          <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/30 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-semibold text-slate-300">Context Memory Pressure:</span>
              <div className="w-48 h-2.5 bg-slate-800 rounded-full overflow-hidden flex border border-slate-700">
                <div
                  style={{ width: `${snapshot.contextPressure.pressurePercent}%` }}
                  className={`h-full transition-all ${
                    snapshot.contextPressure.isWarningTriggered
                      ? "bg-rose-500 animate-pulse"
                      : "bg-indigo-500"
                  }`}
                />
              </div>
              <span className="text-xs font-mono text-white font-bold">
                {snapshot.contextPressure.currentTokens} / {snapshot.contextPressure.maxContextTokens} tok ({snapshot.contextPressure.pressurePercent}%)
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                Compacted Turns: <span className="text-white font-bold">{snapshot.summarizedMessageCount}</span>
              </span>
              {snapshot.contextPressure.isWarningTriggered && (
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                  ⚠️ 75% MEMORY COMPACTION ACTIVE
                </span>
              )}
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Running Summary Accordion Card */}
          <div className="flex-1 flex flex-col p-6 overflow-y-auto border-r border-slate-800 space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-indigo-400">📖 Compacted Conversation Narrative</span>
              {snapshot?.updatedAt && (
                <span className="text-[10px] font-mono text-slate-500">
                  Updated: {new Date(snapshot.updatedAt).toLocaleTimeString()}
                </span>
              )}
            </div>

            {loading ? (
              <div className="text-center py-16 text-slate-500 text-xs font-mono animate-pulse">
                Loading conversation summary...
              </div>
            ) : snapshot ? (
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line font-serif text-[13px]">
                  {snapshot.summary}
                </p>
              </div>
            ) : null}

            {/* Ingestion & Fold-In Tool */}
            <form onSubmit={handleFoldInSummary} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-300">+ Fold-In Turn Summary</span>
              </div>
              <textarea
                rows={2}
                placeholder="e.g. User mentioned new exam date next Wednesday and agreed on daily morning reminders."
                value={newSummaryText}
                onChange={(e) => setNewSummaryText(e.target.value)}
                className="w-full p-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-100 resize-none focus:outline-none focus:border-indigo-500"
                required
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="py-1.5 px-4 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50"
              >
                {isSubmitting ? "Folding In..." : "Extend Running Summary"}
              </button>
            </form>
          </div>

          {/* Right Column: Extracted Named Entity Tags */}
          <div className="w-88 flex flex-col bg-slate-900/40 p-5 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-cyan-400">🏷️ Extracted Entity Tags</span>
              <span className="text-[10px] font-mono text-slate-500">
                {snapshot?.entityTags.length ?? 0} entities
              </span>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-1">
              {["ALL", "PERSON", "PREFERENCE", "PLACE", "SCHEDULE", "CONCEPT"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition ${
                    categoryFilter === cat
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Entity Tags List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredTags.map((tag, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs hover:border-indigo-500/40 transition"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-200">{tag.name}</span>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">{tag.category}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[10px]">
                    <span className="px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                      {Math.round(tag.confidence * 100)}%
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                      ×{tag.occurrences}
                    </span>
                  </div>
                </div>
              ))}

              {filteredTags.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-xs font-mono">
                  No entity tags in this category.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
