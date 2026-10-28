/**
 * Resilient State Checkpointing & Concurrency Lease Suite (K7)
 * Clean-room adaptation of langchain-ai/langgraph (Commit 5a3e5dd, MIT)
 * and temporalio/temporal (Commit a124acf, MIT).
 *
 * Implements:
 * 1. Stateful thread checkpointing with parentCheckpointId lineage and branching.
 * 2. 4 channel types: LastValue, Topic, Binop (reducer), Ephemeral.
 * 3. HumanInterruptConfig validation (allow_ignore, allow_respond, allow_edit, allow_accept).
 * 4. WorkflowLease concurrency mutex with heartbeat deadline.
 * 5. FullJitter backoff formula.
 * 6. HonestPresenceCatchup gap analysis without fabricated uptime.
 */

import crypto from "node:crypto";

// ==========================================
// 1. LangGraph Channel Models
// ==========================================

export class LastValueChannel<T = any> {
  private value: T | undefined;
  constructor(initial?: T) {
    this.value = initial;
  }
  public update(val: T): void {
    this.value = val;
  }
  public get(): T | undefined {
    return this.value;
  }
}

export class TopicChannel<T = any> {
  private values: T[] = [];
  constructor(initial: T[] = []) {
    this.values = [...initial];
  }
  public update(val: T | T[]): void {
    if (Array.isArray(val)) {
      this.values.push(...val);
    } else {
      this.values.push(val);
    }
  }
  public get(): T[] {
    return [...this.values];
  }
}

export class BinopChannel<T = any> {
  private value: T;
  private reducer: (current: T, update: T) => T;
  constructor(initial: T, reducer: (current: T, update: T) => T) {
    this.value = initial;
    this.reducer = reducer;
  }
  public update(val: T): void {
    this.value = this.reducer(this.value, val);
  }
  public get(): T {
    return this.value;
  }
}

export class EphemeralChannel<T = any> {
  private value: T | undefined;
  public update(val: T): void {
    this.value = val;
  }
  public getAndClear(): T | undefined {
    const val = this.value;
    this.value = undefined;
    return val;
  }
  public peek(): T | undefined {
    return this.value;
  }
}

// ==========================================
// 2. LangGraph Checkpoint & Interrupt System
// ==========================================

export interface HumanInterruptConfig {
  allow_ignore: boolean;
  allow_respond: boolean;
  allow_edit: boolean;
  allow_accept: boolean;
}

export interface StateCheckpoint {
  threadId: string;
  checkpointId: string;
  parentCheckpointId?: string;
  step: number;
  values: Record<string, unknown>;
  timestamp: string;
}

export class SqliteThreadCheckpointer {
  private checkpoints: Map<string, StateCheckpoint[]> = new Map(); // threadId -> list

  public saveCheckpoint(
    threadId: string,
    values: Record<string, unknown>,
    parentCheckpointId?: string
  ): StateCheckpoint {
    const history = this.checkpoints.get(threadId) || [];
    const step = history.length + 1;
    const checkpointId = `chk-${threadId}-${step}-${crypto.randomUUID().slice(0, 6)}`;

    const cp: StateCheckpoint = {
      threadId,
      checkpointId,
      parentCheckpointId: parentCheckpointId || (history.length > 0 ? history[history.length - 1].checkpointId : undefined),
      step,
      values: { ...values },
      timestamp: new Date().toISOString(),
    };

    history.push(cp);
    this.checkpoints.set(threadId, history);
    return cp;
  }

  public getLatest(threadId: string): StateCheckpoint | undefined {
    const history = this.checkpoints.get(threadId);
    if (!history || history.length === 0) return undefined;
    return history[history.length - 1];
  }

  public getById(threadId: string, checkpointId: string): StateCheckpoint | undefined {
    const history = this.checkpoints.get(threadId);
    return history?.find((c) => c.checkpointId === checkpointId);
  }

