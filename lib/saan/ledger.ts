/**
 * Saan Consequence Ledger (Adapted from Chronicler src/lib/scene/ledger.ts)
 *
 * Implements interpersonal deed & commitment memory:
 * 1. "Deed": A significant commitment, promise, lie, debt, theft, damage, confession or rescue.
 * 2. Deterministic gate: looksConsequential prevents ordinary small-talk from triggering tracking.
 * 3. Temporal pacing:
 *    - MIN_AGE = 3: deeds sit for 3 turns before being surfaced (prevents mechanical immediate reaction).
 *    - RENUDGE_AFTER = 5: if open and unaddressed, re-nudges after 5 turns so commitments aren't lost.
 *    - MAX_OPEN = 6: capped buffer of active deeds.
 *    - MAX_SHOWN = 2: at most 2 consequences surfaced at once to avoid overwhelming prompts.
 * 4. Grounded resolution: deedMentioned requires distinctive word overlap before marking answered.
 */

import { getDb } from "@/lib/db/client";

export type DeedStatus = "open" | "answered" | "dismissed";

export interface Deed {
  id: string;
  text: string;           // Subject + action, e.g. "User promised to review chapter 4 before midnight"
  turn: number;           // Turn number when it occurred
  affects: string[];      // Who is affected
  witnesses: string[];    // Who witnessed/heard it
  status: DeedStatus;
  nudged?: number;        // Last turn this was injected into prompt
  answered_turn?: number; // Turn when resolved
}

export interface Ledger {
  deeds: Deed[];
  next: number;
}

export interface NewDeed {
  deed: string;
  affects?: string[];
  witnesses?: string[];
}

export const MAX_OPEN = 6;
export const MIN_AGE = 3;         // Turns before world answers deed
export const RENUDGE_AFTER = 5;    // Turns before re-nudging
export const MAX_SHOWN = 2;       // Max deeds per prompt

export function emptyLedger(): Ledger {
  return { deeds: [], next: 1 };
}

export const openDeeds = (l: Ledger): Deed[] => l.deeds.filter((d) => d.status === "open");

// Zero-token regex gate: filters ordinary chatter from consequence-bearing exchanges
const GATE =
  /\b(stole|stolen|steal\w*|slip(?:s|ped|ping)?|pocket\w*|grab\w*|snatch\w*|swip\w*|filch\w*|lift(?:s|ed)?|borrow\w*|took|tak(?:e|es|en|ing)(?! (?:a (?:seat|look|moment|breath|deep|step|sip|bite|walk|nap|minute|second|while|second)|another|care|your time|it easy|me|us|you|him|her|them|the lead|off your))|lie[sd]?|lying|lied|promis\w+|swear|swore|sworn|kill\w*|murder\w*|attack\w*|stab\w*|shoot|shot|punch\w*|slap\w*|strike|struck|hurt|wound\w*|injur\w*|break|broke|smash\w*|burn\w*|destroy\w*|betray\w*|sav(?:e|ed|es|ing)|rescu\w*|kiss\w*|confess\w*|confront\w*|admit\w*|apolog\w*|sorry|threat\w*|blackmail\w*|brib\w*|owe[sd]?|debt|forgiv\w*|reveal\w*|secret|spar(?:e|ed)|abandon\w*|refus\w*|trespass\w*|hid(?:e|den)?|sneak\w*|snuck|pick(?:s|ed)? (?:the |a )?lock|read (?:the |his |her )?(?:letter|diary|journal)|hand(?:s|ed)? (?:her|him|them|over|back)|put (?:it |them )?back|give back|gave back|return\w*|restor\w*|gift\w*|forge[sd]?|bargain\w*|deal|vow\w*|curse[sd]?|poison\w*|free[sd]?|releas\w*|arrest\w*|expos\w*|accus\w*|vaada|kasam|pakka|promise|bhoolna|dhokha)\b/i;

export function looksConsequential(spoken: string, reply: string): boolean {
  return GATE.test(spoken || "") || GATE.test(reply || "");
}

