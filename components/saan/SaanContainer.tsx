"use client";

import * as React from "react";
import { MessageSquare, LayoutGrid, Sparkles, Terminal } from "lucide-react";
import { SaanChat } from "./SaanChat";
import { SaanCockpit } from "./cockpit/SaanCockpit";

export function SaanContainer() {
  const [activeView, setActiveView] = React.useState<"chat" | "cockpit">("chat");

  // Allow switching via keyboard shortcut or custom events
  React.useEffect(() => {
    const handleToggle = () => {
      setActiveView((prev) => (prev === "chat" ? "cockpit" : "chat"));
    };
    window.addEventListener("saan:toggle-cockpit", handleToggle);
    return () => window.removeEventListener("saan:toggle-cockpit", handleToggle);
  }, []);

  return (
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden bg-white dark:bg-zinc-950 font-sans">
      {/* Top Universal Mode Switcher Bar */}
      <div className="h-10 shrink-0 border-b border-zinc-200/80 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-sm px-4 flex items-center justify-between z-10 select-none">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold text-xs border border-purple-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Saan Companion</span>
          </div>
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <span className="text-[11px] text-zinc-500 hidden sm:inline">
            50 Repositories Active Matrix
          </span>
        </div>

        {/* View Switcher Segmented Control */}
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveView("chat")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
              activeView === "chat"
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Living Chat</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView("cockpit")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
              activeView === "cockpit"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>50-Repo Cockpit (50 Tabs)</span>
            <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-purple-500/20 text-purple-600 dark:text-purple-300 font-mono">
              50
            </span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden relative">
        {activeView === "chat" ? (
          <SaanChat onOpenCockpit={() => setActiveView("cockpit")} />
        ) : (
          <SaanCockpit />
        )}
      </div>
    </div>
  );
}
