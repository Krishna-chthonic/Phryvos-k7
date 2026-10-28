/**
 * Temporal Query Engine, Knapsack Fact Budgeting & Causal Linkage
 * Clean-room TypeScript adaptation inspired by vectorize-io/hindsight.
 *
 * Implements:
 * 1. Relative temporal natural language query parser with normalized [00:00:00, 23:59:59] bounding.
 * 2. Causal event dependency tracking (causeMemoryId -> effectMemoryId).
 * 3. Knapsack Fact Budgeting with Top-Rank Floor Rule (Hindsight select_facts_within_budget).
 */

export interface DateBoundingInterval {
  hasConstraint: boolean;
  startTimeMs: number;
  endTimeMs: number;
  matchedPhrase?: string;
}

export interface CausalLink {
  id: string;
  causeMemoryId: string;
  effectMemoryId: string;
  description: string;
  confidence: number;
  createdAt: number;
}

export interface FactSelectionResult {
  selectedIds: string[];
  totalTokens: number;
  truncated: boolean;
  floorApplied: boolean;
}

/**
 * Normalizes start and end of day in UTC / local time.
 */
function createDayBounds(date: Date): { startMs: number; endMs: number } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return { startMs: start.getTime(), endMs: end.getTime() };
}

/**
 * Parses natural language temporal references in a query.
 */
export function parseTemporalQueryBounds(query: string, referenceTime = new Date()): DateBoundingInterval {
  const q = query.toLowerCase();

  // "today"
  if (/\b(today|aaj)\b/i.test(q)) {
    const { startMs, endMs } = createDayBounds(referenceTime);
    return { hasConstraint: true, startTimeMs: startMs, endTimeMs: endMs, matchedPhrase: "today" };
  }

  // "yesterday" / "kal"
  if (/\b(yesterday|kal beeta)\b/i.test(q)) {
    const y = new Date(referenceTime);
    y.setDate(y.getDate() - 1);
    const { startMs, endMs } = createDayBounds(y);
    return { hasConstraint: true, startTimeMs: startMs, endTimeMs: endMs, matchedPhrase: "yesterday" };
  }

  // "last week" / "pichle hafte"
  if (/\b(last week|past week|pichle hafte)\b/i.test(q)) {
    const end = new Date(referenceTime);
    const start = new Date(referenceTime);
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { hasConstraint: true, startTimeMs: start.getTime(), endTimeMs: end.getTime(), matchedPhrase: "last week" };
  }

  // "N days ago" / "N din pehle"
  const daysAgoMatch = q.match(/(\d+)\s*(days?\s*ago|din\s*pehle)/i);
  if (daysAgoMatch) {
    const days = parseInt(daysAgoMatch[1], 10);
    const target = new Date(referenceTime);
    target.setDate(target.getDate() - days);
    const { startMs, endMs } = createDayBounds(target);
    return { hasConstraint: true, startTimeMs: startMs, endTimeMs: endMs, matchedPhrase: `${days} days ago` };
  }

  // "last month" / "pichle mahine"
  if (/\b(last month|past month|pichle mahine)\b/i.test(q)) {
    const end = new Date(referenceTime);
    const start = new Date(referenceTime);
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { hasConstraint: true, startTimeMs: start.getTime(), endTimeMs: end.getTime(), matchedPhrase: "last month" };
  }

  // Default: no temporal constraint
  return {
    hasConstraint: false,
    startTimeMs: 0,
    endTimeMs: Number.MAX_SAFE_INTEGER,
  };
}

/**
 * Hindsight Knapsack Fact Budget Selection with Top-Rank Floor Rule.
 */
export function selectFactsWithinBudget(
  factIdsOrdered: string[],
  textById: Record<string, string>,
  maxTokens: number,
  countTokensFn: (text: string) => number = (t) => Math.ceil(t.length / 4)
): FactSelectionResult {
  if (maxTokens <= 0) {
    return { selectedIds: [], totalTokens: 0, truncated: false, floorApplied: false };
  }

  const selectedIds: string[] = [];
  let totalTokens = 0;
  let skipped = false;

  for (const id of factIdsOrdered) {
    const text = textById[id];
    if (!text) continue;

    const factTokens = countTokensFn(text);
    if (totalTokens + factTokens > maxTokens) {
      skipped = true;
      continue; // Knapsack rule: skips only this fact, does not evict smaller facts behind it
    }

    totalTokens += factTokens;
    selectedIds.push(id);
  }

  let floorApplied = false;
  // Top-Rank Floor Rule:
  // If every candidate was individually over budget, returning empty would read as "no memory".
  // So spend the floor on the top-ranked fact whole and over budget!
  if (selectedIds.length === 0 && skipped && maxTokens > 0) {
    for (const id of factIdsOrdered) {
      const text = textById[id];
      if (text) {
        selectedIds.push(id);
        totalTokens = countTokensFn(text);
        floorApplied = true;
        break;
      }
    }
  }

  return {
    selectedIds,
    totalTokens,
    truncated: skipped,
    floorApplied,
  };
}

export class CausalMemoryRegistry {
  private links: CausalLink[] = [];

  public addCausalLink(causeMemoryId: string, effectMemoryId: string, description: string, confidence = 0.9): CausalLink {
    const link: CausalLink = {
      id: `causal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      causeMemoryId,
      effectMemoryId,
      description,
      confidence,
      createdAt: Date.now(),
    };
    this.links.push(link);
    return link;
  }

  public getCausesFor(effectMemoryId: string): CausalLink[] {
    return this.links.filter((l) => l.effectMemoryId === effectMemoryId);
  }

  public getEffectsOf(causeMemoryId: string): CausalLink[] {
    return this.links.filter((l) => l.causeMemoryId === causeMemoryId);
  }

  public getAllLinks(): CausalLink[] {
    return [...this.links];
  }
}

// Global Singleton for Saan
let globalCausalRegistryInstance: CausalMemoryRegistry | null = null;

export function getCausalMemoryRegistry(): CausalMemoryRegistry {
  if (!globalCausalRegistryInstance) {
    globalCausalRegistryInstance = new CausalMemoryRegistry();
  }
  return globalCausalRegistryInstance;
}
