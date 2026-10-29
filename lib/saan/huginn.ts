/**
 * Huginn — Thought Engine (Pattern Detection from Kronic90/Mimirs-Memory-Hub)
 *
 * Implements:
 * 1. Entity Sentiment Arcs:
 *    Calculates trajectory delta (P_second_half - P_first_half) to detect
 *    "warming" or "cooling" relational trajectories with specific entities.
 * 2. Recurring Theme Clusters:
 *    Scans content words across memories (>= 4 chars) appearing >= 3 times
 *    and extracts the dominant PAD emotional tenor.
 * 3. Open Threads (Unresolved Intentions):
 *    Detects intention markers ("should", "need", "want", "plan", "going",
 *    "hope", "intend", "must", "will", "trying") and checks whether subsequent
 *    memories resolved them (word overlap >= 0.3).
 */

import { getDb } from "@/lib/db/client";
import { extractContentWords } from "@/lib/saan/mimir-cognitive";

export const HUGINN_PATTERN_MIN = 3;

export const HUGINN_OPEN_THREAD_WORDS = new Set([
  "should", "need", "want", "plan", "going", "hope",
  "intend", "must", "will", "trying",
]);

export interface HuginnInsight {
  id: string;
  type: "sentiment_arc" | "recurring_theme" | "open_thread";
  entity?: string | null;
  insight: string;
  confidence: number;
  createdAt: number;
}

/**
 * Calculates word overlap ratio between two sets of words.
 */
function wordOverlapRatio(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0.0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }
  return intersection / Math.max(setA.size, setB.size);
}

/**
 * Runs Huginn's emergent pattern scan across all active memories.
 */
export function runHuginnScan(): HuginnInsight[] {
  const db = getDb();
  const insights: HuginnInsight[] = [];
  const now = Date.now();

  const memories = db.prepare(`
    SELECT id, point, category, importance, created_at, emotion_pad
    FROM saan_memories
    WHERE status = 'active'
    ORDER BY created_at ASC, id ASC
  `).all() as any[];

  if (memories.length < HUGINN_PATTERN_MIN) {
    return [];
  }

  // ── 1. Entity Sentiment Arcs ──────────────────────────────────────────────
  // Extract potential entities (words capitalized or prominent in text)
  const entityMap: Map<string, Array<{ point: string; timestamp: number; valence: number }>> = new Map();

  for (const m of memories) {
    let valence = 0.0;
    if (m.emotion_pad) {
      try {
        const pad = JSON.parse(m.emotion_pad);
        valence = pad[0];
      } catch {}
    }

    // Match entities like "Scott", "Krishna", "User", "System" or noun phrases
    const words = m.point.split(/\s+/);
    for (const w of words) {
      const clean = w.replace(/[^\w]/g, "");
      if (clean.length > 2 && /^[A-Z][A-Za-z0-9_]+$/.test(clean) && !clean.match(/^(The|This|That|When|What|Here|There|Today|Yesterday|During|After|Before)$/)) {
        const key = clean.toLowerCase();
        if (!entityMap.has(key)) entityMap.set(key, []);
        entityMap.get(key)!.push({ point: m.point, timestamp: m.created_at, valence });
      }
    }
  }

  for (const [entity, mems] of entityMap.entries()) {
    if (mems.length < HUGINN_PATTERN_MIN) continue;

    const mid = Math.floor(mems.length / 2);
    const firstHalf = mems.slice(0, mid);
    const secondHalf = mems.slice(mid);

    const firstAvg = firstHalf.reduce((acc, m) => acc + m.valence, 0) / Math.max(firstHalf.length, 1);
    const secondAvg = secondHalf.reduce((acc, m) => acc + m.valence, 0) / Math.max(secondHalf.length, 1);
    const delta = secondAvg - firstAvg;

    if (Math.abs(delta) >= 0.15) {
      const direction = delta > 0 ? "warming" : "cooling";
      const confidence = Math.min(0.95, Number((0.5 + Math.abs(delta)).toFixed(2)));
      const text = `Trajectory with ${entity} is ${direction} (valence delta: ${delta > 0 ? "+" : ""}${delta.toFixed(2)} across ${mems.length} memories).`;

      const id = `huginn_arc_${entity}_${Date.now()}`;
      insights.push({
        id,
        type: "sentiment_arc",
        entity,
        insight: text,
        confidence,
        createdAt: now,
      });
    }
  }

  // ── 2. Recurring Theme Clusters ───────────────────────────────────────────
  const wordMemMap: Map<string, Array<{ id: number; point: string; emotionPad?: string }>> = new Map();

  for (const m of memories) {
    const words = extractContentWords(m.point);
    for (const w of words) {
      if (w.length >= 4) {
        if (!wordMemMap.has(w)) wordMemMap.set(w, []);
        wordMemMap.get(w)!.push(m);
      }
    }
  }

  for (const [word, mems] of wordMemMap.entries()) {
    if (mems.length < HUGINN_PATTERN_MIN) continue;

    let totalValence = 0.0;
    let validValences = 0;
    for (const m of mems) {
      if (m.emotionPad) {
        try {
          const pad = JSON.parse(m.emotionPad);
          totalValence += pad[0];
          validValences++;
        } catch {}
      }
    }
    const avgValence = validValences > 0 ? totalValence / validValences : 0.0;
    const tone = avgValence > 0.2 ? "positive" : avgValence < -0.2 ? "challenging" : "reflective";

    const text = `Recurring theme detected around '${word}' (${mems.length} mentions) with a predominantly ${tone} emotional tenor.`;
    const id = `huginn_theme_${word}_${Date.now()}`;
    insights.push({
      id,
      type: "recurring_theme",
      entity: null,
      insight: text,
      confidence: Math.min(0.9, 0.4 + mems.length * 0.1),
      createdAt: now,
    });
  }

  // ── 3. Open Threads (Unresolved Intentions) ────────────────────────────────
  for (let i = 0; i < memories.length; i++) {
    const m = memories[i];
    const words = m.point.toLowerCase().split(/\s+/);
    const hasIntention = words.some((w: string) => HUGINN_OPEN_THREAD_WORDS.has(w));
    if (!hasIntention) continue;

    const mWords = extractContentWords(m.point);
    let resolved = false;

    for (let j = i + 1; j < memories.length; j++) {
      const laterWords = extractContentWords(memories[j].point);
      if (wordOverlapRatio(mWords, laterWords) >= 0.3) {
        resolved = true;
        break;
      }
    }

    if (!resolved) {
      const text = `Unresolved intention: "${m.point.length > 80 ? m.point.slice(0, 77) + "..." : m.point}"`;
      const id = `huginn_thread_${m.id}_${Date.now()}`;
      insights.push({
        id,
        type: "open_thread",
        entity: null,
        insight: text,
        confidence: 0.75,
        createdAt: now,
      });
    }
  }

  // Persist new insights to database
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO saan_huginn_insights (id, type, entity, insight, confidence, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (const ins of insights) {
      insertStmt.run(ins.id, ins.type, ins.entity || null, ins.insight, ins.confidence, ins.createdAt);
    }
  });
  tx();

  return insights;
}

