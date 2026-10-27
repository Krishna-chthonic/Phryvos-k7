/**
 * Mimir Cognitive Memory Engine (Neuroscience Mechanisms from Kronic90/Mimirs-Memory-Hub)
 *
 * Implements:
 * 1. 5-Factor Composite Re-Ranking (Keyword + Semantic + Vividness + Mood + Recency)
 * 2. Flashbulb Memory Engine (Arousal >= 0.6 & Importance >= 8 -> Permanent Anchor)
 * 3. State-Dependent Mood Congruence (PAD Euclidean distance weighting)
 * 4. Zeigarnik Effect (Unfinished deeds salience boost +0.50)
 * 5. Spaced Repetition Stability & Organic Vividness Decay
 * 6. Volatile 12-Hour Short-Term Facts (Ebbinghaus aggressive decay)
 * 7. Procedural Lessons & Solutions Store (Task / Strategy reuse)
 * 8. Cognitive Drift & Bias Analysis (Negativity drift vs Positivity fixation)
 * 9. Mental Time Travel (relive) & Intentional Cognitive Reappraisal (reframe)
 * 10. Temporal Gist Compression (Fuzzy-Trace Theory > 90 days)
 */

import { getDb } from "@/lib/db/client";
import { getMoodOrgan } from "@/lib/saan/mood-organ";
import { loadLedgerFromDb, openDeeds } from "@/lib/saan/ledger";
import { SaanMemory } from "@/lib/saan/memory";

// ── 1. Neuroscience mechanism constants ─────────────────────────────────────
export const FLASHBULB_STABILITY_FLOOR = 120.0;
export const FLASHBULB_AROUSAL_THRESHOLD = 0.6;
export const FLASHBULB_IMPORTANCE_MIN = 8;
export const FLASHBULB_VIVIDNESS_FLOOR = 0.85;

export const ANCHOR_STABILITY_FLOOR = 90.0;
export const ANCHOR_VIVIDNESS_FLOOR = 0.30;

export const ZEIGARNIK_BOOST = 0.50;
export const PRIMING_BOOST = 1.5;
export const PRIMING_DECAY = 0.8;
export const INTERFERENCE_PENALTY = 0.15;
export const ENTITY_RECALL_BOOST = 0.10;

export const GIST_AGE_THRESHOLD_DAYS = 90;
export const GIST_PRESERVE_WORDS = 15;

export const INITIAL_STABILITY = 3.0;
export const RECENCY_HALF_LIFE_DAYS = 5.0;
export const COGNITIVE_BIAS_THRESHOLD = 0.40;

// Composite re-rank weights (balanced)
export const W_KEYWORD = 0.30;
export const W_SEMANTIC = 0.30;
export const W_VIVIDNESS = 0.20;
export const W_MOOD = 0.10;
export const W_RECENCY = 0.10;

// Factual query weights
export const W_KEYWORD_FACTUAL = 0.45;
export const W_SEMANTIC_FACTUAL = 0.25;
export const W_VIVIDNESS_FACTUAL = 0.10;
export const W_MOOD_FACTUAL = 0.05;
export const W_RECENCY_FACTUAL = 0.15;

// Emotional query weights
export const W_KEYWORD_EMOTIONAL = 0.15;
export const W_SEMANTIC_EMOTIONAL = 0.25;
export const W_VIVIDNESS_EMOTIONAL = 0.25;
export const W_MOOD_EMOTIONAL = 0.25;
export const W_RECENCY_EMOTIONAL = 0.10;

const FACTUAL_QUERY_WORDS = new Set([
  "what", "when", "where", "who", "which", "how many", "how much",
  "config", "setting", "status", "date", "time", "version", "path",
  "command", "code", "file", "ip", "port", "id", "key",
]);

const EMOTIONAL_QUERY_WORDS = new Set([
  "feel", "feeling", "felt", "love", "hate", "sad", "happy", "angry",
  "afraid", "hurt", "trust", "scared", "worried", "anxious", "proud",
  "hope", "relationship", "sorry", "miss", "care", "heart", "lonely",
]);

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "was", "are", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall",
  "should", "may", "might", "must", "can", "could", "and", "but", "or",
  "not", "so", "yet", "both", "either", "neither", "each", "every",
  "all", "any", "few", "more", "most", "other", "some", "such", "no",
  "only", "own", "same", "than", "too", "very", "just", "of", "at",
  "by", "for", "with", "about", "against", "between", "through",
  "during", "before", "after", "above", "below", "to", "from", "up",
  "down", "in", "out", "on", "off", "over", "under", "again", "then",
  "here", "there", "when", "where", "why", "how", "this", "that",
  "these", "those", "i", "me", "my", "myself", "we", "our", "you",
  "your", "he", "him", "his", "she", "her", "it", "its", "they",
  "them", "their", "what", "which", "who", "whom",
]);

