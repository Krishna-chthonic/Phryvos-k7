/**
 * TeleMem Buffered Memory Queue & Embedding Cosine Clustering Engine
 *
 * Clean-room adaptation synthesizing TeleAI-UAGI/telemem:
 * 1. Write buffer queue to avoid database write thrashing during rapid turns.
 * 2. 4-axis persona fact classification:
 *    - relationships (人物关系与互动)
 *    - events (情节发展与事件细节)
 *    - traits (角色特征与背景)
 *    - items (具体物品与地点)
 * 3. Cosine similarity clustering (threshold >= 0.95) across candidate & existing memories.
 * 4. Cluster resolution: Single item -> ADD; Multi-item cluster -> Synthesized Fusion.
 */

export interface BufferedMemoryCandidate {
  id: string;
  userId: string;
  text: string;
  axis: 'relationships' | 'events' | 'traits' | 'items';
  embedding?: number[];
  confidence: number;
  createdAt: string;
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

export class BufferedMemoryQueue {
  private bufferSize: number;
  private similarityThreshold: number;
  private buffers: Map<string, BufferedMemoryCandidate[]>;

  constructor(options?: { bufferSize?: number; similarityThreshold?: number }) {
    this.bufferSize = options?.bufferSize ?? 64;
    this.similarityThreshold = options?.similarityThreshold ?? 0.95;
    this.buffers = new Map();
  }

  private getBufferKey(userId: string): string {
    return `person_${userId || 'anonymous'}`;
  }

  public getPendingCount(userId: string): number {
    const key = this.getBufferKey(userId);
    return this.buffers.get(key)?.length ?? 0;
  }

  /**
   * Pushes a candidate memory into the buffer.
   * Auto-embeds if embedding is missing.
   */
  public enqueue(candidate: Omit<BufferedMemoryCandidate, 'id' | 'createdAt'>): {
    queued: boolean;
    pendingCount: number;
    shouldFlush: boolean;
  } {
    const key = this.getBufferKey(candidate.userId);
    if (!this.buffers.has(key)) {
      this.buffers.set(key, []);
    }
    const buf = this.buffers.get(key)!;

    const fullItem: BufferedMemoryCandidate = {
      ...candidate,
      id: `mem_buf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      embedding: candidate.embedding ?? computeSyntheticEmbedding(candidate.text),
    };

    buf.push(fullItem);
    const shouldFlush = buf.length >= this.bufferSize;

    return {
      queued: true,
      pendingCount: buf.length,
      shouldFlush,
    };
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
        const sim = cosineSimilarity(embA, embB);

        if (sim >= threshold) {
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
   * Flushes the buffer for a user, executing clustering and deduplication.
   */
  public flush(userId: string): FlushResult {
    const key = this.getBufferKey(userId);
    const items = this.buffers.get(key) || [];
    if (items.length === 0) {
      return {
        added: [],
        fused: { clusterCount: 0, originalCount: 0, synthesizedMemories: [] },
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
        // Produce single fused candidate memory with max confidence
        const maxConf = Math.max(...cluster.items.map((x) => x.confidence));
        added.push({
          id: `fused_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          userId,
          text: cluster.synthesizedText!,
          axis: cluster.items[0].axis,
          confidence: maxConf,
          createdAt: new Date().toISOString(),
          metadata: {
            fusedSourcesCount: cluster.items.length,
            originalIds: cluster.items.map((x) => x.id),
          },
        });
      }
    }

    // Clear buffer
    this.buffers.set(key, []);

    return {
      added,
      fused: {
        clusterCount: fusedClusterCount,
        originalCount: items.length,
        synthesizedMemories: synthesized,
      },
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
