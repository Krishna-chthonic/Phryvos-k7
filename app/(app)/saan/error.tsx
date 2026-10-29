"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw, Trash2, Home } from "lucide-react";

export default function SaanErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Saan Section Runtime Error:", error);
  }, [error]);

  const handleClearCacheAndReset = () => {
    try {
      localStorage.removeItem("k7_saan_history");
      localStorage.removeItem("k7_saan_draft");
    } catch {}
    reset();
    window.location.reload();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-zinc-100 bg-zinc-950 font-sans">
      <div className="max-w-md w-full p-6 rounded-2xl bg-zinc-900/90 border border-red-500/30 shadow-2xl flex flex-col items-center text-center space-y-4">
        <div className="p-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h2 className="text-lg font-bold text-zinc-100">Saan Studio Error</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Saan component ko render karte waqt ek error capture hua hai:
          </p>
        </div>

        <div className="w-full p-3 rounded-lg bg-black/60 border border-zinc-800 text-left font-mono text-[11px] text-red-300 max-h-36 overflow-y-auto break-all">
          {error?.message || "Unknown client-side exception"}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-2 w-full">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>

          <button
            type="button"
            onClick={handleClearCacheAndReset}
            className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Cache</span>
          </button>
        </div>

        <a
          href="/unlock"
          className="text-xs text-zinc-500 hover:text-purple-400 transition inline-flex items-center gap-1 mt-2"
        >
          <Home className="w-3 h-3" />
          <span>Go to Vault Unlock</span>
        </a>
      </div>
    </div>
  );
}