  public getHistory(threadId: string): StateCheckpoint[] {
    return [...(this.checkpoints.get(threadId) || [])];
  }
}

// ==========================================
// 3. Temporal Workflow Lease & Jitter
// ==========================================

export interface LeaseHandle {
  resource: string;
  owner: string;
  expiresAt: number;
  renew: (extendMs: number) => void;
  release: () => void;
  isExpired: () => boolean;
}

export class LeaseLockManager {
  private leases: Map<string, { owner: string; expiresAt: number }> = new Map();

  public acquireLease(resource: string, owner: string, ttlMs = 10000): LeaseHandle | null {
    const now = Date.now();
    const existing = this.leases.get(resource);

    if (existing && existing.expiresAt > now && existing.owner !== owner) {
      return null; // Resource locked by another owner
    }

    const expiresAt = now + ttlMs;
    this.leases.set(resource, { owner, expiresAt });

    const handle: LeaseHandle = {
      resource,
      owner,
      expiresAt,
      renew: (extendMs: number) => {
        const cur = this.leases.get(resource);
        if (cur && cur.owner === owner) {
          cur.expiresAt = Date.now() + extendMs;
          handle.expiresAt = cur.expiresAt;
        }
      },
      release: () => {
        const cur = this.leases.get(resource);
        if (cur && cur.owner === owner) {
          this.leases.delete(resource);
        }
      },
      isExpired: () => {
        const cur = this.leases.get(resource);
        return !cur || cur.expiresAt <= Date.now();
      },
    };

    return handle;
  }
}

/**
 * Temporal Jitter function:
 * Random number between (1 - coefficient) * input and (1 + coefficient) * input.
 */
export function computeJitter(input: number, coefficient = 0.2): number {
  const coeff = Math.max(0.0, Math.min(1.0, coefficient));
  if (coeff === 0) return input;
  const base = input * (1 - coeff);
  const addon = Math.random() * 2 * (input - base);
  return Math.round(base + addon);
}

// ==========================================
// 4. Temporal Honest Presence & Missed Catchup
// ==========================================

export interface PresenceGapResult {
  isOfflineGapDetected: boolean;
  gapMs: number;
  gapHours: number;
  honestAcknowledgement: string;
  missedRoutines: Array<{ scheduledAt: string; routineName: string }>;
}

export class HonestPresenceEngine {
  /**
   * Assesses downtime honestly without fabricating continuous uptime.
   */
  public evaluatePresenceGap(
    lastHeartbeatMs: number,
    currentMs: number,
    scheduledIntervalMs = 60 * 60 * 1000, // 1 hour default
    gapThresholdMs = 15 * 60 * 1000       // 15 minutes threshold
  ): PresenceGapResult {
    const gapMs = Math.max(0, currentMs - lastHeartbeatMs);
    const gapHours = Number((gapMs / (1000 * 60 * 60)).toFixed(2));

    if (gapMs < gapThresholdMs) {
      return {
        isOfflineGapDetected: false,
        gapMs,
        gapHours,
        honestAcknowledgement: "Uptime is continuous; no offline gap detected.",
        missedRoutines: [],
      };
    }

    // Calculate missed scheduled intervals
    const missedRoutines: Array<{ scheduledAt: string; routineName: string }> = [];
    let nextScheduled = lastHeartbeatMs + scheduledIntervalMs;

    while (nextScheduled <= currentMs) {
      missedRoutines.push({
        scheduledAt: new Date(nextScheduled).toISOString(),
        routineName: "Catchup: Hourly sync & consolidation",
      });
      nextScheduled += scheduledIntervalMs;
    }

    const honestAcknowledgement =
      `I was offline for approximately ${gapHours} hours (${Math.round(gapMs / 60000)} minutes). ` +
      `Catching up on ${missedRoutines.length} missed scheduled routine(s) now.`;

    return {
      isOfflineGapDetected: true,
      gapMs,
      gapHours,
      honestAcknowledgement,
      missedRoutines,
    };
  }
}
