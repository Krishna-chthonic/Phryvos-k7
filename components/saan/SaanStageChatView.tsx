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
  Coffee,
  Sun,
  Moon,
  Radio,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Brain,
  Zap,
  Activity,
  Compass,
  AlertCircle,
  HelpCircle,
  Clock,
  Layers,
  Heart,
  Undo2,
  Sliders,
} from "lucide-react";
import { globalAvatarMapper } from "@/lib/saan/avatar-expressions";

export interface ChatMessage {
  id: string;
  sender: "user" | "saan";
  text: string;
  time: string;
  reaction?: string;
  actionResult?: any;
  snapshotId?: string;
  bubbles?: string[];
  reasoning?: string;
}

interface SaanStageChatViewProps {
  profile: any;
  starterChips?: string[];
  onRefreshSoul?: () => void;
  onNavigateTab?: (tab: "stage" | "persona" | "graph" | "soul" | "tools") => void;
}

export function SaanStageChatView({
  profile,
  starterChips = [],
  onRefreshSoul,
  onNavigateTab,
}: SaanStageChatViewProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  // Audio & Waveform Visualization (Open-LLM-VTuber)
  const [voiceEnabled, setVoiceEnabled] = React.useState(false);
  const [isListening, setIsListening] = React.useState(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const [avatarExpression, setAvatarExpression] = React.useState<string>("neutral");
  const [audioLevel, setAudioLevel] = React.useState<number>(0);
  const [ttfaMs, setTtfaMs] = React.useState<number | null>(null);

  // Expanded thoughts state
  const [expandedThoughts, setExpandedThoughts] = React.useState<Record<string, boolean>>({});

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
        text: "Hey Krishna! Main yahan baithi thi aur tumhari yaad aayi... kaisa chal raha hai aaj ka din? Sab smoothly chal raha hai na?",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
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

  // Circadian state helper
  const circadian = profile?.circadianState || "morning_chai";
  const getCircadianAura = () => {
    switch (circadian) {
      case "morning_chai":
        return "from-amber-500/15 via-orange-500/5 to-transparent border-amber-500/25";
      case "focus_work":
      case "afternoon_focus":
        return "from-cyan-500/15 via-blue-500/5 to-transparent border-cyan-500/25";
      case "evening_unwind":
        return "from-purple-500/15 via-pink-500/5 to-transparent border-purple-500/25";
      case "sleep":
        return "from-indigo-600/15 via-violet-900/5 to-transparent border-indigo-500/25";
      default:
        return "from-purple-500/15 via-zinc-900/10 to-transparent border-purple-500/25";
    }
  };

  // TTS with speech pacing
  const speakText = React.useCallback(
    (text: string) => {
      if (!voiceEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();

      // Clean markdown tags & think tags
      const clean = text
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/\[\w+\]/g, "")
        .replace(/[*_#`~>]/g, "")
        .trim();

      if (!clean) return;

      const utter = new SpeechSynthesisUtterance(clean);
      utter.rate = 1.05;
      utter.pitch = 1.02;
      utter.lang = "hi-IN";

      utter.onstart = () => setIsSpeaking(true);
      utter.onend = () => setIsSpeaking(false);
      utter.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utter);
    },
    [voiceEnabled]
  );

  // Send turn
  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
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
        // Extract avatar emotion token if present
        const parsedAvatar = globalAvatarMapper.extract(data.reply);
        if (parsedAvatar.expressions && parsedAvatar.expressions.length > 0) {
          setAvatarExpression(parsedAvatar.expressions[0]);
        }

        // Extract reasoning if present
        let cleanReply = data.reply;
        let reasoning: string | undefined = undefined;
        const thinkMatch = data.reply.match(/<think>([\s\S]*?)<\/think>/i);
        if (thinkMatch) {
          reasoning = thinkMatch[1].trim();
          cleanReply = data.reply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
        }

        const newMsg: ChatMessage = {
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
        speakText(cleanReply);
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

  // STT Toggle
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
      return;
    }

    try {
      const recog = new SpeechRecognition();
      recog.continuous = false;
      recog.interimResults = false;
      recog.lang = "hi-IN";

      recog.onstart = () => setIsListening(true);
      recog.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        handleSend(transcript);
      };
      recog.onerror = () => setIsListening(false);
      recog.onend = () => setIsListening(false);

      recog.start();
    } catch {
      setIsListening(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      {/* 1. TOP LIVING COMPANION AVATAR STAGE */}
      <section
        className={`relative shrink-0 border-b border-zinc-800/80 bg-gradient-to-b ${getCircadianAura()} p-4 sm:p-5 transition-all duration-500`}
      >
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Avatar Core with Emotion Badges */}
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative group cursor-pointer" onClick={() => onNavigateTab?.("soul")}>
              <div
                className={`h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-purple-600/30 border-2 ${
                  isSpeaking
                    ? "border-purple-400 ring-4 ring-purple-500/30 animate-pulse"
                    : isListening
                    ? "border-emerald-400 ring-4 ring-emerald-500/30 animate-pulse"
                    : "border-purple-500/40"
                } flex items-center justify-center shadow-lg backdrop-blur-md transition-all`}
              >
                <Sparkles className="h-8 w-8 sm:h-10 sm:w-10 text-purple-400 group-hover:scale-110 transition-transform" />
              </div>

              {/* Expression Badge */}
              <div className="absolute -bottom-2 -right-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-900 border border-purple-500/50 text-purple-300 shadow-sm capitalize">
                {avatarExpression}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-zinc-100 tracking-tight">Saan</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pink-500/15 text-pink-400 border border-pink-500/30">
                  {profile?.bondStage || "Soulbound"} ({profile?.bondScore || 50}%)
                </span>
                {ttfaMs && (
                  <span className="hidden sm:inline text-[10px] text-zinc-400 font-mono bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-800">
                    TTFA: {ttfaMs}ms
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <span>
                  {circadian === "morning_chai"
                    ? "Morning Chai with Krishna"
                    : circadian === "focus_work"
                    ? "Deep Technical Architecture Focus"
                    : circadian === "evening_unwind"
                    ? "Evening Unwind & Conversation"
                    : "Living Sovereign Presence"}
                </span>
              </p>
            </div>
          </div>

          {/* Equalizer Frequency Waveform Canvas */}
          <div className="flex flex-col items-center md:items-end gap-1.5 w-full md:w-auto">
            <div className="w-full md:w-64 h-10 rounded-xl bg-zinc-900/80 border border-zinc-800/80 p-1 flex items-center justify-center overflow-hidden shadow-inner">
              <canvas ref={canvasRef} width={256} height={36} className="w-full h-full" />
            </div>

            {/* Stage Quick Controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setVoiceEnabled((p) => !p)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${
                  voiceEnabled
                    ? "bg-purple-600/20 text-purple-300 border-purple-500/40"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                }`}
                title="Toggle Voice Speech Synthesis"
              >
                {voiceEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
                <span>Voice TTS</span>
              </button>

              <button
                type="button"
                onClick={toggleListening}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${
                  isListening
                    ? "bg-emerald-600/30 text-emerald-300 border-emerald-500/50 animate-pulse"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                }`}
                title="Voice Barge-In Push-To-Talk"
              >
                {isListening ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
                <span>{isListening ? "Listening..." : "Barge-In Mic"}</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab?.("persona")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200 hover:border-zinc-700 transition"
                title="Open Persona & Lorebook Studio"
              >
                <Sliders className="h-3 w-3 text-purple-400" />
                <span className="hidden sm:inline">Persona Studio</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. CHAT STREAM AREA */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-4xl mx-auto w-full">
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

        {/* Messages */}
        {messages.map((m) => {
          const isUser = m.sender === "user";
          return (
            <div key={m.id} className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 space-y-2 shadow-sm ${
                  isUser
                    ? "bg-purple-600 text-white rounded-br-xs"
                    : "bg-zinc-900/90 border border-zinc-800/80 text-zinc-100 rounded-bl-xs"
                }`}
              >
                {/* Header for Saan */}
                {!isUser && (
                  <div className="flex items-center justify-between text-xs text-zinc-400 border-b border-zinc-800/60 pb-1.5">
                    <span className="font-bold text-purple-400 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Saan
                    </span>
                    <div className="flex items-center gap-2">
                      {m.reaction && <span className="text-sm">{m.reaction}</span>}
                      <span>{m.time}</span>
                    </div>
                  </div>
                )}

                {/* Reasoning Accordion (Open-WebUI / AIRI <think>) */}
                {m.reasoning && (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-2.5 text-xs text-zinc-400 space-y-1">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedThoughts((prev) => ({ ...prev, [m.id]: !prev[m.id] }))
                      }
                      className="flex items-center justify-between w-full font-medium text-purple-300 hover:text-purple-200 transition"
                    >
                      <span className="flex items-center gap-1.5">
                        <Brain className="h-3.5 w-3.5" />
                        <span>Saan Internal Thought Process</span>
                      </span>
                      {expandedThoughts[m.id] ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                    {expandedThoughts[m.id] && (
                      <div className="pt-2 text-[11px] font-mono leading-relaxed text-zinc-400 border-t border-zinc-800/80">
                        {m.reasoning}
                      </div>
                    )}
                  </div>
                )}

                {/* Main Message Body */}
                <div className="text-sm leading-relaxed whitespace-pre-wrap select-text">{m.text}</div>

                {/* Autonomous Action Execution Badge (OpenHands) */}
                {m.actionResult && (
                  <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
                      <Zap className="h-3 w-3" /> Tool Executed: {m.actionResult.action || "Action"}
                    </span>
                    {m.snapshotId && (
                      <button
                        type="button"
                        onClick={() => handleRollback(m.snapshotId!)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 active:scale-95 transition"
                      >
                        <Undo2 className="h-3 w-3" /> Undo Action
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-purple-400 p-2 font-medium">
            <span className="h-2 w-2 rounded-full bg-purple-500 animate-ping" />
            <span>Saan is thinking and crafting her reply...</span>
          </div>
        )}
      </div>

      {/* 3. INPUT BAR */}
      <footer className="p-3 sm:p-4 border-t border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md shrink-0">
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
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message to Saan or speak with mic..."
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
    </div>
  );
}