// ── Mimir PAD Emotion Vectors ───────────────────────────────────────────────
export const MIMIR_EMOTION_VECTORS: Record<string, [number, number, number]> = {
  content: [0.7, -0.3, 0.3],
  peaceful: [0.8, -0.5, 0.4],
  serene: [0.8, -0.6, 0.3],
  grateful: [0.8, 0.1, 0.4],
  appreciative: [0.7, 0.0, 0.3],
  hopeful: [0.6, 0.2, 0.3],
  warm: [0.7, 0.1, 0.3],
  tender: [0.6, -0.1, 0.0],
  affectionate: [0.7, 0.2, 0.2],
  happy: [0.8, 0.4, 0.5],
  joyful: [0.9, 0.6, 0.5],
  excited: [0.7, 0.8, 0.5],
  enthusiastic: [0.7, 0.7, 0.5],
  proud: [0.7, 0.4, 0.7],
  playful: [0.7, 0.6, 0.4],
  inspired: [0.7, 0.5, 0.5],
  curious: [0.5, 0.6, 0.3],
  neutral: [0.0, 0.0, 0.0],
  thoughtful: [0.2, 0.1, 0.3],
  reflective: [0.2, -0.1, 0.2],
  nostalgic: [0.3, -0.1, 0.1],
  sad: [-0.6, -0.3, -0.3],
  lonely: [-0.7, -0.4, -0.5],
  disappointed: [-0.5, -0.2, -0.3],
  anxious: [-0.5, 0.7, -0.4],
  frustrated: [-0.5, 0.6, -0.2],
  angry: [-0.7, 0.8, 0.2],
};

export function lookupEmotionPad(name: string): [number, number, number] {
  const key = name.toLowerCase().trim();
  if (MIMIR_EMOTION_VECTORS[key]) {
    return MIMIR_EMOTION_VECTORS[key];
  }
  return [0.2, 0.0, 0.2];
}

// ── In-Memory Priming Activation Buffer ──────────────────────────────────────
const primingBuffer: Map<string, number> = new Map();

/**
 * Extracts content words (excluding common stop words).
 */
export function extractContentWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

// ── Volatile Short-Term Facts (12-hour half life) ───────────────────────────
export interface VolatileFact {
  id: string;
  entity: string;
  attribute: string;
  value: string;
  createdAt: number;
  expiresAt: number;
  vividness: number;
}

export function addVolatileFact(
  entity: string,
  attribute: string,
  value: string,
  ttlHours = 12
): VolatileFact {
  const db = getDb();
  const id = `vf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();
  const expiresAt = now + ttlHours * 3600 * 1000;

  db.prepare(`
    INSERT INTO saan_volatile_facts (id, entity, attribute, value, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, entity.trim(), attribute.trim(), value.trim(), now, expiresAt);

  return {
    id,
    entity: entity.trim(),
    attribute: attribute.trim(),
    value: value.trim(),
    createdAt: now,
    expiresAt,
    vividness: 1.0,
  };
}

export function getVolatileFacts(entity?: string): VolatileFact[] {
  const db = getDb();
  const now = Date.now();

  // Prune expired facts older than 24h past expiration
  db.prepare(`DELETE FROM saan_volatile_facts WHERE expires_at < ?`).run(now - 24 * 3600 * 1000);

  let query = "SELECT id, entity, attribute, value, created_at as createdAt, expires_at as expiresAt FROM saan_volatile_facts WHERE expires_at > ?";
  const params: any[] = [now];

  if (entity) {
    query += " AND LOWER(entity) = LOWER(?)";
    params.push(entity.trim());
  }
  query += " ORDER BY created_at DESC";

  const rows = db.prepare(query).all(...params) as any[];

  return rows.map((r) => {
    const ageHours = (now - r.createdAt) / (3600 * 1000);
    const vividness = Math.exp((-0.693 * ageHours) / 12.0);
    return {
      id: r.id,
      entity: r.entity,
      attribute: r.attribute,
      value: r.value,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      vividness: Math.max(0.01, Math.min(1.0, vividness)),
    };
  });
}

