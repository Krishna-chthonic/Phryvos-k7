"use client";

import * as React from "react";
import { Coffee, Heart, Sparkles, Zap, Flame } from "lucide-react";

interface SaanAffectionBarProps {
  onTriggerAction: (actionType: "chai" | "headpat" | "compliment" | "focus") => void;
  bondScore?: number;
  className?: string;
}

interface FloatingParticle {
  id: number;
  x: number;
  y: number;
  icon: string;
  opacity: number;
  scale: number;
}

export function SaanAffectionBar({
  onTriggerAction,
  bondScore = 65,
  className = "",
}: SaanAffectionBarProps) {
  const [particles, setParticles] = React.useState<FloatingParticle[]>([]);

  // Spawn floating heart / sparkle particle burst
  const spawnParticles = (icon: string) => {
    const newItems: FloatingParticle[] = Array.from({ length: 6 }).map((_, i) => ({
      id: Date.now() + i,
      x: 35 + Math.random() * 30, // 35% to 65% horizontal
      y: 70 + Math.random() * 10,
      icon,
      opacity: 1,
      scale: 0.8 + Math.random() * 0.6,
    }));

    setParticles((prev) => [...prev, ...newItems]);

    // Animate and clear
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newItems.some((n) => n.id === p.id)));
    }, 1800);
  };

  const handleAction = (type: "chai" | "headpat" | "compliment" | "focus", icon: string) => {
    spawnParticles(icon);
    onTriggerAction(type);
  };

  return (
    <div className={`relative flex items-center justify-center gap-1.5 sm:gap-2 select-none ${className}`}>
      {/* Floating Particles Overlay */}
      {particles.map((p) => (
        <span
          key={p.id}
          className="fixed pointer-events-none text-base sm:text-lg animate-float-up z-50 transition-all duration-1000"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            transform: `scale(${p.scale})`,
          }}
        >
          {p.icon}
        </span>
      ))}

      {/* 1. Offer Chai */}
      <button
        type="button"
        onClick={() => handleAction("chai", "☕")}
        className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-500/60 transition active:scale-95 shadow-xs"
        title="Share hot masala chai with Saan"
      >
        <Coffee className="w-3.5 h-3.5 text-amber-400" />
        <span>Offer Chai</span>
      </button>

      {/* 2. Headpat */}
      <button
        type="button"
        onClick={() => handleAction("headpat", "💖")}
        className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 border border-pink-500/30 hover:border-pink-500/60 transition active:scale-95 shadow-xs"
        title="Give Saan an affectionate headpat"
      >
        <Heart className="w-3.5 h-3.5 text-pink-400 fill-pink-400/40" />
        <span>Headpat</span>
      </button>

      {/* 3. Compliment */}
      <button
        type="button"
        onClick={() => handleAction("compliment", "✨")}
        className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:border-purple-500/60 transition active:scale-95 shadow-xs"
        title="Give Saan a sweet sincere compliment"
      >
        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
        <span>Compliment</span>
      </button>

      {/* 4. Deep Focus */}
      <button
        type="button"
        onClick={() => handleAction("focus", "⚡")}
        className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:border-cyan-500/60 transition active:scale-95 shadow-xs"
        title="Enter deep technical architecture focus mode"
      >
        <Zap className="w-3.5 h-3.5 text-cyan-400" />
        <span className="hidden sm:inline">Focus Session</span>
      </button>
    </div>
  );
}
