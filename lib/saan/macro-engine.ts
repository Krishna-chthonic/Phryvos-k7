/**
 * Dynamic Macro Variable Engine (from SillyTavern macros.js & time-macros.js)
 *
 * Implements:
 * 1. Conversational Macro Substitution:
 *    - {{char}}: companion persona name
 *    - {{user}}: user display name
 *    - {{time}}, {{date}}, {{weekday}}, {{isotime}}, {{isodate}}
 *    - {{idle_duration}}: humanized elapsed time since last interaction
 *    - {{lastUserMessage}}, {{lastCharMessage}}, {{lastMessage}}
 * 2. Utility Macros:
 *    - {{pick::opt1::opt2::opt3}}: random uniform selection from choices
 *    - {{roll::XdY}}: deterministic/pseudo-random dice roller (e.g. 1d6, 1d20)
 */

export interface MacroContext {
  charName?: string;
  userName?: string;
  lastUserMessage?: string;
  lastCharMessage?: string;
  lastInteractionTimestamp?: number;
  now?: Date;
}

/**
 * Calculates humanized elapsed duration (e.g. "5 minutes", "2 hours", "3 days")
 */
export function formatIdleDuration(lastTimestamp?: number, now: Date = new Date()): string {
  if (!lastTimestamp || lastTimestamp <= 0) {
    return "a long time";
  }

  const diffMs = Math.max(0, now.getTime() - lastTimestamp);
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes === 1) return "1 minute";
  if (diffMinutes < 60) return `${diffMinutes} minutes`;
  if (diffHours === 1) return "1 hour";
  if (diffHours < 24) return `${diffHours} hours`;
  if (diffDays === 1) return "1 day";
  return `${diffDays} days`;
}

/**
 * Rolls XdY dice (e.g. 1d6, 2d20)
 */
export function evaluateDiceRoll(diceSpec: string): number {
  const match = diceSpec.trim().match(/^(\d+)d(\d+)$/i);
  if (!match) return 0;
  const count = Math.min(100, Math.max(1, parseInt(match[1], 10)));
  const sides = Math.min(1000, Math.max(1, parseInt(match[2], 10)));

  let sum = 0;
  for (let i = 0; i < count; i++) {
    sum += Math.floor(Math.random() * sides) + 1;
  }
  return sum;
}

/**
 * Substitutes all macro tags in a template string
 */
export function substituteMacros(template: string, ctx: MacroContext = {}): string {
  if (!template || typeof template !== "string") return "";

  const char = ctx.charName || "Saan";
  const user = ctx.userName || "Krishna";
  const now = ctx.now || new Date();

  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  const weekdayStr = now.toLocaleDateString([], { weekday: "long" });
  const isoDate = now.toISOString().split("T")[0];
  const isoTime = now.toTimeString().split(" ")[0];

  const idleDuration = formatIdleDuration(ctx.lastInteractionTimestamp, now);
  const lastUserMsg = ctx.lastUserMessage || "";
  const lastCharMsg = ctx.lastCharMessage || "";

  let result = template;

  // 1. Basic entity macros
  result = result.replace(/\{\{char\}\}/gi, char);
  result = result.replace(/\{\{user\}\}/gi, user);

  // 2. Temporal macros
  result = result.replace(/\{\{time\}\}/gi, timeStr);
  result = result.replace(/\{\{date\}\}/gi, dateStr);
  result = result.replace(/\{\{weekday\}\}/gi, weekdayStr);
  result = result.replace(/\{\{isodate\}\}/gi, isoDate);
  result = result.replace(/\{\{isotime\}\}/gi, isoTime);
  result = result.replace(/\{\{idle_duration\}\}/gi, idleDuration);
  result = result.replace(/\{\{idleDuration\}\}/g, idleDuration);

  // 3. Conversation turn macros
  result = result.replace(/\{\{lastUserMessage\}\}/gi, lastUserMsg);
  result = result.replace(/\{\{lastCharMessage\}\}/gi, lastCharMsg);
  result = result.replace(/\{\{lastMessage\}\}/gi, lastCharMsg || lastUserMsg);

  // 4. Utility: {{pick::opt1::opt2::...}}
  result = result.replace(/\{\{pick::([^}]+)\}\}/gi, (_, choicesStr) => {
    const choices = choicesStr.split("::").map((c: string) => c.trim()).filter(Boolean);
    if (choices.length === 0) return "";
    const idx = Math.floor(Math.random() * choices.length);
    return choices[idx];
  });

  // 5. Utility: {{roll::XdY}}
  result = result.replace(/\{\{roll::([^}]+)\}\}/gi, (_, diceSpec) => {
    return String(evaluateDiceRoll(diceSpec));
  });

  return result;
}
