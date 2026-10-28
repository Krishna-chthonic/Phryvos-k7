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
}

interface SaanDialogueBubbleProps {
  message: DialogueBubbleMessage;
  onSpeak?: (text: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onRollback?: (snapshotId: string) => void;
  onSwipeAlternative?: (messageId: string, newIndex: number) => void;
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
}: SaanDialogueBubbleProps) {
  const isUser = message.sender === "user";
  const [expandedThought, setExpandedThought] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [userSelectedReaction, setUserSelectedReaction] = React.useState<string | null>(null);

  // Split text into natural conversational bursts if not already pre-split
  const bubbleList = React.useMemo(() => {
    if (isUser) return [message.text];
    if (message.bubbles && message.bubbles.length > 0) return message.bubbles;
    return splitBurst(message.text, 3);
  }, [message.text, message.bubbles, isUser]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEmojiClick = (emoji: string) => {
    setUserSelectedReaction(emoji);
    onReact?.(message.id, emoji);
  };

  const currentAltIndex = message.activeAltIndex ?? 0;
  const totalAlts = (message.alternatives?.length ?? 0) + 1;

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
        {bubbleList.map((bubbleText, idx) => (
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

                {/* Swipe Alternatives Controls (< 1/3 >) */}
                {totalAlts > 1 && (
                  <div className="flex items-center gap-1 bg-zinc-950 px-2 py-0.5 rounded-lg border border-zinc-800 text-[10px] text-zinc-400">
                    <button
                      type="button"
                      disabled={currentAltIndex <= 0}
                      onClick={() =>
                        onSwipeAlternative?.(message.id, currentAltIndex - 1)
                      }
                      className="hover:text-purple-300 disabled:opacity-30"
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
                      className="hover:text-purple-300 disabled:opacity-30"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Formatted Speech + Narrative Text */}
            <div className="text-sm">
              <FormattedNarrativeText text={bubbleText} />
            </div>

            {/* Bubble Action Footer (Last Bubble only) */}
            {idx === bubbleList.length - 1 && (
              <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-zinc-800/60 text-xs text-zinc-500">
                <span className="text-[10px] font-mono">{message.time}</span>

                {/* Quick Interactive Actions */}
                <div className="flex items-center gap-2">
                  {/* TTS Voice Replay */}
                  <button
                    type="button"
                    onClick={() => onSpeak?.(message.text)}
                    className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-purple-300 transition"
                    title="Speak message out loud"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
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
        ))}

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
      </div>
    </div>
  );
}
