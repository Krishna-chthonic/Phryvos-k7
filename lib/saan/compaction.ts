/**
 * Saan Companion Context Compaction (Adapted from ericwang915/HerAndHim core/compaction.py)
 *
 * Implements 2-phase structured memory compaction:
 * 1. Memory flush: silent extraction of persistent facts before summarization.
 * 2. Structured companion summary: enforces 6 mandatory relational sections
 *    so relationship continuity survives long sessions instead of turning into generic prose.
 */

export interface CompactionSummary {
  relationshipThread: string;
  confirmedFacts: string[];
  openPlansAndDates: string[];
  emotionalTone: string;
  pendingAsksAndPromises: string[];
  doNotLose: string[];
  rawText: string;
}

const CHARS_PER_TOKEN = 4;
export const DEFAULT_COMPACTION_THRESHOLD_TOKENS = 8000;
export const DEFAULT_RECENT_KEEP = 6; // Keep last N turns verbatim

/**
 * Estimates token count using standard 4 chars per token rule.
 */
export function estimateTokens(text: string): number {
  return Math.ceil((text || "").length / CHARS_PER_TOKEN);
}

/**
 * Generates the structured companion compaction prompt.
 */
export function buildCompactionPrompt(
  messagesToSummarize: Array<{ role: string; content: string }>
): string {
  const formattedTranscript = messagesToSummarize
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  return `You are a companion memory compaction engine.
Summarize the following chat history between the User and Saan into a structured companion archive.
Do NOT write generic corporate prose. You MUST preserve the emotional connection, inside jokes, and commitments.

Format your output STRICTLY with the following 6 headers:

### RELATIONSHIP THREAD
(How did the bond evolve? Inside jokes, playful banter, milestones shared)

### CONFIRMED USER FACTS
(Specific personal facts, preferences, constraints revealed)

### OPEN PLANS & DATES
(Upcoming exams, trips, events, deadlines, dinner plans mentioned)

### EMOTIONAL TONE
(User's mood, stress levels, recent wins or sadness)

### PENDING ASKS & PROMISES
(Things either person promised to do, follow up on, or check later)

### DO-NOT-LOSE
(Exact details, names, codes, or crucial facts that must never be forgotten)

---
CHAT TRANSCRIPT TO COMPACT:
${formattedTranscript}`;
}

/**
 * Parses the structured compaction response back into typed sections.
 */
export function parseCompactionSummary(raw: string): CompactionSummary {
  const extractSection = (header: string): string => {
    const regex = new RegExp(`###\\s*${header}[\\r\\n]+([\\s\\S]*?)(?=###|$)`, "i");
    const match = raw.match(regex);
    return match ? match[1].trim() : "";
  };

  const splitLines = (text: string): string[] =>
    text
      .split("\n")
      .map((l) => l.replace(/^[-*•\d.]\s*/, "").trim())
      .filter((l) => l.length > 0);

  return {
    relationshipThread: extractSection("RELATIONSHIP THREAD"),
    confirmedFacts: splitLines(extractSection("CONFIRMED USER FACTS")),
    openPlansAndDates: splitLines(extractSection("OPEN PLANS & DATES")),
    emotionalTone: extractSection("EMOTIONAL TONE"),
    pendingAsksAndPromises: splitLines(extractSection("PENDING ASKS & PROMISES")),
    doNotLose: splitLines(extractSection("DO-NOT-LOSE")),
    rawText: raw.trim(),
  };
}
