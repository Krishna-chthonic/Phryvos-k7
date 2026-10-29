"use client";

import React, { useState, useEffect } from "react";
import {
  JsonRepairAuditEvent,
  RepairResult,
} from "@/lib/saan/dirty-json-repair";

interface SaanDirtyJsonDebugModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AuditorStats {
  totalAudits: number;
  successCount: number;
  failCount: number;
  anomalyFrequencies: Record<string, number>;
}

export function SaanDirtyJsonDebugModal({
  isOpen,
  onClose,
}: SaanDirtyJsonDebugModalProps) {
  const [events, setEvents] = useState<JsonRepairAuditEvent[]>([]);
  const [stats, setStats] = useState<AuditorStats | null>(null);
  const [loading, setLoading] = useState(false);

  // Sandbox inputs
  const [rawInput, setRawInput] = useState(
    "```json\n// AutoGPT Action Hallucination\n{\n  action: 'search_temporal_graph',\n  query: 'adrak chai',\n  recursive: True,\n  notes: None,\n  tags: ['beverage', 'preference',],\n}\n```"
  );
  const [lastRepair, setLastRepair] = useState<RepairResult | null>(null);
  const [isRepairing, setIsRepairing] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const fetchAuditData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_dirty_json_audit" }),
      });
      const data = await res.json();
      if (data.ok) {
        setEvents(data.events || []);
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to load dirty JSON audit:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAuditData();
    }
  }, [isOpen]);

  const handleTestRepair = async () => {
    if (!rawInput.trim()) return;
    setIsRepairing(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "test_dirty_json_repair",
          raw: rawInput,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setLastRepair(data.result);
        await fetchAuditData();
      }
    } catch (err) {
      console.error("Failed to execute repair:", err);
    } finally {
      setIsRepairing(false);
    }
  };

  const handleApplyPreset = (presetType: "python" | "comments" | "unbalanced") => {
    if (presetType === "python") {
      setRawInput(
        "```json\n{\n  action: 'sync_memory',\n  recursive: True,\n  enabled: False,\n  payload: None,\n  trailing: 42,\n}\n```"
      );
    } else if (presetType === "comments") {
      setRawInput(
        "// Diagnostic check\n/* Multi-line comment block */\n{\n  tool: 'inspect_vault',\n  params: {\n    depth: 3,\n    strict: 'yes',\n  },\n}"
      );
    } else {
      setRawInput(
        "{\n  action: 'create_task',\n  title: 'Complete 50 companion repos',\n  tags: ['autonomous', 'verified'"
      );
    }
    setLastRepair(null);
  };

  const handleCopyRepaired = () => {
    if (!lastRepair?.repairedText) return;
    navigator.clipboard.writeText(lastRepair.repairedText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔧</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-zinc-100">
                  AutoGPT & Agent-Zero Dirty JSON Repair Debug Drawer
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-300">
                  Repo #20
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Resilient LLM output parser, raw vs repaired split comparison & anomaly audit trace
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

        {/* Stats Banner */}
        {stats && (
          <div className="border-b border-zinc-800 bg-zinc-900/40 p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase block">Repairs Audited</span>
                <span className="text-lg font-bold font-mono text-zinc-200">{stats.totalAudits}</span>
              </div>
              <div className="h-6 w-px bg-zinc-800" />
              <div>
                <span className="text-[10px] text-zinc-500 uppercase block">Successful</span>
                <span className="text-lg font-bold font-mono text-emerald-400">{stats.successCount}</span>
              </div>
              <div className="h-6 w-px bg-zinc-800" />
              <div>
                <span className="text-[10px] text-zinc-500 uppercase block">Failed</span>
                <span className="text-lg font-bold font-mono text-rose-400">{stats.failCount}</span>
              </div>
            </div>

            {/* Anomaly Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {Object.entries(stats.anomalyFrequencies).map(([anomaly, count]) => (
                <span
                  key={anomaly}
                  className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800/80 border border-zinc-700/60 text-zinc-300"
                >
                  {anomaly}: {count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Interactive Sandbox Form */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-200">
                ✍️ Malformed JSON Test Input:
              </span>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-zinc-500">Presets:</span>
                <button
                  onClick={() => handleApplyPreset("python")}
                  className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                >
                  1. Python Literals
                </button>
                <button
                  onClick={() => handleApplyPreset("comments")}
                  className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                >
                  2. Comments & Quotes
                </button>
                <button
                  onClick={() => handleApplyPreset("unbalanced")}
                  className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                >
                  3. Unclosed Brackets
                </button>
              </div>
            </div>

            <textarea
              rows={5}
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-xs text-rose-300 focus:outline-none focus:border-emerald-500 leading-relaxed"
            />

            <div className="flex justify-end">
              <button
                onClick={handleTestRepair}
                disabled={isRepairing || !rawInput.trim()}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
              >
                {isRepairing ? "Repairing..." : "⚡ Execute Dirty JSON Repair"}
              </button>
            </div>
          </div>

          {/* Split Comparison View */}
          {lastRepair && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
                <div className="flex items-center gap-2">
                  <span>🔬 Side-by-Side Comparison</span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      lastRepair.success
                        ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/40"
                        : "bg-rose-950/60 text-rose-300 border-rose-800/40"
                    }`}
                  >
                    {lastRepair.success ? "✓ REPAIR SUCCESS" : "✕ REPAIR FAILED"} ({lastRepair.durationMs}ms)
                  </span>
                </div>
                {lastRepair.success && (
                  <button
                    onClick={handleCopyRepaired}
                    className="text-[11px] px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded transition-colors"
                  >
                    {copySuccess ? "✓ Copied!" : "Copy Repaired JSON"}
                  </button>
                )}
              </div>

              {/* Anomaly Tags */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-zinc-500">Fixed Anomalies:</span>
                {lastRepair.anomalies.map((anom) => (
                  <span
                    key={anom}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
                  >
                    {anom}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Raw View */}
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-1">
                  <div className="text-[11px] font-medium text-rose-400">🔴 Raw Input (Malformed)</div>
                  <pre className="text-[11px] font-mono text-zinc-400 max-h-56 overflow-y-auto whitespace-pre-wrap">
                    {rawInput}
                  </pre>
                </div>

                {/* Repaired View */}
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-1">
                  <div className="text-[11px] font-medium text-emerald-400">
                    🟢 Repaired Output (Valid JSON)
                  </div>
                  <pre className="text-[11px] font-mono text-emerald-300 max-h-56 overflow-y-auto whitespace-pre-wrap">
                    {lastRepair.success
                      ? JSON.stringify(lastRepair.data, null, 2)
                      : `Error: ${lastRepair.error}`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Historical Repair Audit Drawer */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
              <span>📋 Recent Companion Turn Repair Audits ({events.length})</span>
              {loading && <span className="text-[10px] text-zinc-500">Refreshing...</span>}
            </div>

            {events.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                No JSON repairs audited yet. Test a dirty string above or chat with Saan.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {events.map((e) => (
                  <div
                    key={e.id}
                    className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                            e.success
                              ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/40"
                              : "bg-rose-950/60 text-rose-300 border-rose-800/40"
                          }`}
                        >
                          {e.success ? "REPAIRED" : "FAILED"}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500">{e.id}</span>
                        <span className="text-[10px] font-mono text-zinc-500">{e.durationMs}ms</span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {new Date(e.createdAt).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {e.anomaliesFixed.map((a) => (
                        <span
                          key={a}
                          className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300"
                        >
                          {a}
                        </span>
                      ))}
                    </div>

                    <div className="text-[11px] font-mono text-zinc-300 bg-zinc-950 p-2 rounded border border-zinc-800/60 line-clamp-2">
                      {e.repairedText}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/40 flex items-center justify-between text-xs text-zinc-500">
          <div>AutoGPT dirty JSON repair ensures 100% resilience against LLM formatting hallucinations.</div>
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
