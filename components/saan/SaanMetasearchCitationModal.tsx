"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Globe,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Layers,
  ArrowRight,
  RefreshCw,
  Compass,
  CheckCircle2,
  Filter,
} from "lucide-react";

interface AggregatedSearchResult {
  title: string;
  url: string;
  content: string;
  engines: string[];
  positions: number[];
  score: number;
  publishedDate?: string;
  thumbnail?: string;
}

interface SaanMetasearchCitationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SaanMetasearchCitationModal({
  isOpen,
  onClose,
}: SaanMetasearchCitationModalProps) {
  const [searchQuery, setSearchQuery] = useState("Next.js 16 Server Actions vs Route Handlers");
  const [subqueries, setSubqueries] = useState<string[]>([]);
  const [results, setResults] = useState<AggregatedSearchResult[]>([]);
  const [searchHistory, setSearchHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  const fetchSearchState = async () => {
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_metasearch_state" }),
      });
      const data = await res.json();
      if (data.ok) {
        setSearchHistory(data.history || []);
      }
    } catch (err) {
      console.error("Failed to fetch metasearch history:", err);
    }
  };

  const handleExecuteSearch = async (queryToRun?: string) => {
    const q = (queryToRun || searchQuery).trim();
    if (!q) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "execute_metasearch",
          query: q,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSubqueries(data.subqueries || []);
        setResults(data.results || []);
        setDurationMs(data.durationMs || 12);
        setSearchHistory(data.history || []);
      }
    } catch (err) {
      console.error("Search execution failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSearchState();
      handleExecuteSearch();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl rounded-2xl border border-zinc-700 bg-zinc-900/95 p-6 shadow-2xl backdrop-blur-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-zinc-100">Privacy Metasearch &amp; Query Decomposition</h2>
                <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-mono text-blue-400 border border-blue-500/20">
                  Repos #29 &amp; #30 (SearXNG / Khoj)
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Orthogonal multi-hop query decomposition with SearXNG reciprocal rank fusion &amp; tracking parameter scrubber
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-700 bg-zinc-800 p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition"
          >
            ✕
          </button>
        </div>

        {/* Search Bar Input */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleExecuteSearch()}
              placeholder="Enter complex search query (e.g. Next.js vs Remix on Cloudflare)..."
              className="w-full rounded-xl border border-zinc-700 bg-black/60 pl-9 pr-4 py-2 text-xs font-mono text-zinc-100 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            onClick={() => handleExecuteSearch()}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-semibold text-white transition shadow disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Decompose &amp; Search
          </button>
        </div>

        {/* Khoj Query Decomposition Preview Chips */}
        {subqueries.length > 0 && (
          <div className="mb-4 p-3 rounded-xl border border-blue-500/20 bg-blue-950/15">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-blue-300 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                Khoj Orthogonal Query Decomposition
              </span>
              {durationMs && (
                <span className="text-[10px] font-mono text-zinc-500">
                  Fusion in {durationMs} ms
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {subqueries.map((sub, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSearchQuery(sub);
                    handleExecuteSearch(sub);
                  }}
                  className="flex items-center gap-1 rounded-lg bg-black/50 hover:bg-blue-900/40 border border-blue-500/30 px-2.5 py-1 text-xs text-blue-200 transition"
                >
                  <span className="text-[10px] text-blue-400 font-mono font-bold">#{idx + 1}</span>
                  <span>{sub}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results Stream */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {results.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-8">No search citations found.</p>
          ) : (
            results.map((res, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/40 hover:border-zinc-700 transition space-y-2"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-500/20 text-[10px] font-mono font-bold text-blue-400 border border-blue-500/30">
                        #{idx + 1}
                      </span>
                      <a
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-zinc-100 hover:text-blue-400 transition flex items-center gap-1.5"
                      >
                        <span>{res.title}</span>
                        <ExternalLink className="h-3 w-3 text-zinc-500 hover:text-blue-400 shrink-0" />
                      </a>
                    </div>
                    <div className="text-[11px] font-mono text-blue-400/80 truncate max-w-md">
                      {res.url}
                    </div>
                  </div>

                  {/* Reciprocal Rank Score */}
                  <div className="flex flex-col items-end shrink-0">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                      RRF Score: {res.score}
                    </span>
                    <span className="text-[9px] text-zinc-500 mt-0.5">
                      {res.engines.length} engine{res.engines.length > 1 ? "s" : ""} corroborated
                    </span>
                  </div>
                </div>

                {/* Content Snippet */}
                <p className="text-xs text-zinc-300 leading-relaxed bg-black/30 p-2.5 rounded-lg border border-zinc-900">
                  {res.content}
                </p>

                {/* Badges & Privacy Footer */}
                <div className="flex items-center justify-between text-[10px] pt-1">
                  <div className="flex items-center gap-1.5">
                    {res.engines.map((eng) => (
                      <span
                        key={eng}
                        className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-300 font-mono border border-zinc-700 uppercase text-[9px]"
                      >
                        {eng}
                      </span>
                    ))}
                    {res.publishedDate && (
                      <span className="text-zinc-500 font-mono ml-1">Date: {res.publishedDate}</span>
                    )}
                  </div>

                  <span className="flex items-center gap-1 text-emerald-400/90 font-mono text-[10px]">
                    <ShieldCheck className="h-3 w-3" />
                    UTM Stripped • Sovereign Privacy
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500">
          <span>SearXNG Reciprocal Rank Fusion • Zero Commercial Tracking</span>
          <button
            onClick={onClose}
            className="rounded px-3 py-1 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
