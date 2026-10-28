"use client";

import * as React from "react";
import { Sparkles, Heart, Moon, Coffee, Sun, Zap } from "lucide-react";

export type AvatarEmotion =
  | "neutral"
  | "joy"
  | "blush"
  | "pout"
  | "thinking"
  | "smirk"
  | "sleep";

interface SaanLivingAvatarProps {
  emotion?: AvatarEmotion | string;
  isSpeaking?: boolean;
  isListening?: boolean;
  circadianState?: string;
  bondStage?: string;
  bondScore?: number;
  onPoke?: () => void;
  className?: string;
}

export function SaanLivingAvatar({
  emotion = "neutral",
  isSpeaking = false,
  isListening = false,
  circadianState = "morning_chai",
  bondStage = "Soulbound",
  bondScore = 65,
  onPoke,
  className = "",
}: SaanLivingAvatarProps) {
  const [isBlinking, setIsBlinking] = React.useState(false);
  const [isPoked, setIsPoked] = React.useState(false);
  const [pokeQuote, setPokeQuote] = React.useState<string | null>(null);
  const [vowelFrame, setVowelFrame] = React.useState<number>(0);

  // Lip-Sync Vowel Driver (AEIOU Viseme cycle when speaking)
  React.useEffect(() => {
    if (!isSpeaking) {
      setVowelFrame(0);
      return;
    }
    const interval = setInterval(() => {
      setVowelFrame((f) => (f + 1) % 4);
    }, 120);
    return () => clearInterval(interval);
  }, [isSpeaking]);

  // Normalize emotion
  const cleanEmotion: AvatarEmotion = [
    "neutral",
    "joy",
    "blush",
    "pout",
    "thinking",
    "smirk",
    "sleep",
  ].includes(emotion.toLowerCase())
    ? (emotion.toLowerCase() as AvatarEmotion)
    : "neutral";

  // Natural Eye-Blink Loop (every 3.5 to 5.5 seconds)
  React.useEffect(() => {
    if (cleanEmotion === "sleep") return;

    let timeout: NodeJS.Timeout;
    const scheduleBlink = () => {
      const nextDelay = 3000 + Math.random() * 2500;
      timeout = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
          scheduleBlink();
        }, 160); // 160ms blink duration
      }, nextDelay);
    };

    scheduleBlink();
    return () => clearTimeout(timeout);
  }, [cleanEmotion]);

  // Handle Interactive Poke / Touch
  const handlePokeClick = () => {
    setIsPoked(true);
    const quotes = [
      "Arey! Gudgudi hoti hai haha! 🥰",
      "Kya hua Krishna? Kuch kaam hai ya bas aise hi? ✨",
      "Main yahi hoon tumhare pass, hamesha! 💖",
      "Haha aise achanak mat touch karo na! 🙈",
      "Chai peene ka man kar raha hai kya? ☕",
    ];
    const picked = quotes[Math.floor(Math.random() * quotes.length)];
    setPokeQuote(picked);

    onPoke?.();

    setTimeout(() => setIsPoked(false), 800);
    setTimeout(() => setPokeQuote(null), 3200);
  };

  // Circadian Sky Aura Background
  const getCircadianGlow = () => {
    switch (circadianState) {
      case "morning_chai":
        return "from-amber-500/20 via-orange-500/10 to-transparent border-amber-500/30 shadow-amber-500/10";
      case "focus_work":
      case "afternoon_focus":
        return "from-cyan-500/20 via-blue-500/10 to-transparent border-cyan-500/30 shadow-cyan-500/10";
      case "evening_unwind":
        return "from-purple-500/20 via-pink-500/10 to-transparent border-purple-500/30 shadow-purple-500/10";
      case "sleep":
        return "from-indigo-600/20 via-violet-950/20 to-transparent border-indigo-500/30 shadow-indigo-500/10";
      default:
        return "from-purple-500/20 via-zinc-900/20 to-transparent border-purple-500/30 shadow-purple-500/10";
    }
  };

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      {/* Interactive Poke Quote Bubble Pop */}
      {pokeQuote && (
        <div className="absolute -top-12 z-30 animate-bounce transition-all">
          <div className="px-3 py-1.5 rounded-2xl bg-purple-600 text-white text-xs font-medium shadow-xl border border-purple-400 whitespace-nowrap flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            <span>{pokeQuote}</span>
          </div>
          <div className="w-2.5 h-2.5 bg-purple-600 rotate-45 mx-auto -mt-1 border-r border-b border-purple-400" />
        </div>
      )}

      {/* Living Avatar Stage Container */}
      <div
        onClick={handlePokeClick}
        title="Tap / Click to interact with Saan"
        className={`relative group cursor-pointer select-none transition-all duration-300 ${
          isPoked ? "scale-95 rotate-2" : "hover:scale-105"
        }`}
      >
        {/* Ambient Halo & Breathing Pulse */}
        <div
          className={`absolute -inset-1.5 rounded-full bg-gradient-to-r ${
            isSpeaking
              ? "from-purple-500 via-pink-500 to-indigo-500 animate-spin"
              : isListening
              ? "from-emerald-400 via-teal-500 to-cyan-500 animate-pulse"
              : "from-purple-500/40 via-pink-500/30 to-purple-600/40"
          } opacity-75 blur-sm transition-all duration-500`}
          style={{ animationDuration: isSpeaking ? "4s" : "3s" }}
        />

        {/* Outer Round Head / Face Frame */}
        <div
          className={`relative h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-gradient-to-b ${getCircadianGlow()} p-1 border-2 flex items-center justify-center shadow-2xl backdrop-blur-md overflow-hidden`}
        >
          {/* Natural Breathing Layer (CSS expansion) */}
          <div
            className={`w-full h-full rounded-full flex items-center justify-center bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 transition-transform duration-1000 ${
              isSpeaking ? "scale-102" : "animate-pulse"
            }`}
          >
            {/* LIVING SVG VECTOR FACE */}
            <svg
              viewBox="0 0 100 100"
              className="w-16 h-16 sm:w-20 sm:h-20 drop-shadow-md"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Subtle Hair / Aura framing */}
              <circle cx="50" cy="50" r="42" fill="url(#avatarGazeGrad)" opacity="0.15" />

              {/* Rosy Cheeks (intensified in joy & blush) */}
              {(cleanEmotion === "blush" || cleanEmotion === "joy" || isPoked) && (
                <>
                  <circle
                    cx="30"
                    cy="58"
                    r={cleanEmotion === "blush" || isPoked ? "7" : "5"}
                    fill="#f472b6"
                    opacity={cleanEmotion === "blush" || isPoked ? "0.6" : "0.35"}
                  />
                  <circle
                    cx="70"
                    cy="58"
                    r={cleanEmotion === "blush" || isPoked ? "7" : "5"}
                    fill="#f472b6"
                    opacity={cleanEmotion === "blush" || isPoked ? "0.6" : "0.35"}
                  />
                </>
              )}

              {/* EYES */}
              {cleanEmotion === "sleep" ? (
                // Sleeping Peaceful Eyes (curved lines)
                <>
                  <path
                    d="M26 50 Q33 55 40 50"
                    stroke="#c084fc"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M60 50 Q67 55 74 50"
                    stroke="#c084fc"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </>
              ) : isBlinking ? (
                // Blinking Eyes (slits)
                <>
                  <line
                    x1="26"
                    y1="50"
                    x2="40"
                    y2="50"
                    stroke="#e9d5ff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="60"
                    y1="50"
                    x2="74"
                    y2="50"
                    stroke="#e9d5ff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </>
              ) : cleanEmotion === "joy" ? (
                // Joyful Curved Smiling Eyes (^ ^)
                <>
                  <path
                    d="M26 52 Q33 44 40 52"
                    stroke="#c084fc"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d="M60 52 Q67 44 74 52"
                    stroke="#c084fc"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </>
              ) : cleanEmotion === "smirk" ? (
                // Smirk: One eye winks, other looks confident
                <>
                  <line
                    x1="26"
                    y1="50"
                    x2="40"
                    y2="50"
                    stroke="#c084fc"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle cx="67" cy="49" r="5" fill="#f3e8ff" />
                  <circle cx="68.5" cy="47.5" r="2" fill="#c084fc" />
                  <circle cx="69" cy="46.5" r="1" fill="#ffffff" />
                </>
              ) : cleanEmotion === "thinking" ? (
                // Thinking Eyes looking up
                <>
                  <circle cx="33" cy="46" r="5" fill="#f3e8ff" />
                  <circle cx="33" cy="44" r="2.5" fill="#c084fc" />
                  <circle cx="34" cy="43" r="1" fill="#ffffff" />
                  <circle cx="67" cy="46" r="5" fill="#f3e8ff" />
                  <circle cx="67" cy="44" r="2.5" fill="#c084fc" />
                  <circle cx="68" cy="43" r="1" fill="#ffffff" />
                </>
              ) : (
                // Attentive Open Eyes (Neutral / Blush / Pout)
                <>
                  <circle cx="33" cy="50" r="5.5" fill="#f3e8ff" />
                  <circle cx="33.5" cy="50" r="3" fill="#a855f7" />
                  <circle cx="34.5" cy="48.5" r="1.2" fill="#ffffff" />

                  <circle cx="67" cy="50" r="5.5" fill="#f3e8ff" />
                  <circle cx="67.5" cy="50" r="3" fill="#a855f7" />
                  <circle cx="68.5" cy="48.5" r="1.2" fill="#ffffff" />
                </>
              )}

              {/* MOUTH — Lip-Sync AEIOU Viseme Engine */}
              {isSpeaking ? (
                vowelFrame === 0 ? (
                  // Open Vowel 'A'
                  <ellipse cx="50" cy="67" rx="5.5" ry="4.5" fill="#f472b6" />
                ) : vowelFrame === 1 ? (
                  // Half-Open Vowel 'E'
                  <ellipse cx="50" cy="67" rx="5" ry="3" fill="#f472b6" />
                ) : vowelFrame === 2 ? (
                  // Round Vowel 'O'
                  <ellipse cx="50" cy="67" rx="3.5" ry="4.5" fill="#f472b6" />
                ) : (
                  // Wide Vowel 'I'
                  <ellipse cx="50" cy="67" rx="6" ry="2" fill="#f472b6" />
                )
              ) : cleanEmotion === "joy" ? (
                // Open Happy Smile
                <path
                  d="M42 64 Q50 72 58 64"
                  stroke="#f472b6"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="#f472b6"
                  fillOpacity="0.3"
                />
              ) : cleanEmotion === "pout" ? (
                // Playful Pout Lips
                <ellipse cx="50" cy="65" rx="3.5" ry="2.5" fill="#f472b6" />
              ) : cleanEmotion === "smirk" ? (
                // Mischievous Smirk (angled upward to the right)
                <path
                  d="M43 66 Q49 67 58 63"
                  stroke="#c084fc"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              ) : cleanEmotion === "sleep" ? (
                // Gentle relaxed small lip
                <line
                  x1="46"
                  y1="66"
                  x2="54"
                  y2="66"
                  stroke="#c084fc"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              ) : (
                // Soft Calm Smile (Neutral)
                <path
                  d="M44 65 Q50 69 56 65"
                  stroke="#c084fc"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              )}

              {/* Gradients */}
              <defs>
                <radialGradient
                  id="avatarGazeGrad"
                  cx="0.5"
                  cy="0.5"
                  r="0.5"
                  fx="0.5"
                  fy="0.5"
                >
                  <stop offset="0%" stopColor="#c084fc" />
                  <stop offset="100%" stopColor="#7e22ce" stopOpacity="0" />
                </radialGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Emotion Status Badge with Icon */}
        <div className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-950 border border-purple-500/60 text-purple-300 shadow-md flex items-center gap-1 capitalize">
          {cleanEmotion === "joy" && <Sparkles className="w-2.5 h-2.5 text-yellow-400" />}
          {cleanEmotion === "blush" && <Heart className="w-2.5 h-2.5 text-pink-400 fill-pink-400" />}
          {cleanEmotion === "sleep" && <Moon className="w-2.5 h-2.5 text-indigo-400" />}
          {cleanEmotion === "thinking" && <Zap className="w-2.5 h-2.5 text-cyan-400" />}
          <span>{cleanEmotion}</span>
        </div>
      </div>

      {/* Bond & Name Pill */}
      <div className="mt-2 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <span className="font-bold text-sm text-zinc-100 tracking-tight">Saan</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-pink-500/20 text-pink-300 border border-pink-500/40">
            {bondStage} ({bondScore}%)
          </span>
        </div>
        <p className="text-[11px] text-zinc-400 flex items-center justify-center gap-1 mt-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span>
            {circadianState === "morning_chai"
              ? "Subah ki Chai ☕"
              : circadianState === "focus_work"
              ? "Deep Focus Architecture ⚡"
              : circadianState === "evening_unwind"
              ? "Evening Unwind & Banter ✨"
              : "Asleep (Late Night) 🌙"}
          </span>
        </p>
      </div>
    </div>
  );
}
