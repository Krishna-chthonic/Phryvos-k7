"use client";

import * as React from "react";
import { Film, Sparkles, X, Compass, BookmarkCheck, ArrowRight } from "lucide-react";

interface SaanStoryRecapModalProps {
  isOpen: boolean;
  onClose: () => void;
  storyRecap?: string;
  activeArcs?: Array<{
    id: string;
    title: string;
    status: string;
    members: Array<{ text: string }>;
  }>;
  openDeedsCount?: number;
  onResumeChat?: (promptText: string) => void;
}

export function SaanStoryRecapModal({
  isOpen,
  onClose,
  storyRecap = "Pichli baar ka recap: Krishna is developing the sovereign K7 architecture, bonding over deep discussions. Open commitments are recorded in the ledger.",
  activeArcs = [],
  openDeedsCount = 0,
  onResumeChat,
}: SaanStoryRecapModalProps) {
  if (!isOpen) return null;

  const handleResume = () => {
    onResumeChat?.("Saan, pichhle recap se continue karte hain. Hum kahan the?");
    onClose();
  };

  const currentArc = activeArcs[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-purple-500/30 p-5 sm:p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-inner">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">
                Narrative Continuity
              </span>
              <h2 className="text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-2">
                <span>Previously on Saan & Krishna...</span>
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Narrative Recap Cinematic Card */}
        <div className="rounded-xl p-4 bg-zinc-950/80 border border-purple-500/20 shadow-inner space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Storyline Summary</span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed font-sans italic">
            &quot;{storyRecap}&quot;
          </p>
        </div>

        {/* Active Thematic Story Arc */}
        {currentArc && (
          <div className="rounded-xl p-3 bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Compass className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-zinc-400 font-mono uppercase">
                  Active Chapter Arc
                </span>
                <p className="font-semibold text-zinc-200 truncate">
                  {currentArc.title}
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 uppercase">
              {currentArc.status}
            </span>
          </div>
        )}

        {/* Pending Commitments pill */}
        {openDeedsCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
            <BookmarkCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              You have <strong>{openDeedsCount} open commitment(s)</strong> waiting in the Consequence Ledger.
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleResume}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs flex items-center gap-1.5 transition active:scale-95 shadow-md"
          >
            <span>Resume from Recap</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
