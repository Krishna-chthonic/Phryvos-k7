/**
 * Associative Memory Network for Saan Companion (K7)
 * Clean-room adaptation of agiresearch/A-mem architecture (Commit ceffb86, MIT).
 *
 * Implements:
 * 1. MemoryNote data structure with evolution history and contextual linkages.
 * 2. Hybrid dense + sparse (BM25 token overlap) retrieval scoring (alpha = 0.6).
 * 3. Associative task-to-memory and memory-to-memory multi-hop cluster traversal.
 * 4. Autonomous memory evolution loop (strengthen + update_neighbor semantics).
 */

import crypto from "node:crypto";

export interface MemoryNote {
  id: string;
  content: string;
  keywords: string[];
  links: string[]; // Associated MemoryNote IDs
  retrieval_count: number;
  timestamp: string;
  last_accessed: string;
  context: string;
  evolution_history: Array<{
    action: string;
    timestamp: string;
    details?: Record<string, unknown>;
  }>;
  category: string;
  tags: string[];
  metadata?: Record<string, unknown>;
}

export interface HybridScoreResult {
  note: MemoryNote;
  score: number;
  denseScore: number;
  bm25Score: number;
}

export interface EvolutionDecision {
  should_evolve: boolean;
  actions: ("strengthen" | "update_neighbor")[];
  suggested_connections: string[];
  tags_to_update: string[];
  new_context_neighborhood?: string[];
  new_tags_neighborhood?: string[][];
}

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "because", "as", "what",
  "which", "this", "that", "these", "those", "then", "just", "so", "than",
  "such", "both", "through", "about", "for", "is", "of", "while", "during",
  "to", "from", "in", "out", "on", "off", "again", "further", "then", "once",
  "here", "there", "when", "where", "why", "how", "all", "any", "both", "each",
  "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only",
  "own", "same", "so", "than", "too", "very", "can", "will", "just", "don",
  "should", "now"
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

function computeBM25Score(queryTokens: string[], docTokens: string[], avgDocLen = 20, k1 = 1.5, b = 0.75): number {
  if (queryTokens.length === 0 || docTokens.length === 0) return 0;
  const docLen = docTokens.length;
  const docFreq: Record<string, number> = {};
  for (const t of docTokens) {
    docFreq[t] = (docFreq[t] || 0) + 1;
  }

  let score = 0;
  for (const q of queryTokens) {
    const f = docFreq[q] || 0;
    if (f > 0) {
      const idf = Math.log(1 + 1); // Normalized single-collection smoothing
      const tf = (f * (k1 + 1)) / (f + k1 * (1 - b + b * (docLen / avgDocLen)));
      score += idf * tf;
    }
  }
  return Math.min(1.0, score / Math.max(1, queryTokens.length * 2));
}

function computeDenseOverlap(queryTokens: string[], docTokens: string[]): number {
  if (queryTokens.length === 0 || docTokens.length === 0) return 0;
  const docSet = new Set(docTokens);
  let overlap = 0;
  for (const q of queryTokens) {
    if (docSet.has(q)) overlap++;
  }
  return overlap / Math.max(1, queryTokens.length);
}

export class AssociativeMemoryNetwork {
  private notes: Map<string, MemoryNote> = new Map();
  private taskLinks: Map<string, Set<string>> = new Map(); // taskId -> Set<noteId>

  /**
   * Add a new MemoryNote to the network.
   */
  public addNote(content: string, options?: Partial<MemoryNote>): MemoryNote {
    const now = new Date().toISOString();
    const id = options?.id || `note-${crypto.randomUUID().slice(0, 8)}`;
    const analysis = this.analyzeContent(content);

    const note: MemoryNote = {
      id,
      content,
      keywords: options?.keywords || analysis.keywords,
      links: options?.links || [],
      retrieval_count: options?.retrieval_count || 0,
      timestamp: options?.timestamp || now,
      last_accessed: options?.last_accessed || now,
      context: options?.context || analysis.context,
      evolution_history: options?.evolution_history || [],
      category: options?.category || "general",
      tags: options?.tags || analysis.tags,
      metadata: options?.metadata || {},
    };

    this.notes.set(id, note);
    return note;
  }

  /**
   * Analyze text content using heuristic keyword and theme extraction.
   */
  public analyzeContent(content: string): { keywords: string[]; context: string; tags: string[] } {
    const tokens = tokenize(content);
    const freq: Record<string, number> = {};
    for (const t of tokens) {
      freq[t] = (freq[t] || 0) + 1;
    }

    const sortedTokens = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([w]) => w);

    const keywords = sortedTokens.slice(0, 6);
    const tags = sortedTokens.slice(0, 3).map((w) => `theme:${w}`);
    const firstSentence = content.split(/[.?!]/)[0]?.trim() || content.slice(0, 80);
    const context = `Context: ${firstSentence}`;

