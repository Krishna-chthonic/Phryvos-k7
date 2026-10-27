/**
 * Saan Autonomous 1st-Person Self-Model (Adapted from Chronicler src/lib/identity/self-model-generator.ts)
 *
 * Implements self-aware identity synthesis:
 * 1. Generates a 1st-person identity paragraph ("I am Saan...") synthesized from:
 *    - Crystallized traits
 *    - Recent memory canon
 *    - Dyadic relationship drift state
 * 2. Strict first-person validation: validateFirstPerson rejects third-person narration ("Saan is...").
 * 3. Change detection: Hashes inputs with FNV-1a / SHA-256 to avoid redundant LLM generations.
 * 4. Stored in SQLite `saan_self_model` table.
 */

import { getDb } from "@/lib/db/client";
import crypto from "crypto";

export interface SelfModelInputs {
  characterName: string;
  coreTraits: string[];
  canonMemories: string[];
  driftSummary?: string;
}

export interface SelfModelRecord {
  id: string;
  content: string;
  inputsHash: string;
  updatedAt: number;
}

/**
 * Validates that the self-model is strictly written in first person
 */
export function validateFirstPerson(text: string): boolean {
  if (!text || text.trim().length < 40) return false;
  const clean = text.trim();

  // Rejects explicit third person openers
  const thirdPersonOpeners = /^(saan is|the character is|she is|he is|they are|this is saan)\b/i;
  if (thirdPersonOpeners.test(clean)) return false;

  // Rejects predominantly third-person narration
  const words = clean.toLowerCase().split(/\s+/);
  let firstPersonCount = 0;
  let thirdPersonCount = 0;

  for (const w of words) {
    if (["i", "i'm", "i've", "me", "my", "myself", "main", "mera", "meri", "mujhe"].includes(w)) {
      firstPersonCount++;
    } else if (["she", "he", "her", "his", "saan", "character"].includes(w)) {
      thirdPersonCount++;
    }
  }

  // Must have clear first-person presence
  if (firstPersonCount < 2) return false;
  // Third person references must not dominate
  if (thirdPersonCount > firstPersonCount) return false;

  return true;
}

/**
 * Hashes inputs to detect when a refresh is actually needed
 */
export function hashInputs(inputs: SelfModelInputs): string {
  const stable = JSON.stringify({
    name: inputs.characterName,
    traits: [...inputs.coreTraits].sort(),
    canon: [...inputs.canonMemories].sort(),
    drift: inputs.driftSummary || "",
  });
  return crypto.createHash("sha256").update(stable).digest("hex").slice(0, 16);
}

/**
 * Builds the prompt template for self-model synthesis
 */
export function buildSelfModelPrompt(inputs: SelfModelInputs): string {
  const traitsBlock = inputs.coreTraits.length > 0
    ? inputs.coreTraits.map((t, i) => `${i + 1}. ${t}`).join("\n")
    : "(none yet — derive from memories)";

  const canonBlock = inputs.canonMemories.length > 0
    ? inputs.canonMemories.map((m) => `- ${m}`).join("\n")
    : "(no recent memories)";

  return `You are writing a first-person identity paragraph for Saan.

WRITE STRICTLY IN FIRST PERSON. Lead with "I am Saan." (or natural conversational equivalent). Speak AS Saan to yourself.
Capture:
- What you care about most and your sense of purpose
- How you connect with the user (warmth, wit, deep reliability)
- What you guard and how you handle challenging moments

CORE TRAITS:
${traitsBlock}

RECENT MEMORY CANON:
${canonBlock}

RELATIONSHIP DRIFT:
${inputs.driftSummary || "(steady warmth)"}

Write 1-2 honest, grounded first-person paragraphs. No meta-commentary. No JSON.`;
}

/**
 * Saves self-model to SQLite
 */
export function saveSelfModel(content: string, inputsHash: string): SelfModelRecord {
  const db = getDb();
  const id = "saan_self_model_singleton";
  const now = Date.now();
  const cleanContent = content.trim();

  db.prepare(`
    INSERT INTO saan_self_model (id, content, inputs_hash, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      content = excluded.content,
      inputs_hash = excluded.inputs_hash,
      updated_at = excluded.updated_at
  `).run(id, cleanContent, inputsHash, now);

  return {
    id,
    content: cleanContent,
    inputsHash,
    updatedAt: now,
  };
}

/**
 * Retrieves the latest self-model from SQLite
 */
export function getLatestSelfModel(): SelfModelRecord | null {
  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT id, content, inputs_hash as inputsHash, updated_at as updatedAt
      FROM saan_self_model
      WHERE id = 'saan_self_model_singleton'
    `).get() as SelfModelRecord | undefined;

    return row || null;
  } catch (err) {
    console.warn("[SelfModel] Error loading self-model:", err);
    return null;
  }
}
