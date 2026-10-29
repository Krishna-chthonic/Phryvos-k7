"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  BookOpen,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Link2,
  Image as ImageIcon,
  CheckCircle2,
  Trash2,
  Play,
  ShieldCheck,
} from "lucide-react";

interface ScrapedArticleRecord {
  id: string;
  url: string;
  title: string;
  markdown: string;
  metadata: {
    title?: string;
    description?: string;
    canonicalUrl?: string;
    author?: string;
  };
  extractedLinksCount: number;
  extractedImagesCount: number;
  scrapedAt: string;
}

interface SaanCleanMarkdownModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SaanCleanMarkdownModal({
  isOpen,
  onClose,
}: SaanCleanMarkdownModalProps) {
  const [articles, setArticles] = useState<ScrapedArticleRecord[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<ScrapedArticleRecord | null>(null);
  const [inputUrl, setInputUrl] = useState("https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"reader" | "raw" | "meta">("reader");

  const fetchArticles = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_scraped_articles" }),
      });
      const data = await res.json();
      if (data.ok && data.articles) {
        setArticles(data.articles);
        if (data.articles.length > 0 && !selectedArticle) {
          setSelectedArticle(data.articles[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch scraped articles:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScrapeClean = async () => {
    if (!inputUrl.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "scrape_webpage_clean",
          url: inputUrl.trim(),
          title: "Web Workers API & Concurrent Background Threads",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setArticles(data.articles || []);
        if (data.article) {
          setSelectedArticle(data.article);
        }
      }
    } catch (err) {
      console.error("Failed to scrape clean:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchArticles();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-4xl rounded-2xl border border-zinc-700 bg-zinc-900/95 p-6 shadow-2xl backdrop-blur-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-zinc-100">Clean Markdown Reader &amp; Scraper</h2>
                <span className="rounded bg-orange-500/10 px-2 py-0.5 text-[10px] font-mono text-orange-400 border border-orange-500/20">
                  Repo #31 (Firecrawl)
                </span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono text-emerald-300 border border-emerald-500/30">
                  CMP Popups &amp; Ads Stripped
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Zero boilerplate reader view: strips headers, footers, cookie notices, and converts HTML to semantic markdown
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

        {/* Input Bar */}
        <div className="flex items-center gap-2 mb-4">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Enter web article URL to scrape cleanly..."
            className="flex-1 rounded-xl border border-zinc-700 bg-black/60 px-3.5 py-2 text-xs font-mono text-zinc-100 focus:border-orange-500 focus:outline-none"
          />
          <button
            onClick={handleScrapeClean}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 px-4 py-2 text-xs font-semibold text-white transition shadow disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Scrape Clean
          </button>
        </div>

        {/* Two-Column Body: Articles List (Left) + Document Reader (Right) */}
        <div className="flex-1 overflow-hidden grid grid-cols-12 gap-4">
          {/* Left Column: Recent Scrapes */}
          <div className="col-span-4 border-r border-zinc-800 pr-3 overflow-y-auto space-y-2">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
              Scraped Articles ({articles.length})
            </span>
            {articles.map((art) => (
              <div
                key={art.id}
                onClick={() => setSelectedArticle(art)}
                className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                  selectedArticle?.id === art.id
                    ? "border-orange-500/40 bg-orange-950/20 shadow-sm"
                    : "border-zinc-800/80 bg-zinc-950/30 hover:border-zinc-700"
                }`}
              >
                <div className="font-semibold text-zinc-200 line-clamp-1">{art.title}</div>
                <div className="text-[10px] font-mono text-zinc-500 truncate mt-0.5">{art.url}</div>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-400">
                  <span>{art.extractedLinksCount} links</span>
                  <span>•</span>
                  <span>{art.extractedImagesCount} images</span>
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: Article Reader */}
          <div className="col-span-8 overflow-y-auto pl-1 flex flex-col">
            {selectedArticle ? (
              <div className="space-y-4">
                {/* Document Top Bar */}
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div className="space-y-0.5">
                    <h3 className="text-base font-bold text-zinc-100">{selectedArticle.title}</h3>
                    <a
                      href={selectedArticle.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-mono text-orange-400 hover:underline flex items-center gap-1"
                    >
                      <span>{selectedArticle.url}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  {/* Tab switches */}
                  <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-zinc-800">
                    <button
                      onClick={() => setActiveTab("reader")}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                        activeTab === "reader" ? "bg-orange-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Reader
                    </button>
                    <button
                      onClick={() => setActiveTab("raw")}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                        activeTab === "raw" ? "bg-orange-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Raw Markdown
                    </button>
                    <button
                      onClick={() => setActiveTab("meta")}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                        activeTab === "meta" ? "bg-orange-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Metadata
                    </button>
                  </div>
                </div>

                {/* Tab: READER MODE */}
                {activeTab === "reader" && (
                  <div className="prose prose-invert max-w-none text-xs text-zinc-300 leading-relaxed font-sans space-y-3 bg-black/30 p-4 rounded-xl border border-zinc-800/80">
                    <div className="whitespace-pre-wrap font-sans text-xs text-zinc-200">
                      {selectedArticle.markdown}
                    </div>
                  </div>
                )}

                {/* Tab: RAW MARKDOWN */}
                {activeTab === "raw" && (
                  <pre className="p-4 rounded-xl bg-black/60 border border-zinc-800 font-mono text-[11px] text-zinc-300 overflow-x-auto whitespace-pre-wrap">
                    {selectedArticle.markdown}
                  </pre>
                )}

                {/* Tab: METADATA */}
                {activeTab === "meta" && (
                  <div className="p-4 rounded-xl bg-black/40 border border-zinc-800 space-y-2 text-xs font-mono">
                    <div>
                      <span className="text-zinc-500">Author:</span>{" "}
                      <span className="text-zinc-200">{selectedArticle.metadata.author || "Unknown"}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Description:</span>{" "}
                      <span className="text-zinc-200">{selectedArticle.metadata.description || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Canonical:</span>{" "}
                      <span className="text-zinc-200">{selectedArticle.metadata.canonicalUrl || selectedArticle.url}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Extracted Links:</span>{" "}
                      <span className="text-orange-400 font-bold">{selectedArticle.extractedLinksCount}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Extracted Images:</span>{" "}
                      <span className="text-orange-400 font-bold">{selectedArticle.extractedImagesCount}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center text-zinc-500">
                <FileText className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-xs">Select an article on the left or scrape a new web page.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            Zero Tracking • Clean Local HTML-to-Markdown Scraper
          </span>
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
