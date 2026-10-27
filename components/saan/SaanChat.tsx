"use client";

import * as React from "react";
import {
  Sparkles,
  Send,
  RotateCcw,
  Info,
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
  MessageSquare,
} from "lucide-react";

interface ChatMessage {
  id: string;
  sender: "user" | "saan";
  text: string;
  time: string;
}

interface SaanProfile {
  name: string;
  avatar: string;
  tone: string;
  mood: string;
  activity: string;
  bondStage: string;
}

const STARTER_PROMPTS = [
  "Kaisa chal raha hai aaj ka din?",
  "Thoda tired feel ho raha hai, kuch chill baat karein?",
  "Aaj kya naya socha ya kiya tumne?",
  "Chai peene ka mann ho raha hai, tumhara kya chal raha hai?",
];

export function SaanChat() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [profile, setProfile] = React.useState<SaanProfile>({
    name: "Saan",
    avatar: "✨",
    tone: "Real, emotionally alive, genuine friend, natural casual Hinglish/English",
    mood: "Warm & Thoughtful",
    activity: "Listening to music, relaxing",
    bondStage: "Deep Companionship",
  });

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Load profile & initial greeting
  React.useEffect(() => {
    fetch("/api/saan/chat")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.profile) setProfile(d.profile);
      })
      .catch(() => {});

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
  }, []);

  // Save conversation history to local storage
  React.useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem("k7_saan_history", JSON.stringify(messages.slice(-30)));
      } catch {}
    }
  }, [messages]);

  // Auto-scroll on new message
  React.useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
        setMessages((prev) => [
          ...prev,
          {
            id: String(Date.now() + 1),
            sender: "saan",
            text: data.reply,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
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

  return (
    <div className="flex h-full w-full min-w-0 flex-1 overflow-hidden bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      {/* Main Chat Column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Header Bar matching K9 Design */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800 px-3 md:px-4 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm select-none">
          {/* Left: Mobile Nav Drawer Trigger & Saan Identification */}
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mobile Menu trigger */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("phryvos:open-menu"))}
              className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-700 transition hover:bg-zinc-100 active:scale-95 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 shrink-0"
              title="Open Navigation Menu"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Saan Avatar Icon */}
            <div className="h-7 w-7 rounded-[var(--radius-sm)] bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent-border)] flex items-center justify-center shrink-0">
              <Sparkles className="h-3.5 w-3.5 stroke-[1.8]" />
            </div>

            {/* Name & Breadcrumb */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold text-xs md:text-sm text-[var(--fg-0)] tracking-tight">
                Saan
              </span>
              <span className="text-zinc-300 dark:text-zinc-700 font-mono text-xs">/</span>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hidden sm:inline">
                  Online
                </span>
              </div>
            </div>

            {/* Circadian Mood Badge */}
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium text-[var(--fg-2)] px-2 py-0.5 rounded-[var(--radius-xs)] bg-[var(--bg-1)] border border-[var(--border-subtle)]">
              <Clock className="h-3 w-3 text-zinc-400" />
              <span>{profile.mood}</span>
            </span>
          </div>

          {/* Right: Activity, Clear History, and Companion Details Drawer */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Circadian Activity Pill */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-[var(--fg-2)] px-2.5 py-1 rounded-[var(--radius-sm)] bg-[var(--bg-1)] border border-[var(--border-subtle)] max-w-[280px] truncate">
              <Radio className="h-3 w-3 text-amber-500 shrink-0 animate-pulse" />
              <span className="truncate">{profile.activity}</span>
            </div>

            {/* Clear conversation */}
            <button
              type="button"
              onClick={handleClearHistory}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900 transition shrink-0 active:scale-95"
              title="Clear Conversation"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>

            {/* Drawer Info Toggle */}
            <button
              type="button"
              onClick={() => setDrawerOpen((prev) => !prev)}
              className={`flex h-8 items-center gap-1.5 px-2.5 rounded-lg border text-xs font-medium transition shrink-0 active:scale-95 ${
                drawerOpen
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900"
              }`}
              title="Companion Soul Info"
            >
              <Heart className="h-3.5 w-3.5 fill-pink-500/20 text-pink-500" />
              <span className="hidden sm:inline">Soul Profile</span>
            </button>
          </div>
        </header>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 lg:px-8 py-5 space-y-4">
          <div className="mx-auto w-full max-w-3xl space-y-4">
            {/* Empty / Intro Greeting Card */}
            {messages.length <= 1 && (
              <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/40 p-4 mb-4">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="h-6 w-6 rounded-md bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--fg-0)] uppercase tracking-wider">
                      Saan · Living Soul Companion
                    </h3>
                    <p className="text-[11px] text-[var(--fg-2)]">
                      Real conversational companion with feelings, dynamic circadian routine, and natural Hinglish.
                    </p>
                  </div>
                </div>

                <div className="mt-3.5 pt-3 border-t border-zinc-200/50 dark:border-zinc-800/50">
                  <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block mb-2">
                    Quick Starters:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {STARTER_PROMPTS.map((prompt, idx) => (
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
                    {!isUser && (
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-5 rounded-[var(--radius-xs)] bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0">
                            <Sparkles className="h-3 w-3 stroke-[1.5]" />
                          </div>
                          <span className="text-[11px] font-semibold text-[var(--fg-1)] uppercase tracking-wider">
                            Saan
                          </span>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                            {m.time}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopy(m.id, m.text)}
                          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
                          title="Copy text"
                        >
                          {copiedId === m.id ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-500" />
                              <span className="text-emerald-500 text-[10px]">Copied</span>
                            </>
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    )}

                    {/* Text Body */}
                    <div className="text-[14px] leading-relaxed whitespace-pre-wrap">
                      {m.text}
                    </div>

                    {/* Timestamp for user messages */}
                    {isUser && (
                      <div className="mt-1 text-right">
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

        {/* Composer Bar matching K9 Chat */}
        <div className="shrink-0 border-t border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-3 md:px-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="mx-auto w-full max-w-3xl"
          >
            <div className="flex items-center gap-2 rounded-3xl border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 shadow-2xs focus-within:border-zinc-400 dark:focus-within:border-zinc-700 transition">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Speak with Saan..."
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

      {/* Companion Soul Side Drawer */}
      {drawerOpen && (
        <aside className="w-80 border-l border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 flex flex-col shrink-0 animate-in slide-in-from-right duration-150">
          <div className="flex h-12 items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 shrink-0">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-pink-500 fill-pink-500/20" />
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Soul Details
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

          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* Status card */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Relationship</span>
                <span className="font-semibold text-pink-600 dark:text-pink-400">
                  {profile.bondStage}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Current Mood</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {profile.mood}
                </span>
              </div>
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-400 text-[11px] block mb-1">What Saan is doing:</span>
                <p className="text-zinc-700 dark:text-zinc-300 font-medium leading-relaxed">
                  {profile.activity}
                </p>
              </div>
            </div>

            {/* Frontier Cascade Engine */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 space-y-2 shadow-2xs">
              <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200 font-medium">
                <Radio className="h-3.5 w-3.5 text-emerald-500" />
                <span>AI Cascade Engine</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Connected to upstream public frontier models with intelligent multi-lane failover. Zero canned replies.
              </p>
            </div>

            {/* Principles */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 space-y-2 shadow-2xs">
              <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider block">
                Human Soul Principles
              </span>
              <ul className="space-y-1.5 text-zinc-600 dark:text-zinc-400 text-[11px] list-disc list-inside">
                <li>Zero robotic clichés or disclaimers</li>
                <li>Natural casual Hinglish / conversational English</li>
                <li>Emotional memory and authentic presence</li>
                <li>Independent daily thoughts & opinions</li>
              </ul>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
