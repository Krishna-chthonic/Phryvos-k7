"use client";

import React, { useState, useEffect } from "react";
import {
  GnosysSnapshotPayload,
  SnapshotValidationResult,
  MergeStrategy,
  ImportResult,
} from "@/lib/saan/portable-memory-spec";

interface SaanPortableMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMemoryImported?: () => void;
}

export function SaanPortableMemoryModal({
  isOpen,
  onClose,
  onMemoryImported,
}: SaanPortableMemoryModalProps) {
  const [activeTab, setActiveTab] = useState<"export" | "import" | "dify">("export");
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<GnosysSnapshotPayload | null>(null);
  const [difyDataset, setDifyDataset] = useState<any>(null);

  // Import State
  const [importJsonText, setImportJsonText] = useState("");
  const [validationResult, setValidationResult] = useState<SnapshotValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [mergeStrategy, setMergeStrategy] = useState<MergeStrategy>("UNION");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const fetchExportSnapshot = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "export_memory_snapshot" }),
      });
      const data = await res.json();
      if (data.ok) {
        setSnapshot(data.snapshot);
        setDifyDataset(data.difyDataset);
      }
    } catch (err) {
      console.error("Failed to export memory snapshot:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchExportSnapshot();
      setImportResult(null);
      setValidationResult(null);
    }
  }, [isOpen]);

  const handleCopySnapshot = () => {
    if (!snapshot) return;
    navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleDownloadFile = () => {
    if (!snapshot) return;
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `saan-memory-vault-${snapshot.agentId}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadDify = () => {
    if (!difyDataset) return;
    const blob = new Blob([JSON.stringify(difyDataset, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dify-dataset-${difyDataset.dataset_name}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleValidateInput = async () => {
    if (!importJsonText.trim()) return;
    setIsValidating(true);
    setValidationResult(null);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "validate_memory_snapshot",
          snapshot: importJsonText.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setValidationResult(data.validation);
      }
    } catch (err) {
      console.error("Validation error:", err);
    } finally {
      setIsValidating(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!importJsonText.trim()) return;
    setIsImporting(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "import_memory_snapshot",
          snapshot: importJsonText.trim(),
          strategy: mergeStrategy,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setImportResult(data.importResult);
        await fetchExportSnapshot();
        onMemoryImported?.();
      } else {
        setImportResult({
          success: false,
          strategy: mergeStrategy,
          importedFactsCount: 0,
          importedEdgesCount: 0,
          skippedFactsCount: 0,
          error: data.error || "Import failed",
        });
      }
    } catch (err: any) {
      setImportResult({
        success: false,
        strategy: mergeStrategy,
        importedFactsCount: 0,
        importedEdgesCount: 0,
        skippedFactsCount: 0,
        error: err.message,
      });
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💾</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-zinc-100">
                  Gnosys & Dify Sovereign Memory Interchange
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-300">
                  Repo #17
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Open JSON-LD specification, cryptographic SHA-256 integrity & zero vendor lock-in portability
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/30 px-6">
          <button
            onClick={() => setActiveTab("export")}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "export"
                ? "border-emerald-500 text-emerald-400 bg-emerald-950/10"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span>📤 Export JSON-LD</span>
            {snapshot && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                {snapshot.facts.length} facts
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("import")}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "import"
                ? "border-emerald-500 text-emerald-400 bg-emerald-950/10"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span>📥 Import Snapshot</span>
          </button>

          <button
            onClick={() => setActiveTab("dify")}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "dify"
                ? "border-emerald-500 text-emerald-400 bg-emerald-950/10"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span>📑 Dify Dataset DSL</span>
            {difyDataset && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                {difyDataset.documents.length} docs
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: EXPORT */}
          {activeTab === "export" && (
            <div className="space-y-4">
              {/* Vault Stats Header */}
              {snapshot && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-zinc-900/60 border border-zinc-800 p-3 rounded-xl">
                    <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Memory Facts</div>
                    <div className="text-xl font-bold font-mono text-emerald-400">{snapshot.facts.length}</div>
                  </div>
                  <div className="bg-zinc-900/60 border border-zinc-800 p-3 rounded-xl">
                    <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Graph Edges</div>
                    <div className="text-xl font-bold font-mono text-cyan-400">{snapshot.edges.length}</div>
                  </div>
                  <div className="bg-zinc-900/60 border border-zinc-800 p-3 rounded-xl">
                    <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Core Persona</div>
                    <div className="text-xl font-bold font-mono text-purple-400">
                      {snapshot.coreMemory.persona.length} chars
                    </div>
                  </div>
                  <div className="bg-zinc-900/60 border border-zinc-800 p-3 rounded-xl">
                    <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Core Human</div>
                    <div className="text-xl font-bold font-mono text-amber-400">
                      {snapshot.coreMemory.human.length} chars
                    </div>
                  </div>
                </div>
              )}

              {/* Checksum Pill */}
              {snapshot?.checksum && (
                <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-xs text-zinc-400 font-medium whitespace-nowrap">SHA-256 Checksum:</span>
                    <span className="text-[11px] font-mono text-emerald-400 truncate">
                      {snapshot.checksum}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(snapshot.checksum!);
                    }}
                    className="text-[11px] px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors whitespace-nowrap"
                  >
                    Copy Hash
                  </button>
                </div>
              )}

              {/* Code Preview */}
              <div className="relative">
                <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border border-b-0 border-zinc-800 rounded-t-xl text-xs text-zinc-400">
                  <span>Gnosys v1.0 Standard Snapshot (`application/ld+json`)</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopySnapshot}
                      className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-[11px] transition-colors"
                    >
                      {copySuccess ? "✓ Copied!" : "Copy JSON"}
                    </button>
                    <button
                      onClick={handleDownloadFile}
                      className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] transition-colors"
                    >
                      Download .json
                    </button>
                  </div>
                </div>
                <pre className="p-4 bg-zinc-950 border border-zinc-800 rounded-b-xl text-[11px] font-mono text-zinc-300 max-h-72 overflow-y-auto leading-relaxed">
                  {loading
                    ? "Generating canonical Gnosys snapshot..."
                    : snapshot
                    ? JSON.stringify(snapshot, null, 2)
                    : "No snapshot available"}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 2: IMPORT */}
          {activeTab === "import" && (
            <div className="space-y-4">
              <div className="text-xs text-zinc-400">
                Paste a Gnosys v1.0 JSON-LD memory snapshot below. The cryptographic checksum will be verified
                before applying.
              </div>

              <div>
                <textarea
                  rows={8}
                  placeholder='Paste Gnosys JSON-LD snapshot here (e.g., {"@context": "https://w3id.org/gnosys/v1", "@type": "MemorySnapshot", ...})'
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleValidateInput}
                    disabled={isValidating || !importJsonText.trim()}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 border border-zinc-700 transition-colors"
                  >
                    {isValidating ? "Validating..." : "🔍 Validate Checksum & Schema"}
                  </button>

                  {/* Merge Strategy Selector */}
                  <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-[11px]">
                    <span className="text-zinc-500 px-2">Strategy:</span>
                    {(["UNION", "OVERWRITE", "CONSERVATIVE"] as MergeStrategy[]).map((strat) => (
                      <button
                        key={strat}
                        type="button"
                        onClick={() => setMergeStrategy(strat)}
                        className={`px-2 py-0.5 rounded font-mono transition-colors ${
                          mergeStrategy === strat
                            ? "bg-emerald-600 text-white font-medium"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {strat}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={isImporting || !importJsonText.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white shadow-lg shadow-emerald-600/20 transition-all"
                >
                  {isImporting ? "Importing..." : "⚡ Execute Sovereign Import"}
                </button>
              </div>

              {/* Validation Result Preview */}
              {validationResult && (
                <div
                  className={`p-3 rounded-xl border ${
                    validationResult.valid
                      ? "border-emerald-800/40 bg-emerald-950/20 text-emerald-300"
                      : "border-rose-800/40 bg-rose-950/20 text-rose-300"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>
                      {validationResult.valid ? "✓ Valid Gnosys Snapshot" : "✕ Validation Failed"}
                    </span>
                    <span className="text-[10px] font-mono">
                      Calculated Hash: {validationResult.calculatedChecksum.slice(0, 16)}...
                    </span>
                  </div>
                  {validationResult.valid ? (
                    <div className="text-xs text-zinc-300 mt-1">
                      Payload verified: Contains <span className="font-mono">{validationResult.factCount}</span> facts,{" "}
                      <span className="font-mono">{validationResult.edgeCount}</span> graph edges, and{" "}
                      <span className="font-mono">{validationResult.coreMemoryChars}</span> core memory chars.
                    </div>
                  ) : (
                    <div className="text-xs text-rose-300 mt-1">{validationResult.error}</div>
                  )}
                </div>
              )}

              {/* Import Result Toast */}
              {importResult && (
                <div
                  className={`p-3 rounded-xl border ${
                    importResult.success
                      ? "border-emerald-800/40 bg-emerald-950/20 text-emerald-300"
                      : "border-rose-800/40 bg-rose-950/20 text-rose-300"
                  }`}
                >
                  <div className="text-xs font-semibold">
                    {importResult.success ? "✓ Memory Import Successful" : "✕ Import Failed"}
                  </div>
                  {importResult.success ? (
                    <div className="text-xs text-zinc-300 mt-1">
                      Imported <span className="font-mono text-emerald-400">{importResult.importedFactsCount}</span> facts,{" "}
                      <span className="font-mono text-cyan-400">{importResult.importedEdgesCount}</span> edges, and skipped{" "}
                      <span className="font-mono text-amber-400">{importResult.skippedFactsCount}</span> duplicate facts using{" "}
                      <span className="font-mono text-emerald-400">{importResult.strategy}</span> strategy.
                    </div>
                  ) : (
                    <div className="text-xs text-rose-300 mt-1">{importResult.error}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DIFY DSL */}
          {activeTab === "dify" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>
                  Dify-compatible Knowledge Dataset JSON view with chunked persona and fact documents.
                </span>
                <button
                  onClick={handleDownloadDify}
                  className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs transition-colors"
                >
                  Download Dify Dataset
                </button>
              </div>

              {difyDataset && (
                <div className="space-y-2">
                  <div className="text-xs font-mono text-zinc-400">
                    Dataset Name: <span className="text-cyan-300">{difyDataset.dataset_name}</span> (
                    {difyDataset.documents.length} documents)
                  </div>
                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {difyDataset.documents.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-zinc-200">{doc.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                            {doc.doc_type}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-300 font-mono line-clamp-2">{doc.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/40 flex items-center justify-between text-xs text-zinc-500">
          <div>Gnosys portable format guarantees complete user data ownership with zero platform lock-in.</div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
