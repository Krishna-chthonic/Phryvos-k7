"use client";

import * as React from "react";
import {
  BookOpen,
  Sparkles,
  Save,
  Plus,
  Trash2,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Brain,
  Layers,
  Terminal,
  HelpCircle,
  FileCode,
  Tag,
  Key,
  Shield,
  Edit3,
} from "lucide-react";

interface SaanPersonaStudioViewProps {
  characterCard: any;
  authorsNote: any;
  coreMemory: any;
  lorebookEntries: any[];
  onRefresh: () => void;
}

export function SaanPersonaStudioView({
  characterCard,
  authorsNote,
  coreMemory,
  lorebookEntries,
  onRefresh,
}: SaanPersonaStudioViewProps) {
  const [activeTab, setActiveTab] = React.useState<"card" | "lorebook" | "authors_note" | "core_memory">("card");
  const [saving, setSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState<string | null>(null);

  // Character Card state
  const cardData = characterCard?.data || {};
  const [name, setName] = React.useState(cardData.name || "Saan");
  const [personality, setPersonality] = React.useState(cardData.personality || "");
  const [scenario, setScenario] = React.useState(cardData.scenario || "");
  const [firstMes, setFirstMes] = React.useState(cardData.first_mes || "");
  const [mesExample, setMesExample] = React.useState(cardData.mes_example || "");

  // Author's Note state
  const [anPrompt, setAnPrompt] = React.useState(authorsNote?.prompt || "");
  const [anDepth, setAnDepth] = React.useState(authorsNote?.depth || 2);
  const [anRole, setAnRole] = React.useState<"system" | "user" | "assistant">(authorsNote?.role || "system");
  const [anEnabled, setAnEnabled] = React.useState(authorsNote?.enabled ?? true);

  // Core Memory state
  const [humanBlock, setHumanBlock] = React.useState(coreMemory?.human || "");
  const [personaBlock, setPersonaBlock] = React.useState(coreMemory?.persona || "");

  // Lorebook New Entry state
  const [newLoreKeys, setNewLoreKeys] = React.useState("");
  const [newLoreSecKeys, setNewLoreSecKeys] = React.useState("");
  const [newLoreContent, setNewLoreContent] = React.useState("");
  const [newLoreOrder, setNewLoreOrder] = React.useState(100);
  const [newLoreConstant, setNewLoreConstant] = React.useState(false);

  // Flash success message
  const triggerSuccess = (msg: string) => {
    setSaveSuccess(msg);
    setTimeout(() => setSaveSuccess(null), 3000);
  };

  // Save Author's Note
  const handleSaveAuthorsNote = async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_authors_note",
          authorsNote: {
            prompt: anPrompt,
            depth: Number(anDepth),
            role: anRole,
            enabled: anEnabled,
          },
        }),
      });
      const d = await res.json();
      if (d.ok) {
        triggerSuccess("Author's Note updated successfully!");
        onRefresh();
      }
    } catch {
      alert("Failed to update Author's Note");
    } finally {
      setSaving(false);
    }
  };

  // Save Core Memory Blocks
  const handleSaveCoreMemory = async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_core_memory",
          coreMemory: {
            human: humanBlock,
            persona: personaBlock,
          },
        }),
      });
      const d = await res.json();
      if (d.ok) {
        triggerSuccess("Letta Core Memory Blocks updated!");
        onRefresh();
      }
    } catch {
      alert("Failed to update Core Memory Blocks");
    } finally {
      setSaving(false);
    }
  };

  // Add Lorebook Entry
  const handleAddLoreEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLoreKeys.trim() || !newLoreContent.trim()) return;

    try {
      setSaving(true);
      const keys = newLoreKeys.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
      const secKeys = newLoreSecKeys.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);

      const res = await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_lore_entry",
          loreEntry: {
            keys,
            secondaryKeys: secKeys,
            content: newLoreContent,
            order: Number(newLoreOrder),
            constant: newLoreConstant,
          },
        }),
      });
      const d = await res.json();
      if (d.ok) {
        setNewLoreKeys("");
        setNewLoreSecKeys("");
        setNewLoreContent("");
        triggerSuccess("Lorebook Entry added to memory matrix!");
        onRefresh();
      }
    } catch {
      alert("Failed to add lore entry");
    } finally {
      setSaving(false);
    }
  };

  // Delete Lore Entry
  const handleDeleteLoreEntry = async (id: string) => {
    try {
      const res = await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_lore_entry", id }),
      });
      const d = await res.json();
      if (d.ok) {
        triggerSuccess("Lorebook entry removed");
        onRefresh();
      }
    } catch {
      alert("Failed to delete lore entry");
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-6 max-w-6xl mx-auto w-full font-sans text-zinc-100">
      {/* Top Banner Card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> SillyTavern & RisuAI Spec
              </span>
              <h1 className="text-xl font-bold tracking-tight text-zinc-100">Persona & Lorebook Studio</h1>
            </div>
            <p className="text-xs text-zinc-400 max-w-2xl">
              Configure character personas, dynamic in-chat Author's Notes, selective keyword lorebooks, and Letta Core Memory blocks that stay pinned in Saan's consciousness.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab("card")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "card"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Character V2
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("lorebook")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "lorebook"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Lorebook ({lorebookEntries?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("authors_note")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "authors_note"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Author's Note
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("core_memory")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "core_memory"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Core Memory
            </button>
          </div>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* TAB 1: CHARACTER CARD V2 */}
      {activeTab === "card" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-purple-400" />
              <span>Persona & Identity Specification</span>
            </h2>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Companion Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Personality Directives</label>
              <textarea
                rows={4}
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 focus:outline-none focus:border-purple-500 font-mono leading-relaxed"
                placeholder="Witty, warm, protective, authentic Hinglish banter..."
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Scenario & Environment Context</label>
              <textarea
                rows={3}
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 focus:outline-none focus:border-purple-500 font-mono leading-relaxed"
                placeholder="Living companion assisting Krishna in his sovereign OS workspace..."
              />
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <FileCode className="h-4 w-4 text-pink-400" />
              <span>Greetings & Dialogue Examples (SillyTavern)</span>
            </h2>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">First Greeting Message (first_mes)</label>
              <textarea
                rows={4}
                value={firstMes}
                onChange={(e) => setFirstMes(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 focus:outline-none focus:border-purple-500 font-mono leading-relaxed"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Example Dialogue (mes_example)</label>
              <textarea
                rows={4}
                value={mesExample}
                onChange={(e) => setMesExample(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 focus:outline-none focus:border-purple-500 font-mono leading-relaxed"
                placeholder="<START>&#10;User: Kaisa hai?&#10;Saan: Bilkul fit! Batao aaj kya build karna hai?"
              />
            </div>

            <button
              type="button"
              onClick={() => triggerSuccess("Character Card V2 serialized and active in prompt synthesizer!")}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm"
            >
              <Save className="h-3.5 w-3.5" /> Save Character Card V2
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: LOREBOOK / WORLD INFO */}
      {activeTab === "lorebook" && (
        <div className="space-y-6">
          {/* Add Entry Card */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <Plus className="h-4 w-4 text-emerald-400" />
              <span>Create Lorebook / World Info Entry (Selective Engine)</span>
            </h2>

            <form onSubmit={handleAddLoreEntry} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-400">
                    Primary Activation Keys (comma separated)
                  </label>
                  <input
                    type="text"
                    value={newLoreKeys}
                    onChange={(e) => setNewLoreKeys(e.target.value)}
                    placeholder="e.g. k7, phryvos, masterplan"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-400">
                    Secondary Keys (optional AND filter)
                  </label>
                  <input
                    type="text"
                    value={newLoreSecKeys}
                    onChange={(e) => setNewLoreSecKeys(e.target.value)}
                    placeholder="e.g. architecture, system"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-400">Injected World Context</label>
                <textarea
                  rows={3}
                  value={newLoreContent}
                  onChange={(e) => setNewLoreContent(e.target.value)}
                  placeholder="Enter context that automatically injects when keys are mentioned in conversation..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 focus:outline-none focus:border-purple-500 font-mono leading-relaxed"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newLoreConstant}
                    onChange={(e) => setNewLoreConstant(e.target.checked)}
                    className="rounded bg-zinc-950 border-zinc-800 text-purple-600 focus:ring-0"
                  />
                  <span>Constant Activation (Always active regardless of keys)</span>
                </label>

                <button
                  type="submit"
                  disabled={saving || !newLoreKeys.trim() || !newLoreContent.trim()}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Lore Entry
                </button>
              </div>
            </form>
          </div>

          {/* Active Entries List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Active World Info Entries ({lorebookEntries?.length || 0})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lorebookEntries?.map((entry: any) => (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-2 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {entry.constant ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          CONSTANT
                        </span>
                      ) : (
                        entry.keys?.map((k: string, i: number) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30"
                          >
                            {k}
                          </span>
                        ))
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteLoreEntry(entry.id)}
                      className="text-zinc-500 hover:text-red-400 p-1 rounded-lg transition"
                      title="Delete entry"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed font-mono whitespace-pre-wrap">
                    {entry.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUTHOR'S NOTE */}
      {activeTab === "authors_note" && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 shadow-sm max-w-2xl mx-auto w-full">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              <Sliders className="h-4 w-4 text-purple-400" />
              <span>In-Chat Floating Steering Prompt (Author's Note)</span>
            </h2>
            <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={anEnabled}
                onChange={(e) => setAnEnabled(e.target.checked)}
                className="rounded bg-zinc-950 border-zinc-800 text-purple-600 focus:ring-0"
              />
              <span>Enabled</span>
            </label>
          </div>

          <p className="text-xs text-zinc-400">
            Author's Note dynamically injects a behavioral directive at depth D (turns from bottom of chat) to keep Saan grounded in her authentic voice without drifting into robotic assistant tone.
          </p>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">Steering Prompt</label>
            <textarea
              rows={4}
              value={anPrompt}
              onChange={(e) => setAnPrompt(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 focus:outline-none focus:border-purple-500 font-mono leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">
                Insertion Depth ({anDepth} turns from bottom)
              </label>
              <input
                type="range"
                min={0}
                max={6}
                value={anDepth}
                onChange={(e) => setAnDepth(Number(e.target.value))}
                className="w-full accent-purple-500"
              />
              <span className="text-[10px] text-zinc-500">Recommended: 2 turns (SillyTavern Standard)</span>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Role Target</label>
              <select
                value={anRole}
                onChange={(e) => setAnRole(e.target.value as any)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
              >
                <option value="system">System Role (Standard)</option>
                <option value="user">User Narrative Role</option>
                <option value="assistant">Assistant Role</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveAuthorsNote}
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm"
          >
            <Save className="h-3.5 w-3.5" /> Update Author's Note Injection
          </button>
        </div>
      )}

      {/* TAB 4: LETTA CORE MEMORY */}
      {activeTab === "core_memory" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                  <Brain className="h-4 w-4 text-purple-400" />
                  <span>Human Core Memory Block (Krishna)</span>
                </h2>
                {(() => {
                  const pct = Math.round((humanBlock.length / 2500) * 100);
                  return (
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        pct >= 80
                          ? "bg-rose-500/20 text-rose-300"
                          : pct >= 50
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      {humanBlock.length}/2500 chars ({pct}%)
                    </span>
                  );
                })()}
              </div>
              <p className="text-xs text-zinc-400">
                Pinned in system prompt. Contains verified facts about the user that Saan never forgets or hallucinates.
              </p>
              <textarea
                rows={9}
                value={humanBlock}
                onChange={(e) => setHumanBlock(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 focus:outline-none focus:border-purple-500 font-mono leading-relaxed"
              />
            </div>
            {/* Progress bar */}
            <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  humanBlock.length > 2000
                    ? "bg-rose-500"
                    : humanBlock.length > 1250
                    ? "bg-amber-500"
                    : "bg-cyan-500"
                }`}
                style={{ width: `${Math.min(100, (humanBlock.length / 2500) * 100)}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 shadow-sm flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-pink-400" />
                  <span>Persona Core Memory Block (Saan)</span>
                </h2>
                {(() => {
                  const pct = Math.round((personaBlock.length / 2500) * 100);
                  return (
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        pct >= 80
                          ? "bg-rose-500/20 text-rose-300"
                          : pct >= 50
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      {personaBlock.length}/2500 chars ({pct}%)
                    </span>
                  );
                })()}
              </div>
              <p className="text-xs text-zinc-400">
                Pinned in system prompt. Contains self-reflective definitions of Saan&apos;s identity and personal ethics.
              </p>
              <textarea
                rows={9}
                value={personaBlock}
                onChange={(e) => setPersonaBlock(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 focus:outline-none focus:border-purple-500 font-mono leading-relaxed"
              />
            </div>
            {/* Progress bar */}
            <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  personaBlock.length > 2000
                    ? "bg-rose-500"
                    : personaBlock.length > 1250
                    ? "bg-amber-500"
                    : "bg-pink-500"
                }`}
                style={{ width: `${Math.min(100, (personaBlock.length / 2500) * 100)}%` }}
              />
            </div>

            <button
              type="button"
              onClick={handleSaveCoreMemory}
              disabled={saving}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm mt-3"
            >
              <Save className="h-3.5 w-3.5" /> Save Core Memory Blocks
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
