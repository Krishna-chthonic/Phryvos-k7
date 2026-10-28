"use client";

import * as React from "react";
import {
  BookmarkCheck,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  X,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export interface DeedItem {
  id: string;
  text: string;
  turn: number;
  status: "open" | "answered" | "dismissed";
  affects?: string[];
  witnesses?: string[];
  nudged?: number;
}

interface SaanConsequenceTrackerProps {
  deeds: DeedItem[];
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function SaanConsequenceTracker({
  deeds = [],
  isOpen,
  onClose,
  onRefresh,
}: SaanConsequenceTrackerProps) {
  const [newDeedText, setNewDeedText] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"open" | "all">("open");

  if (!isOpen) return null;

  const filteredDeeds =
    activeTab === "open" ? deeds.filter((d) => d.status === "open") : deeds;

  const handleAddDeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeedText.trim() || submitting) return;

    try {
      setSubmitting(true);
      const res = await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_deed",
          text: newDeedText.trim(),
        }),
      });
      const d = await res.json();
      if (d.ok) {
        setNewDeedText("");
        onRefresh();
      }
    } catch (err) {
      console.error("Failed to add deed", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkAnswered = async (deedId: string) => {
    try {
      const res = await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_deed_answered",
          deedId,
        }),
      });
      const d = await res.json();
      if (d.ok) onRefresh();
    } catch (err) {
      console.error("Failed to mark deed fulfilled", err);
    }
  };

  const handleDismiss = async (deedId: string) => {
    try {
      const res = await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "dismiss_deed",
          deedId,
        }),
      });
      const d = await res.json();
      if (d.ok) onRefresh();
    } catch (err) {
      console.error("Failed to dismiss deed", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-zinc-950 border border-zinc-800 p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <BookmarkCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <span>Consequence & Promises Ledger</span>
                <span className="px-2 py-0.2 rounded-full text-[10px] bg-purple-500/20 text-purple-300 font-mono">
                  Chronicler Engine
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Shared commitments, debts & vows between Krishna & Saan
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher: Open vs All */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("open")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
              activeTab === "open"
                ? "bg-purple-600 text-white"
                : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Open Commitments ({deeds.filter((d) => d.status === "open").length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
              activeTab === "all"
                ? "bg-purple-600 text-white"
                : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            All Ledger Records ({deeds.length})
          </button>
        </div>

        {/* Add Commitment Input Form */}
        <form onSubmit={handleAddDeed} className="flex items-center gap-2">
          <input
            type="text"
            value={newDeedText}
            onChange={(e) => setNewDeedText(e.target.value)}
            placeholder="Log a new commitment or shared promise..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-purple-500"
          />
          <button
            type="submit"
            disabled={!newDeedText.trim() || submitting}
            className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-medium text-xs flex items-center gap-1 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </form>

        {/* Deeds List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {filteredDeeds.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-500 space-y-1">
              <CheckCircle2 className="w-8 h-8 mx-auto text-zinc-600" />
              <p>No commitments in this view.</p>
              <p className="text-[11px] text-zinc-600">
                Promises mentioned in chat are tracked automatically.
              </p>
            </div>
          ) : (
            filteredDeeds.map((d) => {
              const isOpen = d.status === "open";
              return (
                <div
                  key={d.id}
                  className={`rounded-xl p-3 border transition ${
                    isOpen
                      ? "bg-zinc-900/90 border-purple-500/30 text-zinc-200 shadow-xs"
                      : "bg-zinc-950/60 border-zinc-900 text-zinc-500 opacity-70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-mono uppercase font-bold ${
                            isOpen
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {d.status}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          Turn #{d.turn}
                        </span>
                      </div>
                      <p className="text-xs font-medium leading-relaxed text-zinc-200">
                        {d.text}
                      </p>
                    </div>

                    {/* Action buttons */}
                    {isOpen && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMarkAnswered(d.id)}
                          className="px-2 py-1 rounded-lg text-[11px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 active:scale-95 transition"
                          title="Mark fulfilled / answered"
                        >
                          Fulfilled
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDismiss(d.id)}
                          className="p-1 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-900 transition"
                          title="Dismiss commitment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
