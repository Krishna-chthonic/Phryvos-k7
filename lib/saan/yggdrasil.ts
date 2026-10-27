/**
 * Yggdrasil — World Tree Associative Memory Graph (from Kronic90/Mimirs-Memory-Hub)
 *
 * Implements:
 * 1. 6 Edge Types: entity, lexical, temporal, emotional, task_origin, caused_lesson
 * 2. Spreading Activation (Collins & Loftus 1975) with hops, decay, and thresholding
 * 3. Associative Pathfinding (BFS shortest associative trail between two memories)
 * 4. Visualization Payload for K7 Graph & Timeline UI
 */

import { getDb } from "@/lib/db/client";
import { extractContentWords } from "@/lib/saan/mimir-cognitive";

export const YGGDRASIL_WORD_EDGE_MIN = 0.20;
export const YGGDRASIL_WORD_EDGE_MAX = 0.55;
export const YGGDRASIL_TEMPORAL_DAYS = 3.0;
export const SPREADING_ACTIVATION_HOPS = 3;
export const SPREADING_ACTIVATION_DECAY = 0.5;
export const SPREADING_ACTIVATION_THRESHOLD = 0.08;

export type YggdrasilEdgeType =
  | "entity"
  | "lexical"
  | "temporal"
  | "emotional"
  | "task_origin"
  | "caused_lesson";

export interface YggdrasilEdge {
  sourceId: number;
  targetId: number;
  edgeType: YggdrasilEdgeType;
  weight: number;
}

export interface YggdrasilNode {
  id: number;
  point: string;
  category: string;
  importance: number;
  vividness: number;
  createdAt: number;
}

/**
 * Calculates Jaccard word overlap ratio.
 */
function jaccardSimilarity(wordsA: string[], wordsB: string[]): number {
  if (!wordsA.length || !wordsB.length) return 0.0;
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? intersection / union : 0.0;
}

/**
 * Rebuilds or synchronizes the Yggdrasil associative graph across active memories.
 */
export function buildYggdrasilGraph(): YggdrasilEdge[] {
  const db = getDb();
  const memories = db.prepare(`
    SELECT id, point, category, importance, vividness, created_at, emotion_pad
    FROM saan_memories
    WHERE status = 'active'
    ORDER BY created_at DESC
    LIMIT 200
  `).all() as any[];

  if (memories.length < 2) return [];

  const edges: YggdrasilEdge[] = [];
  const processedWords = memories.map((m) => extractContentWords(m.point));

  // Build pairwise relationships
  for (let i = 0; i < memories.length; i++) {
    const memA = memories[i];
    const wordsA = processedWords[i];
    const timeA = memA.created_at;

    for (let j = i + 1; j < memories.length; j++) {
      const memB = memories[j];
      const wordsB = processedWords[j];
      const timeB = memB.created_at;

      // 1. Lexical overlap
      const sim = jaccardSimilarity(wordsA, wordsB);
      if (sim >= YGGDRASIL_WORD_EDGE_MIN && sim <= YGGDRASIL_WORD_EDGE_MAX) {
        edges.push({
          sourceId: memA.id,
          targetId: memB.id,
          edgeType: "lexical",
          weight: Number(sim.toFixed(3)),
        });
      }

      // 2. Temporal proximity (within 3 days)
      const diffDays = Math.abs(timeA - timeB) / (86400 * 1000);
      if (diffDays <= YGGDRASIL_TEMPORAL_DAYS) {
        const weight = Number((0.3 * (1.0 - diffDays / YGGDRASIL_TEMPORAL_DAYS)).toFixed(3));
        edges.push({
          sourceId: memA.id,
          targetId: memB.id,
          edgeType: "temporal",
          weight,
        });
      }

      // 3. Emotional congruence
      if (memA.emotion_pad && memB.emotion_pad) {
        try {
          const padA: [number, number, number] = JSON.parse(memA.emotion_pad);
          const padB: [number, number, number] = JSON.parse(memB.emotion_pad);
          // Check if same quadrant
          if (Math.sign(padA[0]) === Math.sign(padB[0]) && Math.sign(padA[1]) === Math.sign(padB[1])) {
            edges.push({
              sourceId: memA.id,
              targetId: memB.id,
              edgeType: "emotional",
              weight: 0.25,
            });
          }
        } catch {}
      }

      // 4. Same category linkage (e.g. promise, preference)
      if (memA.category === memB.category && memA.category !== "general") {
        edges.push({
          sourceId: memA.id,
          targetId: memB.id,
          edgeType: "task_origin",
          weight: 0.35,
        });
      }
    }
  }

  // Persist edges to SQLite
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO saan_yggdrasil_edges (source_id, target_id, edge_type, weight)
    VALUES (?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (const e of edges) {
      insertStmt.run(e.sourceId, e.targetId, e.edgeType, e.weight);
      // Bi-directional symmetry in memory network
      insertStmt.run(e.targetId, e.sourceId, e.edgeType, e.weight);
    }
  });
  tx();

  return edges;
}

