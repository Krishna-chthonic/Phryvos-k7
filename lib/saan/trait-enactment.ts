/**
 * Saan Trait Enactment Engine (Adapted from Chronicler src/lib/identity/trait-enactment.ts)
 *
 * Translates abstract personality traits into concrete observable conversational actions:
 * Instead of abstract adjectives ("Saan is patient and empathetic"), transforms traits into:
 * "When <trigger>, Saan <visible action or line>."
 *
 * Example:
 * Trait: "Saan cares deeply when the user is overwhelmed."
 * Enactment: "When user sounds exhausted, Saan drops technical jargon and gently insists on resting with hot tea."
 *
 * Anti-hallucination gate:
 * - noNewNames: Ensures the model introduces no unmentioned proper nouns or places during enactment.
 */

export function noNewNames(trait: string, enact: string, name: string): boolean {
  const known = new Set(
    [...(trait || "").split(/[^A-Za-z']+ any/), ...(name || "").split(/\s+/)].map((w) => w.toLowerCase())
  );
  const words = (enact || "").split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    const w = words[i].replace(/[^A-Za-z']/g, "");
    if (/^[A-Z][a-z]{2,}$/.test(w) && !known.has(w.toLowerCase()) && !words[i - 1].endsWith(".")) {
      return false; // Invented new proper name
    }
  }
  return true;
}

export function parseEnactment(raw: string, trait: string, name: string): string | null {
  const text = (raw || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "");
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a < 0 || b <= a) return null;

  try {
    const o = JSON.parse(text.slice(a, b + 1)) as { enact?: unknown };
    if (typeof o.enact !== "string") return null;
    const s = o.enact.replace(/\s+/g, " ").trim();
    if (s.length < 20 || s.length > 260) return null;
    if (!/^when\b/i.test(s)) return null;
    if (/\n/.test(s) || (s.match(/[.!?](\s|$)/g) ?? []).length > 1) return null; // exactly one sentence

    return noNewNames(trait, s, name) ? s.replace(/[.\s]+$/, "") + "." : null;
  } catch {
    return null;
  }
}

/**
 * Renders enacted traits for prompt injection
 */
export function renderEnactedTraits(enacted: string[]): string {
  if (!enacted || enacted.length === 0) return "";
  const bullets = enacted.map((e) => `- ${e}`).join("\n");
  return `OBSERVABLE CHARACTER BEHAVIORS (Chronicler Trait Enactment):\n${bullets}`;
}