// ── Procedural Lessons & Solutions Store ────────────────────────────────────
export interface Lesson {
  id: string;
  topic: string;
  strategy: string;
  importance: number;
  reuseCount: number;
  createdAt: number;
}

export function addLesson(topic: string, strategy: string, importance = 5): Lesson {
  const db = getDb();
  const id = `les_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();

  db.prepare(`
    INSERT INTO saan_lessons (id, topic, strategy, importance, reuse_count, created_at)
    VALUES (?, ?, ?, ?, 0, ?)
  `).run(id, topic.trim(), strategy.trim(), importance, now);

  return {
    id,
    topic: topic.trim(),
    strategy: strategy.trim(),
    importance,
    reuseCount: 0,
    createdAt: now,
  };
}

export function getLessons(topic?: string, limit = 10): Lesson[] {
  const db = getDb();
  let query = "SELECT id, topic, strategy, importance, reuse_count as reuseCount, created_at as createdAt FROM saan_lessons";
  const params: any[] = [];

  if (topic) {
    query += " WHERE LOWER(topic) LIKE LOWER(?)";
    params.push(`%${topic.trim()}%`);
  }
  query += " ORDER BY reuse_count DESC, importance DESC LIMIT ?";
  params.push(limit);

  return db.prepare(query).all(...params) as Lesson[];
}

export function recordLessonReuse(id: string): boolean {
  const db = getDb();
  const res = db.prepare(`UPDATE saan_lessons SET reuse_count = reuse_count + 1 WHERE id = ?`).run(id);
  return res.changes > 0;
}

// ── Flashbulb Memory Logic ──────────────────────────────────────────────────
export function checkIsFlashbulb(
  importance: number,
  pad?: [number, number, number] | null
): boolean {
  const arousal = pad ? Math.abs(pad[1]) : 0.0;
  return importance >= FLASHBULB_IMPORTANCE_MIN && arousal >= FLASHBULB_AROUSAL_THRESHOLD;
}

// ── Organic Vividness & Spaced Repetition Decay ──────────────────────────────
export function calculateVividness(
  createdAt: number,
  stability: number,
  isFlashbulb = false,
  isAnchor = false
): number {
  const now = Date.now();
  const ageDays = (now - createdAt) / (86400 * 1000);
  const effectiveStability = Math.max(stability || INITIAL_STABILITY, 0.1);
  const rawRetention = Math.exp(-ageDays / effectiveStability);

  if (isFlashbulb) {
    return Math.max(rawRetention, FLASHBULB_VIVIDNESS_FLOOR);
  }
  if (isAnchor) {
    return Math.max(rawRetention, ANCHOR_VIVIDNESS_FLOOR);
  }
  return Math.max(0.01, Math.min(1.0, rawRetention));
}

/**
 * Spaced Repetition Touch: Recalling a memory reinforces stability.
 */
export function touchMemory(memoryId: number, currentPad?: [number, number, number]): void {
  try {
    const db = getDb();
    const row = db.prepare(`SELECT stability, co_activation_count, is_flashbulb, is_anchor FROM saan_memories WHERE id = ?`).get(memoryId) as any;
    if (!row) return;

    let newStability = (row.stability || INITIAL_STABILITY) * 1.25;
    if (row.is_flashbulb) {
      newStability = Math.max(newStability, FLASHBULB_STABILITY_FLOOR);
    } else if (row.is_anchor) {
      newStability = Math.max(newStability, ANCHOR_STABILITY_FLOOR);
    }
    newStability = Math.min(newStability, 180.0);

    const now = Date.now();
    db.prepare(`
      UPDATE saan_memories 
      SET stability = ?, 
          vividness = MIN(1.0, vividness + 0.15),
          co_activation_count = co_activation_count + 1,
          last_recalled_at = ?
      WHERE id = ?
    `).run(newStability, now, memoryId);
  } catch (err) {
    console.warn("[MimirCognitive] touchMemory error:", err);
  }
}

// ── Anchor, Cherish, Reframe, Relive ─────────────────────────────────────────
export function anchorMemory(id: number): boolean {
  try {
    const db = getDb();
    const res = db.prepare(`
      UPDATE saan_memories 
      SET is_anchor = 1, 
          stability = MAX(stability, ?) 
      WHERE id = ?
    `).run(ANCHOR_STABILITY_FLOOR, id);
    return res.changes > 0;
  } catch {
    return false;
  }
}

export function cherishMemory(id: number): boolean {
  try {
    const db = getDb();
    const res = db.prepare(`UPDATE saan_memories SET is_cherished = 1 WHERE id = ?`).run(id);
    return res.changes > 0;
  } catch {
    return false;
  }
}

export function uncherishMemory(id: number): boolean {
  try {
    const db = getDb();
    const res = db.prepare(`UPDATE saan_memories SET is_cherished = 0 WHERE id = ?`).run(id);
    return res.changes > 0;
  } catch {
    return false;
  }
}

export function reframeMemory(id: number, newEmotion: string, reason = ""): boolean {
  try {
    const newPad = lookupEmotionPad(newEmotion);
    const db = getDb();
    const res = db.prepare(`
      UPDATE saan_memories 
      SET is_reframed = 1,
          reframe_reason = ?,
          emotion_pad = ?
      WHERE id = ?
    `).run(reason || `reframed to ${newEmotion}`, JSON.stringify(newPad), id);
    return res.changes > 0;
  } catch {
    return false;
  }
}

export function reliveMemory(id: number): { success: boolean; memory?: SaanMemory; blendedMood?: [number, number, number] } {
  try {
    const db = getDb();
    const row = db.prepare(`SELECT * FROM saan_memories WHERE id = ?`).get(id) as any;
    if (!row) return { success: false };

    touchMemory(id);
    const organ = getMoodOrgan();
    const currentMood = organ.getState();

    let blendedMood: [number, number, number] = [currentMood.valence, currentMood.arousal, currentMood.dominance];

    if (row.emotion_pad) {
      try {
        const memPad: [number, number, number] = JSON.parse(row.emotion_pad);
        const alpha = 0.6;
        blendedMood = [
          Number((currentMood.valence * (1 - alpha) + memPad[0] * alpha).toFixed(3)),
          Number((currentMood.arousal * (1 - alpha) + memPad[1] * alpha).toFixed(3)),
          Number((currentMood.dominance * (1 - alpha) + memPad[2] * alpha).toFixed(3)),
        ];
        organ.ingest({
          valence: blendedMood[0] - currentMood.valence,
          arousal: blendedMood[1] - currentMood.arousal,
          dominance: blendedMood[2] - currentMood.dominance,
          weight: 1.0,
          source: "self",
        });
      } catch {}
    }

    return {
      success: true,
      memory: {
        id: row.id,
        point: row.point,
        category: row.category,
        confidence: row.confidence,
        importance: row.importance,
        createdAt: row.created_at,
        validSince: row.valid_since,
        validUntil: row.valid_until,
        status: row.status,
        sourceType: row.source_type,
        vividness: row.vividness,
        stability: row.stability,
        isFlashbulb: Boolean(row.is_flashbulb),
        isAnchor: Boolean(row.is_anchor),
        isCherished: Boolean(row.is_cherished),
        isReframed: Boolean(row.is_reframed),
        reframeReason: row.reframe_reason,
        coActivationCount: row.co_activation_count,
        lastRecalledAt: row.last_recalled_at,
        emotionPad: row.emotion_pad ? JSON.parse(row.emotion_pad) : undefined,
      } as any,
      blendedMood,
    };
  } catch {
    return { success: false };
  }
}

// ── Fuzzy-Trace Gist Compression (>90 days) ──────────────────────────────────
export function compressToGist(id: number): boolean {
  try {
    const db = getDb();
    const row = db.prepare(`SELECT point, created_at, is_flashbulb, is_anchor, is_cherished FROM saan_memories WHERE id = ?`).get(id) as any;
    if (!row) return false;

    // Do not compress flashbulbs, anchors, or cherished memories
    if (row.is_flashbulb || row.is_anchor || row.is_cherished) return false;

    const ageDays = (Date.now() - row.created_at) / (86400 * 1000);
    if (ageDays < GIST_AGE_THRESHOLD_DAYS) return false;

    const words = row.point.split(/\s+/);
    if (words.length <= GIST_PRESERVE_WORDS) return false;

    const gist = words.slice(0, GIST_PRESERVE_WORDS).join(" ") + "...";
    db.prepare(`UPDATE saan_memories SET point = ? WHERE id = ?`).run(gist, id);
    return true;
  } catch {
    return false;
  }
}

// ── Cognitive Drift & Bias Analysis ──────────────────────────────────────────
export interface CognitiveBiasReport {
  biases: Array<{ type: string; description: string; severity: number }>;
  totalAnalyzed: number;
  averageValence: number;
  negativityRatio: number;
  positivityRatio: number;
}

export function driftAnalysis(): CognitiveBiasReport {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT emotion_pad, is_reframed, point
      FROM saan_memories 
      WHERE status = 'active' AND emotion_pad IS NOT NULL
      ORDER BY created_at DESC 
      LIMIT 100
    `).all() as any[];

    if (rows.length < 3) {
      return {
        biases: [],
        totalAnalyzed: rows.length,
        averageValence: 0.0,
        negativityRatio: 0.0,
        positivityRatio: 0.0,
      };
    }

    let posCount = 0;
    let negCount = 0;
    let arousalUpCount = 0;
    let totalValence = 0;

    for (const r of rows) {
      try {
        const pad: [number, number, number] = JSON.parse(r.emotion_pad);
        totalValence += pad[0];
        if (pad[0] > 0.2) posCount++;
        else if (pad[0] < -0.2) negCount++;
        if (pad[1] > 0.3) arousalUpCount++;
      } catch {}
    }

    const n = rows.length;
    const biases: Array<{ type: string; description: string; severity: number }> = [];
    const negRatio = Number((negCount / n).toFixed(2));
    const posRatio = Number((posCount / n).toFixed(2));
    const arousalRatio = Number((arousalUpCount / n).toFixed(2));

    if (negRatio >= COGNITIVE_BIAS_THRESHOLD) {
      biases.push({
        type: "negativity_drift",
        description: `${negCount}/${n} memories are negative-valence — active negativity drift detected.`,
        severity: negRatio,
      });
    }

    if (posRatio >= COGNITIVE_BIAS_THRESHOLD) {
      biases.push({
        type: "positivity_fixation",
        description: `${posCount}/${n} memories are positive-valence — possible rose-tinting bias.`,
        severity: posRatio,
      });
    }

    if (arousalRatio >= COGNITIVE_BIAS_THRESHOLD) {
      biases.push({
        type: "arousal_escalation",
        description: `${arousalUpCount}/${n} memories exhibit high arousal — emotional amplification pattern.`,
        severity: arousalRatio,
      });
    }

    return {
      biases,
      totalAnalyzed: n,
      averageValence: Number((totalValence / n).toFixed(2)),
      negativityRatio: negRatio,
      positivityRatio: posRatio,
    };
  } catch (err) {
    return {
      biases: [],
      totalAnalyzed: 0,
      averageValence: 0.0,
      negativityRatio: 0.0,
      positivityRatio: 0.0,
    };
  }
}

