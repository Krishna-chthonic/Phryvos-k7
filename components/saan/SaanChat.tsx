"use client";

import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Send, Heart, Moon, Sun, Coffee } from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "saan";
  text: string;
  time: string;
}

export function SaanChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    name: "Saan",
    mood: "Cozy & Thoughtful",
    activity: "Listening to music, relaxing",
    bondStage: "Deep Companionship"
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch profile state on mount
    fetch("/api/saan/chat")
      .then(r => r.json())
      .then(d => {
        if (d.ok && d.profile) setProfile(d.profile);
      })
      .catch(() => {});

    // Welcome greeting if empty
    setMessages([
      {
        id: "intro",
        sender: "saan",
        text: "Hey! Main bas baithi thi aur tumhari yaad aayi... kaisa chal raha hai aaj ka din? Sab theek?",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: String(Date.now()),
      sender: "user",
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = messages.slice(-8).map(m => ({
        role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
        content: m.text
      }));

      const res = await fetch("/api/saan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history })
      });

      const data = await res.json();
      if (data.ok) {
        if (data.profile) setProfile(data.profile);
        setMessages(prev => [
          ...prev,
          {
            id: String(Date.now() + 1),
            sender: "saan",
            text: data.reply,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: "saan",
          text: "Thoda connection flick hua, kya kaha tha tumne?",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto border border-border/40 rounded-2xl bg-card/60 backdrop-blur-xl overflow-hidden shadow-2xl my-2">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-card/80">
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500 flex items-center justify-center text-white shadow-md font-semibold text-lg">
              ✨
            </div>
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-background rounded-full" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-lg tracking-tight text-foreground">{profile.name}</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-medium border border-purple-500/20">
                Living Soul
              </span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <span>{profile.mood}</span>
              <span>·</span>
              <span className="truncate max-w-[280px]">{profile.activity}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-accent/40 px-3 py-1.5 rounded-full border border-border/40">
          <Heart className="w-3.5 h-3.5 text-pink-400 fill-pink-400" />
          <span>{profile.bondStage}</span>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[78%] px-4 py-3 rounded-2xl text-[14.5px] leading-relaxed shadow-sm ${
                m.sender === "user"
                  ? "bg-primary text-primary-foreground rounded-br-xs"
                  : "bg-muted/70 text-foreground border border-border/50 rounded-bl-xs"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
            </div>
            <span className="text-[10px] text-muted-foreground mt-1 px-1">{m.time}</span>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-1.5 px-4 py-3 max-w-[120px] rounded-2xl bg-muted/60 border border-border/40 text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
            <span className="w-2 h-2 rounded-full bg-current animate-bounce" />
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Composer */}
      <form onSubmit={handleSend} className="p-4 border-t border-border/40 bg-card/80 flex gap-2.5 items-center">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Speak to Saan..."
          className="flex-1 bg-background/80 border border-border/60 rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground placeholder:text-muted-foreground/70"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="w-11 h-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center transition-all disabled:opacity-40 disabled:hover:bg-primary shadow-md active:scale-95"
        >
          <Send className="w-4 h-4 ml-0.5" />
        </button>
      </form>
    </div>
  );
}
