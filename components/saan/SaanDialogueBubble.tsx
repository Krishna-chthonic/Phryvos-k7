"use client";

import * as React from "react";
import {
  Sparkles,
  Volume2,
  Brain,
  ChevronDown,
  ChevronRight,
  Zap,
  Undo2,
  Copy,
  Check,
  ChevronLeft,
  Heart,
  RotateCw,
} from "lucide-react";
import { splitBurst } from "@/lib/saan/humanize";

export interface DialogueBubbleMessage {
  id: string;
  sender: "user" | "saan";
  text: string;
  time: string;
  reaction?: string;
  actionResult?: any;
  snapshotId?: string;
  bubbles?: string[];
  reasoning?: string;
  alternatives?: string[];
  activeAltIndex?: number;
  mem0Decisions?: {
    event: "ADD" | "UPDATE" | "DELETE" | "NONE";
    factText: string;
    reason: string;
    targetId?: string;
  }[];
}

interface SaanDialogueBubbleProps {
  message: DialogueBubbleMessage;
  onSpeak?: (text: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onRollback?: (snapshotId: string) => void;
  onSwipeAlternative?: (messageId: string, newIndex: number) => void;
  onRegenerateSwipe?: (messageId: string) => void;
}

/**
 * Open-LLM-VTuber Gesture and Emotional Action Badges
 */
interface GestureBadge {
  tag: string;
  label: string;
  icon: string;
  color: string;
}

const VTUBER_GESTURE_MAP: Record<string, { label: string; icon: string; color: string }> = {
  joy: { label: "Joyful", icon: "✨", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  blush: { label: "Blushing", icon: "🌸", color: "bg-pink-500/15 text-pink-300 border-pink-500/30" },
  wink: { label: "Winking", icon: "😉", color: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  wave: { label: "Waving", icon: "👋", color: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
  nod: { label: "Nodding", icon: "🤝", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  tilt_head: { label: "Tilts Head", icon: "🤔", color: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" },
  curious: { label: "Curious", icon: "🧐", color: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  bow: { label: "Bowing", icon: "🙇", color: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  laugh: { label: "Laughing", icon: "😂", color: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" },
  pout: { label: "Pouting", icon: "😤", color: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  smirk: { label: "Smirking", icon: "😏", color: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30" },
  thinking: { label: "Thinking", icon: "💭", color: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  sadness: { label: "Subdued", icon: "🥺", color: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
  anger: { label: "Puffed Cheeks", icon: "💢", color: "bg-rose-600/15 text-rose-300 border-rose-500/30" },
  sigh: { label: "Sighs", icon: "💨", color: "bg-teal-500/15 text-teal-300 border-teal-500/30" },
  stretch: { label: "Stretching", icon: "🧘", color: "bg-lime-500/15 text-lime-300 border-lime-500/30" },
};

function extractVtuberBadges(rawText: string): { cleanedText: string; badges: GestureBadge[] } {
  if (!rawText) return { cleanedText: "", badges: [] };

  const badges: GestureBadge[] = [];
  let cleaned = rawText;

  for (const [tag, meta] of Object.entries(VTUBER_GESTURE_MAP)) {
    const regex = new RegExp(`\\[${tag}\\]`, "gi");
    if (regex.test(cleaned)) {
      badges.push({ tag, ...meta });
      cleaned = cleaned.replace(regex, "");
    }
  }

  return {
    cleanedText: cleaned.replace(/\s{2,}/g, " ").trim(),
    badges,
  };
}

/**
 * Parses SillyTavern style narrative actions inside asterisks (*action*)
 * and renders them in an elegant muted italic lavender font.
 */
function FormattedNarrativeText({ text }: { text: string }) {
  if (!text) return null;

  // Split by asterisks: odd indices are *actions*, even are normal speech
  const parts = text.split(/(\*[^*]+\*)/g);

  return (
    <span className="leading-relaxed whitespace-pre-wrap select-text">
      {parts.map((part, idx) => {
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
          const actionText = part.slice(1, -1);
          return (
            <span
              key={idx}
              className="italic text-purple-300/90 font-serif px-0.5 tracking-wide"
            >
              *{actionText}*
            </span>
          );
        }
        return <span key={idx}>{part}</span>;
      })}
    </span>
  );
}

export function SaanDialogueBubble({
  message,
  onSpeak,
  onReact,
  onRollback,
  onSwipeAlternative,
  onRegenerateSwipe,
}: SaanDialogueBubbleProps) {
  const isUser = message.sender === "user";
  const [expandedThought, setExpandedThought] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [userSelectedReaction, setUserSelectedReaction] = React.useState<string | null>(null);

  const currentAltIndex = message.activeAltIndex ?? 0;
  const totalAlts = (message.alternatives?.length ?? 0) + 1;

  // Pick active text based on activeAltIndex (SillyTavern Multi-Swipe Buffer)
  const activeText = React.useMemo(() => {
    if (isUser || currentAltIndex === 0) return message.text;
    if (message.alternatives && message.alternatives[currentAltIndex - 1]) {
      return message.alternatives[currentAltIndex - 1];
    }
    return message.text;
  }, [message.text, message.alternatives, currentAltIndex, isUser]);

  // Split text into natural conversational bursts if not already pre-split
  const bubbleList = React.useMemo(() => {
    if (isUser) return [activeText];
    if (currentAltIndex === 0 && message.bubbles && message.bubbles.length > 0) return message.bubbles;
    return splitBurst(activeText, 3);
  }, [activeText, message.bubbles, currentAltIndex, isUser]);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEmojiClick = (emoji: string) => {
    setUserSelectedReaction(emoji);
    onReact?.(message.id, emoji);
  };

  if (isUser) {
    return (
      <div className="flex w-full justify-end group">
        <div className="max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 bg-purple-600 text-white rounded-br-xs shadow-md space-y-1.5 transition-all">
          <div className="text-sm leading-relaxed whitespace-pre-wrap select-text">
            {message.text}
          </div>
          <div className="text-[10px] text-purple-200/80 text-right font-mono">
            {message.time}
          </div>
        </div>
      </div>
    );
  }

  // Saan Companion Dialogue Box (with Staggered Bursts)
  return (
    <div className="flex flex-col w-full items-start group space-y-2">
      {/* Pre-reply selective emoji reaction floating on top */}
      {message.reaction && (
        <div className="ml-3 px-2 py-0.5 rounded-full text-xs bg-zinc-900 border border-purple-500/40 text-purple-300 shadow-sm flex items-center gap-1 animate-bounce">
          <span>{message.reaction}</span>
          <span className="text-[10px] text-zinc-400 font-mono">Reacted</span>
        </div>
      )}

      {/* Internal Reasoning <think> Accordion (Airi / Open-WebUI) */}
      {message.reasoning && (
        <div className="max-w-[85%] sm:max-w-[78%] rounded-xl border border-zinc-800 bg-zinc-950/70 p-2.5 text-xs text-zinc-400 space-y-1">
          <button
            type="button"
            onClick={() => setExpandedThought((p) => !p)}
            className="flex items-center justify-between w-full font-medium text-purple-300 hover:text-purple-200 transition"
          >
            <span className="flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5" />
              <span>Saan Internal Thought Process</span>
            </span>
            {expandedThought ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
          {expandedThought && (
            <div className="pt-2 text-[11px] font-mono leading-relaxed text-zinc-400 border-t border-zinc-800/80">
              {message.reasoning}
            </div>
          )}
        </div>
      )}

      {/* Consecutive Natural Texting Bubbles (splitBurst) */}
      <div className="max-w-[90%] sm:max-w-[82%] space-y-2">
        {bubbleList.map((bubbleText, idx) => {
          const { cleanedText, badges } = extractVtuberBadges(bubbleText);

          return (
            <div
              key={idx}
              className="relative rounded-2xl p-4 bg-zinc-900/95 border border-zinc-800/90 text-zinc-100 rounded-bl-xs shadow-md transition-all duration-300 hover:border-zinc-700/80"
            >
              {/* Header only on first bubble */}
              {idx === 0 && (
                <div className="flex items-center justify-between text-xs text-zinc-400 border-b border-zinc-800/60 pb-1.5 mb-2">
                  <span className="font-bold text-purple-400 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Saan
                  </span>

                  {/* Swipe Alternatives Controls (< 1/3 > + Regenerate) */}
                  <div className="flex items-center gap-1 bg-zinc-950 px-2 py-0.5 rounded-lg border border-zinc-800 text-[10px] text-zinc-400">
                    {totalAlts > 1 && (
                      <>
                        <button
                          type="button"
                          disabled={currentAltIndex <= 0}
                          onClick={() =>
                            onSwipeAlternative?.(message.id, currentAltIndex - 1)
                          }
                          className="hover:text-purple-300 disabled:opacity-30 cursor-pointer"
                          title="Previous alternative"
                        >
                          <ChevronLeft className="w-3 h-3" />
                        </button>
                        <span>
                          {currentAltIndex + 1}/{totalAlts}
                        </span>
                        <button
                          type="button"
                          disabled={currentAltIndex >= totalAlts - 1}
                          onClick={() =>
                            onSwipeAlternative?.(message.id, currentAltIndex + 1)
                          }
                          className="hover:text-purple-300 disabled:opacity-30 cursor-pointer"
                          title="Next alternative"
                        >
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => onRegenerateSwipe?.(message.id)}
                      className={`inline-flex items-center gap-1 hover:text-purple-300 text-zinc-400 text-[10px] cursor-pointer ${
                        totalAlts > 1 ? "ml-1 pl-1.5 border-l border-zinc-800" : ""
                      }`}
                      title="Generate new alternative reply (Swipe 🔄)"
                    >
                      <RotateCw className="w-2.5 h-2.5" />
                      <span>Swipe</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Open-LLM-VTuber Gesture & Motion Chips */}
              {badges.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {badges.map((b, bIdx) => (
                    <span
                      key={bIdx}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border shadow-xs ${b.color}`}
                    >
                      <span>{b.icon}</span>
                      <span>{b.label}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Formatted Speech + Narrative Text */}
              <div className="text-sm">
                <FormattedNarrativeText text={cleanedText} />
              </div>

            {/* Bubble Action Footer (Last Bubble only) */}
            {idx === bubbleList.length - 1 && (
              <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-zinc-800/60 text-xs text-zinc-500">
                <span className="text-[10px] font-mono">{message.time}</span>

                {/* Quick Interactive Actions */}
                <div className="flex items-center gap-2">
                  {/* TTS Voice Replay (Active Alternative) */}
                  <button
                    type="button"
                    onClick={() => onSpeak?.(activeText)}
                    className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-purple-300 transition"
                    title="Speak active swipe out loud"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Regenerate Swipe */}
                  <button
                    type="button"
                    onClick={() => onRegenerateSwipe?.(message.id)}
                    className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-purple-300 transition"
                    title="Regenerate alternative response (Swipe 🔄)"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>

                  {/* Copy message */}
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
                    title="Copy text"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* User Emoji Reaction Picker */}
                  <div className="flex items-center gap-1 bg-zinc-950/80 px-1.5 py-0.5 rounded-lg border border-zinc-800/80">
                    {["❤️", "😂", "🥺", "🔥"].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleEmojiClick(emoji)}
                        className={`text-xs hover:scale-125 transition ${
                          userSelectedReaction === emoji ? "scale-110 ring-1 ring-purple-500 rounded" : ""
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

        {/* Autonomous Tool Execution (OpenHands) */}
        {message.actionResult && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-2.5 flex items-center justify-between text-xs text-emerald-300 font-mono">
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-emerald-400" />
              <span>Tool Executed: {message.actionResult.action || "Action"}</span>
            </span>
            {message.snapshotId && (
              <button
                type="button"
                onClick={() => onRollback?.(message.snapshotId!)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 active:scale-95 transition"
              >
                <Undo2 className="h-3 w-3" /> Rollback
              </button>
            )}
          </div>
        )}

        {/* Mem0 4-State Mutation Chips */}
        {message.mem0Decisions && message.mem0Decisions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {message.mem0Decisions.map((dec, idx) => (
              <span
                key={idx}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono border ${
                  dec.event === "ADD"
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    : dec.event === "UPDATE"
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    : dec.event === "DELETE"
                    ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                    : "bg-zinc-800 text-zinc-400 border-zinc-700"
                }`}
                title={`Mem0 Decision Reason: ${dec.reason}`}
              >
                <span>
                  {dec.event === "ADD"
                    ? "➕"
                    : dec.event === "UPDATE"
                    ? "🔄"
                    : dec.event === "DELETE"
                    ? "❌"
                    : "⚪"}
                </span>
                <span className="font-bold">{dec.event}</span>
                <span className="truncate max-w-[180px]">{dec.factText}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
