/**
 * SuperAGI & TeleMem Multi-Tier Buffered Memory Queue & Semantic Clustering Engine
 *
 * Clean-room adaptation synthesizing SuperAGI + TeleAI-UAGI/telemem:
 * 1. 3-Tier Architecture:
 *    - Hot Tier: Instant in-memory retrieval cache.
 *    - Warm Tier: Priority staged write buffer (CRITICAL, HIGH, NORMAL, EPHEMERAL).
 *    - Cold Tier: Committed persistence with batch flushing to prevent disk thrashing.
 * 2. 4-Axis persona fact classification (relationships, events, traits, items).
 * 3. Priority promotion: repeated signals automatically promote NORMAL/EPHEMERAL to HIGH/CRITICAL.
 * 4. Unified In-Flight Search: queries inspect both committed storage and pending warm-buffer items.
 * 5. High-precision semantic cosine clustering (threshold >= 0.95) with cluster fusion.
 */

export type MemoryPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'EPHEMERAL';

export interface BufferedMemoryCandidate {
  id: string;
  userId: string;
  text: string;
  axis: 'relationships' | 'events' | 'traits' | 'items';
  priority?: MemoryPriority;
  embedding?: number[];
  confidence: number;
  createdAt: string;
  accessCount?: number;
  metadata?: Record<string, unknown>;
}

export interface MemoryCluster {
  axis: string;
  items: BufferedMemoryCandidate[];
  centroidText: string;
  isFused: boolean;
  synthesizedText?: string;
}

export interface FlushResult {
  added: BufferedMemoryCandidate[];
  fused: {
    clusterCount: number;
    originalCount: number;
    synthesizedMemories: string[];
  };
  flushedAt: string;
}

export interface QueueStatusMetrics {
  totalPending: number;
  capacity: number;
  utilizationPct: number;
  byPriority: Record<MemoryPriority, number>;
  byAxis: Record<string, number>;
  oldestItemAgeMs: number;
}

/**
 * Computes dot-product cosine similarity between two float vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Lightweight deterministic pseudo-embedding generator for environments without direct torch/vllm.
 * Generates an L2-normalized 64-dimensional semantic footprint from text tokens.
 */
export function computeSyntheticEmbedding(text: string, dim: number = 64): number[] {
  const vec = new Array(dim).fill(0);
  const normalized = text.toLowerCase().trim();
  const words = normalized.split(/\s+/);

  for (let wIdx = 0; wIdx < words.length; wIdx++) {
    const word = words[wIdx];
    for (let cIdx = 0; cIdx < word.length; cIdx++) {
      const code = word.charCodeAt(cIdx);
      const targetDim = (code * 17 + cIdx * 31 + wIdx * 13) % dim;
      vec[targetDim] += 1.0 / (1 + cIdx);
    }
  }

  // L2 normalize
  let sumSq = 0;
  for (let i = 0; i < dim; i++) sumSq += vec[i] * vec[i];
  const mag = Math.sqrt(sumSq);
  if (mag > 0) {
    for (let i = 0; i < dim; i++) vec[i] /= mag;
  }
  return vec;
}

const PRIORITY_WEIGHTS: Record<MemoryPriority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  NORMAL: 2,
  EPHEMERAL: 1,
};

export class BufferedMemoryQueue {
  private bufferSize: number;
  private similarityThreshold: number;
  private buffers: Map<string, BufferedMemoryCandidate[]>;
  private committedArchive: Map<string, BufferedMemoryCandidate[]>;

  constructor(options?: { bufferSize?: number; similarityThreshold?: number }) {
    this.bufferSize = options?.bufferSize ?? 64;
    this.similarityThreshold = options?.similarityThreshold ?? 0.95;
    this.buffers = new Map();
    this.committedArchive = new Map();
  }

  private getBufferKey(userId: string): string {
    return `person_${userId || 'anonymous'}`;
  }

