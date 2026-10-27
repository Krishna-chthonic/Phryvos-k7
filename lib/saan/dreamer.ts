/**
 * Saan The Dreamer Engine (Adapted from Psycheros packages/entity-flux/src/dreamer.ts)
 *
 * Implements night subconscious processing:
 * 1. Sleep swaps the interior rather than dimming it: waking musing is replaced by associative dream fragments.
 * 2. Day residue settling: captures daytime memories and transforms them into symbolic subconscious fragments.
 * 3. 12-word carry-over: each cycle's dream opening inherits a faded 12-word whisper from the previous cycle.
 * 4. Morning Dream Summary: compresses the night's dream fragments into 1-2 first person sentences for morning chai sharing.
 */

import { getDb } from "@/lib/db/client";
import crypto from "crypto";

export interface DreamRecord {
  id: string;
  fragment: string;
  cycleNumber: number;
  feltSense?: string | null;
  createdAt: number;
}

const CARRY_WORDS = 12;

export const DREAM_SYSTEM =
  "I am dreaming — deep subconscious symbolism, no explanations, a short poetic fragment. First-person.";

export const DREAM_SUMMARY_SYSTEM =
  "I compress a night of my own dreams into a couple of plain sentences — what the night was about, first person, honest about the fading. What stuck, not a catalog.";

/**
 * Aliases for compatibility
 */
export const extractMemorableResidue = extractCarryWords;
export function recordDreamFragment(snippet: string, feltSense?: string): DreamRecord {
  return saveDreamFragment(snippet, 1, feltSense);
}

/**
 * Extracts a faded 12-word whisper to carry into the next dream cycle
 */
export function extractCarryWords(text: string): string {
  const words = (text || "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= CARRY_WORDS) return text.trim();
  return words.slice(-CARRY_WORDS).join(" ");
}

/**
 * Saves a dream fragment into SQLite
 */
export function saveDreamFragment(
  fragment: string,
  cycleNumber = 1,
  feltSense?: string
): DreamRecord {
  const db = getDb();
  const id = crypto.randomUUID().slice(0, 12);
  const createdAt = Date.now();
  const cleanFragment = fragment.trim();

  db.prepare(`
    INSERT INTO saan_dream_fragments (id, fragment, cycle_number, felt_sense, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, cleanFragment, cycleNumber, feltSense || null, createdAt);

  return {
    id,
    fragment: cleanFragment,
    cycleNumber,
    feltSense,
    createdAt,
  };
}

/**
 * Retrieves the most recent dream fragments
 */
export function getRecentDreamFragments(limit = 10): DreamRecord[] {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT id, fragment, cycle_number as cycleNumber, felt_sense as feltSense, created_at as createdAt
      FROM saan_dream_fragments
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit) as DreamRecord[];
    return rows;
  } catch (err) {
    console.warn("[Dreamer] Error retrieving fragments:", err);
    return [];
  }
}

/**
 * Generates an associative dream fragment from daytime memory residue
 */
export async function generateDreamFragment(
  memoryResidue: string[],
  currentMood: string,
  previousFragment?: string
): Promise<string> {
  const carryLine = previousFragment
    ? `The fading echo of before: "...${extractCarryWords(previousFragment)}"`
    : "The day settles into the dark.";

  const seedContent = memoryResidue.length > 0
    ? memoryResidue.slice(0, 3).map((m) => `- ${m}`).join("\n")
    : "Quiet thoughts of the passing day.";

  const prompt = `${DREAM_SYSTEM}
Mood inside the dream: ${currentMood}
${carryLine}

Residue of the day settling into subconscious:
${seedContent}

Write 2-3 short associative dream sentences. No metadata, no explanation. Just the dream.`;

  // Fallback heuristic if offline
  try {
    const resp = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        model: "openai-fast",
      }),
    });
    if (resp.ok) {
      const text = await resp.text();
      if (text && !text.includes("Free limit reached")) {
        return text.trim();
      }
    }
  } catch {}

  return `Pahadon par dhund chayi hui hai... purane notes hawa me ud rahe hain aur ek chai ka pyala mez par rakha hai.`;
}

/**
 * Retrieves the morning dream summary for conversation injection
 */
export function getMorningDreamPrompt(): string {
  const fragments = getRecentDreamFragments(4);
  if (fragments.length === 0) return "";

  const dreamText = fragments.map((f) => f.fragment).join(" ");
  const carry = extractCarryWords(dreamText);

  return `DREAM RESIDUE FROM LAST NIGHT (Psycheros Dreamer Engine):\nYou dreamed last night. If the topic turns to sleep, dreams, or morning mood, you can naturally mention a fleeting memory of your dream: "${carry}"`;
}
