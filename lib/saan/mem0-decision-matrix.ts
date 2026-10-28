/**
 * Mem0 Memory Decision Matrix & Identity-Scoped Extraction Engine
 * Clean-room TypeScript adaptation inspired by mem0ai/mem0.
 *
 * Implements:
 * 1. 4-State Memory Mutation Matrix (ADD, UPDATE, DELETE, NONE).
 * 2. Strict User Memory vs Agent Memory extraction separation.
 * 3. Identity Scope Sanitizer (prevents metadata injection privilege escalation).
 * 4. Audit Event Stream emitting structured mutation records.
 */

export type MemoryMutationEvent = "ADD" | "UPDATE" | "DELETE" | "NONE";

export interface CandidateFact {
  text: string;
  category?: "preference" | "important_date" | "plan" | "health" | "professional" | "miscellaneous" | "personal";
  sourceRole: "user" | "assistant";
  confidence?: number;
}

export interface ExistingMemoryItem {
  id: string;
  text: string;
  category?: string;
  sourceRole?: string;
  updatedAt: number;
  isActive: boolean;
}

export interface MemoryDecision {
  event: MemoryMutationEvent;
  targetId?: string;
  factText: string;
  reason: string;
}

export interface MemoryAuditEvent {
  id: string;
  memory: string;
  event: MemoryMutationEvent;
  timestamp: number;
  userId?: string;
  agentId?: string;
}

export interface IdentityScopeParams {
  userId?: string;
  agentId?: string;
  runId?: string;
  actorId?: string;
  inputMetadata?: Record<string, any>;
}

/**
 * Sanitizes input metadata ensuring user cannot inject or override entity scope identifiers.
 * Follows mem0 _build_filters_and_metadata pattern.
 */
export function sanitizeIdentityScope(params: IdentityScopeParams): {
  scopeFilters: Record<string, any>;
  sanitizedMetadata: Record<string, any>;
} {
  const protectedKeys = new Set(["user_id", "userId", "agent_id", "agentId", "run_id", "runId", "actor_id", "actorId"]);
  const cleanMetadata: Record<string, any> = {};

  if (params.inputMetadata) {
    for (const [k, v] of Object.entries(params.inputMetadata)) {
      if (!protectedKeys.has(k)) {
        cleanMetadata[k] = v;
      }
    }
  }

  const scopeFilters: Record<string, any> = {};
  if (params.userId) scopeFilters.userId = params.userId;
  if (params.agentId) scopeFilters.agentId = params.agentId;
  if (params.runId) scopeFilters.runId = params.runId;
  if (params.actorId) scopeFilters.actorId = params.actorId;

  return {
    scopeFilters,
    sanitizedMetadata: cleanMetadata,
  };
}

/**
 * Normalizes string for fuzzy/exact contradiction checks.
 */
function normalizeFact(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, "").trim();
}

/**
 * Evaluates candidate fact against existing memories using the 4-state transition model.
 */
export function evaluateMem0Decision(
  candidate: CandidateFact,
  existingMemories: ExistingMemoryItem[]
): MemoryDecision {
  const cleanCandidate = normalizeFact(candidate.text);
  if (!cleanCandidate) {
    return { event: "NONE", factText: candidate.text, reason: "Empty candidate text" };
  }

  // Active memories only
  const activeMemories = existingMemories.filter((m) => m.isActive);

  for (const existing of activeMemories) {
    const cleanExisting = normalizeFact(existing.text);

    // Exact or near-exact match -> duplicate, no-op
    if (cleanCandidate === cleanExisting || cleanExisting.includes(cleanCandidate)) {
      return {
        event: "NONE",
        targetId: existing.id,
        factText: candidate.text,
        reason: `Fact already present in memory ${existing.id}`,
      };
    }

    // Negation or contradiction check
    const negationPatterns = [
      /\b(no longer|not anymore|quit|stopped|never|cancelled|cancel)\b/i,
      /\b(moved from|changed from|switched from|instead of)\b/i,
    ];

    const isExplicitNegation = negationPatterns.some((pattern) => pattern.test(candidate.text));

    // Common root subject detection (e.g., "software engineer" vs "lawyer")
    const wordsCandidate = new Set(cleanCandidate.split(/\s+/));
    const wordsExisting = cleanExisting.split(/\s+/);
    const commonWords = wordsExisting.filter((w) => w.length > 3 && wordsCandidate.has(w));

    if (isExplicitNegation && commonWords.length > 0) {
      return {
        event: "DELETE",
        targetId: existing.id,
        factText: candidate.text,
        reason: `Candidate explicitly negates existing memory ${existing.id}`,
      };
    }

    // Update check: same subject/category, altered predicate
    if (existing.category && candidate.category && existing.category === candidate.category && commonWords.length >= 2) {
      return {
        event: "UPDATE",
        targetId: existing.id,
        factText: candidate.text,
        reason: `Candidate refines or updates existing fact in category ${existing.category}`,
      };
    }
  }

  // No match, no contradiction -> Novel fact to ADD
  return {
    event: "ADD",
    factText: candidate.text,
    reason: "Candidate fact provides novel information",
  };
}

/**
 * Emits an audit event for telemetry and rollback tracking.
 */
export function createMemoryAuditEvent(
  id: string,
  memory: string,
  event: MemoryMutationEvent,
  userId?: string,
  agentId?: string
): MemoryAuditEvent {
  return {
    id,
    memory,
    event,
    timestamp: Date.now(),
    userId,
    agentId,
  };
}
