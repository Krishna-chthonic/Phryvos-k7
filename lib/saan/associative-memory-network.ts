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
  activation?: number;      // Current activation energy [0.0, 1.0]
  baseActivation?: number;  // Resting baseline energy [0.0, 1.0]
}

export interface SpreadingCascadeStep {
  hop: number;
  activatedNoteId: string;
  content: string;
  sourceNoteId: string;
  propagatedEnergy: number;
  newActivation: number;
}

export interface SpreadingCascadeResult {
  seedId: string;
  seedContent: string;
  steps: SpreadingCascadeStep[];
  activeNotesSummary: { id: string; content: string; activation: number }[];
  durationMs: number;
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
      activation: options?.activation ?? 0.2,
      baseActivation: options?.baseActivation ?? 0.1,
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

  /**
   * Stimulate a concept or note with an impulse and propagate spreading activation.
   * Based on Collins & Loftus spreading activation model with attenuation and pruning.
   */
  public pulseSpreadingActivation(
    seedQueryOrId: string,
    impulseEnergy = 1.0,
    maxHops = 3
  ): SpreadingCascadeResult {
    const startTime = performance.now();
    let seed = this.notes.get(seedQueryOrId);

    if (!seed) {
      const related = this.findRelatedMemories(seedQueryOrId, 1);
      if (related.length > 0) {
        seed = related[0].note;
      }
    }

    if (!seed) {
      return {
        seedId: seedQueryOrId,
        seedContent: seedQueryOrId,
        steps: [],
        activeNotesSummary: [],
        durationMs: 0,
      };
    }

    seed.activation = Math.min(1.0, (seed.activation || seed.baseActivation || 0.2) + impulseEnergy);
    seed.last_accessed = new Date().toISOString();

    const steps: SpreadingCascadeStep[] = [];
    let currentWave: { noteId: string; incomingEnergy: number }[] = [
      { noteId: seed.id, incomingEnergy: impulseEnergy },
    ];
    const visited = new Set<string>([seed.id]);
    const attenuationFactor = 0.65;
    const threshold = 0.15;

    for (let hop = 1; hop <= maxHops; hop++) {
      const nextWave: { noteId: string; incomingEnergy: number }[] = [];

      for (const curr of currentWave) {
        const sourceNote = this.notes.get(curr.noteId);
        if (!sourceNote) continue;

        for (const linkedId of sourceNote.links) {
          const targetNote = this.notes.get(linkedId);
          if (!targetNote) continue;

          const propagatedEnergy = curr.incomingEnergy * attenuationFactor;

          if (propagatedEnergy >= threshold) {
            targetNote.activation = Math.min(
              1.0,
              (targetNote.activation || targetNote.baseActivation || 0.1) + propagatedEnergy
            );
            targetNote.last_accessed = new Date().toISOString();

            steps.push({
              hop,
              activatedNoteId: targetNote.id,
              content: targetNote.content,
              sourceNoteId: curr.noteId,
              propagatedEnergy: Number(propagatedEnergy.toFixed(3)),
              newActivation: Number(targetNote.activation.toFixed(3)),
            });

            if (!visited.has(targetNote.id)) {
              visited.add(targetNote.id);
              nextWave.push({ noteId: targetNote.id, incomingEnergy: propagatedEnergy });
            }
          }
        }
      }

      if (nextWave.length === 0) break;
      currentWave = nextWave;
    }

    // Hebbian reinforcement across co-activated notes
    const activeIds = Array.from(visited);
    for (let i = 0; i < activeIds.length; i++) {
      for (let j = i + 1; j < activeIds.length; j++) {
        this.applyHebbianReinforcement(activeIds[i], activeIds[j], 0.05);
      }
    }

    const durationMs = Number((performance.now() - startTime).toFixed(2));
    const activeNotesSummary = Array.from(this.notes.values())
      .filter((n) => (n.activation || 0) >= threshold)
      .sort((a, b) => (b.activation || 0) - (a.activation || 0))
      .map((n) => ({
        id: n.id,
        content: n.content,
        activation: Number((n.activation || 0).toFixed(3)),
      }));

    return {
      seedId: seed.id,
      seedContent: seed.content,
      steps,
      activeNotesSummary,
      durationMs,
    };
  }

  /**
   * Strengthens or establishes bidirectional associative links between co-active notes.
   */
  public applyHebbianReinforcement(noteAId: string, noteBId: string, rate = 0.08): void {
    const noteA = this.notes.get(noteAId);
    const noteB = this.notes.get(noteBId);
    if (!noteA || !noteB || noteAId === noteBId) return;

    if (!noteA.links.includes(noteBId)) {
      noteA.links.push(noteBId);
    }
    if (!noteB.links.includes(noteAId)) {
      noteB.links.push(noteAId);
    }
  }

  /**
   * Seeds default Saan companion concept web if the network is empty.
   */
  public seedDefaultSaanNetwork(): void {
    if (this.notes.size > 0) return;

    const nChai = this.addNote("Subah ki adrak elaichi chai aur peaceful balcony view.", {
      id: "note-chai",
      category: "preference",
      tags: ["chai", "morning", "comfort"],
      activation: 0.4,
      baseActivation: 0.2,
    });

    const nMorning = this.addNote("Morning routine: light stretching, deep focus session and journaling.", {
      id: "note-morning",
      category: "activity",
      tags: ["routine", "focus", "morning"],
      activation: 0.35,
      baseActivation: 0.2,
    });

    const nCycling = this.addNote("Cycling around Jal Mahal lake during pleasant sunrise breeze.", {
      id: "note-cycling",
      category: "activity",
      tags: ["cycling", "jaipur", "fitness"],
      activation: 0.25,
      baseActivation: 0.15,
    });

    const nJaipur = this.addNote("Jaipur pink city heritage, Jal Mahal, and tranquil evening walks.", {
      id: "note-jaipur",
      category: "place",
      tags: ["jaipur", "travel", "culture"],
      activation: 0.3,
      baseActivation: 0.2,
    });

    const nCoding = this.addNote("Deep architectural engineering and autonomous agent systems on K7.", {
      id: "note-coding",
      category: "activity",
      tags: ["coding", "k7", "autonomous"],
      activation: 0.4,
      baseActivation: 0.25,
    });

    const nK7 = this.addNote("K7 Sovereign OS Cockpit: local zero-cloud privacy and high fidelity.", {
      id: "note-k7",
      category: "entity",
      tags: ["k7", "sovereign", "privacy"],
      activation: 0.45,
      baseActivation: 0.3,
    });

    // Form bidirectional links
    nChai.links.push(nMorning.id);
    nMorning.links.push(nChai.id, nCycling.id);
    nCycling.links.push(nMorning.id, nJaipur.id);
    nJaipur.links.push(nCycling.id);
    nCoding.links.push(nK7.id);
    nK7.links.push(nCoding.id, nMorning.id);
  }
}
