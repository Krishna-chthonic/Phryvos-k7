"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Sliders,
  Sparkles,
  RefreshCw,
  X,
  Lock,
  Key,
  Mail,
  Code,
  Play,
  Check,
  AlertTriangle,
} from "lucide-react";

interface ModelGenerationConfig {
  temperature: number;
  topP: number;
  maxTokens: number;
  systemPromptOverride?: string;
  enableCredentialScrubber: boolean;
  enablePiiScrubber: boolean;
  enableCodeSanitizer: boolean;
}

interface SaanPreflightPipelineModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SaanPreflightPipelineModal({
  isOpen,
  onClose,
}: SaanPreflightPipelineModalProps) {
  const [activeTab, setActiveTab] = useState<"valves" | "generation" | "tester">("valves");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ModelGenerationConfig>({
    temperature: 0.7,
    topP: 0.95,
    maxTokens: 4096,
    systemPromptOverride: "",
    enableCredentialScrubber: true,
    enablePiiScrubber: true,
    enableCodeSanitizer: true,
  });

  // Sandbox Tester State
  const [testPrompt, setTestPrompt] = useState(
    "Connect to cluster using API key sk-proj-1234567890abcdef1234 and notify dev@example.com at +1-555-867-5309."
  );
  const [testResult, setTestResult] = useState<{
    processedPrompt: string;
    totalRedactions: number;
    detectedTypes: string[];
  } | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_preflight_config" }),
      });
      const data = await res.json();
      if (data.ok && data.config) {
        setConfig(data.config);
      }
    } catch (e) {
      console.error("Failed to fetch preflight config", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (updated: Partial<ModelGenerationConfig>) => {
    try {
      setSaving(true);
      const next = { ...config, ...updated };
      setConfig(next);
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "update_preflight_config",
          config: next,
        }),
      });
      const data = await res.json();
      if (data.ok && data.config) {
        setConfig(data.config);
      }
    } catch (e) {
      console.error("Failed to update preflight config", e);
    } finally {
      setSaving(false);
    }
  };

  const handleRunTest = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "test_preflight_pipeline",
          prompt: testPrompt,
          customConfig: config,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult(data.result);
      }
    } catch (e) {
      console.error("Failed to test preflight pipeline", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
      handleRunTest();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#121216] border border-white/10 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/30">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-xl text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-white font-semibold text-lg">Open-WebUI Preflight Valves & Generation</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Repo #41
                </span>
              </div>
              <p className="text-xs text-white/50">
                Preflight security valves, credential redactor, PII masker & model generation parameters
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
            onClick={() => setActiveTab("valves")}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === "valves"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-white/60 hover:text-white"
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Security Valves</span>
          </button>
          <button
            onClick={() => setActiveTab("generation")}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === "generation"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-white/60 hover:text-white"
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Generation Parameters</span>
          </button>
          <button
            onClick={() => setActiveTab("tester")}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === "tester"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-white/60 hover:text-white"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Preflight Sandbox</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-white/80">
          {/* Security Valves Tab */}
          {activeTab === "valves" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 mt-0.5">
                    <Key className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Credential & Secret Scrubber Valve</h4>
                    <p className="text-xs text-white/50 mt-0.5">
                      Intercepts and masks OpenAI (sk-), Anthropic (sk-ant-), AWS (AKIA), GitHub (ghp_), JWTs, and RSA Private Keys before inference.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.enableCredentialScrubber}
                  onChange={(e) => handleSaveConfig({ enableCredentialScrubber: e.target.checked })}
                  className="w-5 h-5 accent-emerald-500 cursor-pointer rounded"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 mt-0.5">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">PII & Contact Redaction Valve</h4>
                    <p className="text-xs text-white/50 mt-0.5">
                      Automatically redacts personal email addresses and telephone numbers to preserve user privacy.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.enablePiiScrubber}
                  onChange={(e) => handleSaveConfig({ enablePiiScrubber: e.target.checked })}
                  className="w-5 h-5 accent-emerald-500 cursor-pointer rounded"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400 mt-0.5">
                    <Code className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Code & Terminal Sanitizer Valve</h4>
                    <p className="text-xs text-white/50 mt-0.5">
                      Strips raw ANSI terminal escape sequences and outer markdown fences prior to tool execution.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.enableCodeSanitizer}
                  onChange={(e) => handleSaveConfig({ enableCodeSanitizer: e.target.checked })}
                  className="w-5 h-5 accent-emerald-500 cursor-pointer rounded"
                />
              </div>
            </div>
          )}

          {/* Generation Parameters Tab */}
          {activeTab === "generation" && (
            <div className="space-y-6">
              {/* Temperature */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-white">Temperature (Creativity vs Determinism):</label>
                  <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {config.temperature.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.5"
                  step="0.05"
                  value={config.temperature}
                  onChange={(e) => handleSaveConfig({ temperature: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-white/40">
                  <span>0.0 (Precise / Code)</span>
                  <span>0.7 (Balanced / Companion)</span>
                  <span>1.5 (Creative / Exploratory)</span>
                </div>
              </div>

              {/* Top-P */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-white">Top-P (Nucleus Sampling):</label>
                  <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {config.topP.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={config.topP}
                  onChange={(e) => handleSaveConfig({ topP: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Max Tokens */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-white">Max Output Tokens:</label>
                  <span className="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {config.maxTokens}
                  </span>
                </div>
                <input
                  type="range"
                  min="512"
                  max="8192"
                  step="256"
                  value={config.maxTokens}
                  onChange={(e) => handleSaveConfig({ maxTokens: parseInt(e.target.value, 10) })}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* System Prompt Override */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-white block">
                  System Prompt Directive Override (Optional):
                </label>
                <textarea
                  value={config.systemPromptOverride || ""}
                  onChange={(e) => handleSaveConfig({ systemPromptOverride: e.target.value })}
                  rows={3}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                  placeholder="e.g. Always respond in high-density bullet points..."
                />
              </div>
            </div>
          )}

          {/* Preflight Tester Tab */}
          {activeTab === "tester" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-white block mb-1">
                  Test Prompt Input (Insert credentials or PII to verify redactor):
                </label>
                <textarea
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  rows={3}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleRunTest}
                  disabled={loading}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  <span>Test Preflight Valves</span>
                </button>
              </div>

              {testResult && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-white/80">Sanitized Prompt:</span>
                      {testResult.totalRedactions > 0 ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                          {testResult.totalRedactions} Secret{testResult.totalRedactions !== 1 ? "s" : ""} Masked
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                          Clean Prompt
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      {testResult.detectedTypes.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-white/10 rounded text-white/60"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl font-mono text-xs text-emerald-300 whitespace-pre-wrap leading-relaxed">
                    {testResult.processedPrompt}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-black/30 flex justify-between items-center text-xs text-white/40">
          <span>Open-WebUI Preflight Valves Architecture • Zero Cloud Leakage</span>
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
