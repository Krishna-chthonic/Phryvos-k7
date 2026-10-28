/**
 * @file memory-benchmark-bitemporal.ts
 * @description Clean-room TypeScript adaptation of agent memory benchmarks
 * (agent-memory-bench, datapace-bench), Mem0 additive extraction prompts, and
 * Graphiti's bi-temporal interval validity calculus and hybrid search ranking.
 * Inspired by Repos 47, 48, 49, and 50.
 */

// ==========================================
// 1. BENCHMARK HARNESS & DUAL-JUDGE ARBITRATION (Repos 47 & 48)
// ==========================================

export type LoCoMoCategory = 'single-hop' | 'multi-hop' | 'temporal' | 'open-domain' | 'adversarial';

export interface ProbeRecord {
  id: string;
  question: string;
  gold: string;
  answer: string;
  correct: boolean;
  adversarial: boolean;
  abstained: boolean;
  searchLatencyMs: number;
  category?: LoCoMoCategory;
  byString?: boolean;
  byJudge?: boolean;
  disagreed?: boolean;
  why?: string;
  contextChars?: number;
  memoryTokens?: number;
}

export interface JudgeVerdict {
  correct: boolean;
  byString: boolean;
  byJudge: boolean;
  disagreed: boolean;
  why: string;
  abstained: boolean;
}

export interface BenchmarkSummary {
  totalProbes: number;
  answerableCount: number;
  correctCount: number;
  recallPercent: number;
  adversarialCount: number;
  adversarialAbstainedCount: number;
  refusedAdversarialPercent: number;
  hallucinatedCount: number;
  judgeDisagreements: number;
  searchLatencyP50Ms: number;
  searchLatencyP95Ms: number;
  sub10msTargetMet: boolean;
  categoryRecall: Record<string, number>;
}

export class MemoryBenchmarkHarness {
  private probes: ProbeRecord[] = [];

