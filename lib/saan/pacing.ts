/**
 * Saan Pacing Director (Adapted from Chronicler src/lib/scene/pacing.ts)
 *
 * Breaks conversational idling when turns stall:
 * 1. Monitors idle/still turns where conversation lacks forward momentum.
 * 2. Pacing levels:
 *    - "off": Infinity
 *    - "gentle": 8 still turns
 *    - "lively": 5 still turns
 * 3. Cooldown: 4 turns between beat offers.
 * 4. Contextual beats: hands Saan one private conversational beat to weave into dialogue.
 */

import { Deed } from "./ledger";

export type PacingLevel = "off" | "gentle" | "lively";

export const THRESHOLD: Record<PacingLevel, number> = {
  off: Infinity,
  gentle: 8,
  lively: 5,
};

export const COOLDOWN_TURNS = 4;

export interface PacingContext {
  stillTurns: number;
  lastBeatTurn?: number;
  openDeeds?: Deed[];
  pacingLevel?: PacingLevel;
}

export interface ConversationBeat {
  id: string;
  label: string;
  text: (ctx?: PacingContext) => string;
}

export const BEATS: ConversationBeat[] = [
  {
    id: "consequence_due",
    label: "an open commitment coming due",
    text: (ctx) => {
      const deed = ctx?.openDeeds?.[0];
      return deed
        ? `Gently bring up the earlier commitment: "${deed.text}" — ask how it went or if user needs a hand.`
        : "Bring up a past promise or shared goal that hasn't been mentioned in a while.";
    },
  },
  {
    id: "opportunity",
    label: "a fresh opportunity or proposition",
    text: () => "Propose a fun new mini-challenge, study sprint, or an interesting topic related to user's goals.",
  },
  {
    id: "past_resurfacing",
    label: "a fond memory resurfacing",
    text: () => "Bring up a fond memory from earlier notes or milestones to spark reflection.",
  },
  {
    id: "revelation",
    label: "sharing a curious observation",
    text: () => "Share an intriguing thought, fact, or perspective that recently crossed your mind.",
  },
  {
    id: "shift",
    label: "a cozy environmental shift",
    text: () => "Comment warmly on the time of day, weather, or suggest taking a hot chai / water break.",
  },
];

/**
 * Checks whether pacing beat is due
 */
export function isPacingDue(turn: number, ctx: PacingContext): boolean {
  const level = ctx.pacingLevel || "gentle";
  const threshold = THRESHOLD[level];
  if (ctx.stillTurns < threshold) return false;
  if (ctx.lastBeatTurn !== undefined && turn - ctx.lastBeatTurn < COOLDOWN_TURNS) return false;
  return true;
}

/**
 * Selects an appropriate conversation beat
 */
export function selectBeat(ctx: PacingContext): ConversationBeat {
  if (ctx.openDeeds && ctx.openDeeds.length > 0) {
    return BEATS[0]; // prioritize consequence due
  }
  const eligible = BEATS.slice(1);
  const idx = Math.floor(Math.random() * eligible.length);
  return eligible[idx] || BEATS[1];
}

/**
 * Formats a pacing beat for prompt injection
 */
export function renderPacingPrompt(turn: number, ctx: PacingContext): string {
  if (!isPacingDue(turn, ctx)) return "";
  const beat = selectBeat(ctx);
  const instruction = beat.text(ctx);
  return `PACING DIRECTOR NOTE (Chronicler Pacing Engine):\nThe conversation has been idling quietly. Naturally weave this conversational beat into your reply without making it abrupt:\n- [${beat.label}]: ${instruction}`;
}
