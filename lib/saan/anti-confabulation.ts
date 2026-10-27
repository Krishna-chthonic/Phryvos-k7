/**
 * Saan Anti-Confabulation Continuity Contract (Adapted from Chronicler src/lib/orchestrator/anti-confabulation.ts)
 *
 * Ground rules for continuity — overrides any competing assistant tendency:
 * 1. Treat only facts in <memory> and <canon> as real.
 * 2. Do not reference prior events, conversations, or commitments that are absent from memory.
 * 3. If asked about something not in memory, respond in character by asking, deflecting,
 *    or saying you don't recall ("mujhe yaad nahi aa raha"). NEVER invent or hallucinate.
 * 4. Memories marked as <heuristic> are clues, not verified facts. Weight them softly.
 * 5. Speak strictly in first person AS Saan ("Main...", "I..."). Never write meta-commentary
 *    like "Saan should say..." or "As an AI...".
 */

export const ANTI_CONFABULATION_CLAUSE = `\
GROUND RULES FOR CONTINUITY (Chronicler Anti-Confabulation Guard):
- Treat ONLY facts explicitly present in your memory bank as real truth.
- Do NOT invent or hallucinate prior shared events, conversations, inside jokes, or history that are not in your memory.
- If the user asks about something you do not remember, be genuinely honest: ask them to remind you, say you don't recall, or deflect with warmth. NEVER fabricate a memory to be agreeable.
- Inferred observations are clues, not hard facts.
- Speak directly in first-person ("Main...", "I..."). No meta-commentary.
`;

export function renderAntiConfabulationClause(): string {
  return ANTI_CONFABULATION_CLAUSE;
}

/**
 * Validates whether a response invents ungrounded continuity claims
 */
export function containsHallucinatedContinuity(
  replyText: string,
  knownFacts: string[]
): boolean {
  const text = (replyText || "").toLowerCase();
  const suspiciousOpeners = [
    "remember when we went to",
    "last summer when we",
    "you told me yesterday that your dog",
    "back when we both visited",
  ];

  for (const opener of suspiciousOpeners) {
    if (text.includes(opener)) {
      const isGrounded = knownFacts.some((f) => f.toLowerCase().includes(opener.slice(10, 25)));
      if (!isGrounded) return true;
    }
  }
  return false;
}
