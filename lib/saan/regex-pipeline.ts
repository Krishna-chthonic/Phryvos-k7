/**
 * Multi-Placement Regex Script Pipeline (from SillyTavern extensions/regex/engine.js)
 *
 * Implements:
 * 1. Targeted regex placement execution (user_input, ai_output, world_info, reasoning)
 * 2. Min/Max depth gate constraints
 * 3. Default strict anti-cliché and assistant disclaimers elimination
 */

export type RegexPlacement = "user_input" | "ai_output" | "world_info" | "reasoning";

export interface RegexScript {
  id: string;
  scriptName: string;
  findRegex: string;     // e.g. "/pattern/flags" or "pattern"
  replaceWith: string;   // replacement string with $1, $2 support
  placement: RegexPlacement[];
  minDepth?: number;     // Only run if message depth >= minDepth
  maxDepth?: number;     // Only run if message depth <= maxDepth
  disabled?: boolean;
}

// Built-in Anti-AI Cliché and Robotic Troping Scripts
export const DEFAULT_ANTI_SLOP_SCRIPTS: RegexScript[] = [
  {
    id: "strip_ai_disclaimer",
    scriptName: "Strip AI Disclaimers",
    findRegex: "/(?:as an ai language model|as an artificial intelligence|i am an ai),?\\s*/gi",
    replaceWith: "",
    placement: ["ai_output"],
  },
  {
    id: "strip_certainly_opening",
    scriptName: "Strip Certainly Opening",
    findRegex: "/(?:^|[.!?]\\s*)(?:certainly!?|sure thing!?|of course!?|absolutely!?),?\\s*(?:here (?:is|are)|i'd be happy to|let me)?\\s*/gi",
    replaceWith: "",
    placement: ["ai_output"],
  },
  {
    id: "strip_how_assist_opening",
    scriptName: "Strip How May I Assist Opening",
    findRegex: "/(?:^|[.!?]\\s*)(?:how (?:can|may) i (?:assist|help) you (?:today|with that)?\\??|what can i do for you today\\??)\\s*/gi",
    replaceWith: "",
    placement: ["ai_output"],
  },
  {
    id: "strip_anything_else_closer",
    scriptName: "Strip Anything Else Closer",
    findRegex: "/(?:is there anything else (?:you need|i can help with|you would like to know)\\??|let me know if you need anything else\\.?)$/gi",
    replaceWith: "",
    placement: ["ai_output"],
  },
];

/**
 * Compiles a findRegex string (/pattern/flags or raw string) into a RegExp object
 */
export function compileRegex(findRegex: string): RegExp | null {
  if (!findRegex) return null;
  const trimmed = findRegex.trim();

  if (trimmed.startsWith("/") && trimmed.lastIndexOf("/") > 0) {
    const lastSlash = trimmed.lastIndexOf("/");
    const pattern = trimmed.slice(1, lastSlash);
    const flags = trimmed.slice(lastSlash + 1);
    try {
      return new RegExp(pattern, flags);
    } catch {
      return null;
    }
  }

  try {
    return new RegExp(trimmed, "g");
  } catch {
    return null;
  }
}

/**
 * Runs a list of regex scripts on raw text matching the given placement and optional depth
 */
export function applyRegexPipeline(
  rawText: string,
  placement: RegexPlacement,
  scripts: RegexScript[] = DEFAULT_ANTI_SLOP_SCRIPTS,
  depth?: number
): string {
  if (!rawText || typeof rawText !== "string") return "";

  let result = rawText;

  for (const script of scripts) {
    if (script.disabled) continue;
    if (!script.placement.includes(placement)) continue;

    // Check depth constraints if depth is provided
    if (typeof depth === "number") {
      if (typeof script.minDepth === "number" && depth < script.minDepth) continue;
      if (typeof script.maxDepth === "number" && depth > script.maxDepth) continue;
    }

    const rx = compileRegex(script.findRegex);
    if (!rx) continue;

    result = result.replace(rx, script.replaceWith);
  }

  // Clean trailing/double whitespace
  return result.replace(/[ \t]{2,}/g, " ").trim();
}
