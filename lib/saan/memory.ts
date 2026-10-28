/**
 * Cognitive Memory Engine for Saan (Inspired by Mem0, Letta, Graphiti, Chronicler)
 *
 * Implements:
 * 1. 3-Tier OS Memory Paging (Core, Working, Archival)
 * 2. Bi-Temporal Validity Schema (valid_since <= t < valid_until)
 * 3. Cryptographic Tombstone Enforcement (Zero Resurrection of deleted facts)
 * 4. Associative Task-Memory Bi-directional Linking (A-mem pattern)
 * 5. Crash-Resilient SQLite Lease Locks (Temporal pattern)
 * 6. Stateful Agent Checkpointing (LangGraph pattern)
 */

import { getDb } from "@/lib/db/client";
import {
  recordMemoryTombstone,
  isMemoryTombstoned,
  hashMemoryContent,
} from "@/lib/governance/data-ownership";
import {
  rankMemoriesComposite,
  checkIsFlashbulb,
  FLASHBULB_STABILITY_FLOOR,
  INITIAL_STABILITY,
} from "@/lib/saan/mimir-cognitive";
import {
  evaluateMem0Decision,
  recordMem0AuditEvent,
  createMemoryAuditEvent,
  type MemoryDecision,
  type CandidateFact,
  type ExistingMemoryItem,
} from "@/lib/saan/mem0-decision-matrix";

export interface SaanMemory {
  id: number;
  point: string;
  category: "fact" | "preference" | "promise" | "emotion" | "general";
  confidence: number;
  importance: number;
  createdAt: number;
  validSince: number;
  validUntil: number;
  status: "active" | "superseded" | "deleted";
  sourceType: "explicit_directive" | "implicit" | "inferred";
  tombstoneHash?: string | null;
  // Mimir Cognitive Extensions
  vividness?: number;
  stability?: number;
  isFlashbulb?: boolean;
  isAnchor?: boolean;
  isCherished?: boolean;
  isReframed?: boolean;
  reframeReason?: string | null;
  coActivationCount?: number;
  lastRecalledAt?: number | null;
  emotionPad?: [number, number, number] | null;
  arcPosition?: string | null;
}

export const INFINITE_VALID_UNTIL = 253402300799000; // Year 9999-12-31 in ms

/**
 * Storage is managed deterministically via migration step 0003 in lib/db/migration-manager.ts.
 * Kept as an export for backward compatibility with diary services.
 */
export function ensureSaanStorage(): void {
  // Migrations run automatically on getDb()
}

/**
 * Retrieves active memories at a specific point in time (Bi-Temporal Query)
 * Valid at queryTime if: valid_since <= queryTime AND valid_until > queryTime AND status = 'active'
 * If queryContext is provided, applies Mimir 5-Factor Composite Re-Ranking!
 */
export function getSaanMemories(
  limit = 20,
  queryTime = Date.now(),
  queryContext?: string,
  currentMoodPad?: [number, number, number]
): SaanMemory[] {
  try {
    const db = getDb();
    const fetchLimit = queryContext ? Math.max(limit * 3, 50) : limit;

    const rows = db
      .prepare(`
        SELECT 
          id, 
          point, 
          category, 
          confidence, 
          importance, 
          created_at as createdAt,
          valid_since as validSince,
          valid_until as validUntil,
          status,
          source_type as sourceType,
          tombstone_hash as tombstoneHash,
          vividness,
          stability,
          is_flashbulb as isFlashbulb,
          is_anchor as isAnchor,
          is_cherished as isCherished,
          is_reframed as isReframed,
          reframe_reason as reframeReason,
          co_activation_count as coActivationCount,
          last_recalled_at as lastRecalledAt,
          emotion_pad as emotionPad,
          arc_position as arcPosition
        FROM saan_memories 
        WHERE valid_since <= ? AND valid_until > ? AND status = 'active'
        ORDER BY importance DESC, created_at DESC 
        LIMIT ?
      `)
      .all(queryTime, queryTime, fetchLimit) as any[];

    const mapped: SaanMemory[] = rows.map((r) => ({
      ...r,
      isFlashbulb: Boolean(r.isFlashbulb),
      isAnchor: Boolean(r.isAnchor),
      isCherished: Boolean(r.isCherished),
      isReframed: Boolean(r.isReframed),
      emotionPad: r.emotionPad ? JSON.parse(r.emotionPad) : null,
    }));

    if (queryContext && queryContext.trim().length > 0) {
      const ranked = rankMemoriesComposite(mapped, queryContext, currentMoodPad);
      return ranked.slice(0, limit).map((s) => s.memory);
    }

    return mapped.slice(0, limit);
  } catch (err) {
    console.warn("[SaanMemory] Error retrieving memories:", err);
    return [];
  }
}

