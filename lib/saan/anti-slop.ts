/**
 * Saan Dynamic Anti-Slop Detector (Adapted from Chronicler src/lib/orchestrator/anti-slop.ts)
 *
 * Replaces static ban lists with dynamic multi-turn n-gram frequency analysis:
 * 1. Analyzes recent assistant replies.
 * 2. Extracts 3-to-6 word contentful phrases (dropping stop-words).
 * 3. Identifies recurring conversational clichés and catchphrases across separate turns.
 * 4. Injects dynamic anti-repetition guidance directly into generation context.
 */

const STOP = new Set(
  (
    "a an the and or but if then so of to in on at by for with from into onto over under as is are was were be been being " +
    "it its this that these those i you he she we they me him her us them my your his their our not no do does did " +
    "have has had will would can could should may might just very more most some any all each there here what when who how " +
    "kya hai hain tha thi the ho gaya gayi gaye aur ya par lekin kyu kab kahan kaise hum tum aap mera meri mere tera teri tere"
  ).split(" ")
);

const MIN_N = 3;
const MAX_N = 6;

function words(text: string): string[] {
  // Strip actions/markdown and normalize words
  return (text || "")
    .toLowerCase()
    .replace(/[*_~`>#\u0900-\u097F]/g, " ")
    .split(/[^a-z0-9']+/)
    .filter(Boolean);
}

function isContentful(gram: string[]): boolean {
  // Needs at least two non-stop words longer than 2 characters
  return gram.filter((w) => !STOP.has(w) && w.length > 2).length >= 2;
}

export interface OverusedOptions {
  minReplies?: number; // Must appear in at least this many separate replies (default: 2)
  max?: number;        // Maximum number of overused phrases to return (default: 5)
  ignore?: string[];   // Specific words to ignore (e.g. names)
}

/**
 * Finds recurring 3-6 word phrases across replies, ordered by length and repetition frequency
 */
export function findOverusedPhrases(
  replies: string[],
  opts: OverusedOptions = {}
): string[] {
  const minReplies = opts.minReplies ?? 2;
  const max = opts.max ?? 5;
  if (!replies || replies.length < minReplies) return [];
  const ignore = new Set((opts.ignore ?? []).map((w) => w.toLowerCase()));

  // gram -> set of reply indexes where it appears
  const support = new Map<string, Set<number>>();
  replies.forEach((reply, idx) => {
    const ws = words(reply);
    for (let n = MIN_N; n <= MAX_N; n++) {
      for (let i = 0; i + n <= ws.length; i++) {
        const gram = ws.slice(i, i + n);
        if (!isContentful(gram)) continue;
        if (gram.some((w) => ignore.has(w))) continue;
        const key = gram.join(" ");
        let s = support.get(key);
        if (!s) support.set(key, (s = new Set()));
        s.add(idx);
      }
    }
  });

  const hits = [...support.entries()]
    .filter(([, s]) => s.size >= minReplies)
    .map(([gram, s]) => ({ gram, count: s.size, len: gram.split(" ").length }))
    // Longest and most repeated first
    .sort((a, b) => b.count * b.len - a.count * a.len || b.len - a.len);

  const chosen: string[] = [];
  for (const h of hits) {
    if (chosen.some((c) => c.includes(h.gram))) continue; // fragment of an already chosen phrase
    chosen.push(h.gram);
    if (chosen.length >= max) break;
  }
  return chosen;
}

/**
 * Formats overused phrases for prompt injection
 */
export function formatAntiSlopPrompt(overused: string[]): string {
  if (!overused || overused.length === 0) return "";
  const list = overused.map((p) => `"${p}"`).join(", ");
  return `DYNAMIC ANTI-SLOP GUARD:\nYou have recently repeated these phrases too often: ${list}. AVOID using these exact word combinations in this turn — speak naturally with fresh phrasing.`;
}
