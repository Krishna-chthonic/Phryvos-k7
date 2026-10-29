"use client";

import React, { useState, useEffect } from "react";
import {
  RotateCcw,
  Zap,
  Activity,
  ShieldCheck,
  AlertOctagon,
  RefreshCw,
  Clock,
  Layers,
  CheckCircle2,
  Play,
  ArrowRight,
  Fingerprint,
} from "lucide-react";

interface DeadLetterItem {
  id: string;
  jobId: string;
  error: string;
  payload: any;
  attempts: number;
  timestamp: string;
  reprocessed?: boolean;
}

interface IdempotencyRecord {
  userId: string;
  idempotencyKey: string;
  fingerprint: string;
  status: "processing" | "completed";
  responseStatus?: number;
  createdAt: number;
  expiresAt: number;
}

interface RetryTelemetryStats {
  totalRequests: number;
  cachedHits: number;
  conflicts: number;
  activeRetries: number;
  deadLetterCount: number;
  circuitState: "CLOSED" | "HALF_OPEN" | "OPEN";
  averageLatencyMs: number;
}

interface SaanRetryTelemetryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActiveRetriesChange?: (count: number) => void;
}

export function SaanRetryTelemetryModal({
  isOpen,
  onClose,
  onActiveRetriesChange,
}: SaanRetryTelemetryModalProps) {
  const [telemetry, setTelemetry] = useState<RetryTelemetryStats | null>(null);
  const [deadLetters, setDeadLetters] = useState<DeadLetterItem[]>([]);
  const [records, setRecords] = useState<IdempotencyRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"telemetry" | "dlq" | "keys" | "simulate">("telemetry");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Simulation state
  const [simFnName, setSimFnName] = useState("sync_vector_embeddings");
  const [simFailCount, setSimFailCount] = useState<number>(2);
  const [simResult, setSimResult] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const fetchTelemetry = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_retry_telemetry" }),
      });
      const data = await res.json();
      if (data.ok) {
        setTelemetry(data.telemetry);
        setDeadLetters(data.deadLetters || []);
        setRecords(data.records || []);
        if (onActiveRetriesChange && data.telemetry) {
          onActiveRetriesChange(data.telemetry.activeRetries || 0);
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch retry telemetry:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTelemetry();
    }
  }, [isOpen]);

  const handleReprocess = async (id: string) => {
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "reprocess_dead_letter",
          id,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setDeadLetters(data.deadLetters || []);
        setTelemetry(data.telemetry);
        if (onActiveRetriesChange && data.telemetry) {
          onActiveRetriesChange(data.telemetry.activeRetries || 0);
        }
        setStatusMessage(`Dead-letter ${id} marked for immediate reprocess!`);
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch (err: any) {
      console.error("Reprocess failed:", err);
    }
  };

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "simulate_retry_execution",
          fnName: simFnName,
          failAttempts: simFailCount,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSimResult(data.sim);
        setTelemetry(data.telemetry);
        setDeadLetters(data.deadLetters || []);
        setRecords(data.records || []);
        if (onActiveRetriesChange && data.telemetry) {
          onActiveRetriesChange(data.telemetry.activeRetries || 0);
        }
      }
    } catch (err: any) {
      console.error("Simulation failed:", err);
    } finally {
      setIsSimulating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl rounded-2xl border border-zinc-700 bg-zinc-900/95 p-6 shadow-2xl backdrop-blur-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-zinc-100">Resilient Retry & Idempotency Telemetry</h2>
                <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-[10px] font-mono text-cyan-400 border border-cyan-500/20">
                  Repo #27 (AutoGen)
                </span>
                {telemetry && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                      telemetry.circuitState === "CLOSED"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : "bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse"
                    }`}
                  >
                    Circuit: {telemetry.circuitState}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Clamped exponential backoff with full jitter, SHA-256 idempotency locks & dead-letter queue
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchTelemetry}
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
            onClick={() => setActiveTab("telemetry")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition ${
              activeTab === "telemetry"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            Live Telemetry
          </button>
          <button
            onClick={() => setActiveTab("dlq")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition ${
              activeTab === "dlq"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <AlertOctagon className="h-3.5 w-3.5" />
            Dead Letters ({deadLetters.filter((d) => !d.reprocessed).length})
          </button>
          <button
            onClick={() => setActiveTab("keys")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition ${
              activeTab === "keys"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <Fingerprint className="h-3.5 w-3.5" />
            Idempotency Keys ({records.length})
          </button>
          <button
            onClick={() => setActiveTab("simulate")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition ${
              activeTab === "simulate"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <Play className="h-3.5 w-3.5" />
            Backoff Simulator
          </button>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div className="mb-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2 text-center text-xs text-emerald-300">
            {statusMessage}
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* TAB: TELEMETRY */}
          {activeTab === "telemetry" && telemetry && (
            <div className="space-y-4">
              {/* Stat Cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                  <div className="text-[11px] font-medium text-zinc-400">Total Requests</div>
                  <div className="text-xl font-bold font-mono text-zinc-100 mt-1">{telemetry.totalRequests}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Dispatched agent turns</div>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                  <div className="text-[11px] font-medium text-emerald-400">Idempotent Hits</div>
                  <div className="text-xl font-bold font-mono text-emerald-300 mt-1">{telemetry.cachedHits}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">0-cost cached replays</div>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                  <div className="text-[11px] font-medium text-cyan-400">Average Latency</div>
                  <div className="text-xl font-bold font-mono text-cyan-300 mt-1">{telemetry.averageLatencyMs} ms</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Network roundtrip</div>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                  <div className="text-[11px] font-medium text-rose-400">Unresolved DLQ</div>
                  <div className="text-xl font-bold font-mono text-rose-300 mt-1">
                    {deadLetters.filter((d) => !d.reprocessed).length}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Pending manual retry</div>
                </div>
              </div>

              {/* Backoff Formula Card */}
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-4">
                <h3 className="text-xs font-semibold text-cyan-300 mb-2 flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-cyan-400" />
                  Clamped Exponential Backoff Progression
                </h3>
                <p className="text-xs text-zinc-300 mb-3 font-mono">
                  delay(attempt) = min(minMs · 2^(attempt - 1), max(minMs, maxMs)) ± Full Jitter
                </p>
                <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
                  <div className="p-2 rounded bg-black/40 border border-zinc-800">
                    <span className="text-zinc-500 block text-[10px]">Attempt 1</span>
                    <span className="text-cyan-400 font-bold">50 ms</span>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-zinc-800">
                    <span className="text-zinc-500 block text-[10px]">Attempt 2</span>
                    <span className="text-cyan-400 font-bold">100 ms</span>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-zinc-800">
                    <span className="text-zinc-500 block text-[10px]">Attempt 3</span>
                    <span className="text-cyan-400 font-bold">200 ms</span>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-zinc-800">
                    <span className="text-zinc-500 block text-[10px]">Attempt 4 (Ceiling)</span>
                    <span className="text-cyan-400 font-bold">1,000 ms</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: DLQ */}
          {activeTab === "dlq" && (
            <div className="space-y-3">
              {deadLetters.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-zinc-800 rounded-xl">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2 opacity-60" />
                  <p className="text-xs text-zinc-400">Dead-letter queue is empty. All background tasks healthy.</p>
                </div>
              ) : (
                deadLetters.map((dl) => (
                  <div
                    key={dl.id}
                    className={`p-3.5 rounded-xl border text-xs transition ${
                      dl.reprocessed
                        ? "border-emerald-500/30 bg-emerald-950/10 opacity-70"
                        : "border-rose-500/40 bg-rose-950/20"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-zinc-400 text-[11px] font-semibold">{dl.id}</span>
                        <span className="font-mono text-cyan-300 font-bold">{dl.jobId}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          {dl.attempts} attempts
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(dl.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <p className="text-xs text-rose-200 font-mono bg-black/50 p-2 rounded border border-rose-950 mb-2">
                      {dl.error}
                    </p>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400">
                        Payload: <code className="text-zinc-300">{JSON.stringify(dl.payload).slice(0, 60)}...</code>
                      </span>
                      {!dl.reprocessed ? (
                        <button
                          onClick={() => handleReprocess(dl.id)}
                          className="flex items-center gap-1 rounded bg-cyan-600/80 hover:bg-cyan-600 px-2.5 py-1 text-[11px] font-semibold text-white transition shadow"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Reprocess Now
                        </button>
                      ) : (
                        <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Reprocessed
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB: IDEMPOTENCY KEYS */}
          {activeTab === "keys" && (
            <div className="space-y-2.5">
              {records.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-6">No active idempotency keys.</p>
              ) : (
                records.map((rec) => (
                  <div key={rec.idempotencyKey} className="p-3 rounded-lg border border-zinc-800 bg-black/40 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-cyan-400 font-semibold">{rec.idempotencyKey}</span>
                        <span className="text-[10px] text-zinc-400">User: {rec.userId}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                          rec.status === "completed" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                        }`}>
                          {rec.status.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        Expires: {new Date(rec.expiresAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                      <span>SHA-256 Fingerprint:</span>
                      <span className="text-zinc-400 select-all truncate">{rec.fingerprint}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB: SIMULATE */}
          {activeTab === "simulate" && (
            <div className="space-y-3 p-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Target Function Name:</label>
                  <input
                    type="text"
                    value={simFnName}
                    onChange={(e) => setSimFnName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-black/60 px-3 py-2 text-xs font-mono text-zinc-100 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Simulate Failures Before Success:</label>
                  <select
                    value={simFailCount}
                    onChange={(e) => setSimFailCount(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-200"
                  >
                    <option value={0}>0 failures (Instant 1st attempt success)</option>
                    <option value={1}>1 failure (Recovers on Attempt 2 with backoff)</option>
                    <option value={2}>2 failures (Recovers on Attempt 3 with exponential backoff)</option>
                    <option value={3}>3 failures (Exhaustion -&gt; DLQ dispatch)</option>
                  </select>
                </div>
              </div>

              <div>
                <button
                  onClick={handleRunSimulation}
                  disabled={isSimulating}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-semibold text-white transition shadow disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5" />
                  {isSimulating ? "Simulating Backoff..." : "Simulate AutoGen Backoff Execution"}
                </button>
              </div>

              {/* Simulation Result Output */}
              {simResult && (
                <div className="mt-3 p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-200">Simulation Execution Trace</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      simResult.finalStatus === "succeeded" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                    }`}>
                      {simResult.finalStatus.toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {simResult.attempts.map((att: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded bg-black/40 text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500">Attempt {att.attempt}:</span>
                          <span className={att.status === "succeeded" ? "text-emerald-400" : "text-rose-400"}>
                            {att.status.toUpperCase()}
                          </span>
                        </div>
                        <span className="text-cyan-400">+{att.delayMs} ms backoff</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono">
                    Idempotency Lock Key: <span className="text-zinc-300">{simResult.idempotencyKey}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500">
          <span>Sovereign Local Replay Protection • AutoGen &amp; n8n Backoff Engine</span>
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
