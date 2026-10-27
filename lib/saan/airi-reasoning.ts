/**
 * Response Categorizer & Reasoning Monologue Extraction (from moeru-ai/airi core-agent)
 *
 * Implements:
 * 1. Extraction of internal thinking/reasoning tags (<think>, <thought>, <reasoning>, <plan>)
 * 2. Clean conversational speech isolation for human bubbles and voice TTS
 * 3. Structured Segment classification (speech vs reasoning)
 */

export type ResponseCategory = "speech" | "reasoning";

export interface CategorizedSegment {
  category: ResponseCategory;
  content: string;
  tagName?: string;
  startIndex: number;
  endIndex: number;
  raw: string;
}

export interface CategorizedResponse {
  segments: CategorizedSegment[];
  speech: string;
  reasoning: string;
  thoughts: string[];
  plans: string[];
  raw: string;
}

const REASONING_TAGS = ["think", "thought", "reasoning", "plan", "internal", "reflection"];

/**
 * Parses model output into speech and reasoning components.
 */
export function categorizeResponse(rawResponse: string): CategorizedResponse {
  if (!rawResponse) {
    return {
      segments: [],
      speech: "",
      reasoning: "",
      thoughts: [],
      plans: [],
      raw: "",
    };
  }

  const segments: CategorizedSegment[] = [];
  let reasoningCombined = "";

  // Regex matching any recognized reasoning tags, case-insensitive, handling multi-line
  const tagPattern = new RegExp(
    `<(?:${REASONING_TAGS.join("|")})\\b[^>]*>([\\s\\S]*?)<\\/(?:${REASONING_TAGS.join("|")})>`,
    "gi"
  );

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(rawResponse)) !== null) {
    const fullMatch = match[0];
    const innerContent = match[1] || "";
    const matchStart = match.index;
    const matchEnd = match.index + fullMatch.length;

    // Speech text preceding the reasoning tag
    if (matchStart > lastIndex) {
      const speechText = rawResponse.slice(lastIndex, matchStart);
      if (speechText.trim().length > 0) {
        segments.push({
          category: "speech",
          content: speechText,
          startIndex: lastIndex,
          endIndex: matchStart,
          raw: speechText,
        });
      }
    }

    // Extract tag name (e.g. "think" from "<think>")
    const tagMatch = fullMatch.match(/<([a-z]+)/i);
    const tagName = tagMatch ? tagMatch[1].toLowerCase() : "think";

    segments.push({
      category: "reasoning",
      content: innerContent.trim(),
      tagName,
      startIndex: matchStart,
      endIndex: matchEnd,
      raw: fullMatch,
    });

    reasoningCombined += (reasoningCombined ? "\n\n" : "") + innerContent.trim();
    lastIndex = matchEnd;
  }

  // Trailing speech text after last tag
  if (lastIndex < rawResponse.length) {
    const trailingSpeech = rawResponse.slice(lastIndex);
    if (trailingSpeech.trim().length > 0) {
      segments.push({
        category: "speech",
        content: trailingSpeech,
        startIndex: lastIndex,
        endIndex: rawResponse.length,
        raw: trailingSpeech,
      });
    }
  }

  // If no tags were found, the entire response is pure speech
  if (segments.length === 0) {
    return {
      segments: [
        {
          category: "speech",
          content: rawResponse,
          startIndex: 0,
          endIndex: rawResponse.length,
          raw: rawResponse,
        },
      ],
      speech: rawResponse.trim(),
      reasoning: "",
      thoughts: [],
      plans: [],
      raw: rawResponse,
    };
  }

  // Combine all speech segments for display and TTS vocalization
  const speechCombined = segments
    .filter((s) => s.category === "speech")
    .map((s) => s.content)
    .join("\n")
    .trim();

  const thoughts = segments
    .filter((s) => s.category === "reasoning" && (s.tagName === "think" || s.tagName === "thought" || s.tagName === "reflection" || !s.tagName))
    .map((s) => s.content);
  const plans = segments
    .filter((s) => s.category === "reasoning" && s.tagName === "plan")
    .map((s) => s.content);

  return {
    segments,
    speech: speechCombined,
    reasoning: reasoningCombined.trim(),
    thoughts,
    plans,
    raw: rawResponse,
  };
}
