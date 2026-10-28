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
} from "lucide-react";
import { globalAvatarMapper } from "@/lib/saan/avatar-expressions";
import { SaanLivingAvatar, type AvatarEmotion } from "./SaanLivingAvatar";
import { SaanDialogueBubble, type DialogueBubbleMessage } from "./SaanDialogueBubble";
import { SaanAffectionBar } from "./SaanAffectionBar";
import { SaanWorkingMemoryCapsule } from "./SaanWorkingMemoryCapsule";

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
  const [messages, setMessages] = React.useState<DialogueBubbleMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  // Audio & Waveform Visualization
  const [voiceEnabled, setVoiceEnabled] = React.useState(false);
  const [isListening, setIsListening] = React.useState(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const [avatarEmotion, setAvatarEmotion] = React.useState<AvatarEmotion>("neutral");
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

  // TTS with speech pacing
  const speakText = React.useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();

      // Clean markdown tags & think tags & narrative asterisks for audio speech
      const clean = text
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/\[\w+\]/g, "")
        .replace(/\*[^*]+\*/g, "") // Narrative actions are silent gestures
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
    []
  );

  // Send turn
  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

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
        // Extract avatar emotion token if present
        const parsedAvatar = globalAvatarMapper.extract(data.reply);
        if (parsedAvatar.expressions && parsedAvatar.expressions.length > 0) {
          const rawEmo = parsedAvatar.expressions[0].toLowerCase();
          if (["joy", "blush", "pout", "thinking", "smirk", "sleep"].includes(rawEmo)) {
            setAvatarEmotion(rawEmo as AvatarEmotion);
          } else {
            setAvatarEmotion("neutral");
          }
        }

        // Extract reasoning if present
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
          speakText(cleanReply);
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

  // Quick Affection Action Handler (Chai, Headpat, Compliment, Focus)
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
        handleSend("Chalo Saan, deep work aur architecture focus shuru karte hain. Let's build K7 sovereign OS!");
        break;
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

  const circadian = profile?.circadianState || "morning_chai";

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      {/* 1. TOP LIVING COMPANION AVATAR STAGE */}
      <section className="relative shrink-0 border-b border-zinc-800/80 bg-zinc-950/90 p-3 sm:p-4 transition-all duration-500">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Living Avatar with Real Vector Face & Micro-Animations */}
          <div className="flex items-center gap-4 w-full md:w-auto">
            <SaanLivingAvatar
              emotion={avatarEmotion}
              isSpeaking={isSpeaking}
              isListening={isListening}
              circadianState={circadian}
              bondStage={profile?.bondStage || "Soulbound"}
              bondScore={profile?.bondScore || 65}
              onPoke={() => setAvatarEmotion("blush")}
            />

            {/* Quick Interactive Affection Bar (HerAndHim + SillyTavern) */}
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

          {/* Equalizer Waveform & Audio Controls */}
          <div className="flex flex-col items-center md:items-end gap-2 w-full md:w-auto">
            <div className="w-full md:w-64 h-9 rounded-xl bg-zinc-900/90 border border-zinc-800/80 p-1 flex items-center justify-center overflow-hidden shadow-inner">
              <canvas ref={canvasRef} width={256} height={32} className="w-full h-full" />
            </div>

            <div className="flex items-center gap-2">
              {ttfaMs && (
                <span className="text-[10px] text-zinc-400 font-mono bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-800">
                  TTFA: {ttfaMs}ms
                </span>
              )}

              {/* TTS Voice Toggle */}
              <button
                type="button"
                onClick={() => setVoiceEnabled((p) => !p)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${
                  voiceEnabled
                    ? "bg-purple-600/30 text-purple-300 border-purple-500/50"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200"
                }`}
                title="Toggle Auto-Voice Speech Synthesis"
              >
                {voiceEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
                <span>Auto Voice</span>
              </button>

              {/* Barge-In Push to Talk */}
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
                <span>{isListening ? "Listening..." : "Mic"}</span>
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

        {/* Mobile Affection Bar (Visible on smaller screens) */}
        <div className="flex lg:hidden mt-3 pt-2.5 border-t border-zinc-800/60 justify-center">
          <SaanAffectionBar
            onTriggerAction={handleAffectionAction}
            bondScore={profile?.bondScore || 65}
          />
        </div>
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
            onSpeak={(text) => speakText(text)}
            onReact={handleUserReaction}
            onRollback={handleRollback}
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
            onChange={(e) => setInput(e.target.value)}
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
    </div>
  );
}
