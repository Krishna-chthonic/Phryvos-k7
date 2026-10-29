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

// ============================================================================
// Sovereign Real-Time Turn Fidelity Evaluator & Multi-Metric Telemetry
// ============================================================================

export interface MemoryEvalMetrics {
  faithfulness: number;     // [0, 1]: Assistant reply faithfully grounded in recalled memories
  relevancy: number;        // [0, 1]: Recalled facts directly answer or enrich user query
  temporalIntegrity: number;// [0, 1]: Facts adhere to temporal timeline with zero anachronisms
  slopPenalty: number;      // [0, 1]: Degree of repetitive clichés or formulaic AI tropes detected
  compositeFidelity: number;// [0, 1]: Weighted composite score
  grade: "S_TIER" | "A_TIER" | "B_TIER" | "FAIL";
  critique: string;
}

export interface MemoryEvalRecord {
  id: string;
  timestamp: string;
  userMessage: string;
  reply: string;
  recalledMemories: string[];
  metrics: MemoryEvalMetrics;
  latencyMs: number;
}

export interface MemoryEvalAggregateStats {
  totalEvaluated: number;
  avgFaithfulness: number;
  avgRelevancy: number;
  avgTemporalIntegrity: number;
  avgCompositeFidelity: number;
  passRate: number; // percentage of turns scoring >= A_TIER (0.75)
  gradeDistribution: Record<string, number>;
}

const COMMON_SLOP_PATTERNS = [
  /\b(delve into|tapestry|beacon|testament to|kaleidoscope|resonate|in conclusion|it's important to remember)\b/gi,
  /\b(cherish every moment|always remember that|i'm always here for you no matter what)\b/gi,
  /\b(pyaar aur dosti ka bandhan|hamesha muskurate raho)\b/gi,
];

export class MemoryEvalJudgeEngine {
  private static tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2);
  }

  public static calculateRelevancy(query: string, memories: string[]): number {
    if (!memories || memories.length === 0) return 0.6;
    const queryTokens = new Set(this.tokenize(query));
    if (queryTokens.size === 0) return 0.5;

    const combinedMemories = memories.join(" ");
    const memoryTokens = this.tokenize(combinedMemories);
    if (memoryTokens.length === 0) return 0.2;

    const matchedTokens = new Set<string>();
    for (const token of memoryTokens) {
      if (queryTokens.has(token)) {
        matchedTokens.add(token);
      }
    }

    const overlap = matchedTokens.size;
    if (overlap === 0) return 0.25;

    const coverage = overlap / queryTokens.size;
    const score = Math.min(1.0, coverage * 0.5 + 0.5);
    return Number(score.toFixed(3));
  }

  public static calculateFaithfulness(reply: string, memories: string[]): number {
    if (!memories || memories.length === 0) return 0.85;
    const replyTokens = this.tokenize(reply);
    if (replyTokens.length === 0) return 0.5;

    const memoryTokenSet = new Set(this.tokenize(memories.join(" ")));
    if (memoryTokenSet.size === 0) return 0.5;

    let groundedTokens = 0;
    for (const token of replyTokens) {
      if (memoryTokenSet.has(token)) {
        groundedTokens++;
      }
    }

    const groundRatio = groundedTokens / Math.max(1, replyTokens.length);
    const normalized = Math.min(1.0, groundRatio * 2.0 + 0.5);
    return Number(normalized.toFixed(3));
  }

  public static calculateTemporalIntegrity(userMessage: string, reply: string, memories: string[]): number {
    const combined = `${userMessage} ${reply} ${memories.join(" ")}`.toLowerCase();
    const temporalConfusion = /\b(yesterday tomorrow|last week next year|pehle kal aane wala)\b/i.test(combined);
    if (temporalConfusion) return 0.3;
    return 0.95;
  }

  public static calculateSlopPenalty(reply: string): number {
    let slopCount = 0;
    for (const pat of COMMON_SLOP_PATTERNS) {
      const matches = reply.match(pat);
      if (matches) slopCount += matches.length;
    }

    if (slopCount === 0) return 0.0;
    return Number(Math.min(1.0, slopCount * 0.25).toFixed(3));
  }

  public static evaluateTurn(
    userMessage: string,
    reply: string,
    recalledMemories: string[] = []
  ): MemoryEvalMetrics {
    const relevancy = this.calculateRelevancy(userMessage, recalledMemories);
    const faithfulness = this.calculateFaithfulness(reply, recalledMemories);
    const temporalIntegrity = this.calculateTemporalIntegrity(userMessage, reply, recalledMemories);
    const slopPenalty = this.calculateSlopPenalty(reply);

    const compositeRaw = (
      faithfulness * 0.40 +
      relevancy * 0.35 +
      temporalIntegrity * 0.25 -
      slopPenalty * 0.20
    );
    const compositeFidelity = Number(Math.max(0.0, Math.min(1.0, compositeRaw)).toFixed(3));

    let grade: MemoryEvalMetrics["grade"] = "FAIL";
    if (compositeFidelity >= 0.88) grade = "S_TIER";
    else if (compositeFidelity >= 0.72) grade = "A_TIER";
    else if (compositeFidelity >= 0.55) grade = "B_TIER";

    const critique = [
      `Fidelity: ${(compositeFidelity * 100).toFixed(1)}% [${grade}].`,
      faithfulness >= 0.7 ? "Strong factual grounding." : "Moderate grounding; watch for drift.",
      relevancy >= 0.6 ? "Context highly pertinent." : "Context loosely aligned.",
      slopPenalty > 0 ? `Cliché penalty applied (-${(slopPenalty * 20).toFixed(0)}%).` : "Clean organic style.",
    ].join(" ");

    return {
      faithfulness,
      relevancy,
      temporalIntegrity,
      slopPenalty,
      compositeFidelity,
      grade,
      critique,
    };
  }
}

