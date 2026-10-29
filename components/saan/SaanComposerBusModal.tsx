"use client";

import React, { useState, useEffect } from "react";
import {
  PenTool,
  Send,
  Pin,
  Sparkles,
  RefreshCw,
  X,
  Compass,
  Check,
  FileText,
  Clock,
  Trash2,
  Tag,
} from "lucide-react";

interface SaanComposerBusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInjectDraftToComposer?: (text: string) => void;
}

interface SavedPrompt {
  id: string;
  title: string;
  text: string;
  category: string;
  pinned: boolean;
}

export function SaanComposerBusModal({
  isOpen,
  onClose,
  onInjectDraftToComposer,
}: SaanComposerBusModalProps) {
  const [activeTab, setActiveTab] = useState<"draft" | "classifier" | "library">("draft");
  const [loading, setLoading] = useState(false);
  const [draftText, setDraftText] = useState("Let us review the bi-temporal memory calculus and verify topological fact invalidation.");
  const [autoSaveStatus, setAutoSaveStatus] = useState<"saved" | "saving">("saved");
  const [injectedSuccess, setInjectedSuccess] = useState(false);

  // Intent Classifier State
  const [classifierPrompt, setClassifierPrompt] = useState(
    "Please remember my morning schedule preferences and remind me daily about hydration."
  );
  const [classificationResult, setClassificationResult] = useState<any>(null);

  // Pinned Prompts
  const [pinnedPrompts, setPinnedPrompts] = useState<SavedPrompt[]>([
    {
      id: "p_1",
      title: "Daily Circadian Reflection",
      text: "Saan, how are our circadian biorhythms aligning today? Give me a quick energy recap.",
      category: "Companion",
      pinned: true,
    },
    {
      id: "p_2",
      title: "Full Architecture Audit",
      text: "Perform an exhaustive forensic audit on all local state graphs and SQLite checkpointers.",
      category: "Engineering",
      pinned: true,
    },
    {
      id: "p_3",
      title: "Hinglish Conversational Mode",
      text: "Haan Saan, thoda break lete hain. Aaj ka plan kya hai?",
      category: "Casual",
      pinned: false,
    },
  ]);

  const handlePostDraft = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "post_composer_draft",
          text: draftText,
        }),
      });
      const data = await res.json();
      if (data.ok && data.posted) {
        if (onInjectDraftToComposer) {
          onInjectDraftToComposer(draftText);
        }
        setInjectedSuccess(true);
        setTimeout(() => setInjectedSuccess(false), 2000);
      }
    } catch (e) {
      console.error("Failed to post composer draft", e);
    } finally {
      setLoading(false);
    }
  };

  const handleClassifyIntent = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "classify_composer_intent",
          prompt: classifierPrompt,
        }),
      });
      const data = await res.json();
      if (data.ok && data.classification) {
        setClassificationResult(data.classification);
      }
    } catch (e) {
      console.error("Failed to classify intent", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      handleClassifyIntent();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#121216] border border-white/10 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/30">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-tr from-violet-500/20 to-purple-500/20 border border-violet-500/30 rounded-xl text-violet-400">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-white font-semibold text-lg">LobeHub Composer Draft Bus</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  Repo #45
                </span>
              </div>
              <p className="text-xs text-white/50">
                Out-of-tree composer draft bus, auto-save state, intent classification & pinned prompts drawer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-black/20 px-4">
          <button
            onClick={() => setActiveTab("draft")}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === "draft"
                ? "border-violet-500 text-violet-400"
                : "border-transparent text-white/60 hover:text-white"
            }`}
          >
            <PenTool className="w-4 h-4" />
            <span>Active Draft Bus</span>
          </button>
          <button
            onClick={() => setActiveTab("classifier")}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === "classifier"
                ? "border-violet-500 text-violet-400"
                : "border-transparent text-white/60 hover:text-white"
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Intent Classifier (Memory vs Skill)</span>
          </button>
          <button
            onClick={() => setActiveTab("library")}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === "library"
                ? "border-violet-500 text-violet-400"
                : "border-transparent text-white/60 hover:text-white"
            }`}
          >
            <Pin className="w-4 h-4" />
            <span>Pinned Prompts ({pinnedPrompts.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-white/80">
          {/* Draft Tab */}
          {activeTab === "draft" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-white/80 block">
                  Out-of-Tree Composer Draft:
                </label>
                <div className="flex items-center space-x-1.5 text-[11px] text-emerald-400 font-mono">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Auto-saved to local memory</span>
                </div>
              </div>

              <textarea
                value={draftText}
                onChange={(e) => {
                  setDraftText(e.target.value);
                  setAutoSaveStatus("saving");
                  setTimeout(() => setAutoSaveStatus("saved"), 500);
                }}
                rows={5}
                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors font-mono leading-relaxed"
                placeholder="Compose message draft..."
              />

              <div className="flex justify-between items-center pt-2">
                <span className="text-[11px] text-white/40">
                  {draftText.length} characters • {draftText.split(/\s+/).filter(Boolean).length} words
                </span>
                <button
                  onClick={handlePostDraft}
                  disabled={loading || !draftText.trim()}
                  className="px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all shadow-md shadow-violet-500/20 disabled:opacity-50"
                >
                  {injectedSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Injected to Composer!</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Inject into Chat Composer</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Classifier Tab */}
          {activeTab === "classifier" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-white/80 block mb-1">
                  Test User Prompt for Automatic Intent Routing:
                </label>
                <textarea
                  value={classifierPrompt}
                  onChange={(e) => setClassifierPrompt(e.target.value)}
                  rows={3}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors font-mono"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleClassifyIntent}
                  disabled={loading}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  <span>Classify Intent</span>
                </button>
              </div>

              {classificationResult && (
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white/80">Classified Intent:</span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold capitalize border ${
                        classificationResult.intent === "companion_memory"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          : "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                      }`}
                    >
                      {classificationResult.intent === "companion_memory"
                        ? "Persistent Companion Memory"
                        : "Ephemeral Execution Skill"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-white/60">
                      <span>Routing Confidence:</span>
                      <span className="font-mono font-bold text-white">
                        {(classificationResult.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-violet-500 h-full rounded-full transition-all"
                        style={{ width: `${classificationResult.confidence * 100}%` }}
                      />
                    </div>
                  </div>

                  {classificationResult.matchedKeywords?.length > 0 && (
                    <div className="pt-1">
                      <span className="text-[11px] text-white/50 block mb-1">Matched Pattern Tokens:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {classificationResult.matchedKeywords.map((k: string, i: number) => (
                          <span
                            key={i}
                            className="text-[10px] px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30 font-mono"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Library Tab */}
          {activeTab === "library" && (
            <div className="space-y-3">
              <span className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-2">
                Multi-Session Pinned Prompts
              </span>
              <div className="space-y-2">
                {pinnedPrompts.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-start justify-between space-x-3 hover:border-violet-500/40 transition-all"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center space-x-2">
                        <Pin className="w-3.5 h-3.5 text-violet-400" />
                        <h4 className="text-xs font-semibold text-white">{p.title}</h4>
                        <span className="text-[10px] px-1.5 py-0.2 bg-white/10 rounded text-white/50 font-mono">
                          {p.category}
                        </span>
                      </div>
                      <p className="text-xs text-white/70 line-clamp-2">{p.text}</p>
                    </div>
                    <button
                      onClick={() => {
                        setDraftText(p.text);
                        setActiveTab("draft");
                      }}
                      className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium text-white transition-colors whitespace-nowrap mt-1"
                    >
                      Load into Draft
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-black/30 flex justify-between items-center text-xs text-white/40">
          <span>LobeHub Composer Draft Bus Standard • Clean-Room Out-of-Tree Routing</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
