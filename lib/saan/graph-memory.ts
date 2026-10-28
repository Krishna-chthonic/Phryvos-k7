/**
 * Graph Associative Memory Engine
 * Clean-room TypeScript adaptation inspired by kwaroran/Risuai GraphMemClient.
 *
 * Implements:
 * 1. Entity nodes with summaries and directed relational edges (`connections`).
 * 2. Breadth-First Search (BFS) multi-hop traversal up to depth N.
 * 3. Textual similarity scoring on node names and summaries.
 */

export interface GraphNode {
  name: string;
  summary: string;
  connections: string[];
  metadata?: Record<string, any>;
  updatedAt?: number;
}

export interface GraphTraversalResult {
  query: string;
  matchedNodes: GraphNode[];
  traversedHops: number;
}

export class GraphMemoryStore {
  private nodes = new Map<string, GraphNode>();

  constructor(initialNodes?: GraphNode[]) {
    if (initialNodes) {
      for (const node of initialNodes) {
        this.addNode(node);
      }
    }
  }

  public addNode(node: GraphNode): void {
    const normalizedName = node.name.trim();
    this.nodes.set(normalizedName.toLowerCase(), {
      ...node,
      name: normalizedName,
      connections: Array.from(new Set(node.connections.map((c) => c.trim()))),
      updatedAt: node.updatedAt || Date.now(),
    });
  }

  public getNode(name: string): GraphNode | null {
    return this.nodes.get(name.trim().toLowerCase()) || null;
  }

  public getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  public deleteNode(name: string): boolean {
    return this.nodes.delete(name.trim().toLowerCase());
  }

  /**
   * Breadth-First Search traversal up to maxDepth hops starting from seed entities.
   */
  public traverse(seedNames: string[], maxDepth = 2): GraphNode[] {
    const visited = new Set<string>();
    const result: GraphNode[] = [];
    let currentQueue: string[] = [...seedNames];

    for (let depth = 0; depth <= maxDepth; depth++) {
      const nextQueue: string[] = [];

      for (const name of currentQueue) {
        const key = name.trim().toLowerCase();
        if (visited.has(key)) continue;
        visited.add(key);

        const node = this.nodes.get(key);
        if (node) {
          result.push(node);
          for (const conn of node.connections) {
            const connKey = conn.trim().toLowerCase();
            if (!visited.has(connKey)) {
              nextQueue.push(conn);
            }
          }
        }
      }

      currentQueue = nextQueue;
      if (currentQueue.length === 0) break;
    }

    return result;
  }

  /**
   * Searches graph nodes matching query terms, then expands via graph traversal.
   */
  public search(query: string, searchDepth = 2): GraphTraversalResult {
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
    const directMatches: string[] = [];

    for (const [key, node] of this.nodes.entries()) {
      const nameMatch = terms.some((term) => key.includes(term));
      const summaryMatch = terms.some((term) => node.summary.toLowerCase().includes(term));
      if (nameMatch || summaryMatch) {
        directMatches.push(node.name);
      }
    }

    const expandedNodes = this.traverse(directMatches, searchDepth);

    return {
      query,
      matchedNodes: expandedNodes,
      traversedHops: searchDepth,
    };
  }
}

// Global Singleton instance for Saan
let globalGraphMemoryInstance: GraphMemoryStore | null = null;

export function getGraphMemoryStore(): GraphMemoryStore {
  if (!globalGraphMemoryInstance) {
    globalGraphMemoryInstance = new GraphMemoryStore();
  }
  return globalGraphMemoryInstance;
}
