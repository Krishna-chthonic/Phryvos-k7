"use client";

import React, { useState, useEffect } from "react";
import {
  Zap,
  Volume2,
  FileText,
  XCircle,
  Play,
  RefreshCw,
  X,
  Layers,
  Radio,
  Trash2,
} from "lucide-react";

interface QueuedFrameSummary {
  id: number;
  name: string;
  type: string;
  pts: string;
  interruptible: boolean;
  metadata?: Record<string, any>;
}

interface ProcessedFrameAudit {
  id: number;
  name: string;
  type: string;
  pts: string;
  interruptible: boolean;
  timestamp: number;
  status: "enqueued" | "popped" | "interrupted_drained";
}

interface SaanStreamingFrameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQueueSizeChange?: (size: number) => void;
}

export function SaanStreamingFrameModal({
  isOpen,
  onClose,
  onQueueSizeChange,
}: SaanStreamingFrameModalProps) {
  const [loading, setLoading] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [queuedFrames, setQueuedFrames] = useState<QueuedFrameSummary[]>([]);
  const [auditLog, setAuditLog] = useState<ProcessedFrameAudit[]>([]);

  // Simulation controls
  const [simText, setSimText] = useState("Haan main bilkul theek hoon! Aur sunao?");
  const [simInterruptible, setSimInterruptible] = useState(true);

  const fetchState = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_pipecat_pipeline_state" }),
      });
      const data = await res.json();
      if (data.ok) {
        setQueueSize(data.queueSize);
        setQueuedFrames(data.queuedFrames || []);
        setAuditLog(data.auditLog || []);
        if (onQueueSizeChange) onQueueSizeChange(data.queueSize);
      }
    } catch (e) {
      console.error("Failed to load Pipecat state", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchState();
    }
  }, [isOpen]);

  const handlePushFrame = async (frameType: "audio" | "text") => {
    try {
      setLoading(true);
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "push_pipecat_frame",
          frameType,
          text: simText,
          interruptible: simInterruptible,
          sampleRate: 16000,
          channels: 1,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setQueueSize(data.queueSize);
        setAuditLog(data.auditLog || []);
        if (onQueueSizeChange) onQueueSizeChange(data.queueSize);
        await fetchState();
      }
    } catch (e) {
      console.error("Failed to enqueue frame", e);
    } finally {
      setLoading(false);
    }
  };

  const handleBargeIn = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "trigger_pipecat_barge_in",
          reason: "user_voice_interruption",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setQueueSize(data.queueSize);
        setAuditLog(data.auditLog || []);
        if (onQueueSizeChange) onQueueSizeChange(data.queueSize);
        await fetchState();
      }
    } catch (e) {
      console.error("Failed to trigger barge-in", e);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    try {
      setLoading(true);
      await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "clear_pipecat_pipeline" }),
      });
      setQueueSize(0);
      setQueuedFrames([]);
      setAuditLog([]);
      if (onQueueSizeChange) onQueueSizeChange(0);
    } catch (e) {
      console.error("Failed to clear pipeline", e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="relative w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl bg-zinc-950 border border-yellow-500/30 shadow-2xl overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold tracking-tight text-white">
                  Pipecat Streaming Frame Pipeline
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                  Repo #36
                </span>
                <span className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-300 font-mono">
                  Queue: {queueSize} Frames
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Low-latency monotonic PTS frame queuing with instantaneous barge-in queue draining
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchState}
              disabled={loading}
              className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
              title="Refresh frame state"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-zinc-800/80 bg-zinc-900/40 text-xs">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePushFrame("audio")}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-medium transition"
            >
              <Volume2 className="w-3.5 h-3.5 text-blue-400" />
              <span>+ Audio Frame (16kHz PCM)</span>
            </button>
            <button
              onClick={() => handlePushFrame("text")}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-medium transition"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>+ Text Frame</span>
            </button>
            <button
              onClick={handleBargeIn}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 font-semibold transition animate-pulse"
              title="Push CancelFrame and drain all interruptible frames"
            >
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Barge-In Interrupt!</span>
            </button>
          </div>

          <button
            onClick={handleClear}
            disabled={loading}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Active Queued Frames */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Active In-Flight Frames ({queuedFrames.length})
            </h3>
            {queuedFrames.length === 0 ? (
              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 text-center text-zinc-500 text-xs">
                Pipeline idle. Queue is currently empty.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                {queuedFrames.map((f) => (
                  <div
                    key={f.id}
                    className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2.5">
                      {f.type.includes("Audio") ? (
                        <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                          <Volume2 className="w-4 h-4" />
                        </div>
                      ) : f.type.includes("Cancel") ? (
                        <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
                          <XCircle className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                          <FileText className="w-4 h-4" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-white">#{f.id} {f.name}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                              f.interruptible
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-purple-500/20 text-purple-300"
                            }`}
                          >
                            {f.interruptible ? "interruptible" : "pinned"}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-zinc-500 block truncate max-w-[260px]">
                          pts: {f.pts} ns
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Audit Log Stream */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Pipeline Execution & Drainage Audit ({auditLog.length})
            </h3>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden text-xs">
              <div className="divide-y divide-zinc-800/60 max-h-60 overflow-y-auto">
                {auditLog.map((item, idx) => (
                  <div
                    key={`${item.id}-${idx}`}
                    className="p-3 flex items-center justify-between hover:bg-zinc-850 transition"
                  >
                    <div className="flex items-center space-x-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          item.status === "interrupted_drained"
                            ? "bg-rose-500"
                            : item.status === "popped"
                            ? "bg-emerald-500"
                            : "bg-yellow-500"
                        }`}
                      />
                      <span className="font-mono text-zinc-300 font-medium">#{item.id} {item.name}</span>
                      <span className="font-mono text-[10px] text-zinc-500">[{item.type}]</span>
                    </div>

                    <div className="flex items-center space-x-2 text-[11px] font-mono">
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          item.status === "interrupted_drained"
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            : item.status === "popped"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                        }`}
                      >
                        {item.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            <span>Monotonic Sub-Millisecond Presentation Timestamps Active</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
