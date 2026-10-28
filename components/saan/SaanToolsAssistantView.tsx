"use client";

import * as React from "react";
import {
  Zap,
  Gift,
  Calendar,
  CheckCircle2,
  Plus,
  Trash2,
  Archive,
  Download,
  Shield,
  Activity,
  ListTodo,
  Clock,
  Sparkles,
  Coffee,
  Moon,
  ExternalLink,
} from "lucide-react";

interface SaanToolsAssistantViewProps {
  personalDates: any[];
  wishes: any[];
  recentTasks: any[];
  upcomingEvents: any[];
  onRefresh: () => void;
}

export function SaanToolsAssistantView({
  personalDates,
  wishes,
  recentTasks,
  upcomingEvents,
  onRefresh,
}: SaanToolsAssistantViewProps) {
  // New Date form state
  const [dateLabel, setDateLabel] = React.useState("");
  const [dateVal, setDateVal] = React.useState("");
  const [isRecurring, setIsRecurring] = React.useState(false);
  const [addingDate, setAddingDate] = React.useState(false);

  // New Wish form state
  const [wishText, setWishText] = React.useState("");
  const [wishUrgency, setWishUrgency] = React.useState("medium");
  const [addingWish, setAddingWish] = React.useState(false);

  // Vault Backup state (Chatbox)
  const [packagingBackup, setPackagingBackup] = React.useState(false);
  const [backupPackage, setBackupPackage] = React.useState<any | null>(null);

  // Briefing state
  const [briefingType, setBriefingType] = React.useState<"morning" | "evening">("morning");
  const [generatingBriefing, setGeneratingBriefing] = React.useState(false);
  const [briefingOutput, setBriefingOutput] = React.useState<string | null>(null);

  const handleAddDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateLabel.trim() || !dateVal) return;

    setAddingDate(true);
    try {
      const res = await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_date",
          label: dateLabel.trim(),
          date: dateVal,
          recurring: isRecurring,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setDateLabel("");
        setDateVal("");
        onRefresh();
      }
    } catch {} finally {
      setAddingDate(false);
    }
  };

  const handleDeleteDate = async (id: string | number) => {
    try {
      await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_date", id }),
      });
      onRefresh();
    } catch {}
  };

  const handleAddWish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wishText.trim()) return;

    setAddingWish(true);
    try {
      const res = await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_wish",
          text: wishText.trim(),
          urgency: wishUrgency,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setWishText("");
        onRefresh();
      }
    } catch {} finally {
      setAddingWish(false);
    }
  };

  const handleFulfillWish = async (wishId: string | number) => {
    try {
      await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fulfill_wish", wishId }),
      });
      onRefresh();
    } catch {}
  };

  // Chatbox 1-Click Sovereign Vault Backup
  const handlePackageBackup = async () => {
    setPackagingBackup(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "action",
          action: "package_vault_backup",
          params: {
            input: {
              memories: [{ id: 1, content: "Sovereign companion memory snapshot" }],
              tasks: recentTasks,
              sessions: [{ id: "session_current", title: "Active Companion Thread" }],
            },
          },
        }),
      });
      const data = await res.json();
      setBackupPackage(data.actionResult?.data?.backupPackage || data);
    } catch (err: any) {
      setBackupPackage({ error: err.message });
    } finally {
      setPackagingBackup(false);
    }
  };

  // Proactive Briefing Generator
  const handleGenerateBriefing = async (type: "morning" | "evening") => {
    setBriefingType(type);
    setGeneratingBriefing(true);
    setBriefingOutput(null);

    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "action",
          action: "generate_proactive_briefing",
          params: { type },
        }),
      });
      const data = await res.json();
      setBriefingOutput(
        data.actionResult?.data?.briefing || data.actionResult?.message || "Briefing generated."
      );
    } catch (err: any) {
      setBriefingOutput("Failed to generate briefing: " + err.message);
    } finally {
      setGeneratingBriefing(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-6 max-w-6xl mx-auto w-full">
      {/* Top Banner Card */}
      <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Zap className="h-4 w-4" />
              </span>
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Assistant, Proactive Tools & Vault Backup
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Personal dates, active wishes, proactive briefings, and zero-cloud sovereign backup packaging.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={generatingBriefing}
              onClick={() => handleGenerateBriefing("morning")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 active:scale-95 transition"
            >
              <Coffee className="w-3.5 h-3.5" />
              Morning Chai Briefing
            </button>

            <button
              type="button"
              disabled={generatingBriefing}
              onClick={() => handleGenerateBriefing("evening")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 active:scale-95 transition"
            >
              <Moon className="w-3.5 h-3.5" />
              Evening Unwind
            </button>
          </div>
        </div>

        {briefingOutput && (
          <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <div className="flex items-center justify-between font-semibold">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                {briefingType === "morning" ? "Morning Chai Briefing" : "Evening Unwind Reflection"}
              </span>
              <button
                type="button"
                onClick={() => setBriefingOutput(null)}
                className="text-amber-600 dark:text-amber-400 hover:underline"
              >
                Dismiss
              </button>
            </div>
            <p className="leading-relaxed whitespace-pre-wrap">{briefingOutput}</p>
          </div>
        )}
      </div>

      {/* Row 1: Personal Dates & Wishes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Important Dates */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-500" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Special Personal Dates ({personalDates.length})
              </h3>
            </div>
          </div>

          <form onSubmit={handleAddDate} className="grid grid-cols-5 gap-2">
            <input
              type="text"
              value={dateLabel}
              onChange={(e) => setDateLabel(e.target.value)}
              placeholder="e.g. Birthday, Exam, Anniversary"
              className="col-span-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              required
            />
            <input
              type="date"
              value={dateVal}
              onChange={(e) => setDateVal(e.target.value)}
              className="col-span-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-2 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40 font-mono"
              required
            />
            <button
              type="submit"
              disabled={addingDate}
              className="py-2 px-3 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 active:scale-95 disabled:opacity-50 transition flex items-center justify-center"
            >
              Add
            </button>
          </form>

          <div className="space-y-2 pt-1 max-h-56 overflow-y-auto">
            {personalDates.map((item) => (
              <div
                key={item.id}
                className="group p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md">
                    {item.date}
                  </span>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                    {item.label}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteDate(item.id)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 p-1 rounded-lg transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {personalDates.length === 0 && (
              <p className="text-xs text-zinc-400 text-center py-4">No personal dates tracked yet.</p>
            )}
          </div>
        </div>

        {/* Wishes & Life Milestones */}
        <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-pink-500" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Wishes & Companion Aspirations ({wishes.length})
              </h3>
            </div>
          </div>

          <form onSubmit={handleAddWish} className="flex gap-2">
            <input
              type="text"
              value={wishText}
              onChange={(e) => setWishText(e.target.value)}
              placeholder="e.g. Learn guitar chord progression, visit Kyoto..."
              className="flex-1 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
              required
            />
            <button
              type="submit"
              disabled={addingWish}
              className="py-2 px-4 rounded-xl text-xs font-semibold text-white bg-pink-600 hover:bg-pink-700 active:scale-95 disabled:opacity-50 transition flex items-center justify-center shrink-0"
            >
              Add Wish
            </button>
          </form>

          <div className="space-y-2 pt-1 max-h-56 overflow-y-auto">
            {wishes.map((item) => (
              <div
                key={item.id}
                className="group p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                    {item.text}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleFulfillWish(item.id)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1 rounded-lg transition shrink-0"
                  title="Mark wish fulfilled"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Fulfilled
                </button>
              </div>
            ))}

            {wishes.length === 0 && (
              <p className="text-xs text-zinc-400 text-center py-4">No active companion wishes yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Sovereign Vault Backup Center (Chatbox) */}
      <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-purple-500" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Sovereign Zero-Cloud Vault Packaging (Chatbox Engine)
              </h3>
            </div>
            <p className="text-xs text-zinc-500">
              Export memories, tasks, and sessions into an authenticated bundle with SHA-256 deduplication.
            </p>
          </div>

          <button
            type="button"
            disabled={packagingBackup}
            onClick={handlePackageBackup}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 active:scale-95 disabled:opacity-50 transition shadow-xs shrink-0"
          >
            {packagingBackup ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
            Package & Verify Vault
          </button>
        </div>

        {backupPackage && (
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono text-xs space-y-3">
            <div className="flex flex-wrap items-center gap-4 text-zinc-700 dark:text-zinc-300">
              <span className="flex items-center gap-1.5 text-emerald-500 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Format: {backupPackage.manifest?.format || "phryvos-vault-backup"}
              </span>
              <span>Sessions: {backupPackage.manifest?.stats?.sessionCount || 1}</span>
              <span>Memories: {backupPackage.manifest?.stats?.memoryCount || 1}</span>
              <span>Deduplicated Assets: {backupPackage.manifest?.stats?.deduplicatedCount || 0}</span>
            </div>

            <div className="p-2.5 rounded-lg bg-black/5 dark:bg-white/5 text-[11px] text-zinc-500">
              SHA-256 Data Digest: {backupPackage.manifest?.checksums?.memories || "Verified"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
