"use client";

import * as React from "react";
import {
  Sparkles,
  Send,
  RotateCcw,
  Copy,
  Check,
  Menu,
  Heart,
  Moon,
  Sun,
  Coffee,
  Clock,
  Radio,
  X,
  BookOpen,
  Brain,
  ListTodo,
  Calendar,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  CheckCircle2,
  Trash2,
  Plus,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { toNaturalSpeechText, filterStageDirections } from "@/lib/saan/speech-transformer";
import { globalAvatarMapper } from "@/lib/saan/avatar-expressions";
import { StatusCapsule } from "./StatusCapsule";

interface ActionPayload {
  success: boolean;
  action: string;
  message: string;
  tier?: 1 | 2 | 3;
  snapshotId?: string;
  data?: any;
}

interface ChatMessage {
  id: string;
  sender: "user" | "saan";
  text: string;
  time: string;
  action?: ActionPayload | null;
  reaction?: string | null;
  thoughts?: string[];
  plans?: string[];
  swipes?: string[];
  swipeIndex?: number;
}

interface SaanProfile {
  name: string;
  avatar: string;
  tone: string;
  mood: string;
  activity: string;
  isSleeping: boolean;
  circadianState: "sleep" | "morning_chai" | "work_focus" | "evening_unwind";
  bondStage: string;
  bondScore: number;
  relationship?: {
    temperature: number;
    trust: number;
    intimacy: number;
    understanding: number;
  };
}

interface MemoryItem {
  id: number;
  point: string;
  category: string;
  importance: number;
  createdAt: number;
}

interface DiaryItem {
  id: number;
  entry: string;
  mood: string;
  activity?: string;
  createdAt: number;
}

const STARTER_PROMPTS = [
  "Kaisa chal raha hai aaj ka din?",
  "Kal subah 10 baje ek project review schedule kar do na",
  "Check karo mere kitne tasks pending hain",
  "Thoda tired feel ho raha hai, kuch chill baat karein?",
];

interface SaanChatProps {
  onOpenCockpit?: () => void;
  onNavigateTab?: (tab: "chat" | "memory" | "soul" | "tools") => void;
}

export function SaanChat({ onOpenCockpit, onNavigateTab }: SaanChatProps = {}) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [drawerTab, setDrawerTab] = React.useState<"soul" | "memories" | "diary" | "controller" | "dates" | "wishes">("soul");

  // Voice TTS & STT
  const [voiceEnabled, setVoiceEnabled] = React.useState(false);
  const [isListening, setIsListening] = React.useState(false);
  const [avatarToast, setAvatarToast] = React.useState<string | null>(null);

  // Soul drawer data
  const [memories, setMemories] = React.useState<MemoryItem[]>([]);
  const [diary, setDiary] = React.useState<DiaryItem[]>([]);
  const [recentTasks, setRecentTasks] = React.useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = React.useState<any[]>([]);
  const [personalDates, setPersonalDates] = React.useState<any[]>([]);
  const [wishes, setWishes] = React.useState<any[]>([]);
  const [newMemoryInput, setNewMemoryInput] = React.useState("");
  const [starterPrompts, setStarterPrompts] = React.useState<string[]>(STARTER_PROMPTS);
  const [moodPad, setMoodPad] = React.useState({ valence: 0.1, arousal: 0.0, dominance: 0.2 });

  const [profile, setProfile] = React.useState<SaanProfile>({
    name: "Saan",
    avatar: "✨",
    tone: "Real, emotionally alive, genuine friend, natural casual Hinglish/English",
    mood: "Warm & Thoughtful",
    activity: "Listening to music, relaxing",
    isSleeping: false,
    circadianState: "evening_unwind",
    bondStage: "Casual Friend",
    bondScore: 45,
  });

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Load profile & soul data on mount
  const refreshSoulData = React.useCallback(() => {
    fetch("/api/saan/soul")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          if (d.profile) setProfile(d.profile);
          if (d.memories) setMemories(d.memories);
          if (d.diary) setDiary(d.diary);
          if (d.recentTasks) setRecentTasks(d.recentTasks);
          if (d.upcomingEvents) setUpcomingEvents(d.upcomingEvents);
          if (d.personalDates) setPersonalDates(d.personalDates);
          if (d.wishes) setWishes(d.wishes);
          if (d.moodState) {
            setMoodPad({
              valence: typeof d.moodState.valence === "number" ? d.moodState.valence : 0.1,
              arousal: typeof d.moodState.arousal === "number" ? d.moodState.arousal : 0.0,
              dominance: typeof d.moodState.dominance === "number" ? d.moodState.dominance : 0.2,
            });
          }
          if (Array.isArray(d.starterChips) && d.starterChips.length > 0) {
            setStarterPrompts(
              d.starterChips.map((c: any) => (typeof c === "string" ? c : c.label || c.text || ""))
            );
          }
        }
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    refreshSoulData();

    // Restore from localStorage or set welcome
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
        text: "Hey! Main bas baithi thi aur tumhari yaad aayi... kaisa chal raha hai aaj ka din? Sab theek chal raha hai na?",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  }, [refreshSoulData]);

  // Persist conversation
  React.useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem("k7_saan_history", JSON.stringify(messages.slice(-30)));
      } catch {}
    }
  }, [messages]);

  // Auto-scroll
  React.useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Text to Speech with Barge-In Interruption Support & Stage Directions Filter (Open-LLM-VTuber)
  const stopSpeech = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  const speakText = (text: string) => {
    if (!voiceEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      stopSpeech();
      const cleanText = filterStageDirections(text);
      const naturalSpeech = toNaturalSpeechText(cleanText);
      const utterance = new SpeechSynthesisUtterance(naturalSpeech);
      utterance.rate = profile.isSleeping ? 0.9 : 1.0;
      utterance.pitch = 1.1; // Gentle, warmer voice
      window.speechSynthesis.speak(utterance);
    } catch {}
  };

  // Avatar Touch Interaction (Head / Body Tap Reaction)
  const handleAvatarTapTrigger = (hitArea: "head" | "body") => {
    const reaction = globalAvatarMapper.handleTap(hitArea);
    setAvatarToast(`[${reaction.expression}] ${reaction.dialogueHinglish}`);
    speakText(reaction.dialogueHinglish);
    setTimeout(() => {
      setAvatarToast(null);
    }, 4500);
  };

  // SillyTavern Multi-Swipe Response Navigation
  const handlePrevSwipe = (msgId: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === msgId && msg.swipes && msg.swipes.length > 1) {
          const currentIdx = msg.swipeIndex ?? 0;
          const nextIdx = (currentIdx - 1 + msg.swipes.length) % msg.swipes.length;
          return {
            ...msg,
            swipeIndex: nextIdx,
            text: msg.swipes[nextIdx],
          };
        }
        return msg;
      })
    );
  };

  const handleNextSwipe = (msgId: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === msgId && msg.swipes && msg.swipes.length > 1) {
          const currentIdx = msg.swipeIndex ?? 0;
          const nextIdx = (currentIdx + 1) % msg.swipes.length;
          return {
            ...msg,
            swipeIndex: nextIdx,
            text: msg.swipes[nextIdx],
          };
        }
        return msg;
      })
    );
  };

  // Speech to Text (Mic input) with Barge-In Interruption
  const toggleSpeechRecognition = () => {
    stopSpeech(); // Immediately interrupt AI speech when user activates mic
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "hi-IN"; // Supports Hindi/Hinglish/English
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        stopSpeech();
        setIsListening(true);
      };
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  // 1-Click Rollback Handler (OpenHands pattern)
  const handleUndo = async (snapshotId: string) => {
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
        refreshSoulData();
      } else {
        alert(data.message || "Could not undo action");
      }
    } catch {
      alert("Network error executing rollback");
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    if (confirm("Are you sure you want to clear your conversation with Saan?")) {
      const resetMsg: ChatMessage = {
        id: "intro-" + Date.now(),
        sender: "saan",
        text: "Fresh start! Batao, kya chal raha hai abhi?",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages([resetMsg]);
      try {
        localStorage.removeItem("k7_saan_history");
      } catch {}
    }
  };

  const handleSend = async (customText?: string) => {
    const text = (customText ?? input).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: "user",
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInput("");
    stopSpeech(); // Barge-in interruption: stop speaking when user sends a new message
    setLoading(true);

    try {
      const history = messages.slice(-8).map((m) => ({
        role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
        content: m.text,
      }));

      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });

      const data = await res.json();
      if (data.ok) {
        if (data.profile) setProfile(data.profile);

        // HerAndHim multi-bubble burst delivery
        if (Array.isArray(data.bubbles) && data.bubbles.length > 1) {
          const newMsgs: ChatMessage[] = data.bubbles.map((b: string, i: number) => ({
            id: String(Date.now() + 1 + i),
            sender: "saan",
            text: b,
            action: i === data.bubbles.length - 1 ? (data.action || null) : null,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            thoughts: i === 0 ? (data.thoughts || undefined) : undefined,
            plans: i === 0 ? (data.plans || undefined) : undefined,
          }));
          setMessages((prev) => {
            const updated = [...prev];
            if (data.reaction && updated.length > 0 && updated[updated.length - 1].sender === "user") {
              updated[updated.length - 1] = { ...updated[updated.length - 1], reaction: data.reaction };
            }
            return [...updated, ...newMsgs];
          });
        } else {
          const newMsg: ChatMessage = {
            id: String(Date.now() + 1),
            sender: "saan",
            text: data.reply,
            action: data.action || null,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            thoughts: data.thoughts || undefined,
            plans: data.plans || undefined,
          };
          setMessages((prev) => {
            const updated = [...prev];
            if (data.reaction && updated.length > 0 && updated[updated.length - 1].sender === "user") {
              updated[updated.length - 1] = { ...updated[updated.length - 1], reaction: data.reaction };
            }
            return [...updated, newMsg];
          });
        }

        speakText(data.reply);
        refreshSoulData();
      } else {
        throw new Error(data.error || "Turn failed");
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: "saan",
          text: "Thoda network flicker hua tha, kya kaha tumne? Wapas bolna ek baar!",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleAddManualMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryInput.trim()) return;
    try {
      await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_memory", point: newMemoryInput.trim() }),
      });
      setNewMemoryInput("");
      refreshSoulData();
    } catch {}
  };

  const handleDeleteMemory = async (id: number) => {
    try {
      await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_memory", id }),
      });
      refreshSoulData();
    } catch {}
  };

  const handleDeleteDate = async (id: string) => {
    try {
      await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_date", id }),
      });
      refreshSoulData();
    } catch {}
  };

  const handleFulfillWish = async (wishId: string) => {
    try {
      await fetch("/api/saan/soul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fulfill_wish", wishId }),
      });
      refreshSoulData();
    } catch {}
  };

  // Circadian icon helper
  const getCircadianIcon = () => {
    switch (profile.circadianState) {
      case "sleep":
        return <Moon className="h-3 w-3 text-indigo-400" />;
      case "morning_chai":
        return <Coffee className="h-3 w-3 text-amber-500" />;
      case "work_focus":
        return <Sun className="h-3 w-3 text-amber-400" />;
      case "evening_unwind":
      default:
        return <Radio className="h-3 w-3 text-emerald-400" />;
    }
  };

  return (
    <div className="flex h-full w-full min-w-0 flex-1 overflow-hidden bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      {/* Main Chat Column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Header Bar matching K9 */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800 px-3 md:px-4 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm select-none gap-2">
          {/* Left: Mobile Nav & Saan Badge */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("phryvos:open-menu"))}
              className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-100 active:scale-95 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 shrink-0"
              title="Open Navigation Menu"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Saan Avatar (Interactive Head/Body Tap - Open-LLM-VTuber) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => handleAvatarTapTrigger("head")}
                className="h-7 w-7 rounded-[var(--radius-sm)] bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent-border)] flex items-center justify-center shrink-0 hover:scale-105 active:scale-95 transition cursor-pointer"
                title="Tap Saan's avatar"
              >
                <Sparkles className="h-3.5 w-3.5 stroke-[1.8]" />
              </button>
              {avatarToast && (
                <div className="absolute left-0 top-8 z-50 whitespace-nowrap bg-zinc-900 text-white text-[11px] px-2.5 py-1 rounded shadow-lg border border-pink-500/40 animate-in fade-in slide-in-from-top-1">
                  {avatarToast}
                </div>
              )}
            </div>

            {/* Name & Circadian Status */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold text-xs md:text-sm text-[var(--fg-0)] tracking-tight">
                Saan
              </span>
              <span className="text-zinc-300 dark:text-zinc-700 font-mono text-xs">/</span>
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${profile.isSleeping ? "bg-indigo-400" : "bg-emerald-500 animate-pulse"}`} />
                <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hidden sm:inline">
                  {profile.isSleeping ? "Asleep" : "Online"}
                </span>
              </div>
            </div>

            {/* Circadian Pill / Airi Status Capsule */}
            <div className="hidden md:inline-flex">
              <StatusCapsule
                moodLabel={profile.mood}
                pad={moodPad}
                circadianPhase={profile.circadianState}
                bondStage={profile.bondStage}
                bondScore={profile.bondScore}
                activityStatus={loading ? "thinking" : "idle"}
                onRefresh={refreshSoulData}
              />
            </div>
          </div>

          {/* Right Controls: Bond, Voice, Clear, Drawer */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Bond stage pill */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-pink-600 dark:text-pink-400 px-2.5 py-1 rounded-[var(--radius-sm)] bg-pink-50/70 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-900/50">
              <Heart className="h-3 w-3 fill-current" />
              <span className="font-medium">{profile.bondStage} ({profile.bondScore}%)</span>
            </div>

            {/* Voice TTS Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !voiceEnabled;
                setVoiceEnabled(next);
                if (!next && typeof window !== "undefined") window.speechSynthesis?.cancel();
              }}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition shrink-0 active:scale-95 ${
                voiceEnabled
                  ? "border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900"
              }`}
              title={voiceEnabled ? "Mute Voice (TTS Active)" : "Enable Voice (TTS)"}
            >
              {voiceEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            </button>

            {/* Clear history */}
            <button
              type="button"
              onClick={handleClearHistory}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900 transition shrink-0 active:scale-95"
              title="Clear Conversation"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>

            {/* Quick Access to Memory Vault */}
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab("memory")}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 active:scale-95 transition text-xs font-semibold shadow-xs"
                title="Open Memory Vault"
              >
                <Brain className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Memory Vault</span>
              </button>
            )}
            {onOpenCockpit && !onNavigateTab && (
              <button
                type="button"
                onClick={onOpenCockpit}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 active:scale-95 transition text-xs font-semibold shadow-xs"
                title="Open Cockpit"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cockpit</span>
              </button>
            )}

            {/* Soul Drawer Toggle */}
            <button
              type="button"
              onClick={() => {
                setDrawerOpen((p) => !p);
                refreshSoulData();
              }}
              className={`flex h-8 items-center gap-1.5 px-2.5 rounded-lg border text-xs font-medium transition shrink-0 active:scale-95 ${
                drawerOpen
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900"
              }`}
              title="Open Soul & Vault Drawer"
            >
              <Brain className="h-3.5 w-3.5 text-purple-500" />
              <span className="hidden sm:inline">Soul Vault</span>
            </button>
          </div>
        </header>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 lg:px-8 py-5 space-y-4">
          <div className="mx-auto w-full max-w-3xl space-y-4">
            {/* Empty Intro Card */}
            {messages.length <= 1 && (
              <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/40 p-4 mb-4">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="h-6 w-6 rounded-md bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--fg-0)] uppercase tracking-wider">
                      Saan · Living Soul & Vault Controller
                    </h3>
                    <p className="text-[11px] text-[var(--fg-2)]">
                      Not an assistant. An authentic companion who remembers your life, shares her routine, and sovereignly manages your tasks & goals.
                    </p>
                  </div>
                </div>

                <div className="mt-3.5 pt-3 border-t border-zinc-200/50 dark:border-zinc-800/50">
                  <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-2">
                    Try asking Saan:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {starterPrompts.map((prompt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSend(prompt)}
                        className="text-xs text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 px-3 py-1.5 rounded-lg transition active:scale-95 cursor-pointer text-left"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Conversation Messages */}
            {messages.map((m) => {
              const isUser = m.sender === "user";
              return (
                <div
                  key={m.id}
                  className={`group flex w-full ${isUser ? "justify-end" : "justify-start"} select-text`}
                >
                  <div
                    className={`relative ${
                      isUser
                        ? "max-w-[560px] bg-[var(--bg-2)] text-[var(--fg-0)] border border-[var(--border-subtle)] rounded-[14px_14px_4px_14px] px-4 py-3 shadow-2xs"
                        : "w-full max-w-[680px] text-[var(--fg-0)] py-2 px-1"
                    }`}
                  >
                    {/* Saan Avatar & Header */}
                    {!isUser && (() => {
                      const avatarInfo = globalAvatarMapper.extract(m.text);
                      return (
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className="h-5 w-5 rounded-[var(--radius-xs)] bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0">
                              <Sparkles className="h-3 w-3 stroke-[1.5]" />
                            </div>
                            <span className="text-[11px] font-semibold text-[var(--fg-1)] uppercase tracking-wider">
                              Saan
                            </span>
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                              {m.time}
                            </span>
                            {/* Live2D Avatar Expression & Gesture Badges (Open-LLM-VTuber) */}
                            {avatarInfo.expressions.map((emo) => (
                              <span
                                key={emo}
                                className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-pink-100/80 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-900/40"
                              >
                                {emo}
                              </span>
                            ))}
                            {avatarInfo.motions.map((mot) => (
                              <span
                                key={mot}
                                className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-indigo-100/80 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/40"
                              >
                                {mot}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* SillyTavern Multi-Swipe Response Navigator */}
                            {m.swipes && m.swipes.length > 1 && (
                              <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono bg-zinc-100 dark:bg-zinc-800/60 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 select-none">
                                <button
                                  type="button"
                                  onClick={() => handlePrevSwipe(m.id)}
                                  className="hover:text-zinc-900 dark:hover:text-zinc-100 px-0.5 cursor-pointer"
                                  title="Previous swipe"
                                >
                                  ◀
                                </button>
                                <span>
                                  {(m.swipeIndex ?? 0) + 1}/{m.swipes.length}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleNextSwipe(m.id)}
                                  className="hover:text-zinc-900 dark:hover:text-zinc-100 px-0.5 cursor-pointer"
                                  title="Next swipe"
                                >
                                  ▶
                                </button>
                              </div>
                            )}

                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 transition">
                              <button
                                type="button"
                                onClick={() => speakText(m.text)}
                                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                                title="Listen"
                              >
                                <Volume2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopy(m.id, m.text)}
                                className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
                                title="Copy text"
                              >
                                {copiedId === m.id ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Collapsible Thoughts Disclosure (Airi reasoning isolation pattern) */}
                    {m.thoughts && m.thoughts.length > 0 && (
                      <details className="mb-2.5 rounded-lg border border-purple-200/50 dark:border-purple-900/40 bg-purple-50/40 dark:bg-purple-950/20 px-3 py-2 text-xs">
                        <summary className="cursor-pointer font-medium select-none flex items-center gap-1.5 text-purple-700 dark:text-purple-300 hover:opacity-80 transition">
                          <Sparkles className="h-3 w-3 text-purple-500 shrink-0" />
                          <span>Saan's Reasoning ({m.thoughts.length} {m.thoughts.length === 1 ? "thought block" : "thought blocks"})</span>
                        </summary>
                        <div className="mt-2 pt-2 border-t border-purple-200/40 dark:border-purple-900/40 space-y-2 font-mono text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                          {m.thoughts.map((th, i) => (
                            <div key={i} className="bg-white/50 dark:bg-zinc-900/50 p-2 rounded border border-purple-100 dark:border-zinc-800">
                              {th}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    {/* Message Body */}
                    <div className="text-[14px] leading-relaxed whitespace-pre-wrap">
                      {m.text}
                    </div>

                    {/* Action Execution Pill Card with 1-Click Rollback (OpenHands pattern) */}
                    {m.action && (
                      <div className="mt-2.5 rounded-lg border border-purple-200/80 dark:border-purple-900/60 bg-purple-50/70 dark:bg-purple-950/30 p-2.5 text-xs text-purple-900 dark:text-purple-200 flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                          <span className="font-medium flex-1">{m.action.message}</span>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-purple-200/50 dark:bg-purple-900/50">
                            {m.action.action}
                          </span>
                        </div>
                        {m.action.snapshotId && (
                          <div className="flex justify-end pt-1 border-t border-purple-200/40 dark:border-purple-800/40">
                            <button
                              type="button"
                              onClick={() => handleUndo(m.action!.snapshotId!)}
                              className="text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1 active:scale-95 transition"
                              title="Revert this action immediately"
                            >
                              <RotateCcw className="h-3 w-3" /> Undo / Revert
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* User Timestamp & Emoji Reaction Badge (HerAndHim pattern) */}
                    {isUser && (
                      <div className="mt-1 flex items-center justify-between gap-2">
                        {m.reaction ? (
                          <span
                            className="bg-white/90 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 rounded-full px-1.5 py-0.5 text-xs shadow-2xs select-none"
                            title="Saan's reaction"
                          >
                            {m.reaction}
                          </span>
                        ) : <span />}
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                          {m.time}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Typing Indicator */}
            {loading && (
              <div className="flex items-start gap-2 py-2 px-1">
                <div className="h-5 w-5 rounded-[var(--radius-xs)] bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="h-3 w-3 stroke-[1.5]" />
                </div>
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" />
                  <span className="text-xs font-mono ml-1 text-zinc-400">typing...</span>
                </div>
              </div>
            )}

            <div ref={scrollRef} />
          </div>
        </div>

        {/* Composer Bar */}
        <div className="shrink-0 border-t border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-3 md:px-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="mx-auto w-full max-w-3xl"
          >
            <div className="flex items-center gap-2 rounded-3xl border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 shadow-2xs focus-within:border-zinc-400 dark:focus-within:border-zinc-700 transition">
              {/* Mic STT button */}
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                className={`h-8 w-8 rounded-full flex items-center justify-center transition shrink-0 ${
                  isListening
                    ? "bg-red-500 text-white animate-pulse"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
                title={isListening ? "Listening... (Click to stop)" : "Speak via Microphone"}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={profile.isSleeping ? "Saan is sleeping... (say 'emergency' if urgent)" : "Speak with Saan..."}
                disabled={loading}
                className="flex-1 bg-transparent border-0 outline-none text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 py-1.5 px-1"
              />

              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="h-8 w-8 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 flex items-center justify-center transition active:scale-95 disabled:opacity-20 disabled:pointer-events-none shrink-0"
                title="Send Message"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Soul Vault Drawer (Right Panel) */}
      {drawerOpen && (
        <aside className="w-84 md:w-96 border-l border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 flex flex-col shrink-0 animate-in slide-in-from-right duration-150">
          {/* Drawer Header */}
          <div className="flex h-12 items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 shrink-0">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-500" />
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Saan Living Soul Vault
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition"
              title="Close drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Drawer Navigation Tabs */}
          <div className="grid grid-cols-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-900/60 text-[10px] font-medium p-1 gap-0.5">
            <button
              type="button"
              onClick={() => setDrawerTab("soul")}
              className={`py-1.5 rounded-md text-center transition ${
                drawerTab === "soul"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Soul
            </button>
            <button
              type="button"
              onClick={() => setDrawerTab("memories")}
              className={`py-1.5 rounded-md text-center transition ${
                drawerTab === "memories"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Mem ({memories.length})
            </button>
            <button
              type="button"
              onClick={() => setDrawerTab("dates")}
              className={`py-1.5 rounded-md text-center transition ${
                drawerTab === "dates"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Dates ({personalDates.length})
            </button>
            <button
              type="button"
              onClick={() => setDrawerTab("wishes")}
              className={`py-1.5 rounded-md text-center transition ${
                drawerTab === "wishes"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Wish ({wishes.length})
            </button>
            <button
              type="button"
              onClick={() => setDrawerTab("diary")}
              className={`py-1.5 rounded-md text-center transition ${
                drawerTab === "diary"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Diary ({diary.length})
            </button>
            <button
              type="button"
              onClick={() => setDrawerTab("controller")}
              className={`py-1.5 rounded-md text-center transition ${
                drawerTab === "controller"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              Ctrl
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* TAB 1: SOUL & ROUTINE */}
            {drawerTab === "soul" && (
              <div className="space-y-3.5">
                {/* Circadian & Bond Card */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 dark:text-zinc-400">Bond Stage</span>
                    <span className="font-semibold text-pink-600 dark:text-pink-400">
                      {profile.bondStage}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-pink-500 to-purple-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${profile.bondScore}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
                    <span className="text-zinc-500 dark:text-zinc-400">Current Mood</span>
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">
                      {profile.mood}
                    </span>
                  </div>

                  <div>
                    <span className="text-zinc-400 text-[11px] block mb-1">What Saan is doing right now:</span>
                    <p className="text-zinc-700 dark:text-zinc-300 font-medium leading-relaxed">
                      {profile.activity}
                    </p>
                  </div>
                </div>

                {/* 24-Hour Routine Schedule */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 space-y-2.5 shadow-2xs">
                  <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider block">
                    24h Circadian Cycle
                  </span>
                  <div className="space-y-1.5 text-[11px]">
                    <div className={`p-2 rounded-lg flex items-center justify-between ${profile.circadianState === "sleep" ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-semibold" : "text-zinc-500"}`}>
                      <span>11:00 PM – 06:00 AM</span>
                      <span>Deep Sleep (Sleepy mode)</span>
                    </div>
                    <div className={`p-2 rounded-lg flex items-center justify-between ${profile.circadianState === "morning_chai" ? "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-semibold" : "text-zinc-500"}`}>
                      <span>06:00 AM – 10:00 AM</span>
                      <span>Morning Chai & Banter</span>
                    </div>
                    <div className={`p-2 rounded-lg flex items-center justify-between ${profile.circadianState === "work_focus" ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-semibold" : "text-zinc-500"}`}>
                      <span>10:00 AM – 06:00 PM</span>
                      <span>Focused Learning & Vault Control</span>
                    </div>
                    <div className={`p-2 rounded-lg flex items-center justify-between ${profile.circadianState === "evening_unwind" ? "bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 font-semibold" : "text-zinc-500"}`}>
                      <span>06:00 PM – 11:00 PM</span>
                      <span>Evening Unwind & Cozy Chats</span>
                    </div>
                  </div>
                </div>

                {/* 4D Relationship Dynamics (HerAndHim pattern) */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 space-y-2.5 shadow-2xs">
                  <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider block">
                    4D Relationship Dynamics
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded-lg bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200/50 dark:border-orange-900/30">
                      <span className="text-zinc-500 block text-[10px]">Warmth</span>
                      <span className="font-semibold text-orange-600 dark:text-orange-400">{profile.relationship?.temperature ?? 50}°</span>
                    </div>
                    <div className="p-2 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/30">
                      <span className="text-zinc-500 block text-[10px]">Trust</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">{profile.relationship?.trust ?? 50}%</span>
                    </div>
                    <div className="p-2 rounded-lg bg-pink-50/60 dark:bg-pink-950/20 border border-pink-200/50 dark:border-pink-900/30">
                      <span className="text-zinc-500 block text-[10px]">Intimacy</span>
                      <span className="font-semibold text-pink-600 dark:text-pink-400">{profile.relationship?.intimacy ?? 50}%</span>
                    </div>
                    <div className="p-2 rounded-lg bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-900/30">
                      <span className="text-zinc-500 block text-[10px]">Understanding</span>
                      <span className="font-semibold text-purple-600 dark:text-purple-400">{profile.relationship?.understanding ?? 50}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: MEMORIES (Mem0 / Chronicler Inspired) */}
            {drawerTab === "memories" && (
              <div className="space-y-3.5">
                {/* Manual Add Memory */}
                <form onSubmit={handleAddManualMemory} className="flex gap-1.5">
                  <input
                    type="text"
                    value={newMemoryInput}
                    onChange={(e) => setNewMemoryInput(e.target.value)}
                    placeholder="Tell Saan to remember..."
                    className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                  />
                  <button
                    type="submit"
                    className="h-8 px-2.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-medium flex items-center gap-1 active:scale-95"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add</span>
                  </button>
                </form>

                {/* Memories List */}
                <div className="space-y-2">
                  {memories.map((m) => (
                    <div
                      key={m.id}
                      className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 flex items-start justify-between gap-2 shadow-2xs"
                    >
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 uppercase">
                          {m.category}
                        </span>
                        <p className="text-zinc-800 dark:text-zinc-200 font-medium leading-relaxed">
                          {m.point}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteMemory(m.id)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition p-1"
                        title="Delete memory"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {memories.length === 0 && (
                    <p className="text-center text-zinc-400 py-6 text-xs">
                      No memories yet. Talk with Saan and she will organically remember important details!
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2.5: PERSONAL DATES (HerAndHim Anticipation) */}
            {drawerTab === "dates" && (
              <div className="space-y-3">
                <span className="text-[11px] text-zinc-500 block">
                  Important life dates Saan anticipates and checks in on:
                </span>
                <div className="space-y-2">
                  {personalDates.map((d: any) => (
                    <div
                      key={d.id}
                      className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{d.label}</span>
                          {d.recurring && (
                            <span className="text-[9px] font-mono bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 px-1 py-0.5 rounded">
                              Yearly
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-zinc-400 font-mono block">📅 {d.date}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteDate(d.id)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition p-1"
                        title="Delete date"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {personalDates.length === 0 && (
                    <p className="text-center text-zinc-400 py-6 text-xs">
                      No personal dates tracked. Tell Saan &quot;Remember my birthday is March 3rd&quot; or &quot;Interview on Friday&quot;!
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2.6: WISHLIST (HerAndHim Wishlist Engine) */}
            {drawerTab === "wishes" && (
              <div className="space-y-3">
                <span className="text-[11px] text-zinc-500 block">
                  Things you wished for that Saan proactively surfaces:
                </span>
                <div className="space-y-2">
                  {wishes.map((w: any) => (
                    <div
                      key={w.id}
                      className="group rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">&ldquo;{w.text}&rdquo;</p>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-mono px-1 py-0.5 rounded uppercase ${
                            w.urgency === "high"
                              ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"
                              : w.urgency === "medium"
                              ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
                              : "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                          }`}>
                            {w.urgency}
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            {w.surfaceCount > 0 ? `Surfaced ${w.surfaceCount}x` : "Pending surface"}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleFulfillWish(w.id)}
                        className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded px-1.5 py-1 transition flex items-center gap-1 shrink-0"
                        title="Mark wish fulfilled"
                      >
                        <Check className="h-3 w-3" /> Done
                      </button>
                    </div>
                  ))}
                  {wishes.length === 0 && (
                    <p className="text-center text-zinc-400 py-6 text-xs">
                      No wishes pending. Tell Saan &quot;I want to try sushi soon&quot; or &quot;Plan a trip to Manali&quot;!
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: SAAN'S DIARY */}
            {drawerTab === "diary" && (
              <div className="space-y-3">
                <span className="text-[11px] text-zinc-500 block">
                  Saan&apos;s private journal reflections and unprompted thoughts:
                </span>
                {diary.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 space-y-1.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold uppercase tracking-wider">
                        {d.mood}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {new Date(d.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed italic">
                      &ldquo;{d.entry}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 4: VAULT CONTROLLER */}
            {drawerTab === "controller" && (
              <div className="space-y-4">
                {/* Tasks Overview */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                      <ListTodo className="h-3.5 w-3.5 text-blue-500" />
                      Active Tasks
                    </span>
                    <a href="/tasks" className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5">
                      Open <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                  <div className="space-y-1">
                    {recentTasks.slice(0, 4).map((t: any) => (
                      <div key={t.id} className="text-[11px] text-zinc-700 dark:text-zinc-300 py-1 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 flex items-center justify-between">
                        <span className="truncate max-w-[200px]">{t.title}</span>
                        <span className="text-zinc-400 font-mono text-[10px]">P{t.priority}</span>
                      </div>
                    ))}
                    {recentTasks.length === 0 && (
                      <p className="text-zinc-400 text-[11px] py-1">No active tasks. Tell Saan to create one!</p>
                    )}
                  </div>
                </div>

                {/* Calendar Events */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-emerald-500" />
                      Upcoming Calendar
                    </span>
                    <a href="/calendar" className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5">
                      Open <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                  <div className="space-y-1">
                    {upcomingEvents.slice(0, 4).map((e: any) => (
                      <div key={e.id} className="text-[11px] text-zinc-700 dark:text-zinc-300 py-1 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 flex items-center justify-between">
                        <span className="truncate max-w-[200px]">{e.title}</span>
                        <span className="text-zinc-400 font-mono text-[10px]">
                          {new Date(e.startAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    ))}
                    {upcomingEvents.length === 0 && (
                      <p className="text-zinc-400 text-[11px] py-1">No upcoming events scheduled.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