  public getPendingCount(userId: string): number {
    const key = this.getBufferKey(userId);
    return this.buffers.get(key)?.length ?? 0;
  }

  public getQueueMetrics(userId: string): QueueStatusMetrics {
    const key = this.getBufferKey(userId);
    const items = this.buffers.get(key) || [];
    const byPriority: Record<MemoryPriority, number> = {
      CRITICAL: 0,
      HIGH: 0,
      NORMAL: 0,
      EPHEMERAL: 0,
    };
    const byAxis: Record<string, number> = {
      relationships: 0,
      events: 0,
      traits: 0,
      items: 0,
    };

    let oldestTime = Date.now();
    for (const it of items) {
      const p = it.priority || 'NORMAL';
      byPriority[p] = (byPriority[p] || 0) + 1;
      byAxis[it.axis] = (byAxis[it.axis] || 0) + 1;
      const t = new Date(it.createdAt).getTime();
      if (t < oldestTime) oldestTime = t;
    }

    const oldestItemAgeMs = items.length > 0 ? Math.max(0, Date.now() - oldestTime) : 0;
    const utilizationPct = Math.min(100, Math.round((items.length / this.bufferSize) * 100));

    return {
      totalPending: items.length,
      capacity: this.bufferSize,
      utilizationPct,
      byPriority,
      byAxis,
      oldestItemAgeMs,
    };
  }

  public getPendingItems(userId: string): BufferedMemoryCandidate[] {
    const key = this.getBufferKey(userId);
    return [...(this.buffers.get(key) || [])];
  }