    return { keywords, context, tags };
  }

  /**
   * Hybrid retrieval combining dense semantic overlap and BM25 token relevance.
   * Score = alpha * dense + (1 - alpha) * bm25
   */
  public hybridScore(query: string, note: MemoryNote, alpha = 0.6): HybridScoreResult {
    const queryTokens = tokenize(query);
    const noteText = `${note.content} ${note.keywords.join(" ")} ${note.tags.join(" ")} ${note.context}`;
    const docTokens = tokenize(noteText);

    const denseScore = computeDenseOverlap(queryTokens, docTokens);
    const bm25Score = computeBM25Score(queryTokens, docTokens);
    const score = Number((alpha * denseScore + (1 - alpha) * bm25Score).toFixed(4));

    return { note, score, denseScore, bm25Score };
  }

  /**
   * Search related memories ordered by hybrid score.
   */
  public findRelatedMemories(query: string, k = 5, alpha = 0.6): HybridScoreResult[] {
    const scored: HybridScoreResult[] = [];
    const now = new Date().toISOString();

    for (const note of this.notes.values()) {
      const res = this.hybridScore(query, note, alpha);
      if (res.score > 0) {
        scored.push(res);
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const topResults = scored.slice(0, k);

    // Update retrieval telemetry
    for (const res of topResults) {
      res.note.retrieval_count += 1;
      res.note.last_accessed = now;
    }

    return topResults;
  }

  /**
   * Autonomous memory evolution loop.
   * Based on A-mem process_memory logic:
   * - strengthens associative links between note and its nearest neighbors
   * - propagates context and updated tags into neighbor notes
   */
  public processEvolution(
    noteId: string,
    neighbors: MemoryNote[],
    decisionOverride?: EvolutionDecision
  ): { evolved: boolean; actions: string[]; updatedNote: MemoryNote } {
    const note = this.notes.get(noteId);
    if (!note) {
      throw new Error(`MemoryNote ${noteId} not found`);
    }

    const now = new Date().toISOString();
    // Default deterministic decision when no override is provided
    const decision: EvolutionDecision = decisionOverride || {
      should_evolve: neighbors.length > 0,
      actions: neighbors.length > 0 ? ["strengthen", "update_neighbor"] : [],
      suggested_connections: neighbors.map((n) => n.id),
      tags_to_update: Array.from(new Set([...note.tags, ...neighbors.flatMap((n) => n.tags)])),
      new_context_neighborhood: neighbors.map((n) => `${n.context} (linked to ${note.id})`),
      new_tags_neighborhood: neighbors.map((n) => Array.from(new Set([...n.tags, `ref:${note.id}`]))),
    };

    if (!decision.should_evolve) {
      return { evolved: false, actions: [], updatedNote: note };
    }

    for (const action of decision.actions) {
      if (action === "strengthen") {
        for (const conn of decision.suggested_connections) {
          if (!note.links.includes(conn) && conn !== note.id) {
            note.links.push(conn);
          }
        }
        note.tags = Array.from(new Set([...note.tags, ...decision.tags_to_update]));
        note.evolution_history.push({
          action: "strengthen",
          timestamp: now,
          details: { connections: decision.suggested_connections, tags: note.tags },
        });
      } else if (action === "update_neighbor") {
        const newContexts = decision.new_context_neighborhood || [];
        const newTags = decision.new_tags_neighborhood || [];

        neighbors.forEach((neighbor, idx) => {
          const liveNeighbor = this.notes.get(neighbor.id);
          if (liveNeighbor) {
            if (newContexts[idx]) {
              liveNeighbor.context = newContexts[idx];
            }
            if (newTags[idx]) {
              liveNeighbor.tags = Array.from(new Set([...liveNeighbor.tags, ...newTags[idx]]));
            }
            if (!liveNeighbor.links.includes(note.id)) {
              liveNeighbor.links.push(note.id);
            }
            liveNeighbor.evolution_history.push({
              action: "update_neighbor",
              timestamp: now,
              details: { sourceNoteId: note.id },
            });
          }
        });
      }
    }

    return { evolved: true, actions: decision.actions, updatedNote: note };
  }

  /**
   * Associative linking between an active task and memories.
   */
  public linkTaskToMemory(taskId: string, noteId: string): void {
    if (!this.notes.has(noteId)) {
      throw new Error(`MemoryNote ${noteId} does not exist`);
    }
    if (!this.taskLinks.has(taskId)) {
      this.taskLinks.set(taskId, new Set());
    }
    this.taskLinks.get(taskId)!.add(noteId);
  }

  /**
   * Query memories associated with a task.
   */
  public getMemoriesForTask(taskId: string): MemoryNote[] {
    const noteIds = this.taskLinks.get(taskId);
    if (!noteIds) return [];
    const results: MemoryNote[] = [];
    for (const id of noteIds) {
      const note = this.notes.get(id);
      if (note) results.push(note);
    }
    return results;
  }

  /**
   * Multi-hop traversal across linked memory cluster.
   */
  public traverseLinkedCluster(startNoteId: string, maxDepth = 3): MemoryNote[] {
    const visited = new Set<string>();
    const cluster: MemoryNote[] = [];
    const queue: Array<{ id: string; depth: number }> = [{ id: startNoteId, depth: 0 }];

    while (queue.length > 0) {
      const item = queue.shift()!;
      if (visited.has(item.id)) continue;
      visited.add(item.id);

      const note = this.notes.get(item.id);
      if (!note) continue;
      cluster.push(note);

      if (item.depth < maxDepth) {
        for (const linkedId of note.links) {
          if (!visited.has(linkedId)) {
            queue.push({ id: linkedId, depth: item.depth + 1 });
          }
        }
      }
    }

    return cluster;
  }

  public getNote(id: string): MemoryNote | undefined {
    return this.notes.get(id);
  }

  public getAllNotes(): MemoryNote[] {
    return Array.from(this.notes.values());
  }

  public clear(): void {
    this.notes.clear();
    this.taskLinks.clear();
  }
}
