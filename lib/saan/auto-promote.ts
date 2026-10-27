/**
 * Saan Memory Auto-Promotion Policy (Adapted from Chronicler src/lib/orchestrator/auto-promote.ts)
 *
 * Implements the sink-risk safeguard: heuristic observations → permanent canon.
 * Inferred observations are NEVER promoted immediately. They must satisfy:
 * 1. Reinforcement count >= 3
 * 2. Distinct sessions >= 2
 * 3. Time span <= 14 days
 * 4. Zero user retcons or corrections in the window
 */

import { getDb } from "@/lib/db/client";

export interface PromotionPolicy {
  minReinforcements: number;
  minUniqueSessions: number;
  maxDaysSpan: number;
}

export const DEFAULT_PROMOTION_POLICY: PromotionPolicy = {
  minReinforcements: 3,
  minUniqueSessions: 2,
  maxDaysSpan: 14,
};

export interface ReinforcementState {
  memoryId: number;
  reinforcementCount: number;
  sessions: string[];
  firstReinforcedAt: number;
  lastReinforcedAt: number;
  isPromoted: boolean;
}

/**
 * Pure evaluation function: determines if a memory crosses promotion threshold
 */
export function shouldPromote(
  state: {
    reinforcementCount: number;
    sessions: string[];
    firstReinforcedAt?: number;
    lastReinforcedAt?: number;
  },
  policy: PromotionPolicy = DEFAULT_PROMOTION_POLICY,
  hasRetconOrCorrection = false
): boolean {
  if (hasRetconOrCorrection) return false;
  if (state.reinforcementCount < policy.minReinforcements) return false;

  const uniqSessions = new Set(state.sessions);
  if (uniqSessions.size < policy.minUniqueSessions) return false;

  if (state.firstReinforcedAt && state.lastReinforcedAt) {
    const days = (state.lastReinforcedAt - state.firstReinforcedAt) / 86400000;
    if (days > policy.maxDaysSpan) return false;
  }

  return true;
}

/**
 * Records a reinforcement occurrence for a memory point in SQLite
 */
export function reinforceMemory(
  memoryId: number,
  sessionId: string,
  now = Date.now()
): ReinforcementState {
  const db = getDb();

  const existing = db.prepare(`
    SELECT memory_id as memoryId, reinforcement_count as reinforcementCount, sessions, first_reinforced_at as firstReinforcedAt, last_reinforced_at as lastReinforcedAt, is_promoted as isPromoted
    FROM saan_memory_reinforcements
    WHERE memory_id = ?
  `).get(memoryId) as any;

  let count = 1;
  let sessions = [sessionId];
  let first = now;
  let isPromoted = false;

  if (existing) {
    count = existing.reinforcementCount + 1;
    const oldSessions: string[] = JSON.parse(existing.sessions || "[]");
    if (!oldSessions.includes(sessionId)) {
      oldSessions.push(sessionId);
    }
    sessions = oldSessions;
    first = existing.firstReinforcedAt;
    isPromoted = Boolean(existing.isPromoted);
  }

  // Check if eligible for promotion
  if (!isPromoted && shouldPromote({ reinforcementCount: count, sessions, firstReinforcedAt: first, lastReinforcedAt: now })) {
    isPromoted = true;
    // Upgrade memory category / importance in saan_memories if active
    db.prepare("UPDATE saan_memories SET confidence = 1.0, importance = MAX(importance, 8) WHERE id = ?").run(memoryId);
  }

  db.prepare(`
    INSERT INTO saan_memory_reinforcements (
      memory_id, reinforcement_count, sessions, first_reinforced_at, last_reinforced_at, is_promoted
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(memory_id) DO UPDATE SET
      reinforcement_count = excluded.reinforcement_count,
      sessions = excluded.sessions,
      last_reinforced_at = excluded.last_reinforced_at,
      is_promoted = excluded.is_promoted
  `).run(memoryId, count, JSON.stringify(sessions), first, now, isPromoted ? 1 : 0);

  return {
    memoryId,
    reinforcementCount: count,
    sessions,
    firstReinforcedAt: first,
    lastReinforcedAt: now,
    isPromoted,
  };
}
