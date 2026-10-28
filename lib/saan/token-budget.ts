/**
 * Token Headroom & Dynamic Budget Clamping
 * Clean-room TypeScript adaptation inspired by kwaroran/Risuai token budgeting algorithms.
 *
 * Implements:
 * 1. Multi-pass token headroom calculation.
 * 2. Iterative oldest-turn pruning for removable messages.
 * 3. Dynamic output token headroom clamping to eliminate HTTP 400 context overflow errors.
 */

export interface TokenBudgetConfig {
  maxContextTokens: number;
  maxResponseTokens: number;
  reservedSafetyMargin?: number;
}

export interface TokenBudgetSummary {
  inputTokens: number;
  outputTokens: number;
  maxContextTokens: number;
  headroomTokens: number;
  wasPruned: boolean;
  prunedTurnCount: number;
}

export interface BudgetableMessage {
  role: string;
  content: string;
  removable?: boolean;
}

/**
 * Heuristic/character-ratio fallback token counter (approx ~4 chars per token)
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  // CJK and symbol dense regex adjustment
  const cjkChars = (text.match(/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  const nonCjkChars = text.length - cjkChars;
  return Math.ceil(nonCjkChars / 3.8 + cjkChars * 1.2);
}

/**
 * Calculates dynamic clamped output tokens based on available headroom.
 */
export function clampOutputTokens(
  inputTokens: number,
  maxContextTokens: number,
  maxResponseTokens: number,
  safetyMargin = 32
): number {
  const maxAvailable = maxContextTokens - inputTokens - safetyMargin;
  if (maxAvailable <= 16) {
    return 16; // minimum viable response
  }
  return Math.min(maxResponseTokens, maxAvailable);
}

/**
 * Prunes removable chat turns from oldest to newest until input tokens are within the target budget.
 */
export function pruneContextTurns<T extends BudgetableMessage>(
  messages: T[],
  maxContextTokens: number,
  maxResponseTokens: number,
  countTokensFn: (msg: T) => number = (m) => estimateTokenCount(m.content)
): { prunedMessages: T[]; budget: TokenBudgetSummary } {
  let totalInputTokens = 0;
  for (const msg of messages) {
    totalInputTokens += countTokensFn(msg);
  }

  const effectiveMaxInput = Math.max(128, maxContextTokens - maxResponseTokens);
  let wasPruned = false;
  let prunedTurnCount = 0;
  const prunedList: T[] = messages.map((m) => ({ ...m }));

  if (totalInputTokens > effectiveMaxInput) {
    wasPruned = true;
    for (let i = 0; i < prunedList.length; i++) {
      if (totalInputTokens <= effectiveMaxInput) break;

      // Only prune turns explicitly tagged as removable or normal non-system turns
      if (prunedList[i].removable || prunedList[i].role !== "system") {
        const turnTokens = countTokensFn(prunedList[i]);
        prunedList[i].content = "";
        totalInputTokens -= turnTokens;
        prunedTurnCount++;
      }
    }
  }

  // Filter out emptied turns
  const finalMessages = prunedList.filter(
    (m) => m.content.trim().length > 0 || m.role === "system"
  );

  // Recalculate exact final input tokens
  let finalInputTokens = 0;
  for (const msg of finalMessages) {
    finalInputTokens += countTokensFn(msg);
  }

  const clampedOutput = clampOutputTokens(finalInputTokens, maxContextTokens, maxResponseTokens);
  const headroom = Math.max(0, maxContextTokens - finalInputTokens - clampedOutput);

  return {
    prunedMessages: finalMessages,
    budget: {
      inputTokens: finalInputTokens,
      outputTokens: clampedOutput,
      maxContextTokens,
      headroomTokens: headroom,
      wasPruned,
      prunedTurnCount,
    },
  };
}
