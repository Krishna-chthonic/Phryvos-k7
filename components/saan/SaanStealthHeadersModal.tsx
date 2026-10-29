"use client";

import React, { useState, useEffect } from "react";
import {
  EyeOff,
  Smartphone,
  Monitor,
  Copy,
  Check,
  RefreshCw,
  X,
  Shield,
  Code,
  Globe,
} from "lucide-react";

interface DeviceProfile {
  name: string;
  userAgent: string;
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
  defaultBrowserType: "chromium" | "firefox" | "webkit";
  platform: string;
  brands: Array<{ brand: string; version: string }>;
}

interface SaanStealthHeadersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SaanStealthHeadersModal({
  isOpen,
  onClose,
}: SaanStealthHeadersModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>("desktop-chrome-linux");
  const [profiles, setProfiles] = useState<Record<string, DeviceProfile>>({});
  const [activeProfile, setActiveProfile] = useState<DeviceProfile | null>(null);
  const [headers, setHeaders] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [copiedType, setCopiedType] = useState<"json" | "curl" | null>(null);

  const fetchProfiles = async (preset = selectedPreset) => {
    try {
      setLoading(true);
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_stealth_profiles", preset }),
      });
      const data = await res.json();
      if (data.ok) {
        setProfiles(data.profiles || {});
        setActiveProfile(data.activeProfile);
        setHeaders(data.activeHeaders || {});
      }
    } catch (e) {
      console.error("Failed to load stealth profiles", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProfiles(selectedPreset);
    }
  }, [isOpen]);

  const handleSelectPreset = async (preset: string) => {
    setSelectedPreset(preset);
    await fetchProfiles(preset);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(headers, null, 2));
    setCopiedType("json");
    setTimeout(() => setCopiedType(null), 1500);
  };

  const handleCopyCurl = () => {
    const curlHeaderArgs = Object.entries(headers)
      .map(([k, v]) => `-H "${k}: ${v.replace(/"/g, '\\"')}"`)
      .join(" \\\n  ");
    const cmd = `curl -s \\\n  ${curlHeaderArgs} \\\n  "https://target-domain.org"`;
    navigator.clipboard.writeText(cmd);
    setCopiedType("curl");
    setTimeout(() => setCopiedType(null), 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="relative w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl bg-zinc-950 border border-cyan-500/30 shadow-2xl overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <EyeOff className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold tracking-tight text-white">
                  Playwright Stealth Anti-Bot Headers
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Repo #34
                </span>
                <span className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-300 font-mono">
                  {activeProfile?.defaultBrowserType.toUpperCase() || "STEALTH"}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Lightweight anti-bot fingerprint synthesis with Client Hints without Chromium overhead
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchProfiles(selectedPreset)}
              disabled={loading}
              className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
              title="Refresh profile"
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

        {/* Preset Selector Bar */}
        <div className="flex items-center space-x-2 px-6 py-3 border-b border-zinc-800/80 bg-zinc-900/40 overflow-x-auto text-xs">
          {Object.keys(profiles).map((preset) => {
            const p = profiles[preset];
            const isSel = selectedPreset === preset;
            return (
              <button
                key={preset}
                onClick={() => handleSelectPreset(preset)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
                  isSel
                    ? "bg-cyan-600/20 text-cyan-300 border border-cyan-500/40"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent"
                }`}
              >
                {p.isMobile ? (
                  <Smartphone className="w-3.5 h-3.5" />
                ) : (
                  <Monitor className="w-3.5 h-3.5" />
                )}
                <span>{p.name}</span>
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeProfile && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-zinc-400 block mb-0.5">Viewport</span>
                <span className="font-mono text-cyan-300 font-semibold">
                  {activeProfile.viewport.width} × {activeProfile.viewport.height}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-zinc-400 block mb-0.5">Scale / DPR</span>
                <span className="font-mono text-cyan-300 font-semibold">
                  {activeProfile.deviceScaleFactor}x
                </span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-zinc-400 block mb-0.5">Platform</span>
                <span className="font-mono text-cyan-300 font-semibold">
                  {activeProfile.platform}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-zinc-400 block mb-0.5">Touch Capable</span>
                <span className="font-mono text-cyan-300 font-semibold">
                  {activeProfile.hasTouch ? "Yes (Touch)" : "No (Pointer)"}
                </span>
              </div>
            </div>
          )}

          {/* Synthesized Headers Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold text-zinc-300">
                Generated HTTP Request Headers ({Object.keys(headers).length})
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyJson}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                >
                  {copiedType === "json" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-cyan-400">Copied JSON</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleCopyCurl}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 transition"
                >
                  {copiedType === "curl" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-cyan-400">Copied Curl</span>
                    </>
                  ) : (
                    <>
                      <Code className="w-3.5 h-3.5" />
                      <span>Copy Curl Command</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 overflow-hidden text-xs">
              <table className="w-full text-left font-mono">
                <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="px-4 py-2.5 font-medium w-1/3">Header Name</th>
                    <th className="px-4 py-2.5 font-medium">Header Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {Object.entries(headers).map(([key, val]) => (
                    <tr key={key} className="hover:bg-zinc-800/30 transition">
                      <td className="px-4 py-2 text-cyan-300 font-semibold align-top">
                        {key}
                      </td>
                      <td className="px-4 py-2 text-zinc-300 break-all select-all">
                        {val}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            <span>Zero Headless Chromium Memory Footprint (100% Native Headers)</span>
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
