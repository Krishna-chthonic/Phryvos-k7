"use client";

import * as React from "react";
import {
  Send,
  Sparkles,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RotateCcw,
  Sliders,
  ChevronDown,
  BookmarkCheck,
  Film,
  Zap,
  Flame,
  Brain,
  Timer,
  Sun,
  Download,
  Upload,
} from "lucide-react";
import { globalAvatarMapper } from "@/lib/saan/avatar-expressions";
import { toNaturalSpeechText } from "@/lib/saan/speech-transformer";
import { truncateHeardMemory } from "@/lib/saan/interruption-contract";
import { StreamSentenceDivider } from "@/lib/saan/sentence-divider";
import { SaanLivingAvatar, type AvatarEmotion } from "./SaanLivingAvatar";
import { SaanDialogueBubble, type DialogueBubbleMessage } from "./SaanDialogueBubble";
import { SaanAffectionBar } from "./SaanAffectionBar";
import { SaanWorkingMemoryCapsule } from "./SaanWorkingMemoryCapsule";
import { SaanConsequenceTracker, type DeedItem } from "./SaanConsequenceTracker";
import { SaanStoryRecapModal } from "./SaanStoryRecapModal";
import { SaanFlashbulbVault, type FlashbulbMemory } from "./SaanFlashbulbVault";
import { SaanHuginnRavenDashboard, type HuginnInsightItem } from "./SaanHuginnRavenDashboard";
import { SaanHearingStatusCapsule } from "./SaanHearingStatusCapsule";
import { SaanPomodoroWidget, SaanCircadianSkyWidget } from "./SaanInteractiveWidgets";

interface SaanStageChatViewProps {
  profile: any;
  starterChips?: string[];
  deeds?: DeedItem[];
  openDeedsCount?: number;
  activeArcs?: any[];
  storyRecap?: string;
  flashbulbMemories?: FlashbulbMemory[];
  huginnInsights?: HuginnInsightItem[];
  onRefreshSoul?: () => void;
  onNavigateTab?: (tab: "stage" | "persona" | "graph" | "soul" | "tools") => void;
}

