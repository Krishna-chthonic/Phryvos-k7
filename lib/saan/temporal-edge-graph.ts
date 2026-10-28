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

export class TemporalEdgeGraphStore {
  private edges = new Map<string, TemporalEntityEdge>();

  constructor(initialEdges?: TemporalEntityEdge[]) {
    if (initialEdges) {
      for (const edge of initialEdges) {
        this.edges.set(edge.id, { ...edge });
      }
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
}

// Global Singleton for Saan
let globalTemporalEdgeGraphInstance: TemporalEdgeGraphStore | null = null;

export function getTemporalEdgeGraphStore(): TemporalEdgeGraphStore {
  if (!globalTemporalEdgeGraphInstance) {
    globalTemporalEdgeGraphInstance = new TemporalEdgeGraphStore();
  }
  return globalTemporalEdgeGraphInstance;
}