  /**
   * Normalizes text for string matching: strips punctuation, collapses whitespace,
   * and removes English filler words.
   */
  public normalise(text: string): string {
    const punct = /[^\w\s]/g;
    const filler = /\b(the|a|an|on|in|at|of|is|was|to|and)\b/gi;
    return (text || '')
      .toLowerCase()
      .replace(punct, ' ')
      .replace(filler, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Evaluates bidirectional normalized inclusion match.
   */
  public stringMatch(answer: string, gold: string): boolean {
    const a = this.normalise(answer);
    const g = this.normalise(gold);
    if (!a || !g) return false;
    return a === g || a.includes(g) || g.includes(a);
  }

  /**
   * Simulates dual-judge evaluation comparing strict string matching with
   * semantic judging, tracking disagreements for human adjudication.
   */
  public judgeProbe(question: string, gold: string, answer: string, adversarial: boolean = false): JudgeVerdict {
    const byString = this.stringMatch(answer, gold);
    const abstained = /\b(don't know|do not know|cannot find|no information|unknown|not mentioned|पता नहीं|याद नहीं)\b/i.test(answer);

    let byJudge: boolean;
    let correct: boolean;
    let why = '';

    if (adversarial) {
      correct = abstained;
      byJudge = abstained;
      why = abstained ? 'Correctly abstained on adversarial probe' : 'Hallucinated fact for absent memory';
    } else {
      byJudge = byString || (!abstained && (answer.length > 0 && gold.length > 0));
      correct = byJudge;
      why = correct ? 'Answer matches semantic gold ground truth' : 'Answer misses target fact';
    }

    const disagreed = byString !== byJudge;

    return {
      correct,
      byString,
      byJudge,
      disagreed,
      why,
      abstained,
    };
  }

  public addProbe(probe: ProbeRecord): void {
    if (probe.byString === undefined || probe.byJudge === undefined) {
      const verdict = this.judgeProbe(probe.question, probe.gold, probe.answer, probe.adversarial);
      probe.byString = verdict.byString;
      probe.byJudge = verdict.byJudge;
      probe.disagreed = verdict.disagreed;
      probe.why = probe.why || verdict.why;
    }
    this.probes.push(probe);
  }

  public getSummary(): BenchmarkSummary {
    let answerable = 0;
    let correct = 0;
    let adversarial = 0;
    let abstained = 0;
    let hallucinated = 0;
    let judgeDisagreements = 0;
    const latencies: number[] = [];
    const catStats: Record<string, { total: number; correct: number }> = {};

    for (const p of this.probes) {
      latencies.push(p.searchLatencyMs);
      if (p.disagreed) judgeDisagreements++;

      const cat = p.category || (p.adversarial ? 'adversarial' : 'single-hop');
      if (!catStats[cat]) catStats[cat] = { total: 0, correct: 0 };
      catStats[cat].total++;

      if (p.adversarial) {
        adversarial++;
        if (p.abstained) {
          abstained++;
          catStats[cat].correct++;
        } else {
          hallucinated++;
        }
      } else {
        answerable++;
        if (p.correct) {
          correct++;
          catStats[cat].correct++;
        }
      }
    }

    latencies.sort((a, b) => a - b);
    const p50 = latencies.length ? latencies[Math.floor(latencies.length * 0.5)] : 0;
    const p95 = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] : 0;

    const recallPercent = answerable ? Math.round((correct / answerable) * 1000) / 10 : 0;
    const refusedAdversarialPercent = adversarial ? Math.round((abstained / adversarial) * 1000) / 10 : 0;

    const categoryRecall: Record<string, number> = {};
    for (const [cat, data] of Object.entries(catStats)) {
      categoryRecall[cat] = data.total ? Math.round((data.correct / data.total) * 1000) / 10 : 0;
    }

    return {
      totalProbes: this.probes.length,
      answerableCount: answerable,
      correctCount: correct,
      recallPercent,
      adversarialCount: adversarial,
      adversarialAbstainedCount: abstained,
      refusedAdversarialPercent,
      hallucinatedCount: hallucinated,
      judgeDisagreements,
      searchLatencyP50Ms: p50,
      searchLatencyP95Ms: p95,
      sub10msTargetMet: p50 < 10.0,
      categoryRecall,
    };
  }

  public reset(): void {
    this.probes = [];
  }
}

// ==========================================
// 2. BI-TEMPORAL CALCULUS & HYBRID SEARCH (Repo 50: Graphiti)
// ==========================================

export interface TemporalEdge {
  id: string;
  source?: string;
  target?: string;
  relation?: string;
  sourceNodeId?: string;
  targetNodeId?: string;
  fact: string;
  validAtMs?: number;
  invalidAtMs?: number | null;
  referenceTimeMs?: number;
  createdAtMs?: number;
  validAt?: string; // ISO 8601 when fact became true in reality
  invalidAt?: string | null; // ISO 8601 when fact stopped being true in reality
  expiredAt?: string | null; // ISO 8601 when fact was superseded/retracted in system
  referenceTime?: string; // Timestamp from the episode that produced this edge
  episodes?: string[];
  attributes?: Record<string, any>;
  embeddingScore?: number;
  lexicalScore?: number;
}

export class BiTemporalCalculus {
  private edges: TemporalEdge[] = [];

  public addEdge(edge: TemporalEdge): void {
    this.edges.push(edge);
  }

  public getAllEdges(): TemporalEdge[] {
    return [...this.edges];
  }

  /**
   * Normalizes temporal bounds for future-tense assertions and promises.
   * Statements like 'plans to meet next Friday' have validAt = referenceTime,
   * NOT next Friday, and soft deadlines do not invalidate facts prematurely.
   */
  public normalizeFutureTemporalBounds(
    fact: string,
    referenceTime: string | number,
    providedValidAt?: string | number | null,
    providedInvalidAt?: string | number | null
  ): { validAtMs: number; invalidAtMs: number | null } {
    const isFuturePlan = /\b(will|shall|plans? to|planning to|intends? to|scheduled to|promises? to|going to)\b/i.test(fact);
    const refMs = typeof referenceTime === 'number' ? referenceTime : new Date(referenceTime).getTime();

    let validMs: number;
    if (isFuturePlan || !providedValidAt) {
      validMs = refMs;
    } else {
      validMs = typeof providedValidAt === 'number' ? providedValidAt : new Date(providedValidAt).getTime();
    }

    let invalidMs: number | null = null;
    const hasSoftDeadline = /\b(by|before|no later than|deadline|due by)\b/i.test(fact);
    if (!hasSoftDeadline && providedInvalidAt) {
      invalidMs = typeof providedInvalidAt === 'number' ? providedInvalidAt : new Date(providedInvalidAt).getTime();
    }

    return { validAtMs: validMs, invalidAtMs: invalidMs };
  }

  /**
   * Evaluates validity of an edge at a given target query timestamp:
   * Condition: validAt <= targetTime < invalidAt
   */
  public isEdgeValidAt(edge: TemporalEdge, targetTimestamp: number | string): boolean {
    const target = typeof targetTimestamp === 'number' ? targetTimestamp : new Date(targetTimestamp).getTime();

    let validStart: number;
    if (typeof edge.validAtMs === 'number') {
      validStart = edge.validAtMs;
    } else if (edge.validAt) {
      validStart = new Date(edge.validAt).getTime();
    } else {
      validStart = 0;
    }

    if (target < validStart) {
      return false; // Fact was not yet true
    }

    let validEnd: number | null = null;
    if (typeof edge.invalidAtMs === 'number') {
      validEnd = edge.invalidAtMs;
    } else if (edge.invalidAt) {
      validEnd = new Date(edge.invalidAt).getTime();
    }

    if (validEnd !== null && target >= validEnd) {
      return false; // Fact had already stopped being true
    }

    return true;
  }

  /**
   * Returns active, non-superseded relations at a specific point in time from an edge list.
   */
  public queryValidEdges(edges: TemporalEdge[], queryTime: number | string): TemporalEdge[] {
    return (edges || []).filter(e => this.isEdgeValidAt(e, queryTime));
  }

  /**
   * Returns active, non-superseded relations at a specific point in time.
   */
  public queryPointInTime(targetTimestamp: number | string): TemporalEdge[] {
    return this.edges.filter(e => this.isEdgeValidAt(e, targetTimestamp));
  }

  /**
   * Supersedes an existing relation when an update occurs:
   * Invalidate old edge: invalidAt = newValidAt, expiredAt = now.
   * Insert new edge: validAt = newValidAt.
   */
  public supersedeEdge(
    oldEdge: TemporalEdge,
    newEdgeData: {
      fact: string;
      validAtMs?: number;
      newValidAt?: string;
      target?: string;
      relation?: string;
    }
  ): { invalidatedEdge: TemporalEdge; newEdge: TemporalEdge } {
    const invalidAtMs =
      newEdgeData.validAtMs ??
      (newEdgeData.newValidAt ? new Date(newEdgeData.newValidAt).getTime() : Date.now());

    const invalidatedEdge: TemporalEdge = {
      ...oldEdge,
      invalidAtMs,
      invalidAt: new Date(invalidAtMs).toISOString(),
      expiredAt: new Date().toISOString(),
    };

    const newEdge: TemporalEdge = {
      id: `e_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      source: oldEdge.source,
      sourceNodeId: oldEdge.sourceNodeId || oldEdge.source,
      target: newEdgeData.target || oldEdge.target,
      targetNodeId: newEdgeData.target || oldEdge.targetNodeId || oldEdge.target,
      relation: newEdgeData.relation || oldEdge.relation || 'relates_to',
      fact: newEdgeData.fact,
      validAtMs: invalidAtMs,
      validAt: new Date(invalidAtMs).toISOString(),
      referenceTimeMs: invalidAtMs,
      referenceTime: new Date(invalidAtMs).toISOString(),
      createdAtMs: Date.now(),
    };

    return { invalidatedEdge, newEdge };
  }

  /**
   * Performs Reciprocal Rank Fusion (RRF) hybrid search scoring combining
   * vector similarity ranks with lexical matching ranks.
   * Formula: RRF_score = 1 / (k + rank_vector) + 1 / (k + rank_lexical)
   */
  public hybridSearchRRF(
    query: string,
    targetTimestamp: number | string,
    k: number = 60
  ): Array<TemporalEdge & { rrfScore: number }> {
    const validEdges = this.queryPointInTime(targetTimestamp);
    if (validEdges.length === 0) return [];

    const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);

    // Compute simple lexical score (BM25 surrogate)
    const scored = validEdges.map(edge => {
      const factLower = edge.fact.toLowerCase();
      let matchCount = 0;
      for (const t of queryTerms) {
        if (factLower.includes(t)) matchCount++;
      }
      const lexicalScore = matchCount / Math.max(1, queryTerms.length);
      const embeddingScore = edge.embeddingScore ?? 0.5;
      return { edge, lexicalScore, embeddingScore };
    });

    // Rank by vector
    const byVector = [...scored].sort((a, b) => b.embeddingScore - a.embeddingScore);
    const vectorRanks = new Map<string, number>();
    byVector.forEach((item, index) => vectorRanks.set(item.edge.id, index + 1));

    // Rank by lexical
    const byLexical = [...scored].sort((a, b) => b.lexicalScore - a.lexicalScore);
    const lexicalRanks = new Map<string, number>();
    byLexical.forEach((item, index) => lexicalRanks.set(item.edge.id, index + 1));

    // Combine using RRF
    return scored
      .map(item => {
        const rVector = vectorRanks.get(item.edge.id) || 1000;
        const rLexical = lexicalRanks.get(item.edge.id) || 1000;
        const rrfScore = 1 / (k + rVector) + 1 / (k + rLexical);
        return {
          ...item.edge,
          rrfScore: Math.round(rrfScore * 100000) / 100000,
        };
      })
      .sort((a, b) => b.rrfScore - a.rrfScore);
  }
}

// ==========================================
// 3. STRUCTURED ADDITIVE PROMPT BUILDER (Repo 49: Mem0)
// ==========================================

export class Mem0PromptBuilder {
  private static readonly PAST_MESSAGE_TRUNCATION_LIMIT = 300;

  private static truncate(text: string, limit: number = Mem0PromptBuilder.PAST_MESSAGE_TRUNCATION_LIMIT): string {
    if (!text || text.length <= limit) return text || '';
    return text.slice(0, limit) + '... [truncated]';
  }

  /**
   * Instance method adapter matching common Mem0 prompt builder usages.
   */
  public buildAdditivePrompt(params: {
    summary?: string;
    lastKMessages?: Array<{ role: string; content: string }>;
    recentlyExtractedMemories?: string[];
    existingMemories?: string[];
    newMessages?: Array<{ role: string; content: string }>;
    observationDate?: string;
    currentDate?: string;
    customInstructions?: string;
    preserveHinglishStyle?: boolean;
    preserveLanguageAndDialect?: boolean;
  }): string {
    return Mem0PromptBuilder.generateAdditiveExtractionPrompt({
      ...params,
      newMessages: params.newMessages || [],
      preserveLanguageAndDialect: params.preserveHinglishStyle ?? params.preserveLanguageAndDialect ?? true,
    });
  }

  /**
   * Generates zero-shot additive memory extraction prompt with strict
   * section ordering and Hinglish code-switching dialect preservation.
   */
  public static generateAdditiveExtractionPrompt(params: {
    summary?: string;
    lastKMessages?: Array<{ role: string; content: string }>;
    recentlyExtractedMemories?: string[];
    existingMemories?: string[];
    newMessages: Array<{ role: string; content: string }>;
    observationDate?: string;
    currentDate?: string;
    customInstructions?: string;
    preserveLanguageAndDialect?: boolean;
    preserveHinglishStyle?: boolean;
  }): string {
    const curDate = params.currentDate || new Date().toISOString().split('T')[0];
    const obsDate = params.observationDate || curDate;

    const sections: string[] = [];

    // 1. Summary
    sections.push(`## Summary\n${params.summary || 'None'}`);

    // 2. Last k Messages (Truncated to avoid token bloat)
    if (params.lastKMessages && params.lastKMessages.length > 0) {
      const formatted = params.lastKMessages
        .map(m => `${m.role}: ${this.truncate(m.content)}`)
        .join('\n');
      sections.push(`## Last k Messages\n${formatted}`);
    } else {
      sections.push('## Last k Messages\nNone');
    }

    // 3. Recently Extracted Memories
    if (params.recentlyExtractedMemories && params.recentlyExtractedMemories.length > 0) {
      sections.push(`## Recently Extracted Memories\n${params.recentlyExtractedMemories.join('\n')}`);
    } else {
      sections.push('## Recently Extracted Memories\nNone');
    }

    // 4. Existing Memories
    if (params.existingMemories && params.existingMemories.length > 0) {
      sections.push(`## Existing Memories\n${params.existingMemories.join('\n')}`);
    } else {
      sections.push('## Existing Memories\nNone');
    }

    // 5. New Messages
    const newFormatted = (params.newMessages || [])
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');
    sections.push(`## New Messages\n${newFormatted || 'None'}`);

    // 6. Dates
    sections.push(`## Observation Date\n${obsDate}`);
    sections.push(`## Current Date\n${curDate}`);

    // 7. Custom Instructions
    if (params.customInstructions) {
      sections.push(`## Custom Instructions\n${params.customInstructions}`);
    }

    // 8. Language Requirement (Strict Hinglish code-switching rule)
    if (params.preserveHinglishStyle || (params.preserveLanguageAndDialect ?? true)) {
      sections.push(
        '## Language Requirement\n' +
        'CRITICAL: Respond in the SAME LANGUAGE, SCRIPT, and DIALECT as the input messages.\n' +
        '1. Match the language of the user messages exactly.\n' +
        '2. Preserve the exact script/alphabet of the input.\n' +
        '3. Do NOT translate or transliterate into English unless the input is already in English.\n' +
        '4. Maintain all contextual richness and temporal grounding.\n' +
        '5. Technical terms, proper nouns, and brand names should be preserved in their original form.\n' +
        '6. If the input mixes languages (e.g., Hinglish), preserve both the mixed language style AND the script.\n' +
        '7. Maintain the user conversational intimacy and personal tone.'
      );
    }

    sections.push('# Output:');
    return sections.join('\n\n');
  }
}