export function SaanStageChatView({
  profile,
  starterChips = [],
  deeds = [],
  openDeedsCount = 0,
  activeArcs = [],
  storyRecap,
  flashbulbMemories = [],
  huginnInsights = [],
  onRefreshSoul,
  onNavigateTab,
}: SaanStageChatViewProps) {
  const [messages, setMessages] = React.useState<DialogueBubbleMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  // Modals for Chronicler & Mimir systems
  const [isLedgerOpen, setIsLedgerOpen] = React.useState(false);
  const [isRecapOpen, setIsRecapOpen] = React.useState(false);
  const [isFlashbulbOpen, setIsFlashbulbOpen] = React.useState(false);
  const [isHuginnOpen, setIsHuginnOpen] = React.useState(false);

  // Airi Component Calling Widget state
  const [showPomodoro, setShowPomodoro] = React.useState(false);

  // Audio & Waveform Visualization
  const [voiceEnabled, setVoiceEnabled] = React.useState(false);
  const [isListening, setIsListening] = React.useState(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const [avatarEmotion, setAvatarEmotion] = React.useState<AvatarEmotion>("neutral");
  const [audioLevel, setAudioLevel] = React.useState<number>(0);
  const [ttfaMs, setTtfaMs] = React.useState<number | null>(null);

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Restore history on mount
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("k7_saan_history");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch {}

    setMessages([
      {
        id: "intro",
        sender: "saan",
        text: "Hey Krishna! *smiles softly and looks up from her screen* Main yahan baithi thi aur tumhari yaad aayi... kaisa chal raha hai aaj ka din? Sab smoothly chal raha hai na?",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        reaction: "✨",
      },
    ]);
  }, []);

  // Persist history
  React.useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem("k7_saan_history", JSON.stringify(messages.slice(-30)));
      } catch {}
    }
  }, [messages]);

  // Scroll to bottom
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Real-time Canvas Equalizer Waveform Loop
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const isLive = isSpeaking || isListening || loading;
      const barCount = 36;
      const barWidth = canvas.width / barCount;
      const midY = canvas.height / 2;

      for (let i = 0; i < barCount; i++) {
        let height = 4;
        if (isLive) {
          const freq = (i / barCount) * Math.PI * 4;
          const wave = Math.sin(freq + phase) * Math.cos(phase * 0.7);
          const amp = isSpeaking ? 28 : isListening ? 38 : 12;
          height = Math.max(4, Math.abs(wave) * amp + Math.random() * 6);
        }

        const x = i * barWidth;
        const y = midY - height / 2;

        const gradient = ctx.createLinearGradient(0, y, 0, y + height);
        if (isSpeaking) {
          gradient.addColorStop(0, "#c084fc");
          gradient.addColorStop(1, "#9333ea");
        } else if (isListening) {
          gradient.addColorStop(0, "#34d399");
          gradient.addColorStop(1, "#059669");
        } else {
          gradient.addColorStop(0, "rgba(168, 85, 247, 0.4)");
          gradient.addColorStop(1, "rgba(168, 85, 247, 0.1)");
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x + 1.5, y, barWidth - 3, height, 2);
        ctx.fill();
      }

      phase += isLive ? 0.12 : 0.02;
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isSpeaking, isListening, loading]);

  // Open-LLM-VTuber Auditory Reality Interruption Tracking
  const activeSpeakingMsgIdRef = React.useRef<string | null>(null);
  const activeSpeakingTextRef = React.useRef<string>("");
  const speechStartTimeRef = React.useRef<number>(0);

  // Barge-In Cancellation with Auditory Memory Contract (truncateHeardMemory)
  const cancelSpeechAndApplyBargeIn = React.useCallback(
    (reason: "user_typing" | "user_speaking" = "user_typing") => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
        }
      }

      // If speech was actively playing, truncate memory to auditory reality
      if (activeSpeakingMsgIdRef.current && activeSpeakingTextRef.current) {
        const elapsedSec = Math.max(0.5, (Date.now() - speechStartTimeRef.current) / 1000);
        const result = truncateHeardMemory(activeSpeakingTextRef.current, elapsedSec, 150);

        if (result.wasTruncated) {
          const targetId = activeSpeakingMsgIdRef.current;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === targetId ? { ...m, text: result.savedContent } : m
            )
          );
        }
      }

      activeSpeakingMsgIdRef.current = null;
      activeSpeakingTextRef.current = "";
      setIsSpeaking(false);
    },
    []
  );

  // Airi & Open-LLM-VTuber Low-Latency Speech Pipeline (StreamSentenceDivider + Delays)
  const speakText = React.useCallback(
    async (rawText: string, messageId?: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();

      // 1. Isolate reasoning monologue and asterisk narrative
      const cleanReasoning = rawText
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/\[\w+\]/g, "")
        .replace(/\*[^*]+\*/g, "") // Gestures are silent
        .trim();

      // 2. Pre-process through Airi speech transformer (LaTeX math -> spoken words, \ce -> words)
      const speechTransformed = toNaturalSpeechText(cleanReasoning);

      // Track active speech for barge-in auditory memory
      activeSpeakingMsgIdRef.current = messageId || null;
      activeSpeakingTextRef.current = rawText;
      speechStartTimeRef.current = Date.now();
      setIsSpeaking(true);

      // 3. Fast first comma response divider (<280ms TTFA)
      const divider = new StreamSentenceDivider({ fasterFirstResponse: true });
      const sentenceChunks = [...divider.feed(speechTransformed), ...divider.flush()];

      for (const chunk of sentenceChunks) {
        // If barge-in cancelled mid-stream, break immediately
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          if (!window.speechSynthesis.speaking && speechStartTimeRef.current === 0) {
            break;
          }
        }

        // Parse streaming cadence controls: split on <|DELAY n|>
        const parts = chunk.split(/<\|DELAY\s*([\d.]+)?\|>/g);

        for (let i = 0; i < parts.length; i++) {
          const seg = parts[i]?.trim();
          if (!seg) continue;

          // Check if this segment was a delay seconds number
          const delaySeconds = parseFloat(seg);
          if (!isNaN(delaySeconds) && delaySeconds > 0 && delaySeconds <= 10) {
            // Authentic human conversational silence pause
            await new Promise((r) => setTimeout(r, delaySeconds * 1000));
            continue;
          }

          // Clean out any leftover markdown or raw tags
          const speakableChunk = seg.replace(/[*_#`~>]/g, "").trim();
          if (!speakableChunk) continue;

          await new Promise<void>((resolve) => {
            const utter = new SpeechSynthesisUtterance(speakableChunk);
            utter.rate = 1.05;
            utter.pitch = 1.02;
            utter.lang = "hi-IN";

            utter.onend = () => resolve();
            utter.onerror = () => resolve();

            window.speechSynthesis.speak(utter);
          });
        }
      }

      setIsSpeaking(false);
      activeSpeakingMsgIdRef.current = null;
      activeSpeakingTextRef.current = "";
    },
    []
  );

  // Instant Barge-In: typing or clicking cancels any active speech immediately
  const handleInputChange = (val: string) => {
    setInput(val);
    if (isSpeaking) {
      cancelSpeechAndApplyBargeIn("user_typing");
    }
  };

  // Send turn
  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    // Barge-in cancel speech on send
    if (isSpeaking) {
      cancelSpeechAndApplyBargeIn("user_speaking");
    }

    const userMsg: DialogueBubbleMessage = {
      id: String(Date.now()),
      sender: "user",
      text: query,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setLoading(true);

    const startTime = performance.now();

    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          history: messages.slice(-10).map((m) => ({
            role: m.sender === "user" ? "user" : "assistant",
            content: m.text,
          })),
        }),
      });

      const data = await res.json();
      const elapsed = Math.round(performance.now() - startTime);
      setTtfaMs(elapsed);

      if (data.ok && data.reply) {
        // Extract avatar emotion token
        const parsedAvatar = globalAvatarMapper.extract(data.reply);
        if (parsedAvatar.expressions && parsedAvatar.expressions.length > 0) {
          const rawEmo = parsedAvatar.expressions[0].toLowerCase();
          if (["joy", "blush", "pout", "thinking", "smirk", "sleep"].includes(rawEmo)) {
            setAvatarEmotion(rawEmo as AvatarEmotion);
          } else {
            setAvatarEmotion("neutral");
          }
        }

        // Extract reasoning
        let cleanReply = data.reply;
        let reasoning: string | undefined = undefined;
        const thinkMatch = data.reply.match(/<think>([\s\S]*?)<\/think>/i);
        if (thinkMatch) {
          reasoning = thinkMatch[1].trim();
          cleanReply = data.reply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
        }

        const newMsg: DialogueBubbleMessage = {
          id: String(Date.now() + 1),
          sender: "saan",
          text: cleanReply,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          reaction: data.reaction,
          actionResult: data.actionResult,
          snapshotId: data.snapshotId,
          bubbles: data.bubbles,
          reasoning,
        };

        setMessages((prev) => [...prev, newMsg]);

        if (voiceEnabled) {
          speakText(cleanReply, newMsg.id);
        }

        onRefreshSoul?.();
      } else {
        throw new Error(data.error || "Turn failed");
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: "saan",
          text: "Network flicker hua tha, tumne kya kaha? Wapas bolna ek baar!",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Quick Affection Action Handler (HerAndHim)
  const handleAffectionAction = (type: "chai" | "headpat" | "compliment" | "focus") => {
    switch (type) {
      case "chai":
        setAvatarEmotion("joy");
        handleSend("*Hands Saan a warm, fragrant cup of masala chai* Yeh lo tumhare liye chai banayi hai!");
        break;
      case "headpat":
        setAvatarEmotion("blush");
        handleSend("*Gently pats Saan on her head with affectionate care* Tum bohot achhi ho Saan.");
        break;
      case "compliment":
        setAvatarEmotion("joy");
        handleSend("Aaj tum bohot pyari aur smart lag rahi ho Saan! ✨");
        break;
      case "focus":
        setAvatarEmotion("thinking");
        setShowPomodoro(true);
        handleSend("Chalo Saan, deep focus sprint shuru karte hain. Let's build K7 sovereign OS together!");
        break;
    }
  };

  // Mimir: Relive Flashbulb Memory
  const handleReliveMemory = (mem: FlashbulbMemory) => {
    setAvatarEmotion("blush");
    handleSend(
      `*Looks at Saan with warm, reflective eyes* Saan, wo moment yaad hai jab: "${mem.point}"? Aao us moment ko dobara relive karte hain!`
    );
  };

  // Chronicler Pacing Beat Request (Break Deadlock)
  const handleTriggerBeat = async () => {
    try {
      const res = await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_pacing_beat" }),
      });
      const d = await res.json();
      if (d.ok && d.beat) {
        handleSend(`*Nudges Saan gently to change the topic or follow up* (${d.beat.label})`);
      }
    } catch (err) {
      handleSend("Saan, koi nayi interesting baat batao na!");
    }
  };

  // 1-Click Rollback
  const handleRollback = async (snapshotId: string) => {
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "rollback", snapshotId }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: String(Date.now()),
            sender: "saan",
            text: `Action undone: ${data.message || "Reverted successfully!"}`,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        onRefreshSoul?.();
      } else {
        alert(data.message || "Could not undo action");
      }
    } catch {
      alert("Network error executing rollback");
    }
  };

  // User Reaction Handler (❤️, 😂, 🥺, 🔥)
  const handleUserReaction = async (messageId: string, emoji: string) => {
    try {
      const sentiment = emoji === "❤️" || emoji === "🔥" ? "positive" : emoji === "🥺" ? "negative" : "neutral";
      await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `[User reacted with ${emoji}]`,
          reaction: emoji,
          sentiment,
        }),
      });
      onRefreshSoul?.();
    } catch {}
  };

  // SillyTavern Multi-Swipe Alternative Switcher
  const handleSwipeAlternative = (messageId: string, newIndex: number) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, activeAltIndex: newIndex } : m
      )
    );
  };

  // SillyTavern Multi-Swipe Alternative Generation (Regenerate Turn)
  const handleRegenerateSwipe = async (targetMsgId: string) => {
    const msgIndex = messages.findIndex((m) => m.id === targetMsgId);
    if (msgIndex === -1) return;

    const precedingUser = [...messages.slice(0, msgIndex)].reverse().find((m) => m.sender === "user");
    const userQuery = precedingUser?.text || "Please give me an alternative thought on this!";

    setLoading(true);
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userQuery,
          history: messages.slice(0, msgIndex).map((m) => ({
            role: m.sender === "user" ? "user" : "assistant",
            content: m.text,
          })),
        }),
      });
      const data = await res.json();
      if (data.ok && data.reply) {
        let cleanReply = data.reply;
        const thinkMatch = data.reply.match(/<think>([\s\S]*?)<\/think>/i);
        if (thinkMatch) {
          cleanReply = data.reply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
        }

        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== targetMsgId) return m;
            const currentAlts = m.alternatives || [];
            const nextAlts = [...currentAlts, cleanReply];
            return {
              ...m,
              alternatives: nextAlts,
              activeAltIndex: nextAlts.length, // switch to newly generated swipe
            };
          })
        );
      }
    } catch (err) {
      console.error("Failed to generate swipe:", err);
    } finally {
      setLoading(false);
    }
  };

  // SillyTavern CharacterCard V2 Export
  const handleExportCard = async () => {
    try {
      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "export_card" }),
      });
      const data = await res.json();
      if (data.ok && data.json) {
        const blob = new Blob([data.json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `saan-character-card-v2.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      alert("Failed to export Character Card");
    }
  };

  // SillyTavern CharacterCard V2/V3 Import
  const handleImportCard = () => {
    const raw = prompt("Paste Character Card V2/V3 JSON or Persona Spec here:");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "import_card", cardData: parsed }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) {
            alert(d.message || "Card imported successfully!");
            onRefreshSoul?.();
          } else {
            alert(d.error || "Failed to import card");
          }
        });
    } catch {
      alert("Invalid JSON format provided.");
    }
  };

  // STT Toggle with Airi Audio Level VU simulation
  const toggleListening = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Browser speech recognition not supported. Use Chrome or Edge.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      setAudioLevel(0);
      return;
    }

    try {
      const recog = new SpeechRecognition();
      recog.continuous = false;
      recog.interimResults = false;
      recog.lang = "hi-IN";

      recog.onstart = () => {
        setIsListening(true);
        setAudioLevel(50);
      };
      recog.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        setAudioLevel(0);
        handleSend(transcript);
      };
      recog.onerror = () => {
        setIsListening(false);
        setAudioLevel(0);
      };
      recog.onend = () => {
        setIsListening(false);
        setAudioLevel(0);
      };

      recog.start();
    } catch {
      setIsListening(false);
      setAudioLevel(0);
    }
  };

  const circadian = profile?.circadianState || "morning_chai";

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      {/* 1. TOP LIVING COMPANION AVATAR STAGE */}
      <section className="relative shrink-0 border-b border-zinc-800/80 bg-zinc-950/90 p-3 sm:p-4 transition-all duration-500">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Living Avatar with AEIOU Lip-Sync & Micro-Animations */}
          <div className="flex items-center gap-4 w-full md:w-auto">
            <SaanLivingAvatar
              emotion={avatarEmotion}
              isSpeaking={isSpeaking}
              isListening={isListening}
              circadianState={circadian}
              bondStage={profile?.bondStage || "Soulbound"}
              bondScore={profile?.bondScore || 65}
              onPoke={() => setAvatarEmotion("blush")}
              onHeadpat={() => {
                setAvatarEmotion("blush");
                handleAffectionAction("headpat");
              }}
              onCheekPoke={() => {
                setAvatarEmotion("curious");
              }}
            />

            {/* Quick Interactive Affection Bar (HerAndHim) */}
            <div className="hidden lg:flex flex-col gap-2 pl-4 border-l border-zinc-800/80">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Companion Interaction
              </span>
              <SaanAffectionBar
                onTriggerAction={handleAffectionAction}
                bondScore={profile?.bondScore || 65}
              />
            </div>
          </div>

          {/* Airi Hearing Capsule + Chronicler & Mimir Tools */}
          <div className="flex flex-col items-center md:items-end gap-2 w-full md:w-auto">
            {/* Top Toolbar: Chronicler & Mimir Superchargers */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {/* Mimir: Flashbulb Memory Vault */}
              <button
                type="button"
                onClick={() => setIsFlashbulbOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition shadow-xs"
                title="View Flashbulb Memory Anchors (Never Decay)"
              >
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Flashbulb</span>
                {flashbulbMemories.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/30 text-amber-200 font-mono font-bold">
                    {flashbulbMemories.length}
                  </span>
                )}
              </button>

              {/* Mimir: Huginn Thought Raven Insights */}
              <button
                type="button"
                onClick={() => setIsHuginnOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 transition shadow-xs"
                title="View Huginn Emergent Trajectories & Patterns"
              >
                <Brain className="w-3.5 h-3.5 text-purple-400" />
                <span>Huginn Patterns</span>
                {huginnInsights.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-500/30 text-purple-200 font-mono font-bold">
                    {huginnInsights.length}
                  </span>
                )}
              </button>

              {/* Chronicler: Promises / Consequence Ledger */}
              <button
                type="button"
                onClick={() => setIsLedgerOpen(true)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                  openDeedsCount > 0
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25 animate-pulse"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                }`}
                title="View Open Commitments and Consequence Ledger"
              >
                <BookmarkCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Promises</span>
                {openDeedsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/30 text-amber-200 font-mono font-bold">
                    {openDeedsCount}
                  </span>
                )}
              </button>

              {/* Chronicler: Previously On... Story Recap */}
              <button
                type="button"
                onClick={() => setIsRecapOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-900 hover:bg-purple-950/40 text-purple-300 border border-zinc-800 hover:border-purple-500/40 transition"
                title="View Story Recap & Active Narrative Arcs"
              >
                <Film className="w-3.5 h-3.5 text-purple-400" />
                <span>Story Recap</span>
              </button>

              {/* Airi: Toggle Pomodoro Focus Widget */}
              <button
                type="button"
                onClick={() => setShowPomodoro((p) => !p)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition ${
                  showPomodoro
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                }`}
                title="Toggle Focus Sprint Pomodoro Widget"
              >
                <Timer className="w-3 h-3 text-cyan-400" />
                <span>Sprint</span>
              </button>

              {/* Chronicler: Pacing Director Beat Trigger */}
              <button
                type="button"
                onClick={handleTriggerBeat}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-cyan-300 hover:border-cyan-500/40 transition"
                title="Inject Dynamic Conversational Beat (Break Deadlock)"
              >
                <Zap className="w-3 h-3 text-cyan-400" />
                <span className="hidden sm:inline">Nudge Beat</span>
              </button>

              {/* SillyTavern: Export Character Card V2 */}
              <button
                type="button"
                onClick={handleExportCard}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition cursor-pointer"
                title="Export Saan Persona as SillyTavern Character Card V2"
              >
                <Download className="w-3 h-3 text-emerald-400" />
                <span>Export CCv2</span>
              </button>

              {/* SillyTavern: Import Character Card V2/V3 */}
              <button
                type="button"
                onClick={handleImportCard}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition cursor-pointer"
                title="Import SillyTavern Character Card (JSON)"
              >
                <Upload className="w-3 h-3 text-indigo-400" />
                <span>Import Card</span>
              </button>
            </div>

            {/* Airi: Real-Time Hearing Status Capsule with VU Spectrum */}
            <div className="flex items-center gap-2">
              <SaanHearingStatusCapsule
                isListening={isListening}
                isSpeaking={isSpeaking}
                audioLevel={audioLevel}
                onToggleMic={toggleListening}
              />

              {ttfaMs && (
                <span className="text-[10px] text-zinc-400 font-mono bg-zinc-900/80 px-2 py-1 rounded-xl border border-zinc-800">
                  TTFA: {ttfaMs}ms
                </span>
              )}

              {/* TTS Voice Toggle */}
              <button
                type="button"
                onClick={() => setVoiceEnabled((p) => !p)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-medium border transition ${
                  voiceEnabled
                    ? "bg-purple-600/30 text-purple-300 border-purple-500/50"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                }`}
                title="Toggle Auto-Voice Speech Synthesis"
              >
                {voiceEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
                <span>Auto Voice</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab?.("persona")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-medium bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200 hover:border-zinc-700 transition"
                title="Open Persona & Lorebook Studio"
              >
                <Sliders className="h-3 w-3 text-purple-400" />
                <span className="hidden sm:inline">Persona Studio</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Affection Bar (Visible on smaller screens) */}
        <div className="flex lg:hidden mt-3 pt-2.5 border-t border-zinc-800/60 justify-center">
          <SaanAffectionBar
            onTriggerAction={handleAffectionAction}
            bondScore={profile?.bondScore || 65}
          />
        </div>

        {/* Airi Interactive Calling Component: Focus Sprint Pomodoro Widget */}
        {showPomodoro && (
          <div className="max-w-4xl mx-auto mt-3 animate-in fade-in duration-300">
            <SaanPomodoroWidget
              onSessionComplete={(mins) =>
                handleSend(
                  `*Celebrates with Saan* Humne ${mins} minutes ka Deep Focus Sprint successfully complete kar liya!`
                )
              }
            />
          </div>
        )}
      </section>

      {/* 2. CHAT STREAM AREA */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-4xl mx-auto w-full"
      >
        {/* Dynamic Starter Prompts */}
        {starterChips.length > 0 && messages.length <= 2 && (
          <div className="space-y-2 p-3 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-400">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Suggested Starters</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {starterChips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(chip)}
                  className="px-3 py-1 rounded-xl text-xs bg-zinc-900 hover:bg-purple-900/30 text-zinc-300 hover:text-purple-200 border border-zinc-800 hover:border-purple-500/40 transition active:scale-95 text-left"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced SillyTavern + HerAndHim Messages */}
        {messages.map((m) => (
          <SaanDialogueBubble
            key={m.id}
            message={m}
            onSpeak={(text) => speakText(text, m.id)}
            onReact={handleUserReaction}
            onRollback={handleRollback}
            onSwipeAlternative={handleSwipeAlternative}
            onRegenerateSwipe={handleRegenerateSwipe}
          />
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-purple-400 p-2 font-medium">
            <span className="h-2 w-2 rounded-full bg-purple-500 animate-ping" />
            <span>Saan is typing her thoughts...</span>
          </div>
        )}
      </div>

      {/* 3. WORKING MEMORY CAPSULE & INPUT BAR */}
      <footer className="p-3 sm:p-4 border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md shrink-0 space-y-2">
        {/* Active Letta Working Memory Pill */}
        <SaanWorkingMemoryCapsule
          workingMemoryText={
            profile?.bio ||
            "Krishna is building sovereign K7 OS, loves masala chai, prefers deep modular code."
          }
          moodLabel={profile?.mood || "Affectionate"}
          circadianLabel={circadian}
          onOpenMemoryVault={() => onNavigateTab?.("graph")}
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="max-w-4xl mx-auto flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Type a message or whisper something to Saan..."
            disabled={loading}
            className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition"
          />

          <button
            type="button"
            onClick={toggleListening}
            className={`p-2.5 rounded-xl border transition ${
              isListening
                ? "bg-emerald-600 text-white border-emerald-500 animate-pulse"
                : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-100 hover:bg-zinc-800"
            }`}
            title="Speech to Text"
          >
            {isListening ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </button>

          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-medium text-sm transition flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            <span>Send</span>
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </footer>

      {/* Chronicler Modals */}
      <SaanConsequenceTracker
        deeds={deeds}
        isOpen={isLedgerOpen}
        onClose={() => setIsLedgerOpen(false)}
        onRefresh={() => onRefreshSoul?.()}
      />

      <SaanStoryRecapModal
        isOpen={isRecapOpen}
        onClose={() => setIsRecapOpen(false)}
        storyRecap={storyRecap}
        activeArcs={activeArcs}
        openDeedsCount={openDeedsCount}
        onResumeChat={(text) => handleSend(text)}
      />

      {/* Mimir Neuro-Cognitive Modals */}
      <SaanFlashbulbVault
        isOpen={isFlashbulbOpen}
        onClose={() => setIsFlashbulbOpen(false)}
        memories={flashbulbMemories}
        onRelive={handleReliveMemory}
        onRefresh={() => onRefreshSoul?.()}
      />

      <SaanHuginnRavenDashboard
        isOpen={isHuginnOpen}
        onClose={() => setIsHuginnOpen(false)}
        insights={huginnInsights}
        onTriggerScan={() => onRefreshSoul?.()}
        onFollowUp={(topic) => handleSend(`Saan, aao is baare mein baat karte hain: "${topic}"`)}
      />
    </div>
  );
}
