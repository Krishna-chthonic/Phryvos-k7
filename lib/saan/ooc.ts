/**
 * Saan Out-of-Character (OOC) Directives Channel (Adapted from Chronicler src/lib/orchestrator/ooc.ts)
 *
 * Allows users to steer the companion with private out-of-character directives:
 * Example: "Arre aaj mood thoda off hai ((keep it gentle and short))"
 * 1. Directives are stripped from in-character spoken dialogue.
 * 2. Handed to the model once as a private director's note in the system prompt.
 * 3. NEVER stored as character memory or user dialogue in the vault.
 * 4. Directive-only messages get a clean placeholder so LLMs don't reject empty turns.
 */

const PATTERNS: RegExp[] = [
  /\(\(([\s\S]*?)\)\)/g,           // ((like this))
  /\[\s*OOC\s*:\s*([\s\S]*?)\]/gi, // [OOC: like this]
  /\(\s*OOC\s*:\s*([\s\S]*?)\)/gi, // (OOC: like this)
];

export const OOC_PLACEHOLDER = "*The conversation continues.*";

export interface OocSplit {
  spoken: string;       // In-character dialogue with all directives removed
  directives: string[]; // Private director notes
}

/**
 * Splits out-of-character directives from in-character dialogue
 */
export function splitOoc(text: string): OocSplit {
  const directives: string[] = [];
  let spoken = text || "";

  for (const re of PATTERNS) {
    spoken = spoken.replace(re, (_m, inner: string) => {
      const d = inner.trim();
      if (d) directives.push(d);
      return " ";
    });
  }

  const cleanedSpoken = spoken
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { spoken: cleanedSpoken, directives };
}

/**
 * Prepares user message for narrative reading: directives removed,
 * with neutral fallback if empty.
 */
export function forNarrative(text: string): string {
  const { spoken, directives } = splitOoc(text);
  if (spoken) return spoken;
  return directives.length > 0 ? OOC_PLACEHOLDER : text;
}

/**
 * True when a message was purely an OOC directive with no spoken dialogue
 */
export function isDirectiveOnly(text: string): boolean {
  const { spoken, directives } = splitOoc(text);
  return spoken === "" && directives.length > 0;
}

/**
 * Formats directives into private director notes for prompt injection
 */
export function formatDirectorNotes(directives: string[]): string {
  if (!directives || directives.length === 0) return "";
  const lines = directives.map((d) => `- ${d}`).join("\n");
  return `PRIVATE USER DIRECTIVE (OOC):\nThe user sent this private out-of-character steering note for this turn. Obey its guidance without referencing the note itself:\n${lines}`;
}