/**
 * Historical time-travel query: reconstructs memory state at any historical timestamp
 */
export function getMemoriesAtTimestamp(timestamp: number, limit = 20): SaanMemory[] {
  return getSaanMemories(limit, timestamp);
}

/**
 * Saves a new permanent memory point with strict tombstone enforcement
 * and Mimir flashbulb memory detection.
 */
export function saveSaanMemory(
  point: string,
  category: SaanMemory["category"] = "general",
  importance = 5,
  sourceType: SaanMemory["sourceType"] = "implicit",
  emotionPad?: [number, number, number] | null
): boolean {
  try {
    const db = getDb();
    const trimmed = point.trim();
    if (!trimmed) return false;

    // 1. Strict Cryptographic Tombstone Check (Gate 3 requirement)
    if (isMemoryTombstoned(db, trimmed)) {
      console.warn(`[SaanMemory] Rejected saving tombstoned memory: "${trimmed}"`);
      return false;
    }

    const now = Date.now();

    // 2. Prevent exact duplicate active points
    const existing = db
      .prepare(`
        SELECT id FROM saan_memories 
        WHERE point = ? AND valid_since <= ? AND valid_until > ? AND status = 'active'
      `)
      .get(trimmed, now, now);
    if (existing) return false;

    // 3. Mimir Flashbulb Memory Detection
    const isFlashbulb = checkIsFlashbulb(importance, emotionPad);
    const stability = isFlashbulb ? FLASHBULB_STABILITY_FLOOR : INITIAL_STABILITY;
    const vividness = isFlashbulb ? 1.0 : 1.0;
    const padJson = emotionPad ? JSON.stringify(emotionPad) : null;

    db.prepare(`
      INSERT INTO saan_memories (
        point, 
        category, 
        confidence, 
        importance, 
        created_at, 
        valid_since, 
        valid_until, 
        status, 
        source_type,
        vividness,
        stability,
        is_flashbulb,
        emotion_pad
      ) VALUES (?, ?, 1.0, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
    `).run(
      trimmed,
      category,
      importance,
      now,
      now,
      INFINITE_VALID_UNTIL,
      sourceType,
      vividness,
      stability,
      isFlashbulb ? 1 : 0,
      padJson
    );

    return true;
  } catch (err) {
    console.warn("[SaanMemory] Error saving memory:", err);
    return false;
  }
}

/**
 * Non-destructive memory invalidation & replacement (Graphiti Bi-temporal calculus)
 * Inactive fact has valid_until set to now; new fact inserted with valid_since = now
 */
export function invalidateAndReplaceMemory(
  id: number,
  newPoint: string,
  category: SaanMemory["category"] = "general",
  importance = 5
): boolean {
  try {
    const db = getDb();
    const now = Date.now();

    // Invalidate existing record
    db.prepare(`
      UPDATE saan_memories 
      SET valid_until = ?, status = 'superseded' 
      WHERE id = ? AND status = 'active'
    `).run(now, id);

    // Insert replacement fact
    return saveSaanMemory(newPoint, category, importance, "implicit");
  } catch (err) {
    console.warn("[SaanMemory] Error invalidating memory:", err);
    return false;
  }
}

/**
 * Cryptographically tombstones and deletes a memory (Gate 3 contract)
 * Records SHA-256 hash into memory_tombstones to prevent AI resurrection
 */
export function deleteSaanMemory(id: number): boolean {
  try {
    const db = getDb();
    const row = db.prepare("SELECT point FROM saan_memories WHERE id = ?").get(id) as
      | { point: string }
      | undefined;
    if (!row) return false;

    const now = Date.now();
    const hash = hashMemoryContent(row.point);

    // 1. Record cryptographic tombstone in governance table
    recordMemoryTombstone(db, row.point);

    // 2. Mark memory status as deleted and record tombstone hash
    db.prepare(`
      UPDATE saan_memories 
      SET valid_until = ?, status = 'deleted', tombstone_hash = ? 
      WHERE id = ?
    `).run(now, hash, id);

    return true;
  } catch (err) {
    console.warn("[SaanMemory] Error deleting memory with tombstone:", err);
    return false;
  }
}