/**
 * Collins & Loftus (1975) Spreading Activation algorithm.
 * Propagates activation energy from seed memories along Yggdrasil edges.
 */
export function spreadingActivation(
  seedIds: number[],
  hops = SPREADING_ACTIVATION_HOPS,
  decay = SPREADING_ACTIVATION_DECAY,
  threshold = SPREADING_ACTIVATION_THRESHOLD
): Map<number, number> {
  const db = getDb();
  const activation = new Map<number, number>();

  for (const id of seedIds) {
    activation.set(id, 1.0);
  }

  let frontier = new Set<number>(seedIds);

  for (let hop = 0; hop < hops; hop++) {
    const nextFrontier = new Set<number>();
    const hopDecay = Math.pow(decay, hop + 1);

    for (const nodeId of frontier) {
      const edges = db.prepare(`
        SELECT target_id, weight 
        FROM saan_yggdrasil_edges 
        WHERE source_id = ?
      `).all(nodeId) as Array<{ target_id: number; weight: number }>;

      for (const e of edges) {
        const transmitted = hopDecay * e.weight;
        if (transmitted < threshold) continue;

        const prev = activation.get(e.target_id) || 0;
        activation.set(e.target_id, prev + transmitted);

        if (!seedIds.includes(e.target_id)) {
          nextFrontier.add(e.target_id);
        }
      }
    }

    frontier = nextFrontier;
    if (frontier.size === 0) break;
  }

  return activation;
}

/**
 * Finds the shortest associative path between two memories using BFS.
 */
export function findAssociativePath(
  sourceId: number,
  targetId: number
): Array<{ memoryId: number; edgeType?: string }> | null {
  if (sourceId === targetId) return [{ memoryId: sourceId }];

  const db = getDb();
  const queue: Array<{ current: number; path: Array<{ memoryId: number; edgeType?: string }> }> = [
    { current: sourceId, path: [{ memoryId: sourceId }] },
  ];
  const visited = new Set<number>([sourceId]);

  while (queue.length > 0) {
    const { current, path } = queue.shift()!;
    if (path.length > 5) continue; // Bound depth

    const neighbors = db.prepare(`
      SELECT target_id, edge_type, weight
      FROM saan_yggdrasil_edges
      WHERE source_id = ?
      ORDER BY weight DESC
    `).all(current) as Array<{ target_id: number; edge_type: string; weight: number }>;

    for (const n of neighbors) {
      if (n.target_id === targetId) {
        return [...path, { memoryId: targetId, edgeType: n.edge_type }];
      }
      if (!visited.has(n.target_id)) {
        visited.add(n.target_id);
        queue.push({
          current: n.target_id,
          path: [...path, { memoryId: n.target_id, edgeType: n.edge_type }],
        });
      }
    }
  }

  return null;
}

/**
 * Returns a complete visualization summary of the Yggdrasil memory graph.
 */
export function getYggdrasilVizSummary(): {
  totalNodes: number;
  totalEdges: number;
  nodes: YggdrasilNode[];
  edges: YggdrasilEdge[];
} {
  const db = getDb();
  const nodes = db.prepare(`
    SELECT id, point, category, importance, vividness, created_at as createdAt
    FROM saan_memories
    WHERE status = 'active'
    ORDER BY created_at DESC
    LIMIT 100
  `).all() as YggdrasilNode[];

  const edges = db.prepare(`
    SELECT source_id as sourceId, target_id as targetId, edge_type as edgeType, weight
    FROM saan_yggdrasil_edges
    LIMIT 250
  `).all() as YggdrasilEdge[];

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    nodes,
    edges,
  };
}