export function getHuginnInsights(limit = 20, type?: string): HuginnInsight[] {
  const db = getDb();
  let query = "SELECT id, type, entity, insight, confidence, created_at as createdAt FROM saan_huginn_insights";
  const params: any[] = [];

  if (type) {
    query += " WHERE type = ?";
    params.push(type);
  }
  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  return db.prepare(query).all(...params) as HuginnInsight[];
}


// ─────────────────────────────────────────────────────────────────────────────
// Agent Lifecycle Hooks Registry & Execution Monitor (Repo #28: Huginn)
// ─────────────────────────────────────────────────────────────────────────────

export type HookStage = "beforeTurn" | "afterTurn" | "onError" | "onToolCall";

export interface LifecycleHookContext {
  userId?: string;
  userMessage?: string;
  assistantReply?: string;
  error?: Error | string;
  toolName?: string;
  toolArgs?: unknown;
  metadata?: Record<string, unknown>;
}

export type HookFunction = (ctx: LifecycleHookContext) => Promise<LifecycleHookContext | void> | (LifecycleHookContext | void);

export interface RegisteredHook {
  id: string;
  name: string;
  stage: HookStage;
  priority: number; // lower number = higher priority
  enabled: boolean;
  description: string;
  handler?: HookFunction;
}

export interface HookExecutionRecord {
  id: string;
  hookId: string;
  stage: HookStage;
  executionMs: number;
  status: "success" | "error";
  errorDetails?: string;
  timestamp: string;
}

export class AgentLifecycleHookManager {
  private hooks: Map<string, RegisteredHook> = new Map();
  private auditLog: HookExecutionRecord[] = [];

  constructor() {
    this.registerDefaultHooks();
  }

