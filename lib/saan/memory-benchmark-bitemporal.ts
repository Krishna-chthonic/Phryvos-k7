/**
 * @file memory-benchmark-bitemporal.ts
 * @description Clean-room TypeScript adaptation of agent memory benchmarks
 * (agent-memory-bench, datapace-bench), Mem0 additive extraction prompts, and
 * Graphiti's bi-temporal interval validity calculus.
 * Inspired by Repos 47, 48, 49, and 50.
 */

// ==========================================
// 1. BENCHMARK HARNESS (Repos 47 & 48)
// ==========================================

export interface ProbeRecord {
  id: string;
  question: string;
  gold: string;
  answer: string;
  correct: boolean;
  adversarial: boolean;
  abstained: boolean;
  searchLatencyMs: number;
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
  searchLatencyP50Ms: number;
  searchLatencyP95Ms: number;
  sub10msTargetMet: boolean;
}

export class MemoryBenchmarkHarness {
  private probes: ProbeRecord[] = [];

  public addProbe(probe: ProbeRecord): void {
    this.probes.push(probe);
  }

  public getSummary(): BenchmarkSummary {
    let answerable = 0;
    let correct = 0;
    let adversarial = 0;
    let abstained = 0;
    let hallucinated = 0;
    const latencies: number[] = [];

    for (const p of this.probes) {
      latencies.push(p.searchLatencyMs);
      if (p.adversarial) {
        adversarial++;
        if (p.abstained) {
          abstained++;
        } else {
          hallucinated++;
        }
      } else {
        answerable++;
        if (p.correct) {
          correct++;
        }
      }
    }

    latencies.sort((a, b) => a - b);
    const p50 = latencies.length ? latencies[Math.floor(latencies.length * 0.5)] : 0;
    const p95 = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] : 0;

    const recallPercent = answerable ? Math.round((correct / answerable) * 1000) / 10 : 0;
    const refusedAdversarialPercent = adversarial ? Math.round((abstained / adversarial) * 1000) / 10 : 0;

    return {
      totalProbes: this.probes.length,
      answerableCount: answerable,
      correctCount: correct,
      recallPercent,
      adversarialCount: adversarial,
      adversarialAbstainedCount: abstained,
      refusedAdversarialPercent,
      hallucinatedCount: hallucinated,
      searchLatencyP50Ms: p50,
      searchLatencyP95Ms: p95,
      sub10msTargetMet: p50 < 10.0,
    };
  }

  public reset(): void {
    this.probes = [];
  }
}

// ==========================================
// 2. BI-TEMPORAL CALCULUS (Repo 50: Graphiti)
// ==========================================

export interface TemporalEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  fact: string;
  validAtMs: number;
  invalidAtMs?: number;
  referenceTimeMs: number;
  createdAtMs: number;
}

export class BiTemporalCalculus {
  /**
   * Verifies if an edge is active and valid at a specific point in time t.
   * Rule: valid_at <= t < invalid_at
   */
  public isEdgeValidAt(edge: TemporalEdge, queryTimeMs: number): boolean {
    if (queryTimeMs < edge.validAtMs) return false;
    if (edge.invalidAtMs !== undefined && queryTimeMs >= edge.invalidAtMs) return false;
    return true;
  }

  /**
   * Filters a collection of edges for a given temporal snapshot.
   */
  public queryValidEdges(edges: TemporalEdge[], queryTimeMs: number): TemporalEdge[] {
    return edges.filter(e => this.isEdgeValidAt(e, queryTimeMs));
  }

  /**
   * Supersedes an outdated edge with a newer conflicting fact.
   * Invalidates the existing relation at newFact.validAtMs and inserts the updated edge.
   */
  public supersedeEdge(
    existingEdge: TemporalEdge,
    newRelation: {
      fact: string;
      validAtMs: number;
      referenceTimeMs?: number;
    }
  ): { invalidatedEdge: TemporalEdge; newEdge: TemporalEdge } {
    // 1. Invalidate old edge
    const invalidatedEdge: TemporalEdge = {
      ...existingEdge,
      invalidAtMs: newRelation.validAtMs,
    };

    // 2. Spawn new edge
    const newEdge: TemporalEdge = {
      id: `edge_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      source: existingEdge.source,
      target: existingEdge.target,
      relation: existingEdge.relation,
      fact: newRelation.fact,
      validAtMs: newRelation.validAtMs,
      referenceTimeMs: newRelation.referenceTimeMs || newRelation.validAtMs,
      createdAtMs: Date.now(),
    };

    return { invalidatedEdge, newEdge };
  }
}

// ==========================================
// 3. STRUCTURED PROMPT BUILDER (Repo 49: Mem0)
// ==========================================

export interface AdditivePromptInput {
  summary?: string;
  lastKMessages?: Array<{ role: string; content: string }>;
  recentlyExtracted?: string[];
  existingMemories?: string[];
  newMessages?: Array<{ role: string; content: string }>;
  observationDate?: string;
  currentDate?: string;
  preserveHinglishStyle?: boolean;
}

export class Mem0PromptBuilder {
  /**
   * Constructs additive extraction prompt matching Mem0's structured zero-shot format.
   */
  public buildAdditivePrompt(input: AdditivePromptInput): string {
    const today = input.currentDate || new Date().toISOString().split('T')[0];
    const obsDate = input.observationDate || today;

    const sections: string[] = [];

    // Summary section
    if (input.summary) {
      sections.push(`## Summary\n${input.summary}`);
    }

    // Last k messages
    if (input.lastKMessages && input.lastKMessages.length > 0) {
      const msgLines = input.lastKMessages.map(
        m => `${m.role}: ${m.content.slice(0, 300)}${m.content.length > 300 ? '...' : ''}`
      );
      sections.push(`## Last k Messages\n${msgLines.join('\n')}`);
    }

    // Recently extracted
    if (input.recentlyExtracted && input.recentlyExtracted.length > 0) {
      sections.push(`## Recently Extracted Memories\n${JSON.stringify(input.recentlyExtracted)}`);
    }

    // Existing memories
    if (input.existingMemories && input.existingMemories.length > 0) {
      sections.push(`## Existing Memories\n${JSON.stringify(input.existingMemories)}`);
    }

    // New messages
    if (input.newMessages && input.newMessages.length > 0) {
      const newLines = input.newMessages.map(m => `${m.role}: ${m.content}`);
      sections.push(`## New Messages\n${newLines.join('\n')}`);
    }

    // Temporal groundings
    sections.push(`## Observation Date\n${obsDate}`);
    sections.push(`## Current Date\n${today}`);

    // Multilingual / Hinglish preservation requirement
    if (input.preserveHinglishStyle) {
      sections.push(
        '## Language Requirement\n' +
        'CRITICAL: Preserve the exact script, dialect, and code-switching style (e.g. Hinglish) of the input messages. Do not force translation into pure English.'
      );
    }

    sections.push('# Output:\n[{"action": "ADD", "fact": "..."}, {"action": "UPDATE", "fact": "..."}]');

    return sections.join('\n\n');
  }
}
