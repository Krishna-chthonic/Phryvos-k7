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