const wordsOf = (s: string) =>
  (s || "")
    .toLowerCase()
    .split(/[^a-z0-9\u0900-\u097F']+/)
    .filter((w) => w.length >= 4);

export function deedMentioned(d: Deed, exchange: string): boolean {
  const hay = (exchange || "").toLowerCase();
  return wordsOf(d.text)
    .filter((w) => w.length >= 4)
    .some((w) => hay.includes(w));
}

export function mentionsOpenDeed(l: Ledger, exchange: string): boolean {
  return openDeeds(l).some((d) => deedMentioned(d, exchange));
}

function similar(a: string, b: string): boolean {
  const wa = new Set(wordsOf(a));
  const wb = wordsOf(b);
  if (wa.size === 0 || wb.length === 0) return false;
  const shared = wb.filter((w) => wa.has(w)).length;
  return shared / Math.min(wa.size, wb.length) >= 0.6;
}

const cleanNames = (xs: string[] | undefined) =>
  [...new Set((xs ?? []).map((x) => String(x || "").trim()).filter((x) => x.length > 0 && x.length <= 40))].slice(0, 4);

export function addDeeds(l: Ledger, incoming: NewDeed[], turn: number): Ledger {
  let next = l.next;
  const deeds = [...l.deeds];

  for (const n of incoming) {
    const raw = (n.deed || "").trim().replace(/[.]+$/, "");
    if (raw.length < 3) continue;
    if (deeds.some((d) => d.status === "open" && similar(d.text, raw))) continue;

    deeds.push({
      id: `d${next++}`,
      text: raw,
      turn,
      affects: cleanNames(n.affects),
      witnesses: cleanNames(n.witnesses),
      status: "open",
    });
  }

  // Cap open deeds to MAX_OPEN, dropping oldest open if needed
  const openCount = deeds.filter((d) => d.status === "open").length;
  if (openCount > MAX_OPEN) {
    let toDrop = openCount - MAX_OPEN;
    for (let i = 0; i < deeds.length && toDrop > 0; i++) {
      if (deeds[i].status === "open") {
        deeds[i] = { ...deeds[i], status: "dismissed" };
        toDrop--;
      }
    }
  }

  return { deeds, next };
}

export function dueDeeds(l: Ledger, turn: number): Deed[] {
  return openDeeds(l)
    .filter((d) => {
      if (turn - d.turn < MIN_AGE) return false; // not aged yet
      if (d.nudged !== undefined && turn - d.nudged < RENUDGE_AFTER) return false; // recently nudged
      return true;
    })
    .slice(0, MAX_SHOWN);
}

export function markNudged(l: Ledger, deedIds: string[], turn: number): Ledger {
  const set = new Set(deedIds);
  return {
    ...l,
    deeds: l.deeds.map((d) => (set.has(d.id) ? { ...d, nudged: turn } : d)),
  };
}

export function markAnswered(l: Ledger, deedIds: string[], turn: number): Ledger {
  const set = new Set(deedIds);
  let changed = false;
  const deeds = l.deeds.map((d) => {
    if (set.has(d.id) && d.status === "open") {
      changed = true;
      return { ...d, status: "answered" as DeedStatus, answered_turn: turn };
    }
    return d;
  });
  return changed ? { ...l, deeds } : l;
}

export function dismiss(l: Ledger, deedId: string): Ledger {
  return {
    ...l,
    deeds: l.deeds.map((d) => (d.id === deedId ? { ...d, status: "dismissed" as DeedStatus } : d)),
  };
}

export function renderConsequences(deeds: Deed[], turn: number): string[] {
  return deeds.map((d) => {
    const age = Math.max(0, turn - d.turn);
    const wit = d.witnesses.length > 0 ? `; ${d.witnesses.join(" and ")} knows of it` : "";
    return `${d.text}${wit} (${age} turns ago)`;
  });
}

export function parseLedgerDelta(raw: string): { new: NewDeed[]; answered: string[] } {
  try {
    const clean = (raw || "")
      .replace(/```(?:json)?/gi, "")
      .replace(/```/g, "")
      .trim();
    const a = clean.indexOf("{");
    const b = clean.lastIndexOf("}");
    if (a < 0 || b <= a) return { new: [], answered: [] };
    const parsed = JSON.parse(clean.slice(a, b + 1));
    const newDeeds: NewDeed[] = Array.isArray(parsed.new)
      ? parsed.new
          .filter((x: any) => x && typeof x.deed === "string")
          .map((x: any) => ({
            deed: String(x.deed),
            affects: Array.isArray(x.affects) ? x.affects.map(String) : [],
            witnesses: Array.isArray(x.witnesses) ? x.witnesses.filter((w: any) => typeof w === "string") : [],
          }))
      : [];
    const answered: string[] = Array.isArray(parsed.answered)
      ? parsed.answered.filter((x: any) => typeof x === "string")
      : [];
    return { new: newDeeds, answered };
  } catch {
    return { new: [], answered: [] };
  }
}

// ── SQLite Persistence ───────────────────────────────────────────────────

export function loadLedgerFromDb(): Ledger {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT id, text, turn, affects, witnesses, status, nudged_turn as nudged, answered_turn as answeredTurn
      FROM saan_consequence_ledger
      ORDER BY turn ASC
    `).all() as any[];

    let maxNum = 0;
    const deeds: Deed[] = rows.map((r) => {
      const match = r.id.match(/^d(\d+)$/);
      if (match) {
        maxNum = Math.max(maxNum, parseInt(match[1], 10));
      }
      return {
        id: r.id,
        text: r.text,
        turn: r.turn,
        affects: r.affects ? JSON.parse(r.affects) : [],
        witnesses: r.witnesses ? JSON.parse(r.witnesses) : [],
        status: r.status,
        nudged: r.nudged ?? undefined,
        answered_turn: r.answeredTurn ?? undefined,
      };
    });

    return { deeds, next: maxNum + 1 };
  } catch (err) {
    console.warn("[Ledger] Error loading from DB:", err);
    return emptyLedger();
  }
}

export function saveDeedToDb(deed: Deed): void {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO saan_consequence_ledger (
        id, text, turn, affects, witnesses, status, nudged_turn, answered_turn, created_at, answered_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        nudged_turn = excluded.nudged_turn,
        answered_turn = excluded.answered_turn,
        answered_at = excluded.answered_at
    `).run(
      deed.id,
      deed.text,
      deed.turn,
      JSON.stringify(deed.affects || []),
      JSON.stringify(deed.witnesses || []),
      deed.status,
      deed.nudged ?? null,
      deed.answered_turn ?? null,
      Date.now(),
      deed.status === "answered" ? Date.now() : null
    );
  } catch (err) {
    console.warn("[Ledger] Error saving deed to DB:", err);
  }
}

export function syncLedgerToDb(ledger: Ledger): void {
  for (const deed of ledger.deeds) {
    saveDeedToDb(deed);
  }
}
