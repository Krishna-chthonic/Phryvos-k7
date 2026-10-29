"use client";

import React, { useState, useEffect } from "react";
import {
  Webhook,
  Activity,
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Shield,
  Zap,
  Sliders,
  AlertTriangle,
} from "lucide-react";

interface RegisteredHook {
  id: string;
  name: string;
  stage: "beforeTurn" | "afterTurn" | "onError" | "onToolCall";
  priority: number;
  enabled: boolean;
  description: string;
}

interface HookExecutionRecord {
  id: string;
  hookId: string;
  stage: string;
  executionMs: number;
  status: "success" | "error";
  errorDetails?: string;
  timestamp: string;
}

interface SaanLifecycleHookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActiveHooksChange?: (count: number) => void;
}

export function SaanLifecycleHookModal({
  isOpen,
  onClose,
  onActiveHooksChange,
}: SaanLifecycleHookModalProps) {
  const [hooks, setHooks] = useState<RegisteredHook[]>([]);
  const [auditLog, setAuditLog] = useState<HookExecutionRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"hooks" | "audit" | "simulate">("hooks");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Simulation state
  const [simMessage, setSimMessage] = useState("Saan, tell me a story about ancient stars.");
  const [simResult, setSimResult] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const fetchHooks = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_lifecycle_hooks" }),
      });
      const data = await res.json();
      if (data.ok) {
        setHooks(data.hooks || []);
        setAuditLog(data.auditLog || []);
        const activeCount = (data.hooks || []).filter((h: any) => h.enabled).length;
        if (onActiveHooksChange) {
          onActiveHooksChange(activeCount);
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch lifecycle hooks:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHooks();
    }
  }, [isOpen]);

  const handleToggle = async (id: string, currentState: boolean) => {
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "toggle_lifecycle_hook",
          id,
          enabled: !currentState,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setHooks(data.hooks || []);
        const activeCount = (data.hooks || []).filter((h: any) => h.enabled).length;
        if (onActiveHooksChange) {
          onActiveHooksChange(activeCount);
        }
        setStatusMessage(`Hook '${id}' ${data.enabled ? "enabled" : "disabled"}`);
        setTimeout(() => setStatusMessage(null), 2500);
      }
    } catch (err: any) {
      console.error("Failed to toggle hook:", err);
    }
  };

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "simulate_hook_lifecycle",
          userMessage: simMessage,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSimResult(data.result);
        setAuditLog(data.auditLog || []);
      }
    } catch (err: any) {
      console.error("Simulation failed:", err);
    } finally {
      setIsSimulating(false);
    }
  };

  if (!isOpen) return null;

  const stageGroups: Array<"beforeTurn" | "afterTurn" | "onError" | "onToolCall"> = [
    "beforeTurn",
    "onToolCall",
    "afterTurn",
    "onError",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl rounded-2xl border border-zinc-700 bg-zinc-900/95 p-6 shadow-2xl backdrop-blur-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Webhook className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-zinc-100">Agent Lifecycle Hooks Registry</h2>
                <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[10px] font-mono text-purple-400 border border-purple-500/20">
                  Repo #28 (Huginn)
                </span>
                <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-300 border border-purple-500/30">
                  {hooks.filter((h) => h.enabled).length} Active
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Deterministic beforeTurn, onToolCall, afterTurn &amp; onError lifecycle interception pipeline
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchHooks}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-zinc-700 bg-zinc-800 p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-zinc-800 pb-3 mb-4">
          <button
            onClick={() => setActiveTab("hooks")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition ${
              activeTab === "hooks"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            Registered Hooks ({hooks.length})
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition ${
              activeTab === "audit"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            Execution Stream ({auditLog.length})
          </button>
          <button
            onClick={() => setActiveTab("simulate")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition ${
              activeTab === "simulate"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <Play className="h-3.5 w-3.5" />
            Simulate Pipeline Run
          </button>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div className="mb-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2 text-center text-xs text-emerald-300">
            {statusMessage}
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* TAB: REGISTERED HOOKS */}
          {activeTab === "hooks" && (
            <div className="space-y-4">
              {stageGroups.map((stage) => {
                const stageHooks = hooks.filter((h) => h.stage === stage);
                if (stageHooks.length === 0) return null;
                return (
                  <div key={stage} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold uppercase tracking-wider text-purple-400">
                        {stage}
                      </span>
                      <div className="h-px flex-1 bg-zinc-800" />
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {stageHooks.length} hooks
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {stageHooks.map((h) => (
                        <div
                          key={h.id}
                          className={`p-3 rounded-xl border transition flex items-center justify-between ${
                            h.enabled
                              ? "border-zinc-800 bg-zinc-950/40"
                              : "border-zinc-900 bg-zinc-950/20 opacity-60"
                          }`}
                        >
                          <div className="space-y-0.5 max-w-[80%]">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-xs text-zinc-100">{h.name}</span>
                              <span className="font-mono text-[10px] text-zinc-500">{h.id}</span>
                              <span className="rounded bg-zinc-800 px-1.5 py-0.2 text-[9px] font-mono text-zinc-400 border border-zinc-700">
                                P:{h.priority}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-400">{h.description}</p>
                          </div>

                          <button
                            onClick={() => handleToggle(h.id, h.enabled)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold font-mono transition border ${
                              h.enabled
                                ? "bg-purple-600/30 text-purple-300 border-purple-500/40 hover:bg-purple-600/40"
                                : "bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300"
                            }`}
                          >
                            {h.enabled ? "ENABLED" : "DISABLED"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB: AUDIT LOG */}
          {activeTab === "audit" && (
            <div className="space-y-2">
              {auditLog.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-6">No hook execution events recorded yet.</p>
              ) : (
                auditLog.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-lg border border-zinc-800 bg-black/40 text-xs flex items-center justify-between font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        log.status === "success" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                      }`}>
                        {log.status.toUpperCase()}
                      </span>
                      <span className="text-purple-300">{log.hookId}</span>
                      <span className="text-zinc-500 text-[10px]">[{log.stage}]</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-cyan-400 font-semibold">{log.executionMs} ms</span>
                      <span className="text-[10px] text-zinc-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB: SIMULATE */}
          {activeTab === "simulate" && (
            <div className="space-y-3 p-2">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Simulated User Input:</label>
                <input
                  type="text"
                  value={simMessage}
                  onChange={(e) => setSimMessage(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-black/60 px-3 py-2 text-xs font-mono text-zinc-100 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <button
                  onClick={handleRunSimulation}
                  disabled={isSimulating}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 px-4 py-2 text-xs font-semibold text-white transition shadow disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5" />
                  {isSimulating ? "Executing Hook Pipeline..." : "Simulate Full Turn Hook Pipeline"}
                </button>
              </div>

              {simResult && (
                <div className="mt-3 p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-200">Execution Pipeline Trace</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800">
                      Total: {simResult.totalDurationMs} ms
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {simResult.trace.map((tr: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded bg-black/40 text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-purple-400 font-bold">[{tr.stage}]</span>
                          <span className="text-zinc-300">{tr.hookId}</span>
                        </div>
                        <span className="text-cyan-400">+{tr.executionMs} ms</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500">
          <span>Huginn Agent Lifecycle Registry • Zero Latency Overhead</span>
          <button
            onClick={onClose}
            className="rounded px-3 py-1 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
