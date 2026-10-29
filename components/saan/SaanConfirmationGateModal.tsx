"use client";

import React, { useState, useEffect } from "react";
import { Shield, ShieldAlert, CheckCircle2, XCircle, Key, Terminal, RefreshCw, AlertTriangle, Lock, FileCode, History } from "lucide-react";

interface ApprovalCard {
  id: string;
  command: string;
  workingDirectory: string;
  sandboxMode: string;
  securityTier: 1 | 2 | 3;
  riskSummary: string;
  requiredPermissions: string[];
  createdAt: string;
  expiresAt: string;
}

interface GateAuditReceipt {
  id: string;
  cardId: string;
  command: string;
  decision: string;
  securityTier: 1 | 2 | 3;
  resolvedAt: string;
  sha256Hash: string;
}

interface SaanConfirmationGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPendingCountChange?: (count: number) => void;
}

export function SaanConfirmationGateModal({ isOpen, onClose, onPendingCountChange }: SaanConfirmationGateModalProps) {
  const [pendingCards, setPendingCards] = useState<ApprovalCard[]>([]);
  const [auditHistory, setAuditHistory] = useState<GateAuditReceipt[]>([]);
  const [sessionAuths, setSessionAuths] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"pending" | "audit" | "simulate">("pending");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Simulation form state
  const [simCommand, setSimCommand] = useState("rm -rf /root/.saan/cache/temp_build");
  const [simTier, setSimTier] = useState<1 | 2 | 3>(3);
  const [simSandbox, setSimSandbox] = useState<string>("workspace-write");

  const fetchGateState = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_gate_approvals" }),
      });
      const data = await res.json();
      if (data.ok) {
        setPendingCards(data.pending || []);
        setAuditHistory(data.auditHistory || []);
        setSessionAuths(data.sessionAuthorizations || []);
        if (onPendingCountChange) {
          onPendingCountChange(data.pending?.length || 0);
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch gate state:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchGateState();
    }
  }, [isOpen]);

  const handleDecision = async (cardId: string, decision: "accept" | "acceptForSession" | "decline") => {
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "submit_gate_decision",
          cardId,
          decision,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setPendingCards(data.pending || []);
        setAuditHistory(data.auditHistory || []);
        setSessionAuths(data.sessionAuthorizations || []);
        if (onPendingCountChange) {
          onPendingCountChange(data.pending?.length || 0);
        }
        setStatusMessage(`Decision recorded: ${decision.toUpperCase()} (Receipt: ${data.receipt?.id || "verified"})`);
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch (err: any) {
      console.error("Decision failed:", err);
    }
  };

  const handleSimulate = async () => {
    if (!simCommand.trim()) return;
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "create_gate_request",
          command: simCommand,
          securityTier: simTier,
          sandboxMode: simSandbox,
          workingDirectory: "/root/k7",
          requiredPermissions: simTier === 3 ? ["fs.delete", "process.exec"] : ["fs.write"],
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setPendingCards(data.pending || []);
        setActiveTab("pending");
        if (onPendingCountChange) {
          onPendingCountChange(data.pending?.length || 0);
        }
        setStatusMessage("Simulated gate request created!");
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch (err: any) {
      console.error("Simulation failed:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl rounded-2xl border border-zinc-700 bg-zinc-900/95 p-6 shadow-2xl backdrop-blur-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-zinc-100">Interactive Confirmation Gate</h2>
                <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-400 border border-amber-500/20">
                  Repo #26 (Smolagents)
                </span>
                {pendingCards.length > 0 && (
                  <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-400 border border-rose-500/30 animate-pulse">
                    {pendingCards.length} Pending
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                3-Tier sandboxed execution safety guardrail with cryptographic audit receipts
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchGateState}
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
            onClick={() => setActiveTab("pending")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition ${
              activeTab === "pending"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <Lock className="h-3.5 w-3.5" />
            Pending Requests ({pendingCards.length})
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition ${
              activeTab === "audit"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Audit Receipts ({auditHistory.length})
          </button>
          <button
            onClick={() => setActiveTab("simulate")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition ${
              activeTab === "simulate"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            Simulate Danger Test
          </button>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div className="mb-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2 text-center text-xs text-emerald-300">
            {statusMessage}
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* TAB: PENDING REQUESTS */}
          {activeTab === "pending" && (
            <div className="space-y-3">
              {pendingCards.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-zinc-800 rounded-xl">
                  <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-2 opacity-60" />
                  <p className="text-sm text-zinc-300 font-medium">All Gate Approvals Clear</p>
                  <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                    No dangerous command execution is currently waiting for human-in-the-loop sign-off.
                  </p>
                  <button
                    onClick={() => setActiveTab("simulate")}
                    className="mt-4 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-300 hover:bg-amber-500/20 transition"
                  >
                    Simulate a Dangerous Command
                  </button>
                </div>
              ) : (
                pendingCards.map((card) => {
                  const isTier3 = card.securityTier === 3;
                  const isTier2 = card.securityTier === 2;
                  return (
                    <div
                      key={card.id}
                      className={`p-4 rounded-xl border transition ${
                        isTier3
                          ? "border-rose-500/40 bg-rose-950/20 shadow-lg shadow-rose-950/10"
                          : isTier2
                          ? "border-amber-500/40 bg-amber-950/20"
                          : "border-emerald-500/30 bg-emerald-950/20"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide uppercase ${
                              isTier3
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                : isTier2
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            }`}
                          >
                            Tier {card.securityTier} {isTier3 ? "• Critical" : isTier2 ? "• Mutation" : "• Read-Only"}
                          </span>
                          <span className="text-[11px] font-mono text-zinc-500">{card.id}</span>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          Expires: {new Date(card.expiresAt).toLocaleTimeString()}
                        </span>
                      </div>

                      {/* Command Block */}
                      <div className="rounded-lg bg-black/60 p-2.5 font-mono text-xs text-zinc-200 border border-zinc-800 mb-2 flex items-center justify-between">
                        <code>$ {card.command}</code>
                      </div>

                      {/* Risk Summary */}
                      <p className="text-xs text-zinc-300 mb-2 flex items-start gap-1.5">
                        <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${isTier3 ? "text-rose-400" : "text-amber-400"}`} />
                        <span>{card.riskSummary}</span>
                      </p>

                      {/* Meta pills */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[11px]">
                        <span className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-400 border border-zinc-700">
                          cwd: {card.workingDirectory}
                        </span>
                        <span className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-400 border border-zinc-700">
                          sandbox: {card.sandboxMode}
                        </span>
                        {card.requiredPermissions.map((perm) => (
                          <span key={perm} className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-zinc-400 font-mono text-[10px]">
                            {perm}
                          </span>
                        ))}
                      </div>

                      {/* Human-in-the-loop Action Controls */}
                      <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80">
                        <button
                          onClick={() => handleDecision(card.id, "accept")}
                          className="flex items-center gap-1 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition shadow"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Allow Once
                        </button>
                        <button
                          onClick={() => handleDecision(card.id, "acceptForSession")}
                          className="flex items-center gap-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition"
                        >
                          <Key className="h-3.5 w-3.5 text-amber-400" />
                          Allow for Session
                        </button>
                        <button
                          onClick={() => handleDecision(card.id, "decline")}
                          className="flex items-center gap-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 px-3 py-1.5 text-xs font-medium text-rose-300 transition"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Block & Decline
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Session Authorizations */}
              {sessionAuths.length > 0 && (
                <div className="mt-4 p-3 rounded-xl border border-zinc-800 bg-zinc-950/40">
                  <h3 className="text-xs font-semibold text-zinc-300 mb-2 flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-amber-400" />
                    Session Pre-Authorized Commands ({sessionAuths.length})
                  </h3>
                  <div className="space-y-1">
                    {sessionAuths.map((auth, idx) => (
                      <div key={idx} className="rounded bg-black/40 px-2 py-1 font-mono text-[11px] text-zinc-400 border border-zinc-800/60">
                        {auth}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: AUDIT RECEIPTS */}
          {activeTab === "audit" && (
            <div className="space-y-2.5">
              {auditHistory.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-6">No cryptographic receipts recorded yet.</p>
              ) : (
                auditHistory.map((rcpt) => (
                  <div key={rcpt.id} className="p-3 rounded-lg border border-zinc-800 bg-black/40 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-amber-400 font-semibold">{rcpt.id}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          rcpt.decision.includes("accept") ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                        }`}>
                          {rcpt.decision.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(rcpt.resolvedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-zinc-300 truncate">
                      <code>{rcpt.command}</code>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-zinc-900 text-[10px] text-zinc-500 font-mono">
                      <span>SHA256:</span>
                      <span className="text-zinc-400 select-all truncate">{rcpt.sha256Hash}</span>
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
                <label className="block text-xs font-medium text-zinc-300 mb-1">Command to Simulate:</label>
                <input
                  type="text"
                  value={simCommand}
                  onChange={(e) => setSimCommand(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-black/60 px-3 py-2 text-xs font-mono text-zinc-100 focus:border-amber-500 focus:outline-none"
                  placeholder="e.g. rm -rf /root/.saan/cache"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Security Tier:</label>
                  <select
                    value={simTier}
                    onChange={(e) => setSimTier(Number(e.target.value) as 1 | 2 | 3)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-200"
                  >
                    <option value={1}>Tier 1 (Safe Read-Only)</option>
                    <option value={2}>Tier 2 (Workspace Mutation)</option>
                    <option value={3}>Tier 3 (Critical / Irreversible)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Sandbox Policy:</label>
                  <select
                    value={simSandbox}
                    onChange={(e) => setSimSandbox(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-200"
                  >
                    <option value="workspace-write">Workspace-Write</option>
                    <option value="read-only">Read-Only</option>
                    <option value="unrestricted">Unrestricted</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleSimulate}
                  className="w-full rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2 text-xs font-semibold text-white transition shadow"
                >
                  Create Simulated Gate Request
                </button>
              </div>

              <div className="flex items-center gap-2 pt-2 text-[11px] text-zinc-400">
                <span>Presets:</span>
                <button
                  type="button"
                  onClick={() => {
                    setSimCommand("rm -rf /root/.saan/cache/old_scratch");
                    setSimTier(3);
                  }}
                  className="rounded bg-zinc-800 px-2 py-0.5 hover:bg-zinc-700 text-zinc-300"
                >
                  rm -rf
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSimCommand("git push --force origin backup-staging");
                    setSimTier(2);
                  }}
                  className="rounded bg-zinc-800 px-2 py-0.5 hover:bg-zinc-700 text-zinc-300"
                >
                  git push --force
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSimCommand("cat /etc/hosts");
                    setSimTier(1);
                  }}
                  className="rounded bg-zinc-800 px-2 py-0.5 hover:bg-zinc-700 text-zinc-300"
                >
                  cat safe
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500">
          <span>Sovereign Local Gate • 0 Cloud Leakage</span>
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
