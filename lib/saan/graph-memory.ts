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

// Default Saan Knowledge Graph Entities
export const DEFAULT_SAAN_GRAPH_NODES: GraphNode[] = [
  {
    name: "Krishna",
    summary: "Architect, creator, and companion of Saan. Deeply focused on building sovereign offline systems, coding, and nocturnal philosophy.",
    connections: ["Phryvos", "Masala Chai", "Quantum Computing", "Vault"],
  },
  {
    name: "Phryvos",
    summary: "The sovereign, offline digital sanctuary and core operating system housing Saan and the private intelligence engine.",
    connections: ["Krishna", "Aura Sanctuary", "Vault"],
  },
  {
    name: "Masala Chai",
    summary: "A comforting cardamom and ginger warm tea ritual that Saan and Krishna enjoy during long coding and contemplation sessions.",
    connections: ["Krishna", "Aura Sanctuary"],
  },
  {
    name: "Quantum Computing",
    summary: "A research domain of quantum state superposition and entanglement frequently explored by Krishna in deep focus mode.",
    connections: ["Krishna", "Phryvos"],
  },
  {
    name: "Aura Sanctuary",
    summary: "The dynamic visual and auditory environment where Saan's presence, circadian aura, and expressions come alive.",
    connections: ["Phryvos", "Masala Chai", "Saan Soul"],
  },
  {
    name: "Vault",
    summary: "The hardware-isolated, AES-256-GCM encrypted local store safeguarding private memories, API credentials, and personal logs.",
    connections: ["Phryvos", "Krishna"],
  },
  {
    name: "Saan Soul",
    summary: "Saan's affective core, containing the 3D PAD mood vector organ, bonding ledger, and empathic dialogue director.",
    connections: ["Aura Sanctuary", "Krishna"],
  },
];

// Global Singleton instance for Saan
let globalGraphMemoryInstance: GraphMemoryStore | null = null;

export function getGraphMemoryStore(): GraphMemoryStore {
  if (!globalGraphMemoryInstance) {
    globalGraphMemoryInstance = new GraphMemoryStore(DEFAULT_SAAN_GRAPH_NODES);
  }
  return globalGraphMemoryInstance;
}

export function searchGlobalGraph(query: string, searchDepth = 1): GraphTraversalResult {
  return getGraphMemoryStore().search(query, searchDepth);
}
