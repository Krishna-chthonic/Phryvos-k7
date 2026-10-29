"use client";

import React, { useState, useEffect } from "react";
import {
  Target,
  Code,
  List,
  Play,
  Trash2,
  RefreshCw,
  X,
  Check,
  Copy,
  Layers,
} from "lucide-react";

interface InteractiveElement {
  index: number;
  tag: string;
  type?: string;
  name?: string;
  role?: string;
  text: string;
  value?: string;
  placeholder?: string;
  href?: string;
  disabled?: boolean;
  checked?: boolean;
  elementHash?: string;
}

interface AccessibilityTreeResult {
  serializedTree: string;
  selectorMap: Record<number, InteractiveElement>;
  interactiveCount: number;
}

interface AccessibilityTreeRecord {
  id: string;
  url?: string;
  title?: string;
  parsedAt: number;
  result: AccessibilityTreeResult;
}

interface SaanAccessibilityTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SaanAccessibilityTreeModal({
  isOpen,
  onClose,
}: SaanAccessibilityTreeModalProps) {
  const [activeTab, setActiveTab] = useState<"tree" | "selectors" | "parse">("tree");
  const [loading, setLoading] = useState(false);
  const [latestRecord, setLatestRecord] = useState<AccessibilityTreeRecord | null>(null);
  const [history, setHistory] = useState<AccessibilityTreeRecord[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Custom parse form
  const [customHtml, setCustomHtml] = useState(
    `<form class="checkout-form">\n  <h3>Confirm Checkout</h3>\n  <label>Delivery Note: <input type="text" name="note" placeholder="Leave at door" /></label>\n  <button type="submit" id="pay-now">Place Order (₹450)</button>\n  <a href="/cart">Back to Cart</a>\n</form>`
  );
  const [customUrl, setCustomUrl] = useState("https://shop.local/checkout");
  const [customTitle, setCustomTitle] = useState("Checkout Flow");

  const fetchState = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_accessibility_tree" }),
      });
      const data = await res.json();
      if (data.ok) {
        setLatestRecord(data.latest);
        setHistory(data.history || []);
      }
    } catch (e) {
      console.error("Failed to load accessibility tree", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchState();
    }
  }, [isOpen]);

  const handleParseCustom = async () => {
    if (!customHtml.trim()) return;
    try {
      setLoading(true);
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "parse_accessibility_tree",
          html: customHtml,
          url: customUrl,
          title: customTitle,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setLatestRecord(data.latest);
        setHistory(data.history || []);
        setActiveTab("tree");
      }
    } catch (e) {
      console.error("Failed to parse accessibility tree", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, idx?: number) => {
    navigator.clipboard.writeText(text);
    if (idx !== undefined) {
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 1500);
    }
  };

  if (!isOpen) return null;

  const currentResult = latestRecord?.result;
  const elements = currentResult?.selectorMap
    ? Object.values(currentResult.selectorMap)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="relative w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl bg-zinc-950 border border-emerald-500/30 shadow-2xl overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold tracking-tight text-white">
                  Browser-Use Accessibility DOM Tree
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Repo #33
                </span>
                <span className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-300 font-mono">
                  {currentResult?.interactiveCount ?? 0} Interactive Nodes
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Token-efficient indexed DOM view `[0], [1]` with paint-order occlusion detection
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchState}
              disabled={loading}
              className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
              title="Refresh tree"
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

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 px-6 pt-3 pb-2 border-b border-zinc-800/80 bg-zinc-900/40 text-xs">
          <button
            onClick={() => setActiveTab("tree")}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === "tree"
                ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/40"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Serialized Tree ({currentResult?.interactiveCount ?? 0})</span>
          </button>
          <button
            onClick={() => setActiveTab("selectors")}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === "selectors"
                ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/40"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Selector Map ({elements.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("parse")}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg font-medium transition ${
              activeTab === "parse"
                ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/40"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Parse Custom HTML</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === "tree" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-zinc-300">Target Page:</span>
                  <span className="text-emerald-400 font-mono">
                    {latestRecord?.url || "https://local-agent.browser/view"}
                  </span>
                  {latestRecord?.title && (
                    <span className="text-zinc-500">({latestRecord.title})</span>
                  )}
                </div>
                <button
                  onClick={() => handleCopy(currentResult?.serializedTree || "")}
                  className="flex items-center space-x-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Tree</span>
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-xs text-emerald-300 leading-relaxed overflow-x-auto whitespace-pre-wrap">
                {currentResult?.serializedTree ||
                  "// No accessibility tree available. Click 'Parse Custom HTML' to generate one."}
              </pre>
            </div>
          )}

          {activeTab === "selectors" && (
            <div className="space-y-3">
              {elements.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-sm">
                  No interactive elements detected in current page.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {elements.map((el) => (
                    <div
                      key={el.index}
                      className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-emerald-500/30 transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            [{el.index}] &lt;{el.tag}&gt;
                          </span>
                          {el.role && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400">
                              role="{el.role}"
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-white truncate">
                          {el.text || el.placeholder || el.value || "(empty label)"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1 text-[11px] font-mono text-zinc-400">
                          {el.type && (
                            <span className="bg-zinc-800/80 px-1.5 py-0.5 rounded">
                              type={el.type}
                            </span>
                          )}
                          {el.name && (
                            <span className="bg-zinc-800/80 px-1.5 py-0.5 rounded">
                              name={el.name}
                            </span>
                          )}
                          {el.href && (
                            <span className="bg-zinc-800/80 px-1.5 py-0.5 rounded text-cyan-400 truncate max-w-[200px]">
                              href={el.href}
                            </span>
                          )}
                          {el.elementHash && (
                            <span className="bg-zinc-800/80 px-1.5 py-0.5 rounded text-purple-400">
                              hash={el.elementHash.slice(0, 8)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs">
                        <span className="text-zinc-500 font-mono">click([{el.index}])</span>
                        <button
                          onClick={() => handleCopy(`click([${el.index}])`, el.index)}
                          className="flex items-center space-x-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                        >
                          {copiedIndex === el.index ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Action</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "parse" && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Target Page URL</label>
                  <input
                    type="text"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Page Title</label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">HTML Markup / DOM Tree</label>
                <textarea
                  rows={9}
                  value={customHtml}
                  onChange={(e) => setCustomHtml(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
                  placeholder="Paste HTML here to serialize into indexed accessibility tree..."
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleParseCustom}
                  disabled={loading || !customHtml.trim()}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  <span>Parse into Indexed Tree</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Sovereign Clean-Room Browser Automation Engine Active</span>
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