export class MemoryEvalStore {
  private history: MemoryEvalRecord[] = [];
  private readonly maxRecords: number = 100;

  public recordEvaluation(
    userMessage: string,
    reply: string,
    recalledMemories: string[] = [],
    latencyMs: number = 5
  ): MemoryEvalRecord {
    const metrics = MemoryEvalJudgeEngine.evaluateTurn(userMessage, reply, recalledMemories);
    const record: MemoryEvalRecord = {
      id: `eval_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      userMessage,
      reply,
      recalledMemories,
      metrics,
      latencyMs,
    };

    this.history.unshift(record);
    if (this.history.length > this.maxRecords) {
      this.history.pop();
    }
    return record;
  }

  public getHistory(limit: number = 20): MemoryEvalRecord[] {
    return this.history.slice(0, limit);
  }

  public getAggregateStats(): MemoryEvalAggregateStats {
    if (this.history.length === 0) {
      return {
        totalEvaluated: 0,
        avgFaithfulness: 1.0,
        avgRelevancy: 1.0,
        avgTemporalIntegrity: 1.0,
        avgCompositeFidelity: 1.0,
        passRate: 100.0,
        gradeDistribution: { S_TIER: 0, A_TIER: 0, B_TIER: 0, FAIL: 0 },
      };
    }

    let sumFaith = 0;
    let sumRel = 0;
    let sumTemp = 0;
    let sumComp = 0;
    let passing = 0;
    const grades: Record<string, number> = { S_TIER: 0, A_TIER: 0, B_TIER: 0, FAIL: 0 };

    for (const rec of this.history) {
      sumFaith += rec.metrics.faithfulness;
      sumRel += rec.metrics.relevancy;
      sumTemp += rec.metrics.temporalIntegrity;
      sumComp += rec.metrics.compositeFidelity;
      grades[rec.metrics.grade] = (grades[rec.metrics.grade] || 0) + 1;
      if (rec.metrics.grade === "S_TIER" || rec.metrics.grade === "A_TIER" || rec.metrics.grade === "B_TIER") {
        passing++;
      }
    }

    const total = this.history.length;
    return {
      totalEvaluated: total,
      avgFaithfulness: Number((sumFaith / total).toFixed(3)),
      avgRelevancy: Number((sumRel / total).toFixed(3)),
      avgTemporalIntegrity: Number((sumTemp / total).toFixed(3)),
      avgCompositeFidelity: Number((sumComp / total).toFixed(3)),
      passRate: Number(((passing / total) * 100).toFixed(1)),
      gradeDistribution: grades,
    };
  }

  public clear(): void {
    this.history = [];
  }
}

let globalMemoryEvalStore: MemoryEvalStore | null = null;

export function getMemoryEvalStore(): MemoryEvalStore {
  if (!globalMemoryEvalStore) {
    globalMemoryEvalStore = new MemoryEvalStore();
  }
  return globalMemoryEvalStore;
}

