"use client";

import React, { useState, useEffect } from "react";
import {
  Code,
  Layers,
  Sparkles,
  RefreshCw,
  X,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Brain,
  FileCode,
  ExternalLink,
  Play,
} from "lucide-react";

interface ParsedArtifact {
  id: string;
  identifier: string;
  title: string;
  type: "code" | "mermaid" | "html" | "markdown" | "table" | "unknown";
  mimeType: string;
  language?: string;
  content: string;
  filename: string;
}

interface ReasoningParseResult {
  hasReasoning: boolean;
  reasoning: string;
  cleanedAnswer: string;
}

interface CitationChip {
  url: string;
  domain: string;
  title?: string;
  index: number;
}

interface SaanArtifactReasoningModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SaanArtifactReasoningModal({
  isOpen,
  onClose,
}: SaanArtifactReasoningModalProps) {
  const [activeTab, setActiveTab] = useState<"artifacts" | "reasoning" | "workbench">("artifacts");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isThoughtExpanded, setIsThoughtExpanded] = useState(true);

  // Sample or parsed state
  const [sampleText, setSampleText] = useState(
    `<think>\nAnalyzing the requested microkernel service architecture.\nLocal SQLite checkpointer guarantees zero state loss.\n</think>\n\nHere is the architecture definition:\n\n<artifact identifier="kernel-service" title="Local Sovereign Microkernel" type="code" language="typescript">\nexport class LocalMicrokernel {\n  private state = new Map<string, unknown>();\n  public register(service: string) {\n    this.state.set(service, { active: true, uptime: Date.now() });\n  }\n}\n</artifact>\n\nSee details at https://github.com/LibreChat-AI/LibreChat and https://huggingface.co/chat-ui.`
  );

  const [artifacts, setArtifacts] = useState<ParsedArtifact[]>([]);
  const [reasoning, setReasoning] = useState<ReasoningParseResult | null>(null);
  const [citations, setCitations] = useState<CitationChip[]>([]);
  const [selectedArtifactIndex, setSelectedArtifactIndex] = useState(0);

  const handleParse = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "extract_artifacts_and_reasoning",
          text: sampleText,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setReasoning(data.reasoning);
        setArtifacts(data.artifacts);
        setCitations(data.citations);
        setSelectedArtifactIndex(0);
      }
    } catch (e) {
      console.error("Failed to parse artifacts and reasoning", e);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    if (isOpen) {
      handleParse();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentArtifact = artifacts[selectedArtifactIndex] || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#121216] border border-white/10 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/30">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-xl text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-white font-semibold text-lg">Modular Artifacts & CoT Reasoning</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Repos #42 & #43
                </span>
              </div>
              <p className="text-xs text-white/50">
                Interactive slide-out artifacts sandbox, code runners, and expandable &lt;think&gt; reasoning accordions
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
            onClick={() => setActiveTab("artifacts")}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === "artifacts"
                ? "border-cyan-500 text-cyan-400"
                : "border-transparent text-white/60 hover:text-white"
            }`}
          >
            <Code className="w-4 h-4" />
            <span>Artifacts Sandbox ({artifacts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("reasoning")}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === "reasoning"
                ? "border-cyan-500 text-cyan-400"
                : "border-transparent text-white/60 hover:text-white"
            }`}
          >
            <Brain className="w-4 h-4" />
            <span>CoT Reasoning Accordion</span>
          </button>
          <button
            onClick={() => setActiveTab("workbench")}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === "workbench"
                ? "border-cyan-500 text-cyan-400"
                : "border-transparent text-white/60 hover:text-white"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Parser Workbench</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-white/80">
          {/* Artifacts Tab */}
          {activeTab === "artifacts" && (
            <div className="space-y-4">
              {artifacts.length === 0 ? (
                <div className="text-center py-12 text-white/40">
                  <FileCode className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No interactive artifacts detected in current buffer.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Sidebar list of artifacts */}
                  <div className="space-y-2 border-r border-white/10 pr-4">
                    <span className="text-xs font-semibold text-white/60 uppercase tracking-wider block mb-2">
                      Extracted Artifacts
                    </span>
                    {artifacts.map((art, idx) => (
                      <button
                        key={art.id}
                        onClick={() => setSelectedArtifactIndex(idx)}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                          selectedArtifactIndex === idx
                            ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-300"
                            : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="truncate">{art.title}</span>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/10">
                            {art.language || art.type}
                          </span>
                        </div>
                        <div className="text-[10px] text-white/40 font-mono mt-1 truncate">
                          {art.filename}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Main Artifact Viewer */}
                  <div className="md:col-span-2 space-y-3">
                    {currentArtifact && (
                      <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden flex flex-col">
                        <div className="p-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-mono text-cyan-400 font-semibold">
                              {currentArtifact.filename}
                            </span>
                            <span className="text-[10px] text-white/40">
                              ({currentArtifact.mimeType})
                            </span>
                          </div>
                          <button
                            onClick={() => copyToClipboard(currentArtifact.content, currentArtifact.id)}
                            className="p-1 px-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-mono flex items-center space-x-1.5 transition-colors"
                          >
                            {copiedId === currentArtifact.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-white/60" />
                                <span>Copy Code</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="p-4 overflow-x-auto text-xs font-mono text-white/90 leading-relaxed max-h-[350px]">
                          <code>{currentArtifact.content}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reasoning Tab */}
          {activeTab === "reasoning" && (
            <div className="space-y-4">
              {reasoning?.hasReasoning ? (
                <div className="space-y-4">
                  {/* Collapsible CoT Accordion */}
                  <div className="border border-purple-500/30 bg-purple-500/5 rounded-xl overflow-hidden transition-all">
                    <button
                      onClick={() => setIsThoughtExpanded(!isThoughtExpanded)}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-purple-500/10 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300">
                          <Brain className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-purple-300">
                            Thinking Process & Chain-of-Thought
                          </h4>
                          <p className="text-[10px] text-white/50">
                            Internal reasoning tokens hidden from standard output
                          </p>
                        </div>
                      </div>
                      {isThoughtExpanded ? (
                        <ChevronDown className="w-4 h-4 text-purple-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-purple-400" />
                      )}
                    </button>

                    {isThoughtExpanded && (
                      <div className="p-4 pt-1 border-t border-purple-500/20 text-xs font-mono text-purple-200/90 whitespace-pre-wrap leading-relaxed">
                        {reasoning.reasoning}
                      </div>
                    )}
                  </div>

                  {/* Cleaned Response Card */}
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-2">
                    <span className="text-xs font-semibold text-white/60 uppercase tracking-wider block">
                      User-Facing Response (Post-Reasoning Extraction)
                    </span>
                    <div className="text-xs text-white leading-relaxed whitespace-pre-wrap">
                      {reasoning.cleanedAnswer}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-white/40">
                  <Brain className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No &lt;think&gt; reasoning tags found in current message.</p>
                </div>
              )}

              {/* Citations Chips */}
              {citations.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                    Interactive Citation Chips ({citations.length})
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {citations.map((c) => (
                      <a
                        key={c.index}
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 rounded-lg text-xs font-mono text-blue-300 transition-colors"
                      >
                        <span className="text-[10px] text-blue-400 font-bold">[{c.index}]</span>
                        <span>{c.domain}</span>
                        <ExternalLink className="w-3 h-3 text-blue-400" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Workbench Tab */}
          {activeTab === "workbench" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-white block mb-1">
                  Input Stream / Raw Model Generation:
                </label>
                <textarea
                  value={sampleText}
                  onChange={(e) => setSampleText(e.target.value)}
                  rows={6}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors font-mono leading-relaxed"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleParse}
                  disabled={loading}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  <span>Extract Artifacts & CoT</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-black/30 flex justify-between items-center text-xs text-white/40">
          <span>LibreChat Modular Artifacts & HuggingFace CoT Accordion • Clean-Room</span>
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
