/**
 * Temporal Query Engine, Knapsack Fact Budgeting & Causal Linkage
 * Clean-room TypeScript adaptation inspired by vectorize-io/hindsight.
 *
 * Implements:
 * 1. Relative temporal natural language query parser with normalized [00:00:00, 23:59:59] bounding.
 * 2. Causal event dependency tracking (causeMemoryId -> effectMemoryId).
 * 3. Knapsack Fact Budgeting with Top-Rank Floor Rule (Hindsight select_facts_within_budget).
 * 4. Multi-category token capacity analysis.
 */

import { getSaanMemories, SaanMemory } from "./memory";

export interface DateBoundingInterval {
  hasConstraint: boolean;
  startTimeMs: number;
  endTimeMs: number;
  matchedPhrase?: string;
  isoStart?: string;
  isoEnd?: string;
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

export interface KnapsackCategoryBreakdown {
  category: string;
  count: number;
  tokens: number;
  percentage: number;
  color: string;
}

export interface KnapsackBudgetReport {
  budgetCapTokens: number;
  usedTokens: number;
  remainingTokens: number;
  utilizationPct: number;
  floorRuleActive: boolean;
  categories: KnapsackCategoryBreakdown[];
  selectedMemoryCount: number;
  totalAvailableCount: number;
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

  // "today" / "aaj"
  if (/\b(today|aaj)\b/i.test(q)) {
    const { startMs, endMs } = createDayBounds(referenceTime);
    return {
      hasConstraint: true,
      startTimeMs: startMs,
      endTimeMs: endMs,
      matchedPhrase: "today",
      isoStart: new Date(startMs).toISOString(),
      isoEnd: new Date(endMs).toISOString(),
    };
  }

  // "yesterday" / "kal"
  if (/\b(yesterday|kal beeta)\b/i.test(q)) {
    const y = new Date(referenceTime);
    y.setDate(y.getDate() - 1);
    const { startMs, endMs } = createDayBounds(y);
    return {
      hasConstraint: true,
      startTimeMs: startMs,
      endTimeMs: endMs,
      matchedPhrase: "yesterday",
      isoStart: new Date(startMs).toISOString(),
      isoEnd: new Date(endMs).toISOString(),
    };
  }

  // "last week" / "pichle hafte"
  if (/\b(last week|past week|pichle hafte)\b/i.test(q)) {
    const end = new Date(referenceTime);
    const start = new Date(referenceTime);
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return {
      hasConstraint: true,
      startTimeMs: start.getTime(),
      endTimeMs: end.getTime(),
      matchedPhrase: "last week",
      isoStart: start.toISOString(),
      isoEnd: end.toISOString(),
    };
  }

  // "N days ago" / "N din pehle"
  const daysAgoMatch = q.match(/(\d+)\s*(days?\s*ago|din\s*pehle)/i);
  if (daysAgoMatch) {
    const days = parseInt(daysAgoMatch[1], 10);
    const target = new Date(referenceTime);
    target.setDate(target.getDate() - days);
    const { startMs, endMs } = createDayBounds(target);
    return {
      hasConstraint: true,
      startTimeMs: startMs,
      endTimeMs: endMs,
      matchedPhrase: `${days} days ago`,
      isoStart: new Date(startMs).toISOString(),
      isoEnd: new Date(endMs).toISOString(),
    };
  }

  // "last month" / "pichle mahine"
  if (/\b(last month|past month|pichle mahine)\b/i.test(q)) {
    const end = new Date(referenceTime);
    const start = new Date(referenceTime);
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return {
      hasConstraint: true,
      startTimeMs: start.getTime(),
      endTimeMs: end.getTime(),
      matchedPhrase: "last month",
      isoStart: start.toISOString(),
      isoEnd: end.toISOString(),
    };
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

/**
 * Computes a Knapsack Budget Allocation Report from active companion memories.
 */
export function generateKnapsackBudgetReport(budgetCap = 1200): KnapsackBudgetReport {
  let memories: SaanMemory[] = [];
  try {
    memories = getSaanMemories(60);
  } catch {
    memories = [];
  }

  const categoryMap: Record<string, { count: number; tokens: number; color: string }> = {
    preference: { count: 0, tokens: 0, color: "#10b981" }, // Emerald
    plan: { count: 0, tokens: 0, color: "#f59e0b" },       // Amber
    fact: { count: 0, tokens: 0, color: "#06b6d4" },       // Cyan
    promise: { count: 0, tokens: 0, color: "#a855f7" },    // Purple
    general: { count: 0, tokens: 0, color: "#64748b" },    // Slate
  };

  const textById: Record<string, string> = {};
  const orderedIds: string[] = [];

  for (const mem of memories) {
    const id = String(mem.id);
    textById[id] = mem.point;
    orderedIds.push(id);

    const cat = categoryMap[mem.category] ? mem.category : "general";
    const tok = Math.ceil(mem.point.length / 4);
    categoryMap[cat].count++;
    categoryMap[cat].tokens += tok;
  }

  const knapsackRes = selectFactsWithinBudget(orderedIds, textById, budgetCap);
  const totalTokens = knapsackRes.totalTokens;
  const remaining = Math.max(0, budgetCap - totalTokens);
  const utilization = Math.min(100, Math.round((totalTokens / budgetCap) * 100));

  const categories: KnapsackCategoryBreakdown[] = Object.entries(categoryMap).map(([cat, data]) => ({
    category: cat.toUpperCase(),
    count: data.count,
    tokens: data.tokens,
    percentage: totalTokens > 0 ? Math.round((data.tokens / totalTokens) * 100) : 0,
    color: data.color,
  }));

  return {
    budgetCapTokens: budgetCap,
    usedTokens: totalTokens,
    remainingTokens: remaining,
    utilizationPct: utilization,
    floorRuleActive: knapsackRes.floorApplied,
    categories,
    selectedMemoryCount: knapsackRes.selectedIds.length,
    totalAvailableCount: memories.length,
  };
}

export class CausalMemoryRegistry {
  private links: CausalLink[] = [];

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults(): void {
    const now = Date.now();
    this.links = [
      {
        id: "causal_001",
        causeMemoryId: "mem_chai_morning",
        effectMemoryId: "mem_morning_energy",
        description: "Drinking ginger chai in morning causes heightened focus and cheerful mood",
        confidence: 0.95,
        createdAt: now - 86400000 * 2,
      },
      {
        id: "causal_002",
        causeMemoryId: "mem_late_screen",
        effectMemoryId: "mem_drowsy_morning",
        description: "Coding past 2 AM induces morning fatigue and delayed start",
        confidence: 0.92,
        createdAt: now - 86400000,
      },
      {
        id: "causal_003",
        causeMemoryId: "mem_deep_focus_pomodoro",
        effectMemoryId: "mem_daily_milestone_done",
        description: "Uninterrupted deep work sprint leads to milestone completion",
        confidence: 0.97,
        createdAt: now - 43200000,
      },
    ];
  }

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
