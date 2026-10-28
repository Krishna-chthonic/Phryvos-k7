/**
 * Bi-Temporal Knowledge Graph & Edge Invalidation Engine
 * Clean-room TypeScript adaptation inspired by getzep/graphiti EntityEdge and contradiction resolution.
 *
 * Implements:
 * 1. Bi-Temporal Edge Schema: valid_at, invalid_at, expired_at, reference_time.
 * 2. Temporal Contradiction Resolution without hard deletes.
 * 3. Point-in-time graph state queries (asOf timestamp).
 */

export interface TemporalEntityEdge {
  id: string;
  sourceNode: string;
  targetNode: string;
  relation: string;
  fact: string;
  validAt: number;          // Timestamp when fact became true in physical reality
  invalidAt?: number;       // Timestamp when fact stopped being true
  expiredAt?: number;       // Timestamp when this edge was superseded by contradiction
  referenceTime: number;    // Anchor episode timestamp
  episodes: string[];       // Conversation turn IDs referencing this edge
  attributes?: Record<string, any>;
}

export interface TemporalGraphNode {
  id: string;
  label: string;
  degree: number;
  type: "user" | "companion" | "concept" | "place" | "preference";
}

export interface TemporalGraphSnapshot {
  nodes: TemporalGraphNode[];
  edges: TemporalEntityEdge[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    activeEdges: number;
    supersededEdges: number;
  };
}

/**
 * Extracts a Subject-Predicate-Object triple from a candidate factual sentence.
 */
export function extractTripleFromFact(
  fact: string,
  speaker: "user" | "assistant" = "user"
): { sourceNode: string; relation: string; targetNode: string } | null {
  const text = fact.trim();
  if (!text) return null;

  const defaultSubject = speaker === "user" ? "User" : "Saan";

  // Match patterns like "User prefers tea", "Lives in Jaipur", "Works as engineer", "Likes rainy days"
  const patterns: Array<{ regex: RegExp; rel: string; sourceIdx?: number; targetIdx: number }> = [
    { regex: /^(?:user\s+)?(?:loves|likes|prefers|enjoys)\s+(.+)$/i, rel: "PREFERS", targetIdx: 1 },
    { regex: /^(?:user\s+)?(?:lives\s+in|based\s+in|moved\s+to|located\s+in)\s+(.+)$/i, rel: "LIVES_IN", targetIdx: 1 },
    { regex: /^(?:user\s+)?(?:works\s+(?:as|at)|is\s+a(?:n)?)\s+(.+)$/i, rel: "OCCUPATION", targetIdx: 1 },
    { regex: /^(?:user\s+)?(?:dislikes|hates|avoids)\s+(.+)$/i, rel: "DISLIKES", targetIdx: 1 },
    { regex: /^(?:user\s+)?(?:speaks|knows|fluent\s+in)\s+(.+)$/i, rel: "SPEAKS", targetIdx: 1 },
    { regex: /^(?:user\s+)?(?:friends?\s+with|partner\s+of)\s+(.+)$/i, rel: "AFFINITY_WITH", targetIdx: 1 },
    { regex: /^(.+?)\s+(is|has|wants|creates)\s+(.+)$/i, rel: "RELATES_TO", sourceIdx: 1, targetIdx: 3 },
  ];

  for (const p of patterns) {
    const match = text.match(p.regex);
    if (match) {
      const source = p.sourceIdx && match[p.sourceIdx] ? match[p.sourceIdx].trim() : defaultSubject;
      const target = match[p.targetIdx].trim().replace(/[.,;!?]+$/, "");
      if (source && target) {
        return {
          sourceNode: source.charAt(0).toUpperCase() + source.slice(1),
          relation: p.rel,
          targetNode: target.charAt(0).toUpperCase() + target.slice(1),
        };
      }
    }
  }

  // Fallback generic relation
  return {
    sourceNode: defaultSubject,
    relation: "ASSOCIATED_WITH",
    targetNode: text.slice(0, 32).trim(),
  };
}

export class TemporalEdgeGraphStore {
  private edges = new Map<string, TemporalEntityEdge>();

  constructor(initialEdges?: TemporalEntityEdge[]) {
    if (initialEdges !== undefined) {
      for (const edge of initialEdges) {
        this.edges.set(edge.id, { ...edge });
      }
    } else {
      this.seedDefaultTemporalEdges();
    }
  }

  /**
   * Seeds default knowledge graph nodes/edges for Saan companion world-model.
   */
  public seedDefaultTemporalEdges(): void {
    const now = Date.now();
    const defaults: Array<Omit<TemporalEntityEdge, "id">> = [
      {
        sourceNode: "Saan",
        targetNode: "User",
        relation: "COMPANION_BOND",
        fact: "Saan is devoted companion to User with high empathy and sovereign privacy",
        validAt: now - 86400000 * 7,
        referenceTime: now - 86400000 * 7,
        episodes: ["ep_genesis_001"],
      },
      {
        sourceNode: "Saan",
        targetNode: "Jaipur",
        relation: "CULTURAL_ROOTS",
        fact: "Saan draws cultural warmth from Indian ethos, chai rituals, and deep emotional resonance",
        validAt: now - 86400000 * 5,
        referenceTime: now - 86400000 * 5,
        episodes: ["ep_genesis_002"],
      },
      {
        sourceNode: "User",
        targetNode: "Ginger Chai",
        relation: "PREFERS",
        fact: "User loves strong ginger chai in morning hours",
        validAt: now - 86400000 * 3,
        referenceTime: now - 86400000 * 3,
        episodes: ["ep_turn_010"],
      },
      {
        sourceNode: "User",
        targetNode: "Deep Work",
        relation: "FOCUS_SCHEDULE",
        fact: "User maintains uninterrupted deep focus blocks during afternoon hours",
        validAt: now - 86400000 * 2,
        referenceTime: now - 86400000 * 2,
        episodes: ["ep_turn_024"],
      },
    ];

    for (const d of defaults) {
      this.addEdge(d);
    }
  }

