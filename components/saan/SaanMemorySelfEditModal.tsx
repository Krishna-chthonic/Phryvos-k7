"use client";

import React, { useState, useEffect } from "react";
import {
  Brain,
  User,
  Sparkles,
  Code,
  Heart,
  Save,
  Plus,
  RefreshCw,
  X,
  Clock,
  Check,
  AlertCircle,
} from "lucide-react";

type CoreMemoryBlockLabel = "human" | "persona" | "project" | "emotional_state";

interface CoreMemoryBlock {
  label: CoreMemoryBlockLabel;
  content: string;
  maxCharacters?: number;
  updatedAt?: number;
}

interface CoreMemoryCapacityItem {
  label: CoreMemoryBlockLabel;
  length: number;
  maxCapacity: number;
  percentage: number;
  isNearCapacity: boolean;
}

interface CoreMemoryEditEvent {
  id: string;
  timestamp: number;
  block: CoreMemoryBlockLabel;
  operation: "append" | "replace" | "manual_update";
  diffSummary: string;
  author: "saan" | "user";
}

interface SaanMemorySelfEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SaanMemorySelfEditModal({ isOpen, onClose }: SaanMemorySelfEditModalProps) {
  const [blocks, setBlocks] = useState<CoreMemoryBlock[]>([]);
  const [capacity, setCapacity] = useState<CoreMemoryCapacityItem[]>([]);
  const [history, setHistory] = useState<CoreMemoryEditEvent[]>([]);
  const [activeTab, setActiveTab] = useState<CoreMemoryBlockLabel>("human");
  const [editedContent, setEditedContent] = useState("");
  const [appendInput, setAppendInput] = useState("");
  const [findInput, setFindInput] = useState("");
  const [replaceInput, setReplaceInput] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchBlocks = async () => {
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_core_memory_blocks" }),
      });
      const data = await res.json();
      if (data.ok) {
        setBlocks(data.blocks || []);
        setCapacity(data.capacity || []);
        setHistory(data.history || []);
        const current = (data.blocks || []).find((b: any) => b.label === activeTab);
        if (current) setEditedContent(current.content);
      }
    } catch (err) {
      console.warn("Failed to load core memory blocks:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBlocks();
    }
  }, [isOpen]);

  useEffect(() => {
    const cur = blocks.find((b) => b.label === activeTab);
    if (cur) setEditedContent(cur.content);
  }, [activeTab, blocks]);

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleSaveBlock = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "edit_core_memory_block",
          block: activeTab,
          newContent: editedContent,
          author: "user",
        }),
      });
      const data = await res.json();
      if (data.ok && data.result?.success) {
        setBlocks(data.blocks);
        setCapacity(data.capacity);
        setHistory(data.history);
        showStatus(`Saved ${activeTab} block successfully`);
      } else {
        showStatus(data.result?.message || "Failed to update block");
      }
    } catch (err) {
      showStatus("Error updating block");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAppend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appendInput.trim()) return;

    setIsSaving(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "edit_core_memory_block",
          block: activeTab,
          operation: "append",
          text: appendInput.trim(),
          author: "user",
        }),
      });
      const data = await res.json();
      if (data.ok && data.result?.success) {
        setBlocks(data.blocks);
        setCapacity(data.capacity);
        setHistory(data.history);
        setAppendInput("");
        showStatus(`Appended to ${activeTab}`);
      } else {
        showStatus(data.result?.message || "Append rejected");
      }
    } catch (err) {
      showStatus("Append failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReplace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!findInput || !replaceInput) return;

    setIsSaving(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "edit_core_memory_block",
          block: activeTab,
          operation: "replace",
          oldContent: findInput,
          newContent: replaceInput,
          author: "user",
        }),
      });
      const data = await res.json();
      if (data.ok && data.result?.success) {
        setBlocks(data.blocks);
        setCapacity(data.capacity);
        setHistory(data.history);
        setFindInput("");
        setReplaceInput("");
        showStatus(`Replaced in ${activeTab}`);
      } else {
        showStatus(data.result?.message || "Substring not found or rejected");
      }
    } catch (err) {
      showStatus("Replace failed");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const currentCap = capacity.find((c) => c.label === activeTab) || {
    length: editedContent.length,
    maxCapacity: 2500,
    percentage: Math.round((editedContent.length / 2500) * 100),
    isNearCapacity: false,
  };

  const tabIcons: Record<CoreMemoryBlockLabel, React.ReactNode> = {
    human: <User className="w-3.5 h-3.5" />,
    persona: <Sparkles className="w-3.5 h-3.5" />,
    project: <Code className="w-3.5 h-3.5" />,
    emotional_state: <Heart className="w-3.5 h-3.5" />,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[85vh] bg-slate-900 border border-fuchsia-500/30 rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-fuchsia-500/20 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-400">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-wide text-fuchsia-300">
                Letta Core Memory Blocks & Agentic Self-Editing
              </h2>
              <p className="text-xs text-slate-400">
                Pinned System Prompt Memory, Ceiling Guarantees & Live Mutation Audit (Repo #49)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchBlocks}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition"
              title="Refresh Blocks"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Toast Banner */}
        {statusMessage && (
          <div className="px-6 py-2 bg-fuchsia-950/80 border-b border-fuchsia-700/50 text-fuchsia-200 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-fuchsia-400" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Block Selector Tabs */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-950/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {(["human", "persona", "project", "emotional_state"] as CoreMemoryBlockLabel[]).map(
              (label) => {
                const isSelected = activeTab === label;
                const capItem = capacity.find((c) => c.label === label);
                return (
                  <button
                    key={label}
                    onClick={() => setActiveTab(label)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      isSelected
                        ? "bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-500/50"
                        : "bg-slate-900/60 text-slate-400 border border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    {tabIcons[label]}
                    <span className="capitalize">{label.replace("_", " ")}</span>
                    {capItem && (
                      <span className="text-[10px] opacity-70 font-mono">
                        ({capItem.percentage}%)
                      </span>
                    )}
                  </button>
                );
              }
            )}
          </div>

          {/* Capacity Progress Bar */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-mono text-[11px]">
              {currentCap.length} / {currentCap.maxCapacity} chars
            </span>
            <div className="w-24 bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  currentCap.percentage > 85
                    ? "bg-rose-500"
                    : currentCap.percentage > 60
                    ? "bg-amber-500"
                    : "bg-fuchsia-500"
                }`}
                style={{ width: `${Math.min(currentCap.percentage, 100)}%` }}
              />
            </div>
            {currentCap.isNearCapacity && (
              <span className="text-amber-400 text-[10px] flex items-center gap-0.5">
                <AlertCircle className="w-3 h-3" />
                <span>Ceiling Near</span>
              </span>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Editor Area (2 Columns) */}
            <div className="md:col-span-2 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span className="capitalize">Core Block: {activeTab.replace("_", " ")}</span>
                  <button
                    onClick={handleSaveBlock}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-white font-medium text-xs transition"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? "Saving..." : "Save Block"}</span>
                  </button>
                </div>
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  rows={8}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-fuchsia-500 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none font-mono leading-relaxed"
                />
              </div>

              {/* Fast Append Input */}
              <form
                onSubmit={handleAppend}
                className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-fuchsia-400" />
                    <span>Append Note (Agentic Contract)</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="New habit, trait, project milestone..."
                    value={appendInput}
                    onChange={(e) => setAppendInput(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 focus:border-fuchsia-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none font-mono"
                  />
                  <button
                    type="submit"
                    disabled={isSaving || !appendInput.trim()}
                    className="px-3 py-1.5 rounded-lg bg-fuchsia-950 hover:bg-fuchsia-900 border border-fuchsia-600/50 text-fuchsia-200 text-xs font-medium transition"
                  >
                    Append
                  </button>
                </div>
              </form>

              {/* Find & Replace Tools */}
              <form
                onSubmit={handleReplace}
                className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-2"
              >
                <span className="text-xs font-semibold text-slate-300">
                  Targeted Substring Replace
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Old text substring..."
                    value={findInput}
                    onChange={(e) => setFindInput(e.target.value)}
                    className="bg-slate-900 border border-slate-700 focus:border-fuchsia-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none font-mono"
                  />
                  <input
                    type="text"
                    placeholder="New replacement text..."
                    value={replaceInput}
                    onChange={(e) => setReplaceInput(e.target.value)}
                    className="bg-slate-900 border border-slate-700 focus:border-fuchsia-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSaving || !findInput || !replaceInput}
                  className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium transition"
                >
                  Execute Replacement
                </button>
              </form>
            </div>

            {/* Audit Log / History Feed (1 Column) */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-950/40 border border-slate-800 flex flex-col">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Clock className="w-3.5 h-3.5 text-fuchsia-400" />
                <span>Mutation Audit Feed ({history.length})</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 max-h-96 pr-1">
                {history.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No mutations recorded yet.</p>
                ) : (
                  history.slice().reverse().map((ev) => (
                    <div
                      key={ev.id}
                      className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] space-y-1"
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-mono text-fuchsia-300 uppercase">{ev.block}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded font-mono ${
                            ev.author === "saan"
                              ? "bg-purple-950 text-purple-300 border border-purple-800"
                              : "bg-cyan-950 text-cyan-300 border border-cyan-800"
                          }`}
                        >
                          {ev.author}
                        </span>
                      </div>
                      <p className="text-slate-300 font-mono text-[10px] break-words">
                        {ev.diffSummary}
                      </p>
                      <div className="text-[9px] text-slate-500">
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