// ── 5-Factor Composite Re-Ranking Algorithm ──────────────────────────────────
export interface ScoredMemory {
  memory: SaanMemory;
  score: number;
  factors: {
    keyword: number;
    semantic: number;
    vividness: number;
    mood: number;
    recency: number;
    zeigarnikBoost: number;
    primingBoost: number;
    cherishedBoost: number;
  };
}

export function rankMemoriesComposite(
  candidates: SaanMemory[],
  query = "",
  currentMoodPad?: [number, number, number]
): ScoredMemory[] {
  if (!candidates.length) return [];

  const queryLower = query.toLowerCase();
  const queryTokens = new Set(extractContentWords(queryLower));

  // Determine query type (factual vs emotional)
  let factualCount = 0;
  let emotionalCount = 0;
  for (const token of queryLower.split(/\s+/)) {
    if (FACTUAL_QUERY_WORDS.has(token)) factualCount++;
    if (EMOTIONAL_QUERY_WORDS.has(token)) emotionalCount++;
  }

  let wKw = W_KEYWORD;
  let wSem = W_SEMANTIC;
  let wViv = W_VIVIDNESS;
  let wMood = W_MOOD;
  let wRec = W_RECENCY;

  if (factualCount > emotionalCount) {
    wKw = W_KEYWORD_FACTUAL;
    wSem = W_SEMANTIC_FACTUAL;
    wViv = W_VIVIDNESS_FACTUAL;
    wMood = W_MOOD_FACTUAL;
    wRec = W_RECENCY_FACTUAL;
  } else if (emotionalCount > factualCount) {
    wKw = W_KEYWORD_EMOTIONAL;
    wSem = W_SEMANTIC_EMOTIONAL;
    wViv = W_VIVIDNESS_EMOTIONAL;
    wMood = W_MOOD_EMOTIONAL;
    wRec = W_RECENCY_EMOTIONAL;
  }

  const now = Date.now();
  let openDeedWords = new Set<string>();
  try {
    const ledger = loadLedgerFromDb();
    const activeDeeds = openDeeds(ledger);
    openDeedWords = new Set(activeDeeds.flatMap((d) => extractContentWords(d.text)));
  } catch {
    openDeedWords = new Set();
  }

  const scored: ScoredMemory[] = [];

  for (const mem of candidates) {
    const memWords = extractContentWords(mem.point);
    const memWordSet = new Set(memWords);

    // 1. Keyword Overlap (BM25 surrogate: token overlap / max(len(query), 1))
    let sKw = 0.0;
    if (queryTokens.size > 0) {
      let overlap = 0;
      for (const t of queryTokens) {
        if (memWordSet.has(t)) overlap++;
      }
      sKw = Math.min(1.0, overlap / Math.max(queryTokens.size, 1));
    }

    // 2. Semantic Salience (surrogate based on importance & confidence: [0, 1])
    const sSem = ((mem.importance || 5) / 10.0) * (mem.confidence || 1.0);

    // 3. Vividness & Stability
    const memAny = mem as any;
    const viv = calculateVividness(
      mem.createdAt,
      memAny.stability || INITIAL_STABILITY,
      Boolean(memAny.is_flashbulb || memAny.isFlashbulb),
      Boolean(memAny.is_anchor || memAny.isAnchor)
    );
    const sViv = viv;

    // 4. Mood Congruence (PAD dot product or distance)
    let sMood = 0.5;
    if (currentMoodPad && memAny.emotion_pad) {
      try {
        const memPad: [number, number, number] = typeof memAny.emotion_pad === "string" 
          ? JSON.parse(memAny.emotion_pad) 
          : memAny.emotion_pad;
        const dot = currentMoodPad[0] * memPad[0] + currentMoodPad[1] * memPad[1] + currentMoodPad[2] * memPad[2];
        sMood = Math.max(0.0, Math.min(1.0, (dot + 1.0) / 2.0));
      } catch {
        sMood = 0.5;
      }
    }

    // 5. Exponential Recency Decay (t_1/2 = 5 days)
    const ageDays = (now - mem.createdAt) / (86400 * 1000);
    const sRec = Math.exp((-0.693 * ageDays) / RECENCY_HALF_LIFE_DAYS);

    // Base 5-Factor Composite Score
    let composite = wKw * sKw + wSem * sSem + wViv * sViv + wMood * sMood + wRec * sRec;

    // Boosts
    let zeigarnikBoost = 0.0;
    for (const w of memWords) {
      if (openDeedWords.has(w)) {
        zeigarnikBoost = ZEIGARNIK_BOOST;
        break;
      }
    }
    composite += zeigarnikBoost;

    // Priming boost from activation buffer
    let primedHits = 0;
    for (const w of memWords) {
      if (primingBuffer.has(w)) {
        primedHits += primingBuffer.get(w)!;
      }
    }
    const primingBoost = primedHits > 0 ? Math.min(0.3, primedHits * 0.02) : 0.0;
    composite += primingBoost;

    // Cherished boost
    let cherishedBoost = 0.0;
    if (memAny.is_cherished || memAny.isCherished) {
      cherishedBoost = composite * 0.10;
      composite += cherishedBoost;
    }

    scored.push({
      memory: mem,
      score: Number(composite.toFixed(4)),
      factors: {
        keyword: Number(sKw.toFixed(3)),
        semantic: Number(sSem.toFixed(3)),
        vividness: Number(sViv.toFixed(3)),
        mood: Number(sMood.toFixed(3)),
        recency: Number(sRec.toFixed(3)),
        zeigarnikBoost,
        primingBoost: Number(primingBoost.toFixed(3)),
        cherishedBoost: Number(cherishedBoost.toFixed(3)),
      },
    });
  }

  scored.sort((a, b) => b.score - a.score);

  // Update priming buffer with top recalled memories (Spreading activation)
  for (const item of scored.slice(0, 3)) {
    for (const w of extractContentWords(item.memory.point)) {
      if (w.length >= 4) {
        const prev = primingBuffer.get(w) || 0;
        primingBuffer.set(w, Math.min(5.0, prev + PRIMING_BOOST));
      }
    }
  }

  // Decay older primed words
  for (const [w, val] of primingBuffer.entries()) {
    const decayed = val * PRIMING_DECAY;
    if (decayed < 0.1) primingBuffer.delete(w);
    else primingBuffer.set(w, decayed);
  }

  return scored;
}
