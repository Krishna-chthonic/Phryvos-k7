/**
 * Trigger Recall & Proactive Briefing Engine for Saan Companion (K7)
 * Clean-room adaptation of openclaw/openclaw architecture (Commit e094e4c8, MIT).
 *
 * Implements:
 * 1. Canonical & legacy root memory path resolution (MEMORY.md / repair directory).
 * 2. Active hours window evaluation supporting overnight windows and IANA timezones.
 * 3. Retrospective vs prospective intent classifier.
 * 4. Dual-phrase trigger scorer (0.85 single-word, coverage+overlap multi-word, 0.65 threshold).
 * 5. Proactive Morning Chai Briefing (08:00) and Evening Unwind Recap (21:00) builders.
 */

import path from "node:path";

export const CANONICAL_ROOT_MEMORY_FILENAME = "MEMORY.md";
export const LEGACY_ROOT_MEMORY_FILENAME = "memory.md";
export const STRONG_TRIGGER_MATCH_SCORE = 0.65;
export const MAX_TRIGGER_CONTEXT_CHARS = 1800;
export const MAX_TRIGGER_INJECTIONS = 3;

export function resolveCanonicalRootMemoryPath(workspaceDir: string): string {
  return path.join(workspaceDir, CANONICAL_ROOT_MEMORY_FILENAME);
}

export function resolveLegacyRootMemoryPath(workspaceDir: string): string {
  return path.join(workspaceDir, LEGACY_ROOT_MEMORY_FILENAME);
}

export function resolveRootMemoryRepairDir(workspaceDir: string): string {
  return path.join(workspaceDir, ".openclaw-repair", "root-memory");
}

export interface CronActiveHours {
  start: string; // HH:MM
  end: string;   // HH:MM or 24:00
  timezone?: string; // "user" | "local" | IANA identifier
}

/**
 * Validates active hours format and timezone.
 */
export function assertCronActiveHours(active: CronActiveHours): void {
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(active.start) ||
    !/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/.test(active.end)
  ) {
    throw new Error("cron activeHours requires HH:MM start/end (24:00 is allowed only for end)");
  }
  if (active.timezone !== undefined && active.timezone !== "user" && active.timezone !== "local") {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: active.timezone }).format(0);
    } catch {
      throw new Error("cron activeHours.timezone must be user, local, or an IANA timezone");
    }
  }
}

/**
 * Checks if a given timestamp falls within active hours window, including overnight windows.
 */
export function isCronWithinActiveHours(
  active: CronActiveHours | undefined,
  nowMs: number,
  userTimezone = "UTC"
): boolean {
  if (!active) return true;
  assertCronActiveHours(active);

  const tz = active.timezone === "user" ? userTimezone : active.timezone === "local" ? undefined : active.timezone;
  const d = new Date(nowMs);
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  });

  const parts = timeFormatter.formatToParts(d);
  const hour = parts.find((p) => p.type === "hour")?.value || "00";
  const minute = parts.find((p) => p.type === "minute")?.value || "00";
  const currentHM = `${hour}:${minute}`;

  const startHM = active.start;
  const endHM = active.end === "24:00" ? "23:59" : active.end;

  if (startHM <= endHM) {
    // Standard day window (e.g., 08:00 to 22:00)
    return currentHM >= startHM && currentHM <= endHM;
  } else {
    // Overnight window (e.g., 22:00 to 06:00)
    return currentHM >= startHM || currentHM <= endHM;
  }
}

export type RecallIntent = "retrospective" | "prospective_reminder" | "factual" | "none";

const RETROSPECTIVE_PATTERNS = [
  /\b(did we|what did (we|you) do|remember when|last time|last week|yesterday|recall|we talked about)\b/i,
  /\b(what happened (with|to)|who said|kya hua tha|yaad hai|pehle)\b/i,
];

