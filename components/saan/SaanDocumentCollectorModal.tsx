"use client";

import React, { useState, useEffect } from "react";
import {
  BookOpen,
  FileText,
  Hash,
  Search,
  Link as LinkIcon,
  Plus,
  X,
  Check,
  FolderOpen,
  Sparkles,
} from "lucide-react";

interface DocumentChunk {
  chunkIndex: number;
  text: string;
  wordCount: number;
  tokenCountEstimate: number;
  checksum: string;
  wikilinks?: string[];
}

interface IngestedDocument {
  id: string;
  title: string;
  url: string;
  docAuthor: string;
  description: string;
  docSource: string;
  chunkSource: string;
  published: string;
  wordCount: number;
  tokenCountEstimate: number;
  chunks: DocumentChunk[];
  detectedWikilinks: string[];
}

interface WikilinkNode {
  tag: string;
  count: number;
  docIds: string[];
}

interface SaanDocumentCollectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertWikilink?: (wikilink: string) => void;
}

export function SaanDocumentCollectorModal({
  isOpen,
  onClose,
  onInsertWikilink,
}: SaanDocumentCollectorModalProps) {
  const [documents, setDocuments] = useState<IngestedDocument[]>([]);
  const [wikilinks, setWikilinks] = useState<WikilinkNode[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Form states for new document ingestion
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("Local User");
  const [source, setSource] = useState("Sovereign Document");
  const [content, setContent] = useState("");
  const [isIngesting, setIsIngesting] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const fetchVaultData = async () => {
    try {
      const resDocs = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_vault_documents" }),
      });
      const dataDocs = await resDocs.json();
      if (dataDocs.ok && Array.isArray(dataDocs.documents)) {
        setDocuments(dataDocs.documents);
        if (dataDocs.documents.length > 0 && !selectedDocId) {
          setSelectedDocId(dataDocs.documents[0].id);
        }
      }

      const resLinks = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "get_vault_wikilinks" }),
      });
      const dataLinks = await resLinks.json();
      if (dataLinks.ok && Array.isArray(dataLinks.graph)) {
        setWikilinks(dataLinks.graph);
      }
    } catch (err) {
      console.warn("Failed to load vault documents:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchVaultData();
    }
  }, [isOpen]);

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setIsIngesting(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "ingest_document",
          textContent: content,
          title: title.trim(),
          metadata: {
            title: title.trim(),
            docAuthor: author.trim() || "Local User",
            docSource: source.trim() || "Sovereign Vault",
            published: new Date().toISOString(),
          },
          maxChunkWords: 120,
        }),
      });
      const data = await res.json();
      if (data.ok && data.document) {
        setTitle("");
        setContent("");
        fetchVaultData();
        setSelectedDocId(data.document.id);
      }
    } catch (err) {
      console.error("Ingestion failed:", err);
    } finally {
      setIsIngesting(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "search_vault_chunks", query: query.trim() }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.results)) {
        setSearchResults(data.results);
      }
    } catch (err) {
      console.warn("Search failed:", err);
    }
  };

  const handleLinkClick = (tag: string) => {
    const wikilinkStr = `[[${tag}]]`;
    if (onInsertWikilink) {
      onInsertWikilink(wikilinkStr);
    }
    navigator.clipboard?.writeText(wikilinkStr);
    setCopiedLink(tag);
    setTimeout(() => setCopiedLink(null), 1800);
  };

  if (!isOpen) return null;

  const currentDoc = documents.find((d) => d.id === selectedDocId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[85vh] bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-500/20 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-wide text-emerald-300">
                Document Collector Vault & Wikilink Graph
              </h2>
              <p className="text-xs text-slate-400">
                Sovereign Chunk Ingestion, SHA-256 Checksums & Bi-Directional [[Wikilinks]]
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Stats */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-950/30 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search chunk text or [[wikilinks]]..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-700 focus:border-emerald-500 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60">
              {documents.length} Docs
            </span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-950/50 border border-emerald-800/40 text-emerald-300">
              {wikilinks.length} Wikilinks
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Wikilink Network Pills */}
          {wikilinks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                <LinkIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span>Obsidian-Style [[Wikilinks]] Cloud (Click to Insert into Composer)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {wikilinks.map((wl) => (
                  <button
                    key={wl.tag}
                    onClick={() => handleLinkClick(wl.tag)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-600/40 text-emerald-300 transition"
                  >
                    <span>[[{wl.tag}]]</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-800/50 text-emerald-200">
                      {wl.count}
                    </span>
                    {copiedLink === wl.tag && <Check className="w-3 h-3 text-emerald-400" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Hits (if query is active) */}
          {searchQuery && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Search Results ({searchResults.length})
              </h3>
              {searchResults.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No matching chunks found.</p>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((res, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-semibold text-emerald-300">{res.docTitle}</span>
                        <span>Chunk #{res.chunkIndex}</span>
                      </div>
                      <p className="text-slate-300 line-clamp-3">{res.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Document Ingestion & Chunk Viewer Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Ingestion Form */}
            <form onSubmit={handleIngest} className="space-y-3 p-4 rounded-xl bg-slate-950/40 border border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Ingest New Document</span>
              </div>
              <input
                type="text"
                placeholder="Document Title (e.g. Cognitive Memory Spec)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Author"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Source / Tag"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                />
              </div>
              <textarea
                placeholder="Paste document text with optional [[wikilinks]] here..."
                rows={5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none font-mono"
              />
              <button
                type="submit"
                disabled={isIngesting || !title.trim() || !content.trim()}
                className="w-full py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-semibold text-xs tracking-wide transition flex items-center justify-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isIngesting ? "Chunking & Hashing..." : "Ingest & Chunk Document"}</span>
              </button>
            </form>

            {/* Ingested Documents List */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-950/40 border border-slate-800 flex flex-col">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <FolderOpen className="w-4 h-4 text-emerald-400" />
                <span>Vault Documents ({documents.length})</span>
              </div>
              {documents.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500 text-xs">
                  <FileText className="w-8 h-8 mb-2 opacity-40 text-emerald-400" />
                  <span>No documents ingested yet. Add one to see automatic chunking & SHA-256 verification.</span>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2 max-h-56 pr-1">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition ${
                        selectedDocId === doc.id
                          ? "bg-emerald-950/40 border-emerald-500/50 text-slate-100"
                          : "bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300"
                      }`}
                    >
                      <div className="font-semibold text-emerald-300 truncate">{doc.title}</div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                        <span>{doc.chunks.length} chunks</span>
                        <span>{doc.wordCount} words</span>
                        <span>{doc.detectedWikilinks.length} wikilinks</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Selected Document Chunk Viewer */}
          {currentDoc && (
            <div className="space-y-3 p-4 rounded-xl bg-slate-950/50 border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-200">
                    Chunks for: {currentDoc.title}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  {currentDoc.chunks.length} semantic chunks • ~{currentDoc.tokenCountEstimate} tokens
                </span>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {currentDoc.chunks.map((chk) => (
                  <div
                    key={chk.chunkIndex}
                    className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-emerald-400">
                          #{chk.chunkIndex}
                        </span>
                        <span>{chk.wordCount} words</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500" title={chk.checksum}>
                        SHA-256: {chk.checksum.slice(0, 12)}...
                      </span>
                    </div>
                    <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">{chk.text}</p>
                    {chk.wikilinks && chk.wikilinks.length > 0 && (
                      <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800/60">
                        <span className="text-[10px] text-slate-500">Links:</span>
                        {chk.wikilinks.map((wl) => (
                          <button
                            key={wl}
                            onClick={() => handleLinkClick(wl)}
                            className="px-2 py-0.5 text-[10px] rounded bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-700/50 text-emerald-300 transition"
                          >
                            [[{wl}]]
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