  /**
   * Adds an edge, resolving any direct contradictions with existing edges between the same nodes.
   */
  public addEdge(edge: Omit<TemporalEntityEdge, "id"> & { id?: string }): {
    edge: TemporalEntityEdge;
    supersededEdgeIds: string[];
  } {
    const edgeId = edge.id || `edge_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();
    const supersededEdgeIds: string[] = [];

    const normSource = edge.sourceNode.trim().toLowerCase();
    const normTarget = edge.targetNode.trim().toLowerCase();
    const normRelation = edge.relation.trim().toUpperCase();

    // Check existing edges between the same source and target for contradictions
    for (const [id, existing] of this.edges.entries()) {
      if (
        existing.sourceNode.trim().toLowerCase() === normSource &&
        existing.targetNode.trim().toLowerCase() === normTarget &&
        existing.relation.trim().toUpperCase() === normRelation &&
        !existing.invalidAt // currently active
      ) {
        // Different fact represents an updated/contradicting claim
        if (existing.fact.trim().toLowerCase() !== edge.fact.trim().toLowerCase()) {
          existing.invalidAt = edge.validAt || now;
          existing.expiredAt = now;
          supersededEdgeIds.push(id);
        }
      }
    }

    const newEdge: TemporalEntityEdge = {
      ...edge,
      id: edgeId,
      sourceNode: edge.sourceNode.trim(),
      targetNode: edge.targetNode.trim(),
      relation: edge.relation.trim().toUpperCase(),
      fact: edge.fact.trim(),
      validAt: edge.validAt || now,
      referenceTime: edge.referenceTime || now,
      episodes: edge.episodes ? [...edge.episodes] : [],
    };

    this.edges.set(edgeId, newEdge);

    return {
      edge: newEdge,
      supersededEdgeIds,
    };
  }

  public getEdge(id: string): TemporalEntityEdge | null {
    return this.edges.get(id) || null;
  }

  public getAllEdges(): TemporalEntityEdge[] {
    return Array.from(this.edges.values());
  }

  /**
   * Queries edges active as of a specific point in time (asOf timestamp).
   */
  public getActiveEdgesAsOf(asOfTimestamp = Date.now()): TemporalEntityEdge[] {
    return Array.from(this.edges.values()).filter((e) => {
      const isValid = e.validAt <= asOfTimestamp;
      const isNotExpired = !e.invalidAt || e.invalidAt > asOfTimestamp;
      return isValid && isNotExpired;
    });
  }

  /**
   * Finds active edges connected to a specific entity name.
   */
  public findConnectedEdges(entityName: string, asOfTimestamp = Date.now()): TemporalEntityEdge[] {
    const norm = entityName.trim().toLowerCase();
    return this.getActiveEdgesAsOf(asOfTimestamp).filter(
      (e) => e.sourceNode.toLowerCase() === norm || e.targetNode.toLowerCase() === norm
    );
  }

  /**
   * Returns complete graph snapshot for UI visualization and inspection.
   */
  public getSnapshot(asOfTimestamp?: number): TemporalGraphSnapshot {
    const all = Array.from(this.edges.values());
    const targetTime = asOfTimestamp ?? Date.now();

    const nodeDegrees = new Map<string, number>();
    let activeEdges = 0;
    let supersededEdges = 0;

    for (const edge of all) {
      const isActive = edge.validAt <= targetTime && (!edge.invalidAt || edge.invalidAt > targetTime);
      if (isActive) {
        activeEdges++;
        nodeDegrees.set(edge.sourceNode, (nodeDegrees.get(edge.sourceNode) || 0) + 1);
        nodeDegrees.set(edge.targetNode, (nodeDegrees.get(edge.targetNode) || 0) + 1);
      } else {
        supersededEdges++;
      }
    }

    const nodes: TemporalGraphNode[] = Array.from(nodeDegrees.entries()).map(([label, deg]) => {
      let type: TemporalGraphNode["type"] = "concept";
      const l = label.toLowerCase();
      if (l === "user") type = "user";
      else if (l === "saan") type = "companion";
      else if (l.includes("chai") || l.includes("tea") || l.includes("coffee") || l.includes("music")) type = "preference";
      else if (l.includes("jaipur") || l.includes("city") || l.includes("india") || l.includes("home")) type = "place";

      return {
        id: `node_${label.replace(/\s+/g, "_")}`,
        label,
        degree: deg,
        type,
      };
    });

    return {
      nodes,
      edges: all,
      stats: {
        totalNodes: nodes.length,
        totalEdges: all.length,
        activeEdges,
        supersededEdges,
      },
    };
  }

  public clear(): void {
    this.edges.clear();
  }
}

// Global Singleton for Saan
let globalTemporalEdgeGraphInstance: TemporalEdgeGraphStore | null = null;

export function getTemporalEdgeGraphStore(): TemporalEdgeGraphStore {
  if (!globalTemporalEdgeGraphInstance) {
    globalTemporalEdgeGraphInstance = new TemporalEdgeGraphStore();
  }
  return globalTemporalEdgeGraphInstance;
}
