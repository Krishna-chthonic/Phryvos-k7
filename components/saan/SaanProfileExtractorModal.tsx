"use client";

import React, { useState, useEffect } from "react";
import { ProfileAttribute, MergeDecision } from "@/lib/saan/profile-extractor";

interface SaanProfileExtractorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SaanProfileExtractorModal({ isOpen, onClose }: SaanProfileExtractorModalProps) {
  const [attributes, setAttributes] = useState<ProfileAttribute[]>([]);
  const [loading, setLoading] = useState(false);
  const [topicFilter, setTopicFilter] = useState<string>("ALL");

  // Fact Merger Sandbox inputs
  const [newTopic, setNewTopic] = useState("companion_preferences");
  const [newSubTopic, setNewSubTopic] = useState("beverage_rituals");
  const [newContent, setNewContent] = useState("");
  const [lastDecision, setLastDecision] = useState<MergeDecision | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_user_profile" }),
      });
      const data = await res.json();
      if (data.ok && data.allAttributes) {
        setAttributes(data.allAttributes);
      }
    } catch (err) {
      console.error("Failed to load user profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMergeAttribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic || !newSubTopic || !newContent.trim()) return;

    setIsSubmitting(true);
    setLastDecision(null);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "update_profile_attribute",
          attribute: {
            topic: newTopic,
            subTopic: newSubTopic,
            content: newContent,
            confidence: 0.95,
          },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setLastDecision(data.decision);
        if (data.allAttributes) {
          setAttributes(data.allAttributes);
        }
        setNewContent("");
      }
    } catch (err) {
      console.error("Failed to merge profile attribute:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProfile();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredAttributes = attributes.filter(
    (a) => topicFilter === "ALL" || a.topic === topicFilter
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-5xl h-[88vh] bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👤</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-white">Categorical User Profile & Fact Merger</h2>
                <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  Memobase Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Topic-constrained user modeling, confidence badges & 3-state fact merger (APPEND / UPDATE / ABORT)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            ✕ Close
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Categorical Profile Cards */}
          <div className="flex-1 flex flex-col p-6 overflow-y-auto border-r border-slate-800 space-y-4">
            {/* Topic Filter Pills */}
            <div className="flex flex-wrap gap-1.5 pb-2 border-b border-slate-800/80">
              {["ALL", "basic_info", "companion_preferences", "personalization", "interaction_history"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTopicFilter(t)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition ${
                    topicFilter === t
                      ? "bg-teal-600 text-white shadow-sm"
                      : "bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800"
                  }`}
                >
                  {t.replace(/_/g, " ").toUpperCase()}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-center py-16 text-slate-500 text-xs font-mono animate-pulse">
                Loading profile attributes...
              </div>
            ) : filteredAttributes.length > 0 ? (
              <div className="space-y-3">
                {filteredAttributes.map((attr) => (
                  <div
                    key={attr.id || `${attr.topic}_${attr.subTopic}`}
                    className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-teal-500/30 transition flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-500/15 text-teal-300 border border-teal-500/30">
                          {attr.topic.toUpperCase()}
                        </span>
                        <span className="text-xs font-mono text-slate-400 font-semibold">
                          {attr.subTopic.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono text-[10px]">
                        <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 font-bold">
                          {Math.round(attr.confidence * 100)}% Conf
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-medium pt-1">
                      {attr.content}
                    </p>
                    <span className="text-[10px] font-mono text-slate-500 text-right">
                      Updated: {new Date(attr.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-slate-500 text-xs font-mono">
                No profile attributes found in this topic.
              </div>
            )}
          </div>

          {/* Right Column: 3-State Fact Merger Sandbox */}
          <div className="w-88 flex flex-col bg-slate-900/40 p-5 overflow-y-auto space-y-4">
            <span className="text-xs font-mono font-bold text-teal-400">⚙️ 3-State Fact Merger Sandbox</span>

            {/* Merge Result Banner */}
            {lastDecision && (
              <div
                className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                  lastDecision.action === "APPEND"
                    ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
                    : lastDecision.action === "UPDATE"
                    ? "bg-amber-950/40 border-amber-500/40 text-amber-200"
                    : "bg-slate-900 border-slate-700 text-slate-400"
                }`}
              >
                <div className="flex items-center justify-between font-mono font-bold text-[11px]">
                  <span>DECISION: {lastDecision.action}</span>
                  <span className="text-[10px]">{lastDecision.action === "ABORT" ? "NO-OP" : "COMMITTED"}</span>
                </div>
                <p className="text-[11px] leading-snug font-serif italic text-slate-300">
                  &ldquo;{lastDecision.thought}&rdquo;
                </p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleMergeAttribute} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div>
                <label className="text-[10px] font-mono text-slate-400">Topic</label>
                <select
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-slate-100"
                >
                  <option value="basic_info">basic_info</option>
                  <option value="companion_preferences">companion_preferences</option>
                  <option value="personalization">personalization</option>
                  <option value="interaction_history">interaction_history</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400">Subtopic Key</label>
                <input
                  type="text"
                  placeholder="e.g. beverage_rituals, focus_style"
                  value={newSubTopic}
                  onChange={(e) => setNewSubTopic(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-slate-100 font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400">Candidate Statement</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Now prefers green tea instead of chai in the morning."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full mt-1 p-2 text-xs bg-slate-900 border border-slate-700 rounded text-slate-100 resize-none focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white transition disabled:opacity-50"
              >
                {isSubmitting ? "Evaluating..." : "Evaluate & Merge Fact"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
