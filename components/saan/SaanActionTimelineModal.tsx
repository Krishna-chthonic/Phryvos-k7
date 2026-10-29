"use client";

import React, { useState, useEffect } from "react";
import {
  OpenHandsEvent,
  ActionEvent,
  ObservationEvent,
  UserRejectObservation,
} from "@/lib/saan/observable-action-stream";

interface SaanActionTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ActionStreamStats {
  totalEvents: number;
  actionsCount: number;
  obsCount: number;
  errorCount: number;
  rejectCount: number;
}

export function SaanActionTimelineModal({
  isOpen,
  onClose,
}: SaanActionTimelineModalProps) {
  const [events, setEvents] = useState<OpenHandsEvent[]>([]);
  const [stats, setStats] = useState<ActionStreamStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "ACTIONS" | "OBSERVATIONS" | "ERRORS">("ALL");
  const [expandedPayloads, setExpandedPayloads] = useState<Record<string, boolean>>({});
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});

  // Simulation Preset
  const [simPreset, setSimPreset] = useState<"search" | "file" | "highrisk">("search");
  const [isSimulating, setIsSimulating] = useState(false);

  const fetchStreamData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_action_stream" }),
      });
      const data = await res.json();
      if (data.ok) {
        setEvents(data.events || []);
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to load action stream:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStreamData();
    }
  }, [isOpen]);

  const togglePayload = (id: string) => {
    setExpandedPayloads((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleThought = (id: string) => {
    setExpandedThoughts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSimulateToolCall = async () => {
    setIsSimulating(true);
    let actionPayload: any = {};

    if (simPreset === "search") {
      actionPayload = {
        toolName: "search_temporal_graph",
        payload: { entity: "Krishna", maxHops: 2, relation: "PREFERS" },
        thought: [
          "Recalling recent temporal facts about user's evening workflow.",
          "Verifying bi-temporal graph edges without resurrecting tombstones.",
        ],
        output: "Found 2 active edges: Krishna -> PREFERS -> Adrak Chai; Krishna -> WORKING_ON -> Next.js 16.",
        securityRisk: "LOW",
      };
    } else if (simPreset === "file") {
      actionPayload = {
        toolName: "vault_read",
        payload: { path: "/vault/notes/daily-briefing.md" },
        thought: ["Accessing local sovereign notes for morning briefing synthesis."],
        output: "File Content: # Daily Briefing\n- 50 repo autonomous upgrade progress\n- Zero regressions verified.",
        securityRisk: "LOW",
      };
    } else {
      actionPayload = {
        toolName: "system_state_lease_acquire",
        payload: { resource: "sqlite_master_lock", leaseDurationSeconds: 30 },
        thought: ["Acquiring distributed state lease across background daemon workers."],
        output: "Lease acquired successfully: lease-id=lease_90184. Auto-expires in 30s.",
        securityRisk: "HIGH",
      };
    }

    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "simulate_action_stream",
          action: actionPayload,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        await fetchStreamData();
      }
    } catch (err) {
      console.error("Simulation error:", err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleClearStream = async () => {
    try {
      await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "clear_action_stream" }),
      });
      await fetchStreamData();
    } catch (err) {
      console.error("Failed to clear stream:", err);
    }
  };

  if (!isOpen) return null;

  const filteredEvents = events.filter((e) => {
    if (filter === "ALL") return true;
    if (filter === "ACTIONS") return e.kind === "action";
    if (filter === "OBSERVATIONS") return e.kind === "observation";
    if (filter === "ERRORS") return e.kind === "observation" && (e as any).isError;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-zinc-100">
                  OpenHands Observable Action Stream & Execution Timeline
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-950/80 border border-orange-800/60 text-orange-300">
                  Repo #19
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Observable tool calls, structured observations, collapsible payloads & self-correcting error loops
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

        {/* Stats & Filter Bar */}
        <div className="border-b border-zinc-800 bg-zinc-900/40 p-4 flex flex-wrap items-center justify-between gap-4">
          {stats && (
            <div className="flex items-center gap-4">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase block">Total</span>
                <span className="text-lg font-bold font-mono text-zinc-200">{stats.totalEvents}</span>
              </div>
              <div className="h-6 w-px bg-zinc-800" />
              <div>
                <span className="text-[10px] text-zinc-500 uppercase block">Actions</span>
                <span className="text-lg font-bold font-mono text-orange-400">{stats.actionsCount}</span>
              </div>
              <div className="h-6 w-px bg-zinc-800" />
              <div>
                <span className="text-[10px] text-zinc-500 uppercase block">Observations</span>
                <span className="text-lg font-bold font-mono text-cyan-400">{stats.obsCount}</span>
              </div>
              <div className="h-6 w-px bg-zinc-800" />
              <div>
                <span className="text-[10px] text-zinc-500 uppercase block">Errors</span>
                <span className="text-lg font-bold font-mono text-rose-400">{stats.errorCount}</span>
              </div>
            </div>
          )}

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-lg text-xs">
            {(["ALL", "ACTIONS", "OBSERVATIONS", "ERRORS"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-2.5 py-1 rounded font-mono text-[11px] transition-colors ${
                  filter === tab
                    ? "bg-orange-600 text-white font-medium shadow"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Interactive Simulation Sandbox */}
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-300 font-medium">Test Action Presets:</span>
              <select
                value={simPreset}
                onChange={(e) => setSimPreset(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-orange-500"
              >
                <option value="search">1. Temporal Graph Memory Search (LOW Risk)</option>
                <option value="file">2. Vault Note Reader (LOW Risk)</option>
                <option value="highrisk">3. System State Lease Lock (HIGH Risk)</option>
              </select>
              <button
                onClick={handleSimulateToolCall}
                disabled={isSimulating}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white shadow-lg shadow-orange-600/20 transition-all"
              >
                {isSimulating ? "Executing..." : "Execute Tool Call"}
              </button>
            </div>

            <button
              onClick={handleClearStream}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Clear Stream
            </button>
          </div>

          {/* Timeline View */}
          <div className="space-y-4">
            {filteredEvents.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                No events match filter &quot;{filter}&quot;. Trigger a tool call above to populate the timeline.
              </div>
            ) : (
              <div className="relative before:absolute before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-zinc-800 space-y-3">
                {filteredEvents.map((evt, idx) => {
                  if (evt.kind === "action") {
                    const action = evt as ActionEvent;
                    const isThoughtOpen = expandedThoughts[action.id];
                    const isPayloadOpen = expandedPayloads[action.id];

                    return (
                      <div key={action.id} className="relative pl-9 space-y-1.5">
                        {/* Timeline Node */}
                        <div className="absolute left-2.5 top-2 w-3.5 h-3.5 rounded-full bg-zinc-950 border-2 border-orange-500 flex items-center justify-center -translate-x-1/2">
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                        </div>

                        {/* Action Header Card */}
                        <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 transition-all space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-orange-950/80 text-orange-300 border border-orange-800/60 font-semibold">
                                ACTION: {action.toolName}
                              </span>
                              <span
                                className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                                  action.securityRisk === "HIGH"
                                    ? "bg-rose-950/50 text-rose-300 border-rose-800/40"
                                    : "bg-zinc-800 text-zinc-400 border-zinc-700"
                                }`}
                              >
                                {action.securityRisk} RISK
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-zinc-500">
                              {new Date(action.timestamp).toLocaleTimeString()}
                            </span>
                          </div>

                          {/* Thought Accordion */}
                          {action.thought && action.thought.length > 0 && (
                            <div className="text-xs">
                              <button
                                onClick={() => toggleThought(action.id)}
                                className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
                              >
                                <span>{isThoughtOpen ? "▼" : "▶"}</span>
                                <span>Agent Reasoning ({action.thought.length} thoughts)</span>
                              </button>
                              {isThoughtOpen && (
                                <div className="mt-1.5 p-2 rounded-lg bg-zinc-950 border border-zinc-800/80 text-[11px] text-zinc-300 italic space-y-1">
                                  {action.thought.map((t, tidx) => (
                                    <div key={tidx}>• {t}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Payload Accordion */}
                          <div className="text-xs pt-1 border-t border-zinc-800/40">
                            <button
                              onClick={() => togglePayload(action.id)}
                              className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 font-mono"
                            >
                              <span>{isPayloadOpen ? "▼" : "▶"}</span>
                              <span>Payload Arguments</span>
                            </button>
                            {isPayloadOpen && (
                              <pre className="mt-1.5 p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[10px] text-orange-300 overflow-x-auto">
                                {JSON.stringify(action.actionPayload, null, 2)}
                              </pre>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (evt.kind === "observation") {
                    const obs = evt as ObservationEvent;
                    return (
                      <div key={obs.id} className="relative pl-9 space-y-1">
                        {/* Timeline Node */}
                        <div
                          className={`absolute left-2.5 top-2 w-3.5 h-3.5 rounded-full bg-zinc-950 border-2 flex items-center justify-center -translate-x-1/2 ${
                            obs.isError ? "border-rose-500" : "border-cyan-500"
                          }`}
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full ${
                              obs.isError ? "bg-rose-400" : "bg-cyan-400"
                            }`}
                          />
                        </div>

                        {/* Observation Card */}
                        <div
                          className={`p-3 rounded-xl border transition-all ${
                            obs.isError
                              ? "bg-rose-950/15 border-rose-800/40 text-rose-300"
                              : "bg-zinc-900/40 border-zinc-800/80 text-zinc-300"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                                  obs.isError
                                    ? "bg-rose-900/40 text-rose-300 border-rose-700/50"
                                    : "bg-cyan-950/60 text-cyan-300 border-cyan-800/40"
                                }`}
                              >
                                {obs.isError ? "ERROR OBSERVATION" : "OBSERVATION"}
                              </span>
                              <span className="text-[10px] font-mono text-zinc-500">
                                Ref: {obs.actionId}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-zinc-500">
                              {new Date(obs.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="text-xs font-mono whitespace-pre-wrap bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/60 text-zinc-200">
                            {obs.content}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (evt.kind === "user_reject") {
                    const rej = evt as UserRejectObservation;
                    return (
                      <div key={rej.id} className="relative pl-9 space-y-1">
                        <div className="absolute left-2.5 top-2 w-3.5 h-3.5 rounded-full bg-zinc-950 border-2 border-red-500 flex items-center justify-center -translate-x-1/2">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        </div>
                        <div className="p-3 rounded-xl bg-red-950/20 border border-red-800/50 text-red-300">
                          <div className="text-xs font-semibold">⛔ USER REJECTED ACTION</div>
                          <div className="text-xs mt-1 text-zinc-300">{rej.reason}</div>
                        </div>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/40 flex items-center justify-between text-xs text-zinc-500">
          <div>OpenHands observable stream ensures complete transparency of companion tool execution.</div>
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
