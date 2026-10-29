"use client";

import React, { useState, useEffect } from "react";
import {
  BufferedMemoryCandidate,
  MemoryPriority,
  QueueStatusMetrics,
  FlushResult,
} from "@/lib/saan/buffered-memory-queue";

interface SaanBufferedQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQueueUpdated?: () => void;
}

export function SaanBufferedQueueModal({
  isOpen,
  onClose,
  onQueueUpdated,
}: SaanBufferedQueueModalProps) {
  const [metrics, setMetrics] = useState<QueueStatusMetrics | null>(null);
  const [items, setItems] = useState<BufferedMemoryCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFlush, setLastFlush] = useState<FlushResult | null>(null);

  // Enqueue Sandbox Form
  const [newText, setNewText] = useState("");
  const [newAxis, setNewAxis] = useState<"relationships" | "events" | "traits" | "items">("traits");
  const [newPriority, setNewPriority] = useState<MemoryPriority>("NORMAL");
  const [newConfidence, setNewConfidence] = useState(0.85);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [isFlushing, setIsFlushing] = useState(false);

  const fetchQueueData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_buffered_queue_status" }),
      });
      const data = await res.json();
      if (data.ok) {
        setMetrics(data.metrics);
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Failed to fetch buffered queue status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchQueueData();
      setLastFlush(null);
    }
  }, [isOpen]);

  const handleEnqueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;

    setIsEnqueuing(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "enqueue_buffered_memory",
          candidate: {
            text: newText.trim(),
            axis: newAxis,
            priority: newPriority,
            confidence: newConfidence,
          },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setNewText("");
        await fetchQueueData();
        onQueueUpdated?.();
      }
    } catch (err) {
      console.error("Failed to enqueue memory:", err);
    } finally {
      setIsEnqueuing(false);
    }
  };

  const handleFlush = async () => {
    setIsFlushing(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "flush_buffered_memory" }),
      });
      const data = await res.json();
      if (data.ok && data.flushResult) {
        setLastFlush(data.flushResult);
        await fetchQueueData();
        onQueueUpdated?.();
      }
    } catch (err) {
      console.error("Failed to flush queue:", err);
    } finally {
      setIsFlushing(false);
    }
  };

  if (!isOpen) return null;

  const getPriorityBadgeClass = (p: MemoryPriority) => {
    switch (p) {
      case "CRITICAL":
        return "bg-rose-500/20 text-rose-300 border-rose-500/40";
      case "HIGH":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "NORMAL":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
      case "EPHEMERAL":
        return "bg-zinc-500/20 text-zinc-400 border-zinc-600";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📬</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-zinc-100">
                  SuperAGI & TeleMem Multi-Tier Write Buffer Inspector
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-300">
                  Repo #16
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Staged priority write-queue, semantic cosine clustering & zero-thrashing batch flush
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
          {/* 3-Tier Pipeline Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl border border-rose-800/40 bg-rose-950/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-rose-300">
                  <span>🔥 HOT TIER</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-900/40 text-rose-300">In-Flight</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Immediate zero-latency dialogue working memory & pending turns.
                </p>
              </div>
              <div className="text-xs font-mono text-rose-400 mt-2">Status: Active</div>
            </div>

            <div className="p-3 rounded-xl border border-cyan-800/40 bg-cyan-950/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-cyan-300">
                  <span>⚡ WARM TIER</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/50 text-cyan-300 font-mono">
                    {metrics ? `${metrics.totalPending} items` : "..."}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Staged priority buffer queue with automatic clustering & deduping.
                </p>
              </div>
              <div className="text-xs font-mono text-cyan-400 mt-2">
                Capacity: {metrics?.capacity || 32} ({metrics?.utilizationPct || 0}%)
              </div>
            </div>

            <div className="p-3 rounded-xl border border-blue-900/40 bg-blue-950/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-blue-300">
                  <span>❄️ COLD TIER</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300">Persistent</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Committed SQLite vector vault & temporal knowledge graph edges.
                </p>
              </div>
              <div className="text-xs font-mono text-blue-400 mt-2">Status: Synced</div>
            </div>
          </div>

          {/* Metrics & Queue Gauges */}
          {metrics && (
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-[11px] text-zinc-400 uppercase tracking-wider">Pending Items</div>
                  <div className="text-2xl font-bold font-mono text-cyan-300">{metrics.totalPending}</div>
                </div>
                <div className="h-8 w-px bg-zinc-800" />
                <div>
                  <div className="text-[11px] text-zinc-400 uppercase tracking-wider">Queue Load</div>
                  <div className="text-2xl font-bold font-mono text-amber-300">{metrics.utilizationPct}%</div>
                </div>
                <div className="h-8 w-px bg-zinc-800" />
                <div>
                  <div className="text-[11px] text-zinc-400 uppercase tracking-wider">Oldest Age</div>
                  <div className="text-sm font-mono text-zinc-300 mt-1">
                    {metrics.oldestItemAgeMs > 0 ? `${Math.round(metrics.oldestItemAgeMs / 1000)}s` : "0s"}
                  </div>
                </div>
              </div>

              {/* Priority Pills */}
              <div className="flex items-center gap-1.5">
                {(["CRITICAL", "HIGH", "NORMAL", "EPHEMERAL"] as MemoryPriority[]).map((p) => (
                  <span
                    key={p}
                    className={`text-[10px] font-mono px-2 py-1 rounded-md border ${getPriorityBadgeClass(p)}`}
                  >
                    {p}: {metrics.byPriority[p] || 0}
                  </span>
                ))}
              </div>

              {/* Manual Flush Button */}
              <button
                onClick={handleFlush}
                disabled={isFlushing || metrics.totalPending === 0}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-cyan-600/20 transition-all flex items-center gap-2"
              >
                {isFlushing ? "Flushing..." : "⚡ Force Flush Buffer"}
              </button>
            </div>
          )}

          {/* Flush Result Feedback */}
          {lastFlush && (
            <div className="p-3 rounded-xl border border-emerald-800/40 bg-emerald-950/20 space-y-1">
              <div className="text-xs font-semibold text-emerald-300 flex items-center gap-2">
                <span>✓ Buffer Flush Executed</span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {new Date(lastFlush.flushedAt).toLocaleTimeString()}
                </span>
              </div>
              <div className="text-xs text-zinc-300">
                Added <span className="font-mono text-emerald-400">{lastFlush.added.length}</span> memories |{" "}
                Fused <span className="font-mono text-amber-400">{lastFlush.fused.clusterCount}</span> semantic clusters from{" "}
                <span className="font-mono">{lastFlush.fused.originalCount}</span> inputs.
              </div>
              {lastFlush.fused.synthesizedMemories.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="text-[11px] text-amber-300 font-medium">Synthesized Memories:</div>
                  {lastFlush.fused.synthesizedMemories.map((synth, idx) => (
                    <div
                      key={idx}
                      className="text-xs font-mono text-zinc-300 bg-zinc-900/80 p-1.5 rounded border border-zinc-800"
                    >
                      • {synth}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Interactive Enqueue Sandbox */}
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
              <span>✍️ Enqueue Memory Candidate</span>
              <span className="text-[10px] text-zinc-400">Simulate turn observation ingestion</span>
            </div>

            <form onSubmit={handleEnqueue} className="space-y-3">
              <div>
                <input
                  type="text"
                  placeholder="e.g., User drinks adrak chai while coding at 2 AM"
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">Axis Category</label>
                  <select
                    value={newAxis}
                    onChange={(e) => setNewAxis(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="traits">traits (identity & preferences)</option>
                    <option value="events">events (plans & milestones)</option>
                    <option value="relationships">relationships (bonds & interactions)</option>
                    <option value="items">items (belongings & places)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as MemoryPriority)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="CRITICAL">CRITICAL (Core Identity / Crisis)</option>
                    <option value="HIGH">HIGH (Strong Preferences)</option>
                    <option value="NORMAL">NORMAL (Standard Observations)</option>
                    <option value="EPHEMERAL">EPHEMERAL (Temporary context)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">Confidence ({newConfidence})</label>
                  <input
                    type="range"
                    min="0.5"
                    max="1.0"
                    step="0.05"
                    value={newConfidence}
                    onChange={(e) => setNewConfidence(parseFloat(e.target.value))}
                    className="w-full h-7 accent-cyan-500"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isEnqueuing || !newText.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 border border-zinc-700 transition-colors"
                >
                  {isEnqueuing ? "Enqueuing..." : "Enqueue Memory"}
                </button>
              </div>
            </form>
          </div>

          {/* Pending Items Inspector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
              <div className="flex items-center gap-2">
                <span>📋 Pending Buffer Items ({items.length})</span>
                {loading && <span className="text-[10px] text-zinc-500">Refreshing...</span>}
              </div>
            </div>

            {items.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                Buffer queue is currently empty. Enqueue a fact above or continue chatting to populate.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 transition-all flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-mono px-2 py-0.5 rounded border ${getPriorityBadgeClass(
                            item.priority || "NORMAL"
                          )}`}
                        >
                          {item.priority || "NORMAL"}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                          {item.axis}
                        </span>
                        <span className="text-[10px] font-mono text-cyan-400">
                          {Math.round(item.confidence * 100)}% conf
                        </span>
                        {(item.accessCount || 1) > 1 && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-900/40 text-amber-300 border border-amber-800/50">
                            {item.accessCount}x hits
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {new Date(item.createdAt).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="text-xs text-zinc-200">{item.text}</div>

                    <div className="text-[10px] font-mono text-zinc-500 flex items-center justify-between mt-1 pt-1 border-t border-zinc-800/40">
                      <span>ID: {item.id}</span>
                      <span>Vector footprint: {item.embedding ? `${item.embedding.length} dims` : "synthetic"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/40 flex items-center justify-between text-xs text-zinc-500">
          <div>SuperAGI multi-tier queue prevents storage I/O bottlenecks in continuous conversations.</div>
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
