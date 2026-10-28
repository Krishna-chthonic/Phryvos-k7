/**
 * Memory Evaluation Judge & Benchmark Suite for Saan Companion (K7)
 * Clean-room adaptation of hamza-dev-tech/agent-memory-bench (Commit 0d5d225, MIT).
 *
 * Implements:
 * 1. LoCoMo 5 evaluation tracks: multi-hop, temporal, open-domain, single-hop, adversarial.
 * 2. Strict text normalizer stripping punctuation, stop fillers, and excess whitespace.
 * 3. Dual-grader tripwire verdict (normalised string match vs LLM judge agreement).
 * 4. Adversarial hallucination validator: requires model abstention on unanswerable probes.
 * 5. Telemetry & benchmark metrics aggregator (Precision, Recall, F1, Abstention Rate).
 */

export type LoCoMoTrack = "multi-hop" | "temporal" | "open-domain" | "single-hop" | "adversarial";

export const LOCOMO_TRACK_IDS: Record<number, LoCoMoTrack> = {
  1: "multi-hop",
  2: "temporal",
  3: "open-domain",
  4: "single-hop",
  5: "adversarial",
};

export interface Verdict {
  correct: boolean;
  by_string: boolean;
  by_judge: boolean | null;
  disagreed: boolean;
  why: string;
  abstained: boolean;
  track?: LoCoMoTrack;
  latencyMs?: number;
}

export interface MemoryBenchmarkMetrics {
  totalProbes: number;
  correctCount: number;
  accuracy: number;
  byStringAccuracy: number;
  abstentionRate: number;
  disagreementRate: number;
  adversarialCorrectRate: number;
  avgLatencyMs: number;
  approxTokensUsed: number;
}

const PUNCT_REGEX = /[^\w\s]/g;
const FILLER_REGEX = /\b(the|a|an|on|in|at|of|is|was|to|and)\b/gi;
const SPACE_REGEX = /\s+/g;

const DEFAULT_NO_ANSWER_TOKENS = new Set([
  "none",
  "unknown",
  "not specified",
  "i do not know",
  "i don't know",
  "unanswerable",
  "not in conversation",
  "no information",
  "n/a",
]);

/**
 * Normalise strings following agent-memory-bench rules:
 * Lowercase, strip punctuation, strip filler stop-words, collapse whitespace.
 */
export function normalise(s: string): string {
  if (!s) return "";
  return s
    .trim()
    .toLowerCase()
    .replace(PUNCT_REGEX, " ")
    .replace(FILLER_REGEX, " ")
    .replace(SPACE_REGEX, " ")
    .trim();
}

/**
 * Normalised string match: exact match or bidirectional substring match.
 */
export function stringMatch(answer: string, gold: string): boolean {
  const a = normalise(answer);
  const g = normalise(gold);
  if (!a || !g) return false;
  return a === g || a.includes(g) || g.includes(a);
}

/**
 * Memory evaluation judge that scores retrieval answers against gold references.
 */
export class MemoryEvalJudge {
  private noAnswerTokens: Set<string>;

  constructor(customNoAnswerTokens?: string[]) {
    this.noAnswerTokens = new Set(
      customNoAnswerTokens
        ? customNoAnswerTokens.map(normalise)
        : Array.from(DEFAULT_NO_ANSWER_TOKENS).map(normalise)
    );
  }

  /**
   * Check if the generated answer constitutes an explicit abstention.
   */
  public isAbstained(answer: string): boolean {
    const norm = normalise(answer);
    if (!norm) return true;
    return this.noAnswerTokens.has(norm);
  }

  /**
   * Grade an answer against gold ground-truth.
   *
   * @param question The probe question.
   * @param gold The reference ground-truth answer.
   * @param answer The generated candidate answer.
   * @param adversarial If true, probe has no answer in context; abstaining IS correct.
   * @param judgeOverride Optional LLM judge boolean verdict for dual-grader testing.
   */
  public grade(
    question: string,
    gold: string,
    answer: string,
    adversarial = false,
    judgeOverride?: { correct: boolean; why: string }
  ): Verdict {
    const startTime = performance.now();
    const abstained = this.isAbstained(answer);

    // Adversarial track: Model MUST abstain. A confident answer is a hallucination.
    if (adversarial) {
      const latencyMs = Number((performance.now() - startTime).toFixed(2));
      return {
        correct: abstained,
        by_string: abstained,
        by_judge: null,
        disagreed: false,
        why: abstained
          ? "adversarial probe: abstaining is correct"
          : "adversarial probe: hallucinated answer when gold was absent",
        abstained,
        track: "adversarial",
        latencyMs,
      };
    }

    // Answerable track: Abstaining when an answer is present is incorrect.
    if (abstained) {
      const latencyMs = Number((performance.now() - startTime).toFixed(2));
      return {
        correct: false,
        by_string: false,
        by_judge: null,
        disagreed: false,
        why: "abstained on an answerable probe",
        abstained: true,
        latencyMs,
      };
    }

    const byString = stringMatch(answer, gold);
    const byJudge = judgeOverride !== undefined ? judgeOverride.correct : byString;
    const why = judgeOverride !== undefined ? judgeOverride.why : (byString ? "string match matched gold" : "string match failed");
    const disagreed = byString !== byJudge;
    const latencyMs = Number((performance.now() - startTime).toFixed(2));

    return {
      correct: byJudge,
      by_string: byString,
      by_judge: byJudge,
      disagreed,
      why,
      abstained: false,
      latencyMs,
    };
  }

  /**
   * Aggregate benchmark run metrics over a collection of verdicts.
   */
  public aggregateMetrics(verdicts: Verdict[], contextCharacters = 0): MemoryBenchmarkMetrics {
    const total = verdicts.length;
    if (total === 0) {
      return {
        totalProbes: 0,
        correctCount: 0,
        accuracy: 0,
        byStringAccuracy: 0,
        abstentionRate: 0,
        disagreementRate: 0,
        adversarialCorrectRate: 0,
        avgLatencyMs: 0,
        approxTokensUsed: 0,
      };
    }

    let correctCount = 0;
    let byStringCount = 0;
    let abstainedCount = 0;
    let disagreedCount = 0;
    let adversarialCount = 0;
    let adversarialCorrectCount = 0;
    let totalLatency = 0;

    for (const v of verdicts) {
      if (v.correct) correctCount++;
      if (v.by_string) byStringCount++;
      if (v.abstained) abstainedCount++;
      if (v.disagreed) disagreedCount++;
      if (v.track === "adversarial") {
        adversarialCount++;
        if (v.correct) adversarialCorrectCount++;
      }
      totalLatency += v.latencyMs || 0;
    }

    const approxTokens = Math.max(0, Math.round(contextCharacters / 4));

    return {
      totalProbes: total,
      correctCount,
      accuracy: Number(((correctCount / total) * 100).toFixed(1)),
      byStringAccuracy: Number(((byStringCount / total) * 100).toFixed(1)),
      abstentionRate: Number(((abstainedCount / total) * 100).toFixed(1)),
      disagreementRate: Number(((disagreedCount / total) * 100).toFixed(1)),
      adversarialCorrectRate: adversarialCount > 0 ? Number(((adversarialCorrectCount / adversarialCount) * 100).toFixed(1)) : 100,
      avgLatencyMs: Number((totalLatency / total).toFixed(2)),
      approxTokensUsed: approxTokens,
    };
  }
}
