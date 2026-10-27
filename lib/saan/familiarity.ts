/**
 * Saan Familiarity & Habituation Pool (Adapted from Psycheros packages/entity-flux/src/familiarity.ts)
 *
 * Implements self-regulation and anti-repetition:
 * 1. Rolling pool of recently expressed thoughts, topics, and suggestions.
 * 2. Habituation: effective salience = raw salience * novelty ratio.
 * 3. Ratio-based novelty vs hardcoded thresholds: prevents Saan from repeating
 *    the same conversational riffs, nagging about the same task, or sounding like a broken record.
 */

interface FamiliarityEntry {
  text: string;
  tokens: Set<string>;
  timestamp: number;
}

const POOL_MAX_ENTRIES = 50;
const HABITUATION_SPAN_MS = 45 * 60 * 1000; // 45-minute rolling window

// Tokenizes text into normalized stems, stripping punctuation and common stop words
function tokenize(text: string): Set<string> {
  const words = (text || "")
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const stopWords = new Set([
    "the", "and", "that", "this", "with", "have", "from", "your", "what",
    "kya", "hai", "hain", "nahi", "raha", "rahe", "rahi", "hoga", "karo", "karna"
  ]);

  return new Set(words.filter((w) => !stopWords.has(w)));
}

class FamiliarityPool {
  private entries: FamiliarityEntry[] = [];

  /**
   * Cleans entries older than the habituation span
   */
  private prune(now = Date.now()): void {
    const cutoff = now - HABITUATION_SPAN_MS;
    this.entries = this.entries.filter((e) => e.timestamp >= cutoff);
    if (this.entries.length > POOL_MAX_ENTRIES) {
      this.entries = this.entries.slice(-POOL_MAX_ENTRIES);
    }
  }

  /**
   * Records a topic or thought that was recently spoken
   */
  record(text: string, now = Date.now()): void {
    this.prune(now);
    const tokens = tokenize(text);
    if (tokens.size === 0) return;

    this.entries.push({
      text: text.trim(),
      tokens,
      timestamp: now,
    });
  }

  /**
   * Computes Jaccard/overlap novelty ratio against recently spoken pool.
   * 1.0 = completely novel, 0.0 = exact duplicate / highly repetitive
   */
  calculateNoveltyRatio(candidateText: string, now = Date.now()): number {
    this.prune(now);
    if (this.entries.length === 0) return 1.0;

    const candidateTokens = tokenize(candidateText);
    if (candidateTokens.size === 0) return 1.0;

    let maxSimilarity = 0.0;

    for (const entry of this.entries) {
      // Time-decayed weight (more recent entries matter more)
      const ageMs = now - entry.timestamp;
      const recencyWeight = Math.max(0.2, 1.0 - ageMs / HABITUATION_SPAN_MS);

      // Jaccard similarity: intersection / union
      let intersection = 0;
      for (const token of candidateTokens) {
        if (entry.tokens.has(token)) intersection++;
      }
      const union = candidateTokens.size + entry.tokens.size - intersection;
      const sim = union > 0 ? (intersection / union) * recencyWeight : 0;

      if (sim > maxSimilarity) {
        maxSimilarity = sim;
      }
    }

    // Novelty is the inverse of maximum similarity
    return Math.max(0.0, Math.min(1.0, 1.0 - maxSimilarity));
  }

  /**
   * Determines if a candidate response is too repetitive (novelty below threshold)
   */
  shouldSuppress(candidateText: string, threshold = 0.45, now = Date.now()): boolean {
    const novelty = this.calculateNoveltyRatio(candidateText, now);
    return novelty < threshold;
  }

  clear(): void {
    this.entries = [];
  }
}

// Global singleton pool
const globalPool = new FamiliarityPool();

export function recordSpoken(text: string): void {
  globalPool.record(text);
}

export function getNoveltyRatio(text: string): number {
  return globalPool.calculateNoveltyRatio(text);
}

export function isRepetitive(text: string, threshold?: number): boolean {
  return globalPool.shouldSuppress(text, threshold);
}

export function clearFamiliarity(): void {
  globalPool.clear();
}

export const calculateNoveltyRatio = getNoveltyRatio;
export const shouldSuppress = isRepetitive;
export const resetFamiliarityWindow = clearFamiliarity;
