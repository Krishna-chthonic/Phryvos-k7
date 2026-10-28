"use client";

import * as React from "react";
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  Sun,
  Moon,
  Coffee,
  Zap,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

interface SaanPomodoroWidgetProps {
  onSessionComplete?: (minutes: number) => void;
  className?: string;
}

export function SaanPomodoroWidget({
  onSessionComplete,
  className = "",
}: SaanPomodoroWidgetProps) {
  const [secondsLeft, setSecondsLeft] = React.useState(25 * 60);
  const [isActive, setIsActive] = React.useState(false);
  const [cycle, setCycle] = React.useState(1);

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((s) => s - 1);
      }, 1000);
    } else if (secondsLeft === 0 && isActive) {
      setIsActive(false);
      setCycle((c) => c + 1);
      onSessionComplete?.(25);
    }
    return () => clearInterval(interval);
  }, [isActive, secondsLeft, onSessionComplete]);

  const toggleTimer = () => setIsActive((a) => !a);

  const resetTimer = () => {
    setIsActive(false);
    setSecondsLeft(25 * 60);
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progressPercent = ((25 * 60 - secondsLeft) / (25 * 60)) * 100;

  return (
    <div
      className={`rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/30 via-zinc-900 to-zinc-950 p-4 shadow-md space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
            <Timer className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-zinc-100 flex items-center gap-1.5">
              <span>Deep Architecture Focus Sprint</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-cyan-500/20 text-cyan-300">
                Cycle #{cycle}
              </span>
            </span>
            <p className="text-[10px] text-zinc-400">
              Co-working session with Saan (Airi Component Calling)
            </p>
          </div>
        </div>

        {/* Progress Bar Gauge */}
        <div className="w-16 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-cyan-400 transition-all duration-1000"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Timer Display & Controls */}
      <div className="flex items-center justify-between pt-1">
        <div className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-cyan-300">
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTimer}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-xs ${
              isActive
                ? "bg-amber-600 hover:bg-amber-500 text-white"
                : "bg-cyan-600 hover:bg-cyan-500 text-white"
            }`}
          >
            {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isActive ? "Pause" : "Start Sprint"}</span>
          </button>

          <button
            type="button"
            onClick={resetTimer}
            className="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
            title="Reset to 25 mins"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface SaanCircadianSkyWidgetProps {
  circadianState?: string;
  className?: string;
}

export function SaanCircadianSkyWidget({
  circadianState = "morning_chai",
  className = "",
}: SaanCircadianSkyWidgetProps) {
  const getSkyDetails = () => {
    switch (circadianState) {
      case "morning_chai":
        return {
          title: "Subah ki Chai & Strategy",
          desc: "Fresh golden sunrise aura. Time for system planning and calm reflection.",
          icon: Coffee,
          badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
          skyGlow: "from-amber-500/15 via-orange-500/5 to-transparent",
        };
      case "focus_work":
      case "afternoon_focus":
        return {
          title: "Deep Technical Focus Sprint",
          desc: "High energy, minimal distractions. Building sovereign K7 modules.",
          icon: Zap,
          badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
          skyGlow: "from-cyan-500/15 via-blue-500/5 to-transparent",
        };
      case "evening_unwind":
        return {
          title: "Evening Twilight & Banter",
          desc: "Soft violet dusk lighting. Reviewing the day's achievements.",
          icon: Sparkles,
          badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/40",
          skyGlow: "from-purple-500/15 via-pink-500/5 to-transparent",
        };
      default:
        return {
          title: "Late Night Starlight",
          desc: "Quiet hours. Deep restorative sleep and dream consolidation.",
          icon: Moon,
          badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
          skyGlow: "from-indigo-600/15 via-violet-950/10 to-transparent",
        };
    }
  };

  const sky = getSkyDetails();
  const Icon = sky.icon;

  return (
    <div
      className={`rounded-2xl border border-zinc-800 bg-gradient-to-r ${sky.skyGlow} p-3.5 shadow-xs flex items-center justify-between gap-3 ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-zinc-100 shadow-inner">
          <Icon className="w-4 h-4 text-purple-400" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-zinc-100 truncate">{sky.title}</h3>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono border uppercase font-bold ${sky.badgeColor}`}
            >
              {circadianState}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 truncate mt-0.5">{sky.desc}</p>
        </div>
      </div>
    </div>
  );
}
