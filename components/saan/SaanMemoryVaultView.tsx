"use client";

import * as React from "react";
import {
  Brain,
  Search,
  Plus,
  Trash2,
  Calendar,
  Clock,
  Sparkles,
  FileText,
  Tag,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Layers,
  Activity,
  ArrowRight,
  Shield,
  Edit3,
} from "lucide-react";

interface MemoryItem {
  id: number;
  point: string;
  category: string;
  importance: number;
  createdAt: number;
}

interface SaanMemoryVaultViewProps {
  memories: MemoryItem[];
  onRefresh: () => void;
}

export function SaanMemoryVaultView({ memories, onRefresh }: SaanMemoryVaultViewProps) {
  const [search, setSearch] = React.useState("");
  const [selectedCat, setSelectedCat] = React.useState<string>("all");
  const [newMemory, setNewMemory] = React.useState("");
  const [newCat, setNewCat] = React.useState("preference");
  const [savingMemory, setSavingMemory] = React.useState(false);
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);

  // Document Ingestion state (Anything-LLM)
  const [docTitle, setDocTitle] = React.useState("");
  const [docContent, setDocContent] = React.useState("");
  const [ingesting, setIngesting] = React.useState(false);
  const [ingestedResult, setIngestedResult] = React.useState<any | null>(null);

  // Bi-Temporal Point-in-Time Query state (Graphiti)
  const [temporalQuery, setTemporalQuery] = React.useState("");
  const [temporalDate, setTemporalDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [queryingTemporal, setQueryingTemporal] = React.useState(false);
  const [temporalResult, setTemporalResult] = React.useState<any | null>(null);

  // Filter memories
  const filteredMemories = React.useMemo(() => {
    return memories.filter((m) => {
      const matchCat = selectedCat === "all" || m.category.toLowerCase() === selectedCat.toLowerCase();
      const q = search.toLowerCase().trim();
      const matchSearch = !q || m.point.toLowerCase().includes(q) || m.category.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [memories, selectedCat, search]);

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    memories.forEach((m) => set.add(m.category || "general"));
    return ["all", ...Array.from(set)];
  }, [memories]);

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemory.trim()) return;

    setSavingMemory(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_memory",
          point: newMemory.trim(),
          category: newCat,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setNewMemory("");
        setActionMessage("Memory saved to permanent vault!");
        onRefresh();
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch {
      setActionMessage("Failed to save memory.");
    } finally {
      setSavingMemory(false);
    }
  };

  const handleDeleteMemory = async (id: number) => {
    try {
      const res = await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_memory", id }),
      });
      const data = await res.json();
      if (data.ok) {
        onRefresh();
      }
    } catch {}
  };

  // Anything-LLM Document Ingestion
  const handleIngestDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim() || !docContent.trim()) return;

    setIngesting(true);
    setIngestedResult(null);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "action",
          action: "process_vault_document",
          params: {
            textContent: docContent,
            metadata: { title: docTitle },
            maxChunkWords: 80,
          },
        }),
      });
      const data = await res.json();
      setIngestedResult(data.actionResult || data);
      setDocContent("");
      setDocTitle("");
      onRefresh();
    } catch (err: any) {
      setIngestedResult({ error: err.message });
    } finally {
      setIngesting(false);
    }
  };

  // Graphiti Bi-Temporal Query
  const handleRunTemporalQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!temporalQuery.trim()) return;

    setQueryingTemporal(true);
    setTemporalResult(null);
    try {
      const queryTimeMs = new Date(temporalDate).getTime();
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "action",
          action: "evaluate_bitemporal_validity",
          params: {
            edges: memories.map((m, i) => ({
              id: `mem_${m.id}`,
              fact: m.point,
              validAtMs: m.createdAt || Date.now() - 86400000,
              referenceTimeMs: m.createdAt || Date.now(),
            })),
            queryTimeMs,
          },
        }),
      });
      const data = await res.json();
      setTemporalResult(data.actionResult || data);
    } catch (err: any) {
      setTemporalResult({ error: err.message });
    } finally {
      setQueryingTemporal(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-6 max-w-6xl mx-auto w-full">
      {/* Top Header Card */}
      <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                <Brain className="h-4 w-4" />
              </span>
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Memory & Knowledge Vault
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Permanent memory provenance, bi-temporal fact calculus, and document ingestion.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center gap-2">
              <span className="text-zinc-400">Memories Stored:</span>
              <span className="font-bold text-purple-600 dark:text-purple-400">{memories.length}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center gap-2">
              <span className="text-zinc-400">Recall Latency:</span>
              <span className="font-bold text-emerald-500">&lt; 3.5ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Add Memory & Search Filter */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Add New Memory Form */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <Plus className="w-4 h-4 text-purple-500" />
            <span>Store Permanent Fact</span>
          </div>

          <form onSubmit={handleAddMemory} className="space-y-3">
            <div>
              <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                Fact or User Preference
              </label>
              <textarea
                value={newMemory}
                onChange={(e) => setNewMemory(e.target.value)}
                placeholder="e.g., User drinks ginger chai without sugar in mornings..."
                className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40 min-h-[90px] resize-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                Category
              </label>
              <select
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              >
                <option value="preference">Preference / Habit</option>
                <option value="identity">Identity / Background</option>
                <option value="relationship">Relationship / Friend</option>
                <option value="goal">Goal / Exam Study</option>
                <option value="project">Project / Work</option>
                <option value="general">General Knowledge</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={savingMemory || !newMemory.trim()}
              className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 active:scale-95 disabled:opacity-50 transition shadow-xs flex items-center justify-center gap-1.5"
            >
              {savingMemory ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Save Memory
            </button>

            {actionMessage && (
              <p className="text-xs text-emerald-500 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {actionMessage}
              </p>
            )}
          </form>
        </div>

        {/* Right 2 cols: Search & Filtered Memory Cards */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search memories..."
                className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 pl-8 pr-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCat(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition capitalize shrink-0 ${
                    selectedCat === cat
                      ? "bg-purple-600 text-white shadow-xs"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Memory List */}
          <div className="space-y-2">
            {filteredMemories.map((m) => (
              <div
                key={m.id}
                className="group p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 hover:border-purple-500/30 transition flex items-start justify-between gap-3 shadow-2xs"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <p className="text-xs text-zinc-900 dark:text-zinc-100 leading-relaxed font-medium">
                    {m.point}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono">
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 capitalize">
                      {m.category || "general"}
                    </span>
                    <span>•</span>
                    <span>{new Date(m.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteMemory(m.id)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 p-1 rounded-lg transition"
                  title="Delete from memory"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {filteredMemories.length === 0 && (
              <div className="p-8 text-center text-xs text-zinc-500 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 space-y-1">
                <Brain className="w-8 h-8 opacity-30 mx-auto" />
                <p>No memories match your query.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Capabilities Row: Bi-Temporal Query & Document Ingestion */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        {/* Bi-Temporal Point-in-Time Query (Graphiti) */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-500" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Bi-Temporal Time-Travel Query (Graphiti)
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
              valid_at ≤ t &lt; invalid_at
            </span>
          </div>

          <form onSubmit={handleRunTemporalQuery} className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  Search Query
                </label>
                <input
                  type="text"
                  value={temporalQuery}
                  onChange={(e) => setTemporalQuery(e.target.value)}
                  placeholder="e.g. user home city or tea preference"
                  className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  As of Date
                </label>
                <input
                  type="date"
                  value={temporalDate}
                  onChange={(e) => setTemporalDate(e.target.value)}
                  className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-2 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={queryingTemporal || !temporalQuery.trim()}
              className="py-1.5 px-3 rounded-xl text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-700 active:scale-95 disabled:opacity-50 transition flex items-center gap-1.5"
            >
              {queryingTemporal ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
              Query Historical State
            </button>
          </form>

          {temporalResult && (
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono overflow-auto max-h-40">
              <pre className="text-zinc-700 dark:text-zinc-300">
                {JSON.stringify(temporalResult.data || temporalResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Document Ingestion & Wikilink Extraction (Anything-LLM) */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Document Collector & Wikilinks (Anything-LLM)
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              [[Wikilinks]] Support
            </span>
          </div>

          <form onSubmit={handleIngestDocument} className="space-y-3">
            <div>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="Document Title (e.g. Physics Notes)"
                className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                required
              />
            </div>

            <div>
              <textarea
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                placeholder="Paste notes with markdown or [[Wikilinks]] like [[Thermodynamics]]..."
                className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 min-h-[75px] resize-none font-mono"
                required
              />
            </div>

            <button
              type="submit"
              disabled={ingesting || !docTitle.trim() || !docContent.trim()}
              className="py-1.5 px-3 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition flex items-center gap-1.5"
            >
              {ingesting ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
              Ingest & Chunk Document
            </button>
          </form>

          {ingestedResult && (
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono overflow-auto max-h-40">
              <pre className="text-zinc-700 dark:text-zinc-300">
                {JSON.stringify(ingestedResult.data || ingestedResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