/**
 * Associative Task-Memory Linking (A-mem pattern)
 */
export function linkTaskMemory(taskId: number, memoryId: number): void {
  try {
    const db = getDb();
    db.prepare(`
      INSERT OR IGNORE INTO task_memories (task_id, memory_id, created_at)
      VALUES (?, ?, ?)
    `).run(taskId, memoryId, Date.now());
  } catch (err) {
    console.warn("[SaanMemory] Failed to link task memory:", err);
  }
}

export function getTaskMemories(taskId: number): SaanMemory[] {
  try {
    const db = getDb();
    const now = Date.now();
    const rows = db
      .prepare(`
        SELECT 
          m.id, 
          m.point, 
          m.category, 
          m.confidence, 
          m.importance, 
          m.created_at as createdAt,
          m.valid_since as validSince,
          m.valid_until as validUntil,
          m.status,
          m.source_type as sourceType
        FROM saan_memories m
        JOIN task_memories tm ON m.id = tm.memory_id
        WHERE tm.task_id = ? AND m.valid_since <= ? AND m.valid_until > ? AND m.status = 'active'
        ORDER BY m.importance DESC
      `)
      .all(taskId, now, now) as SaanMemory[];
    return rows;
  } catch {
    return [];
  }
}

/**
 * Crash-Resilient SQLite Lease Lock (Temporal pattern)
 * Guarantees only one background pulse daemon executes at a time
 */
export function acquireDaemonLease(leaseName: string, owner: string, ttlMs = 60000): boolean {
  try {
    const db = getDb();
    const now = Date.now();
    const expiresAt = now + ttlMs;

    const res = db.prepare(`
      INSERT INTO saan_daemon_leases (lease_name, lease_owner, lease_expires_at, acquired_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(lease_name) DO UPDATE SET 
        lease_owner = excluded.lease_owner,
        lease_expires_at = excluded.lease_expires_at,
        acquired_at = excluded.acquired_at
      WHERE saan_daemon_leases.lease_expires_at < ? OR saan_daemon_leases.lease_owner = excluded.lease_owner
    `).run(leaseName, owner, expiresAt, now, now);

    return res.changes > 0;
  } catch {
    return false;
  }
}

export function releaseDaemonLease(leaseName: string, owner: string): void {
  try {
    const db = getDb();
    db.prepare(`
      DELETE FROM saan_daemon_leases 
      WHERE lease_name = ? AND lease_owner = ?
    `).run(leaseName, owner);
  } catch {}
}

/**
 * Stateful Agent Checkpointing (LangGraph pattern)
 */
export function saveAgentCheckpoint(sessionId: string, stateBlob: string): string {
  try {
    const db = getDb();
    const id = `chk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    db.prepare(`
      INSERT INTO saan_checkpoints (id, session_id, state_blob, created_at)
      VALUES (?, ?, ?, ?)
    `).run(id, sessionId, stateBlob, Date.now());
    return id;
  } catch {
    return "";
  }
}

export function getLatestCheckpoint(sessionId: string): { id: string; stateBlob: string; createdAt: number } | null {
  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT id, state_blob as stateBlob, created_at as createdAt 
      FROM saan_checkpoints 
      WHERE session_id = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `).get(sessionId) as { id: string; stateBlob: string; createdAt: number } | undefined;
    return row ?? null;
  } catch {
    return null;
  }
}

/**
 * Retrieves current Bond Score (0 to 100) from kv store
 */
export function getBondScore(): number {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM kv WHERE key = 'saan_bond_score'").get() as
      | { value: string }
      | undefined;
    if (row && row.value) {
      const val = parseInt(row.value, 10);
      if (!isNaN(val)) return Math.min(100, Math.max(0, val));
    }
  } catch {}
  return 25; // Default initial bond
}

/**
 * Increments bond score slightly on meaningful interaction
 */
export function bumpBondScore(delta = 1): number {
  try {
    const current = getBondScore();
    const next = Math.min(100, Math.max(0, current + delta));
    const db = getDb();
    db.prepare(
      "INSERT INTO kv (key, value, updated_at) VALUES ('saan_bond_score', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
    ).run(String(next), Date.now());
    return next;
  } catch {
    return 25;
  }
}

/**
 * Intelligent extraction of memories from a user message with Mem0 4-State Decision Matrix
 * Evaluates candidate facts against existing memories: ADD, UPDATE, DELETE, or NONE.
 */
