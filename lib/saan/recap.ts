/**
 * Saan Session "Previously On..." Recap Generator (Adapted from Chronicler src/lib/recap/generator.ts)
 *
 * Generates a warm, concise session re-entry recap when opening chat after a gap:
 * 1. Pulls top-importance memories + active consequence deeds.
 * 2. Strict anti-hallucination prompt:
 *    - Only paraphrases explicit facts from memory.
 *    - Never attributes a user fact to Saan or vice versa.
 *    - No invented melodrama or fake tension.
 *    - 2-4 sentences, reads like a warm re-entry recap card.
 */

import { Deed } from "./ledger";

export interface RecapFact {
  text: string;
  importance: number;
}

export function buildRecapPrompt(facts: RecapFact[], deeds: Deed[]): string {
  const factLines = facts.slice(0, 8).map((f, i) => `  ${i + 1}. ${f.text}`).join("\n");
  const deedLines = deeds.length > 0
    ? deeds.map((d) => `  - Open commitment: ${d.text}`).join("\n")
    : "  - (none open)";

  return `You produce a warm, concise "Previously on..." recap card for Saan and the user.

STRICT ANTI-HALLUCINATION RULES:
1. ONLY restate facts and commitments from the list below. Do NOT invent new events.
2. Keep subjects accurate: what the user did is user's, what Saan did is Saan's.
3. 2-3 short, natural sentences. Hinglish/English with warmth.
4. Open naturally with a warm reminder ("Pichli baar humne..." or "Previously...").

FACTS:
${factLines}

OPEN DEEDS & COMMITMENTS:
${deedLines}

Write the recap card now.`;
}

/**
 * Deterministic fallback recap builder (zero-latency)
 */
export function buildDeterministicRecap(facts: RecapFact[], deeds: Deed[]): string {
  const topFacts = facts.slice(0, 2).map((f) => f.text).join(", ");
  const deedNotice = deeds.length > 0 ? ` Aur ek open commitement chal raha tha: "${deeds[0].text}".` : "";

  if (!topFacts) {
    return "Aao ek nayi shuruaat karte hain! Pichle notes clear hain.";
  }

  return `Pichli baar ka recap: ${topFacts}.${deedNotice} Aao yahin se aage badhte hain!`;
}