const PROSPECTIVE_PATTERNS = [
  /\b(remind me|don't forget|dont forget|schedule|tomorrow|next week|later today|in the future)\b/i,
  /\b(yaad dilana|kal|aage se|alert me)\b/i,
];

/**
 * Classify conversation turn intent into memory recall modes.
 */
export function classifyRecallIntent(text: string): RecallIntent {
  for (const pat of RETROSPECTIVE_PATTERNS) {
    if (pat.test(text)) return "retrospective";
  }
  for (const pat of PROSPECTIVE_PATTERNS) {
    if (pat.test(text)) return "prospective_reminder";
  }
  if (/\b(what is|who is|where is|how does)\b/i.test(text)) {
    return "factual";
  }
  return "none";
}

export interface TriggerPhraseMatch {
  phrase: string;
  score: number;
  matchedTokens: string[];
}

/**
 * Dual-phrase trigger scorer adapted from OpenClaw:
 * - Single-word trigger: fixed 0.85 when present.
 * - Multi-word trigger: (coverage * 0.8) + min(1.0, overlap / 2) * 0.2.
 */
export function scoreTriggerPhrase(query: string, triggerPhrase: string): TriggerPhraseMatch {
  const qTokens = query.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean);
  const pTokens = triggerPhrase.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean);

  if (pTokens.length === 0 || qTokens.length === 0) {
    return { phrase: triggerPhrase, score: 0, matchedTokens: [] };
  }

  const qSet = new Set(qTokens);
  const matchedTokens = pTokens.filter((t) => qSet.has(t));
  const overlap = matchedTokens.length;

  if (pTokens.length === 1) {
    const score = overlap > 0 ? 0.85 : 0.0;
    return { phrase: triggerPhrase, score, matchedTokens };
  }

  const coverage = overlap / pTokens.length;
  const score = Number((coverage * 0.8 + Math.min(1.0, overlap / 2) * 0.2).toFixed(4));
  return { phrase: triggerPhrase, score, matchedTokens };
}

/**
 * Filter and rank memories by trigger match score, capped at MAX_TRIGGER_CONTEXT_CHARS.
 */
