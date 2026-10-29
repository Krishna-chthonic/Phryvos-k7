"use client";

import React, { useState, useEffect } from "react";
import { ProactiveTriggerConfig } from "@/lib/saan/trigger-recall";

interface SaanProactiveTriggerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SaanProactiveTriggerModal({
  isOpen,
  onClose,
}: SaanProactiveTriggerModalProps) {
  const [config, setConfig] = useState<ProactiveTriggerConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewBriefing, setPreviewBriefing] = useState<{
    type: string;
    formatted: string;
    timestamp: string;
    isActive?: boolean;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_proactive_config" }),
      });
      const data = await res.json();
      if (data.ok && data.config) {
        setConfig(data.config);
      }
    } catch (e) {
      console.error("Failed to load proactive config:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  const handleSaveConfig = async () => {
    if (!config) return;
    setSaveStatus("Saving...");
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "update_proactive_config",
          config,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSaveStatus("Saved successfully!");
        setTimeout(() => setSaveStatus(null), 2000);
      } else {
        setSaveStatus("Save failed");
      }
    } catch (e) {
      setSaveStatus("Error saving");
    }
  };

  const handleGeneratePreview = async (type: "morning_chai" | "evening_unwind") => {
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "preview_proactive_briefing",
          briefingType: type,
        }),
      });
      const data = await res.json();
      if (data.ok && data.briefing) {
        setPreviewBriefing({
          ...data.briefing,
          isActive: data.isActive,
        });
      }
    } catch (e) {
      console.error("Failed to generate preview:", e);
    } finally {
      setPreviewLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus("Copied!");
    setTimeout(() => setCopyStatus(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-zinc-950 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-lg">
              ☀️
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                Proactive Trigger & Briefing Engine
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Repo #21 TriggerRecall
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Autonomous Morning Chai briefings, Evening Unwind recaps & active cron hours
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
          {loading ? (
            <div className="text-center py-12 text-zinc-400">Loading proactive triggers...</div>
          ) : config ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Configuration Panel */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                  <span>⏱️ Active Hours & Trigger Windows</span>
                </h3>

                {/* Morning Chai Card */}
                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                      ☕ Morning Chai Window
                    </span>
                    <input
                      type="checkbox"
                      checked={config.morningChai.enabled}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          morningChai: { ...config.morningChai, enabled: e.target.checked },
                        })
                      }
                      className="accent-amber-500 w-4 h-4 rounded cursor-pointer"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-zinc-400 block mb-1">Target Time (HH:MM)</label>
                      <input
                        type="time"
                        value={config.morningChai.time}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            morningChai: { ...config.morningChai, time: e.target.value },
                          })
                        }
                        className="w-full bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-200"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-400 block mb-1">Active Hours Window</label>
                      <div className="text-zinc-300 bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5">
                        {config.morningChai.activeWindow.start} - {config.morningChai.activeWindow.end}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Evening Unwind Card */}
                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-indigo-300 flex items-center gap-1.5">
                      🌙 Evening Unwind Window
                    </span>
                    <input
                      type="checkbox"
                      checked={config.eveningUnwind.enabled}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          eveningUnwind: { ...config.eveningUnwind, enabled: e.target.checked },
                        })
                      }
                      className="accent-indigo-500 w-4 h-4 rounded cursor-pointer"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-zinc-400 block mb-1">Target Time (HH:MM)</label>
                      <input
                        type="time"
                        value={config.eveningUnwind.time}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            eveningUnwind: { ...config.eveningUnwind, time: e.target.value },
                          })
                        }
                        className="w-full bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-200"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-400 block mb-1">Active Hours Window</label>
                      <div className="text-zinc-300 bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5">
                        {config.eveningUnwind.activeWindow.start} - {config.eveningUnwind.activeWindow.end}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleSaveConfig}
                    className="flex-1 py-2 px-4 rounded-xl bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 text-amber-200 font-semibold text-xs transition"
                  >
                    💾 Save Proactive Settings
                  </button>
                  {saveStatus && (
                    <span className="text-xs text-amber-400 font-mono">{saveStatus}</span>
                  )}
                </div>
              </div>

              {/* Live Preview Panel */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                  <span>✨ Live Briefing Previews</span>
                </h3>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleGeneratePreview("morning_chai")}
                    disabled={previewLoading}
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 font-medium text-xs transition flex items-center justify-center gap-1.5"
                  >
                    ☀️ Test Morning Chai
                  </button>
                  <button
                    onClick={() => handleGeneratePreview("evening_unwind")}
                    disabled={previewLoading}
                    className="flex-1 py-2 px-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 text-indigo-300 font-medium text-xs transition flex items-center justify-center gap-1.5"
                  >
                    🌙 Test Evening Unwind
                  </button>
                </div>

                {previewBriefing ? (
                  <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-3 relative">
                    <div className="flex items-center justify-between text-xs text-zinc-400 pb-2 border-b border-zinc-800">
                      <span className="font-semibold text-zinc-300 uppercase tracking-wide">
                        {previewBriefing.type === "morning_chai"
                          ? "☕ Morning Chai Briefing"
                          : "🌙 Evening Unwind Recap"}
                      </span>
                      <div className="flex items-center gap-2">
                        {previewBriefing.isActive !== undefined && (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                              previewBriefing.isActive
                                ? "bg-emerald-950 border border-emerald-500/40 text-emerald-300"
                                : "bg-zinc-800 text-zinc-400"
                            }`}
                          >
                            {previewBriefing.isActive ? "Window Open" : "Window Closed"}
                          </span>
                        )}
                        <button
                          onClick={() => copyToClipboard(previewBriefing.formatted)}
                          className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
                        >
                          {copyStatus || "Copy"}
                        </button>
                      </div>
                    </div>
                    <pre className="text-xs text-zinc-200 whitespace-pre-wrap font-sans leading-relaxed max-h-60 overflow-y-auto">
                      {previewBriefing.formatted}
                    </pre>
                    <div className="text-[10px] text-zinc-500 text-right">
                      Generated at: {new Date(previewBriefing.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 rounded-xl border border-dashed border-zinc-800 text-center text-zinc-500 text-xs">
                    Click a test button above to preview live synthesized briefings with SQLite context.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
