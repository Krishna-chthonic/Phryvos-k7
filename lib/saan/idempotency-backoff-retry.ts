/**
 * Idempotency, Clamped Backoff & Dead-Letter Retry Suite (K7)
 * Clean-room adaptation of n8n-io/n8n architecture (Commit 80867e64, Fair-Code Clean-Room).
 *
 * Implements:
 * 1. 12-hour TTL IdempotencyStore with SHA-256 payload fingerprinting.
 * 2. Clamped exponential backoff preventing inverted min/max misconfiguration.
 * 3. Dead-letter queue for resilient asynchronous execution retries.
 */

import crypto from "node:crypto";

export const IDEMPOTENCY_KEY_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export interface IdempotencyRecord {
  userId: string;
  idempotencyKey: string;
  fingerprint: string;
  status: "processing" | "completed";
  responseStatus?: number;
  responseBody?: unknown;
  createdAt: number;
  expiresAt: number;
}

export interface DeadLetterItem {
  id: string;
  jobId: string;
  error: string;
  payload: unknown;
  attempts: number;
  timestamp: string;
}

/**
 * Clamped Exponential Backoff adapted from n8n packages/@n8n/db/src/connection/backoff.ts:
 * Ramps from minMs with base 2, clamped so ceiling never falls below minMs.
 */
export function computeBackoff(attempt: number, minMs: number, maxMs: number): number {
  const safeAttempt = Math.max(1, attempt);
  const ceiling = Math.max(minMs, maxMs);
  return Math.min(minMs * 2 ** (safeAttempt - 1), ceiling);
}

export class IdempotencyBackoffEngine {
  private store: Map<string, IdempotencyRecord> = new Map(); // key = `${userId}:${idempotencyKey}`
  private deadLetters: DeadLetterItem[] = [];

  /**
   * Computes deterministic SHA-256 fingerprint for arbitrary payload.
   */
  public computeFingerprint(payload: unknown): string {
    const serialized = typeof payload === "string" ? payload : JSON.stringify(payload || {});
    return crypto.createHash("sha256").update(serialized).digest("hex");
  }

  /**
   * Checks or acquires idempotency lock.
   * - "cached": Already completed with same fingerprint; returns stored response.
   * - "acquired": First attempt; caller can proceed.
   * - "conflict": Currently processing or fingerprint mismatch.
   */
  public checkOrAcquire(
    userId: string,
    idempotencyKey: string,
    payload: unknown
  ): { status: "cached" | "acquired" | "conflict"; record?: IdempotencyRecord } {
    const key = `${userId}:${idempotencyKey}`;
    const fingerprint = this.computeFingerprint(payload);
    const now = Date.now();

    const existing = this.store.get(key);

    if (existing) {
      // Check expiration
      if (now > existing.expiresAt) {
        this.store.delete(key);
      } else {
        if (existing.fingerprint !== fingerprint) {
          return { status: "conflict", record: existing };
        }
        if (existing.status === "completed") {
          return { status: "cached", record: existing };
        }
        // Still processing
        return { status: "conflict", record: existing };
      }
    }

    // Acquire lock
    const newRecord: IdempotencyRecord = {
      userId,
      idempotencyKey,
      fingerprint,
      status: "processing",
      createdAt: now,
      expiresAt: now + IDEMPOTENCY_KEY_TTL_MS,
    };
    this.store.set(key, newRecord);

    return { status: "acquired", record: newRecord };
  }

  /**
   * Finalizes an idempotency transaction with status and response payload.
   */
  public complete(
    userId: string,
    idempotencyKey: string,
    responseStatus: number,
    responseBody: unknown
  ): void {
    const key = `${userId}:${idempotencyKey}`;
    const record = this.store.get(key);
    if (!record) {
      throw new Error(`Cannot complete nonexistent idempotency key: ${key}`);
    }

    record.status = "completed";
    record.responseStatus = responseStatus;
    record.responseBody = responseBody;
  }

  /**
   * Records a failed job in the dead-letter error queue.
   */
  public recordDeadLetter(jobId: string, error: string, payload: unknown, attempts: number): DeadLetterItem {
    const item: DeadLetterItem = {
      id: `dlq-${crypto.randomUUID().slice(0, 8)}`,
      jobId,
      error,
      payload,
      attempts,
      timestamp: new Date().toISOString(),
    };
    this.deadLetters.push(item);
    return item;
  }

  public getDeadLetters(): DeadLetterItem[] {
    return [...this.deadLetters];
  }

  public clear(): void {
    this.store.clear();
    this.deadLetters = [];
  }
}