export function extractMemoriesFromTurn(userMessage: string): MemoryDecision[] {
  const text = userMessage.trim();
  const lower = text.toLowerCase();
  const candidates: CandidateFact[] = [];

  // 1. Explicit memory triggers (Memobase pattern)
  const explicitMatches = [
    /(?:ye|yeh|ye baat)\s+(?:yaad rakhna|hamesha yaad rakhna|note kar lo|bhulna mat)/i,
    /(?:remember\s+(?:that|this)|always remember)/i,
  ];

  for (const regex of explicitMatches) {
    if (regex.test(lower)) {
      const cleaned = text
        .replace(/(?:ye|yeh|ye baat)\s+(?:yaad rakhna|hamesha yaad rakhna|note kar lo|bhulna mat)/gi, "")
        .replace(/(?:remember\s+(?:that|this)|always remember)/gi, "")
        .replace(/^[:,\s-]+/, "")
        .trim();
      if (cleaned.length > 5) {
        candidates.push({
          text: cleaned,
          category: "preference",
          sourceRole: "user",
          confidence: 0.95,
        });
      }
    }
  }

  // 2. Name / Identity patterns
  const nameMatch = text.match(/(?:mera naam|my name is|i am|main)\s+([A-Z][a-z]+)/i);
  if (nameMatch && !["Saan", "User", "Ghar", "Theek"].includes(nameMatch[1])) {
    candidates.push({
      text: `User's name is ${nameMatch[1]}`,
      category: "personal",
      sourceRole: "user",
      confidence: 0.98,
    });
  }

  // 3. Exam / Goals mention
  if (/(?:exam|test|interview|target|submission)\s+(?:hai|on|hoga)/i.test(lower)) {
    candidates.push({
      text: `Upcoming deadline/event: "${text.slice(0, 120)}"`,
      category: "plan",
      sourceRole: "user",
      confidence: 0.85,
    });
  }

  // 4. Strong likes/dislikes / preferences
  if (/(?:mujhe|i\s+like|i\s+love)\s+([^,.?!]+?)\s+(?:pasand hai|bahut pasand hai)/i.test(lower)) {
    const likeMatch = text.match(/(?:mujhe|i\s+like|i\s+love)\s+([^,.?!]+?)\s+(?:pasand hai|bahut pasand hai)/i);
    if (likeMatch && likeMatch[1]) {
      candidates.push({
        text: `User likes ${likeMatch[1].trim()}`,
        category: "preference",
        sourceRole: "user",
        confidence: 0.9,
      });
    }
  }

  // 5. Explicit negations / preference changes
  if (/(?:no longer|not anymore|ab se nahi|band kar diya|switched to|instead of)\s+([^,.?!]+)/i.test(lower)) {
    candidates.push({
      text: text,
      category: "preference",
      sourceRole: "user",
      confidence: 0.9,
    });
  }

  if (candidates.length === 0) return [];

  const existingActive = getSaanMemories(50);
  const existingItems: ExistingMemoryItem[] = existingActive.map((m) => ({
    id: String(m.id),
    text: m.point,
    category: m.category,
    sourceRole: m.sourceType,
    updatedAt: m.createdAt,
    isActive: m.status === "active",
  }));

  const decisions: MemoryDecision[] = [];

  for (const candidate of candidates) {
    const decision = evaluateMem0Decision(candidate, existingItems);
    decisions.push(decision);

    const auditId = `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    switch (decision.event) {
      case "ADD": {
        saveSaanMemory(decision.factText, (candidate.category as any) || "general", 7, "implicit");
        recordMem0AuditEvent(createMemoryAuditEvent(auditId, decision.factText, "ADD", "krishna", "saan"));
        break;
      }
      case "UPDATE": {
        if (decision.targetId) {
          invalidateAndReplaceMemory(Number(decision.targetId), decision.factText, (candidate.category as any) || "general");
          recordMem0AuditEvent(createMemoryAuditEvent(auditId, decision.factText, "UPDATE", "krishna", "saan"));
        }
        break;
      }
      case "DELETE": {
        if (decision.targetId) {
          deleteSaanMemory(Number(decision.targetId));
          recordMem0AuditEvent(createMemoryAuditEvent(auditId, decision.factText, "DELETE", "krishna", "saan"));
        }
        break;
      }
      case "NONE": {
        recordMem0AuditEvent(createMemoryAuditEvent(auditId, decision.factText, "NONE", "krishna", "saan"));
        break;
      }
    }
  }

  return decisions;
}
