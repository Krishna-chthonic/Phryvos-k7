"use client";

import React, { useState, useEffect } from "react";
import { ActiveLeaseRecord } from "@/lib/saan/resilient-state-lease";

interface SaanStateLeaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LeaseMetrics {
  activeCount: number;
  totalAcquisitions: number;
  totalRenewals: number;
  totalPreemptions: number;
  fencingTokens: Record<string, number>;
}

const RESOURCES = [
  { id: "memory_blocks", name: "Core Memory Blocks (Letta RAM)", desc: "Persona & Human identity scratchpads" },
  { id: "consequence_ledger", name: "Consequence Ledger (Chronicler)", desc: "Deeds & promises tracking table" },
  { id: "profile_card", name: "User Profile Card (Memobase)", desc: "Categorical preferences & interaction facts" },
  { id: "temporal_graph", name: "Bi-Temporal Graph (Graphiti)", desc: "Point-in-time entity knowledge edges" },
  { id: "chat_turn", name: "Chat Turn Context (AirI / Soul)", desc: "Active turn execution & audio speech buffer" },
  { id: "associative_network", name: "Associative Concept Web", desc: "Spreading activation semantic network" },
];

export function SaanStateLeaseModal({
  isOpen,
  onClose,
}: SaanStateLeaseModalProps) {
  const [leases, setLeases] = useState<ActiveLeaseRecord[]>([]);
  const [metrics, setMetrics] = useState<LeaseMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  // Simulator controls
  const [selectedResource, setSelectedResource] = useState("memory_blocks");
  const [holderId, setHolderId] = useState("agent-memory-synthesizer");
  const [ttlMs, setTtlMs] = useState(15000);
  const [simResult, setSimResult] = useState<string | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const fetchLeases = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_state_leases" }),
      });
      const data = await res.json();
      if (data.ok) {
        setLeases(data.leases || []);
        setMetrics(data.metrics || null);
      }
    } catch (e) {
      console.error("Error fetching state leases:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLeases();
      const interval = setInterval(fetchLeases, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleAcquire = async () => {
    setSimLoading(true);
    setSimResult(null);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "acquire_state_lease",
          resource: selectedResource,
          owner: holderId,
          ttlMs,
        }),
      });
      const data = await res.json();
      if (data.ok && data.lease) {
        setSimResult(`✅ Lease granted! Fencing token: ${data.lease.fencingToken}`);
      } else {
        setSimResult(`❌ Acquisition conflict: Resource is already locked!`);
      }
      fetchLeases();
    } catch (e) {
      setSimResult("Error acquiring lease");
    } finally {
      setSimLoading(false);
    }
  };

  const handlePreempt = async (resource: string) => {
    try {
      await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "preempt_state_lease",
          resource,
        }),
      });
      fetchLeases();
    } catch (e) {
      console.error("Error preempting lease:", e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col bg-zinc-950 border border-teal-500/30 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 text-lg">
              🔒
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                Distributed State Lease & Concurrency Mutex
                <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Repo #24 CrewAI
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Monotonic fencing tokens, TTL lease locks, heartbeat renewals & deadlock preemption
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 p-2 rounded-lg hover:bg-zinc-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Metrics Cards */}
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40">
                <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Active Locks</div>
                <div className="text-xl font-bold font-mono text-teal-300 mt-1">
                  {metrics.activeCount}
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Resources Held</div>
              </div>
              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40">
                <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Total Granted</div>
                <div className="text-xl font-bold font-mono text-emerald-300 mt-1">
                  {metrics.totalAcquisitions}
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Lease Acquisitions</div>
              </div>
              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40">
                <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Heartbeat Renewals</div>
                <div className="text-xl font-bold font-mono text-indigo-300 mt-1">
                  {metrics.totalRenewals}
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">TTL Extensions</div>
              </div>
              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40">
                <div className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Preemptions</div>
                <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                  {metrics.totalPreemptions}
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">Timeouts / Overrides</div>
              </div>
            </div>
          )}

          {/* Interactive Lease Simulator */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
            <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
              <span>🧪 Multi-Agent Lease Acquisition Simulator</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1">Target Resource</label>
                <select
                  value={selectedResource}
                  onChange={(e) => setSelectedResource(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200"
                >
                  {RESOURCES.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-zinc-400 block mb-1">Agent Holder ID</label>
                <input
                  type="text"
                  value={holderId}
                  onChange={(e) => setHolderId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200"
                />
              </div>
              <div>
                <label className="text-zinc-400 block mb-1">Lease Duration: {(ttlMs / 1000).toFixed(0)}s</label>
                <select
                  value={ttlMs}
                  onChange={(e) => setTtlMs(parseInt(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200"
                >
                  <option value={5000}>5 Seconds (Ephemeral)</option>
                  <option value={15000}>15 Seconds (Normal)</option>
                  <option value={30000}>30 Seconds (Extended)</option>
                  <option value={60000}>60 Seconds (Heavy)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleAcquire}
                disabled={simLoading}
                className="py-2 px-5 rounded-xl bg-teal-500/20 border border-teal-500/40 hover:bg-teal-500/30 text-teal-200 font-semibold text-xs transition"
              >
                🔒 Request Exclusive State Lease
              </button>
              {simResult && (
                <div className="text-xs font-mono text-zinc-300">
                  {simResult}
                </div>
              )}
            </div>
          </div>

          {/* Resources Status Grid */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
              <span>📋 State Resource Mutex Status</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {RESOURCES.map((res) => {
                const activeLease = leases.find((l) => l.resource === res.id);
                const isLocked = !!activeLease;
                const token = metrics?.fencingTokens[res.id] || 100;

                return (
                  <div
                    key={res.id}
                    className={`p-4 rounded-xl border transition space-y-2 ${
                      isLocked
                        ? "border-amber-500/40 bg-amber-950/10"
                        : "border-zinc-800 bg-zinc-900/40"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-zinc-200">{res.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          isLocked
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        }`}
                      >
                        {isLocked ? "LOCKED" : "AVAILABLE"}
                      </span>
                    </div>

                    <div className="text-[11px] text-zinc-400">
                      {res.desc}
                    </div>

                    {isLocked && activeLease ? (
                      <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                        <div className="space-y-0.5 font-mono text-[11px]">
                          <div className="text-zinc-300">
                            Holder: <span className="text-amber-300">{activeLease.owner}</span>
                          </div>
                          <div className="text-zinc-400 text-[10px]">
                            Fencing: #{activeLease.fencingToken} • TTL: {(activeLease.remainingMs / 1000).toFixed(1)}s
                          </div>
                        </div>
                        <button
                          onClick={() => handlePreempt(res.id)}
                          className="px-2.5 py-1 rounded bg-rose-500/20 border border-rose-500/40 hover:bg-rose-500/30 text-rose-300 text-[10px] font-semibold transition"
                        >
                          Preempt
                        </button>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                        <span>Latest Fencing Token: #{token}</span>
                        <span>Zero Concurrency Hazards</span>
                      </div>
                    )}
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
