"use client";

import React, { useState, useEffect } from "react";
import {
  MemoryNote,
  SpreadingCascadeResult,
} from "@/lib/saan/associative-memory-network";

interface SaanAssociativeNetworkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SaanAssociativeNetworkModal({
  isOpen,
  onClose,
}: SaanAssociativeNetworkModalProps) {
  const [notes, setNotes] = useState<MemoryNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [seedInput, setSeedInput] = useState("adrak chai");
  const [impulseEnergy, setImpulseEnergy] = useState(1.0);
  const [lastCascade, setLastCascade] = useState<SpreadingCascadeResult | null>(null);
  const [pulsing, setPulsing] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const fetchNetwork = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_associative_network" }),
      });
      const data = await res.json();
      if (data.ok && data.notes) {
        setNotes(data.notes);
      }
    } catch (e) {
      console.error("Failed to load associative network:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNetwork();
    }
  }, [isOpen]);

  const handlePulse = async () => {
    if (!seedInput.trim()) return;
    setPulsing(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "pulse_associative_concept",
          seed: seedInput,
          energy: impulseEnergy,
          maxHops: 3,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setLastCascade(data.cascade);
        if (data.notes) setNotes(data.notes);
      }
    } catch (e) {
      console.error("Error firing spreading activation pulse:", e);
    } finally {
      setPulsing(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "add_associative_note",
          content: newNoteContent,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setNewNoteContent("");
        if (data.notes) setNotes(data.notes);
      }
    } catch (e) {
      console.error("Error adding associative note:", e);
    } finally {
      setAddingNote(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col bg-zinc-950 border border-violet-500/30 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400 text-lg">
              🕸️
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                Associative Cognitive Memory Network
                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  Repo #23 AssociativeMemory
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Spreading activation pulse propagation, Hebbian co-activation learning & concept clusters
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
          {/* Pulse Stimulator Panel */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
              <span>⚡ Spreading Activation Stimulator</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs text-zinc-400 block mb-1">Seed Concept or Note Query</label>
                <input
                  type="text"
                  value={seedInput}
                  onChange={(e) => setSeedInput(e.target.value)}
                  placeholder="e.g. adrak chai, jaipur, coding..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Impulse Energy: {impulseEnergy.toFixed(2)}</label>
                <input
                  type="range"
                  min="0.3"
                  max="1.5"
                  step="0.05"
                  value={impulseEnergy}
                  onChange={(e) => setImpulseEnergy(parseFloat(e.target.value))}
                  className="w-full accent-violet-500 cursor-pointer mt-2"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={handlePulse}
                disabled={pulsing}
                className="py-2 px-5 rounded-xl bg-violet-500/20 border border-violet-500/40 hover:bg-violet-500/30 text-violet-200 font-semibold text-xs transition flex items-center gap-2"
              >
                🌊 Fire Activation Pulse
              </button>
              {lastCascade && (
                <div className="text-xs text-zinc-400 font-mono">
                  Cascade: {lastCascade.steps.length} hops in {lastCascade.durationMs}ms
                </div>
              )}
            </div>

            {/* Cascade Flow Visualization */}
            {lastCascade && lastCascade.steps.length > 0 && (
              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/70 space-y-2">
                <div className="text-[11px] font-semibold text-violet-300 uppercase tracking-wider">
                  Cascade Propagation Wave:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {lastCascade.steps.map((st, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border border-zinc-800 bg-zinc-900/60 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-[10px] text-zinc-400">
                        <span className="font-mono text-violet-400">Hop {st.hop}</span>
                        <span className="font-mono text-emerald-400">+{(st.propagatedEnergy * 100).toFixed(0)}%</span>
                      </div>
                      <div className="text-zinc-200 truncate font-medium text-[11px]">
                        {st.content}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        Total Energy: {(st.newActivation * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Active Concept Web Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <span>🕸️ Network Concept Nodes ({notes.length})</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto">
              {notes.map((note) => {
                const energyPct = Math.round(((note.activation ?? 0.2) * 100));
                return (
                  <div
                    key={note.id}
                    className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-violet-500/30 transition space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300 uppercase">
                        {note.category || "concept"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-zinc-400 font-mono">
                          Links: {note.links.length}
                        </span>
                        <span className="text-xs font-mono font-bold text-violet-300">
                          {energyPct}%
                        </span>
                      </div>
                    </div>
                    {/* Energy Bar */}
                    <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300"
                        style={{ width: `${Math.min(100, energyPct)}%` }}
                      />
                    </div>
                    <div className="text-xs text-zinc-200 line-clamp-2">
                      {note.content}
                    </div>
                    {note.tags && note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {note.tags.slice(0, 4).map((t, idx) => (
                          <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-950 text-zinc-400 font-mono">
                            #{t.replace("theme:", "")}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Add Note Form */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 space-y-3">
            <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Add Concept to Associative Network
            </h4>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder="Enter new memory note or concept association..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500/50"
              />
              <button
                onClick={handleAddNote}
                disabled={addingNote || !newNoteContent.trim()}
                className="py-2 px-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs transition disabled:opacity-50"
              >
                + Add Note
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