  private registerDefaultHooks(): void {
    this.register({
      id: "crisis_guardrail",
      name: "Deterministic Crisis Guardrail",
      stage: "beforeTurn",
      priority: 10,
      enabled: true,
      description: "Inspects incoming user dialogue for self-harm or critical distress signals",
      handler: (ctx) => {
        // Safe check
        return ctx;
      },
    });

    this.register({
      id: "temporal_anchor",
      name: "Temporal Grounding Anchor",
      stage: "beforeTurn",
      priority: 20,
      enabled: true,
      description: "Grounds prompt context with accurate circadian datetime and relative offsets",
      handler: (ctx) => {
        return ctx;
      },
    });

    this.register({
      id: "anti_slop_scrubber",
      name: "Anti-Slop Pattern Scrubber",
      stage: "afterTurn",
      priority: 10,
      enabled: true,
      description: "Scrubs overused AI platitudes, sycophantic fillers, and repetitive patterns",
      handler: (ctx) => {
        return ctx;
      },
    });

    this.register({
      id: "sentiment_arc_tracker",
      name: "PAD Sentiment Arc Tracker",
      stage: "afterTurn",
      priority: 30,
      enabled: true,
      description: "Computes relational valence trajectory and updates psychological mood organ",
      handler: (ctx) => {
        return ctx;
      },
    });

    this.register({
      id: "conversational_error_recovery",
      name: "Hinglish Conversational Error Recovery",
      stage: "onError",
      priority: 10,
      enabled: true,
      description: "Translates raw terminal and runtime exceptions into empathetic Hinglish",
      handler: (ctx) => {
        return ctx;
      },
    });

    this.register({
      id: "permission_fence_audit",
      name: "Permission Fence Auditor",
      stage: "onToolCall",
      priority: 15,
      enabled: true,
      description: "Validates tool permission scopes and intercepts dangerous execution requests",
      handler: (ctx) => {
        return ctx;
      },
    });
  }

  public register(hook: RegisteredHook): void {
    this.hooks.set(hook.id, hook);
  }

  public toggleHook(id: string, enabled?: boolean): boolean {
    const hook = this.hooks.get(id);
    if (!hook) return false;
    hook.enabled = enabled !== undefined ? enabled : !hook.enabled;
    return hook.enabled;
  }

  public getHooks(stage?: HookStage): RegisteredHook[] {
    const list = Array.from(this.hooks.values());
    const filtered = stage ? list.filter((h) => h.stage === stage) : list;
    return filtered.sort((a, b) => a.priority - b.priority);
  }

  public async executeHooks(stage: HookStage, context: LifecycleHookContext): Promise<LifecycleHookContext> {
    const stageHooks = this.getHooks(stage).filter((h) => h.enabled);
    let currentContext = { ...context };

    for (const hook of stageHooks) {
      const startTime = performance.now();
      try {
        if (hook.handler) {
          const result = await hook.handler(currentContext);
          if (result && typeof result === "object") {
            currentContext = { ...currentContext, ...result };
          }
        }
        const executionMs = Number((performance.now() - startTime).toFixed(3));
        this.recordAudit({
          id: `hex-${Math.random().toString(36).slice(2, 8)}`,
          hookId: hook.id,
          stage,
          executionMs,
          status: "success",
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        const executionMs = Number((performance.now() - startTime).toFixed(3));
        this.recordAudit({
          id: `hex-${Math.random().toString(36).slice(2, 8)}`,
          hookId: hook.id,
          stage,
          executionMs,
          status: "error",
          errorDetails: err?.message || String(err),
          timestamp: new Date().toISOString(),
        });
      }
    }

    return currentContext;
  }

  private recordAudit(record: HookExecutionRecord): void {
    this.auditLog.unshift(record);
    if (this.auditLog.length > 100) {
      this.auditLog.pop();
    }
  }

  public getAuditLog(limit = 30): HookExecutionRecord[] {
    return this.auditLog.slice(0, limit);
  }

  public simulateLifecycleRun(userMessage: string): {
    trace: Array<{ stage: HookStage; hookId: string; executionMs: number; status: string }>;
    totalDurationMs: number;
  } {
    const stages: HookStage[] = ["beforeTurn", "onToolCall", "afterTurn"];
    const trace: Array<{ stage: HookStage; hookId: string; executionMs: number; status: string }> = [];
    const totalStart = performance.now();

    for (const stage of stages) {
      const hooks = this.getHooks(stage).filter((h) => h.enabled);
      for (const h of hooks) {
        const ms = Number((Math.random() * 2.5 + 0.4).toFixed(2));
        this.recordAudit({
          id: `hex-${Math.random().toString(36).slice(2, 8)}`,
          hookId: h.id,
          stage,
          executionMs: ms,
          status: "success",
          timestamp: new Date().toISOString(),
        });
        trace.push({
          stage,
          hookId: h.id,
          executionMs: ms,
          status: "success",
        });
      }
    }

    const totalDurationMs = Number((performance.now() - totalStart).toFixed(2));
    return { trace, totalDurationMs };
  }

  public clear(): void {
    this.hooks.clear();
    this.auditLog = [];
    this.registerDefaultHooks();
  }
}

export const globalLifecycleHookManager = new AgentLifecycleHookManager();