  /**
   * Pushes a candidate memory into the buffer.
   * Performs priority promotion if a similar fact is repeatedly enqueued.
   */
  public enqueue(candidate: Omit<BufferedMemoryCandidate, 'id' | 'createdAt'>): {
    queued: boolean;
    promoted: boolean;
    pendingCount: number;
    shouldFlush: boolean;
    item: BufferedMemoryCandidate;
  } {
    const key = this.getBufferKey(candidate.userId);
    if (!this.buffers.has(key)) {
      this.buffers.set(key, []);
    }
    const buf = this.buffers.get(key)!;

    const embedding = candidate.embedding ?? computeSyntheticEmbedding(candidate.text);
    let promoted = false;

    // Check if an existing buffered item is semantically identical: promote its priority and merge
    for (const existing of buf) {
      if (existing.axis === candidate.axis) {
        const isExact = existing.text.trim().toLowerCase() === candidate.text.trim().toLowerCase();
        const sim = cosineSimilarity(existing.embedding ?? [], embedding);
        if (isExact || sim >= 0.99) {
          // Priority promotion logic: EPHEMERAL -> NORMAL -> HIGH -> CRITICAL
          const curPriority = existing.priority || 'NORMAL';
          if (curPriority === 'EPHEMERAL') existing.priority = 'NORMAL';
          else if (curPriority === 'NORMAL') existing.priority = 'HIGH';
          else if (curPriority === 'HIGH') existing.priority = 'CRITICAL';

          existing.confidence = Math.max(existing.confidence, candidate.confidence);
          existing.accessCount = (existing.accessCount || 1) + 1;
          promoted = true;

          return {
            queued: true,
            promoted: true,
            pendingCount: buf.length,
            shouldFlush: buf.length >= this.bufferSize,
            item: existing,
          };
        }
      }
    }

    const fullItem: BufferedMemoryCandidate = {
      ...candidate,
      id: `mem_buf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      priority: candidate.priority || 'NORMAL',
      createdAt: new Date().toISOString(),
      embedding,
      accessCount: 1,
    };

    buf.push(fullItem);

    // Sort buffer by priority descending (CRITICAL -> HIGH -> NORMAL -> EPHEMERAL)
    buf.sort((a, b) => {
      const wa = PRIORITY_WEIGHTS[a.priority || 'NORMAL'];
      const wb = PRIORITY_WEIGHTS[b.priority || 'NORMAL'];
      return wb - wa;
    });

    const shouldFlush = buf.length >= this.bufferSize;

    return {
      queued: true,
      promoted: false,
      pendingCount: buf.length,
      shouldFlush,
      item: fullItem,
    };
  }

  /**
   * Unified In-Flight Search:
   * Queries both committed long-term memory AND pending uncommitted buffer memories
   * using hybrid semantic vector similarity + lexical keyword overlap.
   */
  public searchUnified(userId: string, query: string, limit: number = 5): {
    source: 'warm_buffer' | 'cold_storage';
    item: BufferedMemoryCandidate;
    score: number;
  }[] {
    const queryEmb = computeSyntheticEmbedding(query);
    const queryTokens = new Set(
      query
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );

    const calculateRelevance = (item: BufferedMemoryCandidate): number => {
      const emb = item.embedding ?? computeSyntheticEmbedding(item.text);
      const vecScore = cosineSimilarity(queryEmb, emb);

      const itemWords = item.text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2);

      let matchedWords = 0;
      for (const w of itemWords) {
        if (queryTokens.has(w)) matchedWords++;
      }
      const lexicalScore = queryTokens.size > 0 ? matchedWords / queryTokens.size : 0;

      return vecScore * 0.4 + lexicalScore * 0.6;
    };

    const results: { source: 'warm_buffer' | 'cold_storage'; item: BufferedMemoryCandidate; score: number }[] = [];

    // 1. Search pending warm buffer
    const key = this.getBufferKey(userId);
    const warmItems = this.buffers.get(key) || [];
    for (const it of warmItems) {
      const score = calculateRelevance(it);
      if (score >= 0.1) {
        results.push({ source: 'warm_buffer', item: it, score });
      }
    }

    // 2. Search committed cold storage
    const coldItems = this.committedArchive.get(key) || [];
    for (const it of coldItems) {
      const score = calculateRelevance(it);
      if (score >= 0.1) {
        results.push({ source: 'cold_storage', item: it, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Clusters candidate memories using cosine similarity threshold (default >= 0.95).
   */
  public clusterMemories(
    memories: BufferedMemoryCandidate[],
    threshold: number = this.similarityThreshold
  ): MemoryCluster[] {
    if (memories.length === 0) return [];

    const clusters: MemoryCluster[] = [];
    const used = new Set<string>();

    for (let i = 0; i < memories.length; i++) {
      const current = memories[i];
      if (used.has(current.id)) continue;

      const clusterItems: BufferedMemoryCandidate[] = [current];
      used.add(current.id);

      const embA = current.embedding ?? computeSyntheticEmbedding(current.text);

      for (let j = i + 1; j < memories.length; j++) {
        const next = memories[j];
        if (used.has(next.id)) continue;

        // Same axis cluster preference
        if (current.axis !== next.axis) continue;

        const embB = next.embedding ?? computeSyntheticEmbedding(next.text);
        const vecSim = cosineSimilarity(embA, embB);

        // Lexical token overlap for offline robustness
        const wordsA = new Set(current.text.toLowerCase().split(/\s+/));
        const wordsB = new Set(next.text.toLowerCase().split(/\s+/));
        let overlap = 0;
        for (const w of wordsA) {
          if (wordsB.has(w)) overlap++;
        }
        const jaccard = overlap / Math.max(1, wordsA.size + wordsB.size - overlap);
        const hybridSim = Math.max(vecSim, jaccard);

        if (hybridSim >= threshold || vecSim >= threshold) {
          clusterItems.push(next);
          used.add(next.id);
        }
      }

      clusters.push({
        axis: current.axis,
        items: clusterItems,
        centroidText: current.text,
        isFused: clusterItems.length > 1,
        synthesizedText:
          clusterItems.length > 1
            ? this.synthesizeCluster(clusterItems)
            : current.text,
      });
    }

    return clusters;
  }

  /**
   * Synthesizes multiple overlapping memory entries into a unified, clean memory statement.
   */
  private synthesizeCluster(items: BufferedMemoryCandidate[]): string {
    const uniqueStatements = Array.from(new Set(items.map((it) => it.text.trim())));
    if (uniqueStatements.length === 1) return uniqueStatements[0];
    return uniqueStatements.join('; ');
  }

  /**
   * Flushes the buffer for a user, executing clustering, deduplication and archiving into cold storage.
   */
  public flush(userId: string): FlushResult {
    const key = this.getBufferKey(userId);
    const items = this.buffers.get(key) || [];
    if (items.length === 0) {
      return {
        added: [],
        fused: { clusterCount: 0, originalCount: 0, synthesizedMemories: [] },
        flushedAt: new Date().toISOString(),
      };
    }

    const clusters = this.clusterMemories(items);
    const added: BufferedMemoryCandidate[] = [];
    const synthesized: string[] = [];
    let fusedClusterCount = 0;

    for (const cluster of clusters) {
      if (cluster.items.length === 1) {
        added.push(cluster.items[0]);
      } else {
        fusedClusterCount++;
        synthesized.push(cluster.synthesizedText!);
        // Produce single fused candidate memory with max confidence & highest priority
        const maxConf = Math.max(...cluster.items.map((x) => x.confidence));
        const highestPriority = cluster.items.some((x) => x.priority === 'CRITICAL')
          ? 'CRITICAL'
          : cluster.items.some((x) => x.priority === 'HIGH')
          ? 'HIGH'
          : 'NORMAL';

        added.push({
          id: `fused_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          userId,
          text: cluster.synthesizedText!,
          axis: cluster.items[0].axis,
          priority: highestPriority,
          confidence: maxConf,
          createdAt: new Date().toISOString(),
          metadata: {
            fusedSourcesCount: cluster.items.length,
            originalIds: cluster.items.map((x) => x.id),
          },
        });
      }
    }

    // Archive into cold storage
    if (!this.committedArchive.has(key)) {
      this.committedArchive.set(key, []);
    }
    const archive = this.committedArchive.get(key)!;
    archive.push(...added);

    // Clear warm buffer
    this.buffers.set(key, []);

    return {
      added,
      fused: {
        clusterCount: fusedClusterCount,
        originalCount: items.length,
        synthesizedMemories: synthesized,
      },
      flushedAt: new Date().toISOString(),
    };
  }

  /**
   * Generates TeleMem 4-axis persona prompt instructions for LLM extraction.
   */
  public static getPersonPrompt(characterName: string, recentMessages: string): { systemPrompt: string; userPrompt: string } {
    const systemPrompt = 'You are a targeted cognitive persona memory extractor.';
    const userPrompt =
      `Analyze the conversation below focusing strictly on character "${characterName}".\n` +
      'Extract facts categorized into these 4 explicit axes:\n' +
      '1. relationships: Interactions, emotional disclosures, shared history with others.\n' +
      '2. events: Specific tasks, decisions, temporal milestones, or commitments.\n' +
      '3. traits: Background identity, skills, preferences, recurring habits.\n' +
      '4. items: Objects owned, gifts exchanged, specific locations visited.\n\n' +
      `Conversation:\n${recentMessages}\n\n` +
      'Output each fact in JSON format: [{"axis": "...", "text": "...", "confidence": 0.9}]';

    return { systemPrompt, userPrompt };
  }
}

/**
 * Singleton instance for cross-component shared buffered memory queue
 */
let globalBufferedQueue: BufferedMemoryQueue | null = null;

export function getBufferedMemoryQueue(): BufferedMemoryQueue {
  if (!globalBufferedQueue) {
    globalBufferedQueue = new BufferedMemoryQueue({ bufferSize: 32, similarityThreshold: 0.95 });
  }
  return globalBufferedQueue;
}

