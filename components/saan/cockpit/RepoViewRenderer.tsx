"use client";

import * as React from "react";
import {
  Play,
  RotateCcw,
  Check,
  Copy,
  ExternalLink,
  Clock,
  Shield,
  Tag,
  Code2,
  Terminal,
  Activity,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { RepoMetadata } from "./types";

interface RepoViewRendererProps {
  repo: RepoMetadata;
}

export function RepoViewRenderer({ repo }: RepoViewRendererProps) {
  const [paramsInput, setParamsInput] = React.useState(
    JSON.stringify(repo.defaultParams, null, 2)
  );
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<any | null>(null);
  const [latencyMs, setLatencyMs] = React.useState<number | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [parseError, setParseError] = React.useState<string | null>(null);

  // Sync params when repo changes
  React.useEffect(() => {
    setParamsInput(JSON.stringify(repo.defaultParams, null, 2));
    setResult(null);
    setLatencyMs(null);
    setParseError(null);
  }, [repo]);

  const handleCopyResult = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExecute = async () => {
    setParseError(null);
    let parsedParams: any = {};
    try {
      parsedParams = paramsInput.trim() ? JSON.parse(paramsInput) : {};
    } catch (e: any) {
      setParseError("Invalid JSON syntax in parameters: " + e.message);
      return;
    }

    setLoading(true);
    const start = performance.now();

    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "action",
          action: repo.action,
          params: parsedParams,
        }),
      });

      const data = await res.json();
      const duration = Math.round((performance.now() - start) * 10) / 10;
      setLatencyMs(duration);
      setResult(data.actionResult || data);
    } catch (err: any) {
      const duration = Math.round((performance.now() - start) * 10) / 10;
      setLatencyMs(duration);
      setResult({ success: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setParamsInput(JSON.stringify(repo.defaultParams, null, 2));
    setResult(null);
    setLatencyMs(null);
    setParseError(null);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Top Banner Card matching K7 styling */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 font-mono">
                Repo #{repo.num} of 50
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                {repo.categoryName}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                Commit: {repo.commit}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {repo.license}
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {repo.title}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl">
              {repo.description}
            </p>
          </div>

          <div className="shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              <Code2 className="w-3.5 h-3.5 text-zinc-500" />
              {repo.repoSlug}
            </span>
          </div>
        </div>

        {/* Feature Highlights Chips */}
        <div className="mt-4 pt-4 border-t border-zinc-200/60 dark:border-zinc-800/80 flex flex-wrap gap-2">
          {repo.highlights.map((h, i) => (
            <div
              key={i}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-50 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              {h}
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Action Playground Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Parameter Editor */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-5 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-purple-500" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Live Controller Action:
                <span className="ml-1.5 font-mono text-purple-600 dark:text-purple-400 text-xs px-2 py-0.5 rounded bg-purple-500/10">
                  {repo.action}
                </span>
              </h3>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1"
              title="Reset default parameters"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>

          <div className="flex-1 flex flex-col space-y-2">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Input Payload (JSON format)
            </label>
            <textarea
              value={paramsInput}
              onChange={(e) => setParamsInput(e.target.value)}
              className="flex-1 min-h-[220px] w-full font-mono text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y"
              spellCheck={false}
            />
            {parseError && (
              <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {parseError}
              </p>
            )}
          </div>

          <div className="pt-2 flex items-center justify-between">
            <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-500" />
              <span>Tier 1 Auto-Permitted</span>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={handleExecute}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 active:scale-95 disabled:opacity-50 transition shadow-sm"
            >
              {loading ? (
                <>
                  <Activity className="w-3.5 h-3.5 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Execute Action
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Live Output Inspector */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-5 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Action Output & State Response
              </h3>
            </div>
            {result && (
              <div className="flex items-center gap-3">
                {latencyMs !== null && (
                  <span className="text-xs font-mono text-zinc-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-emerald-500" />
                    {latencyMs}ms
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleCopyResult}
                  className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-[220px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4 font-mono text-xs overflow-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[180px] space-y-2 text-zinc-500">
                <Activity className="w-5 h-5 animate-spin text-purple-500" />
                <p className="text-xs">Dispatching {repo.action} through Saan controller...</p>
              </div>
            ) : result ? (
              <pre className="text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap word-break">
                {JSON.stringify(result, null, 2)}
              </pre>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[180px] text-zinc-400 dark:text-zinc-600 space-y-2 text-center p-6">
                <Sparkles className="w-8 h-8 opacity-40" />
                <p className="text-xs">
                  Click <strong className="text-zinc-700 dark:text-zinc-300">"Execute Action"</strong> to run {repo.action} against the live Phryvos K7 backend.
                </p>
              </div>
            )}
          </div>

          {result && result.message && (
            <div className="p-3 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 text-xs text-zinc-700 dark:text-zinc-300">
              <span className="font-semibold text-purple-600 dark:text-purple-400">Message: </span>
              {result.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