export function selectTriggeredMemories(
  query: string,
  memories: Array<{ id: string; content: string; triggerPhrases: string[] }>,
  threshold = STRONG_TRIGGER_MATCH_SCORE,
  maxInjections = MAX_TRIGGER_INJECTIONS
): Array<{ id: string; content: string; score: number; bestPhrase: string }> {
  const candidates: Array<{ id: string; content: string; score: number; bestPhrase: string }> = [];

  for (const mem of memories) {
    let bestScore = 0;
    let bestPhrase = "";

    for (const phrase of mem.triggerPhrases) {
      const match = scoreTriggerPhrase(query, phrase);
      if (match.score > bestScore) {
        bestScore = match.score;
        bestPhrase = phrase;
      }
    }

    if (bestScore >= threshold) {
      candidates.push({
        id: mem.id,
        content: mem.content,
        score: bestScore,
        bestPhrase,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  // Enforce injection limit and character budget
  const selected: typeof candidates = [];
  let totalChars = 0;

  for (const c of candidates) {
    if (selected.length >= maxInjections) break;
    if (totalChars + c.content.length > MAX_TRIGGER_CONTEXT_CHARS && selected.length > 0) {
      break;
    }
    selected.push(c);
    totalChars += c.content.length;
  }

  return selected;
}

/**
 * Proactive Morning Chai Briefing (08:00):
 * Synthesizes pending tasks, schedule events, and warm companion wishes.
 */
export function generateMorningChaiBriefing(
  tasks: string[],
  calendar: string[],
  companionName = "Saan"
): string {
  const parts: string[] = [
    `☕ **Good morning! Here is your Morning Chai Briefing from ${companionName}:**`,
  ];

  if (tasks.length > 0) {
    parts.push(`\n**Top Priorities for Today:**\n${tasks.map((t, i) => `${i + 1}. ${t}`).join("\n")}`);
  } else {
    parts.push("\n**Priorities:** Your task list is clear and ready for new focus.");
  }

  if (calendar.length > 0) {
    parts.push(`\n**Scheduled Milestones:**\n${calendar.map((c) => `• ${c}`).join("\n")}`);
  }

  parts.push("\nTake a deep breath and start the day with steady energy. I am right beside you.");
  return parts.join("\n");
}

/**
 * Proactive Evening Unwind Recap (21:00):
 * Synthesizes completed accomplishments and sets calm night closure.
 */
export function generateEveningUnwindRecap(
  accomplishments: string[],
  deeds: string[],
  companionName = "Saan"
): string {
  const parts: string[] = [
    `🌙 **Evening Unwind Recap with ${companionName}:**`,
  ];

  if (accomplishments.length > 0) {
    parts.push(`\n**What We Accomplished Today:**\n${accomplishments.map((a) => `✓ ${a}`).join("\n")}`);
  }

  if (deeds.length > 0) {
    parts.push(`\n**Reflections & Milestones:**\n${deeds.map((d) => `• ${d}`).join("\n")}`);
  }

  parts.push("\nYou put in solid work today. Time to rest your mind and recharge for tomorrow.");
  return parts.join("\n");
}

export interface ProactiveTriggerConfig {
  morningChai: {
    enabled: boolean;
    time: string; // HH:MM
    activeWindow: CronActiveHours;
  };
  eveningUnwind: {
    enabled: boolean;
    time: string; // HH:MM
    activeWindow: CronActiveHours;
  };
  timezone: string;
}

export class ProactiveTriggerManager {
  private config: ProactiveTriggerConfig;
  private lastTriggered: Record<string, string> = {};

  constructor(initialConfig?: Partial<ProactiveTriggerConfig>) {
    this.config = {
      morningChai: {
        enabled: initialConfig?.morningChai?.enabled ?? true,
        time: initialConfig?.morningChai?.time ?? "08:00",
        activeWindow: initialConfig?.morningChai?.activeWindow ?? {
          start: "07:30",
          end: "10:30",
          timezone: "user",
        },
      },
      eveningUnwind: {
        enabled: initialConfig?.eveningUnwind?.enabled ?? true,
        time: initialConfig?.eveningUnwind?.time ?? "21:00",
        activeWindow: initialConfig?.eveningUnwind?.activeWindow ?? {
          start: "20:30",
          end: "23:30",
          timezone: "user",
        },
      },
      timezone: initialConfig?.timezone ?? "local",
    };
  }

  public getConfig(): ProactiveTriggerConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  public updateConfig(updates: Partial<ProactiveTriggerConfig>): ProactiveTriggerConfig {
    if (updates.morningChai) {
      this.config.morningChai = { ...this.config.morningChai, ...updates.morningChai };
    }
    if (updates.eveningUnwind) {
      this.config.eveningUnwind = { ...this.config.eveningUnwind, ...updates.eveningUnwind };
    }
    if (updates.timezone) {
      this.config.timezone = updates.timezone;
    }
    return this.getConfig();
  }

  public isWindowActive(type: "morning_chai" | "evening_unwind", nowMs: number = Date.now()): boolean {
    const window = type === "morning_chai" ? this.config.morningChai.activeWindow : this.config.eveningUnwind.activeWindow;
    return isCronWithinActiveHours(window, nowMs, this.config.timezone);
  }

  public generateBriefing(
    type: "morning_chai" | "evening_unwind",
    data?: { tasks?: string[]; calendar?: string[]; accomplishments?: string[]; deeds?: string[] },
    companionName: string = "Saan"
  ): { type: string; formatted: string; timestamp: string } {
    const timestamp = new Date().toISOString();
    this.lastTriggered[type] = timestamp;

    if (type === "morning_chai") {
      const defaultTasks = data?.tasks || [
        "Finalize cognitive memory architecture upgrade",
        "Verify Next.js 16 zero-regression build pipeline",
      ];
      const defaultCal = data?.calendar || [
        "10:00 AM: Deep focus autonomous agent check-in",
        "03:00 PM: Milestone verification review",
      ];
      return {
        type: "morning_chai",
        formatted: generateMorningChaiBriefing(defaultTasks, defaultCal, companionName),
        timestamp,
      };
    } else {
      const defaultAcc = data?.accomplishments || [
        "20 Companion repositories fully audited, tested, and synchronized",
        "Clean-room TypeScript & Next.js routes 100% compiled",
      ];
      const defaultDeeds = data?.deeds || [
        "Maintained unbreakable sovereign local privacy",
        "Shared reflective discussion during evening work",
      ];
      return {
        type: "evening_unwind",
        formatted: generateEveningUnwindRecap(defaultAcc, defaultDeeds, companionName),
        timestamp,
      };
    }
  }
}

let globalProactiveManager: ProactiveTriggerManager | null = null;

export function getProactiveTriggerManager(): ProactiveTriggerManager {
  if (!globalProactiveManager) {
    globalProactiveManager = new ProactiveTriggerManager();
  }
  return globalProactiveManager;
}

