/**
 * Multi-Source Context Registry (from moeru-ai/airi core-agent runtime)
 *
 * Implements:
 * Dynamic context injection with strategy-based bucket isolation:
 * - `replace-self`: Overwrites previous context from this writer (e.g. active IDE file, system health)
 * - `append-self`: Appends to history for this writer (e.g. notifications stream)
 */

export interface ContextMessage {
  source: string;
  content: string;
  strategy: "replace-self" | "append-self";
  timestamp?: number;
  metadata?: Record<string, any>;
}

export interface ContextIngestResult {
  sourceKey: string;
  mutation: "replace" | "append";
  entryCount: number;
}

export class ContextRegistry {
  private activeBuckets = new Map<string, ContextMessage[]>();
  private history: ContextMessage[] = [];
  private historyLimit = 400;

  constructor(historyLimit = 400) {
    this.historyLimit = historyLimit;
  }

  /**
   * Ingests a context message according to its strategy.
   */
  ingest(msg: ContextMessage): ContextIngestResult {
    const key = msg.source.trim().toLowerCase();
    const safeMsg: ContextMessage = {
      ...msg,
      timestamp: msg.timestamp || Date.now(),
    };

    if (!this.activeBuckets.has(key)) {
      this.activeBuckets.set(key, []);
    }

    let mutation: "replace" | "append" = "replace";

    if (msg.strategy === "append-self") {
      this.activeBuckets.get(key)!.push(safeMsg);
      mutation = "append";
    } else {
      // Default: replace-self
      this.activeBuckets.set(key, [safeMsg]);
      mutation = "replace";
    }

    this.history.push(safeMsg);
    if (this.history.length > this.historyLimit) {
      this.history = this.history.slice(-this.historyLimit);
    }

    return {
      sourceKey: key,
      mutation,
      entryCount: this.activeBuckets.get(key)!.length,
    };
  }

  /**
   * Alias for ingest supporting key/policy or source/strategy
   */
  register(entry: {
    key?: string;
    source?: string;
    policy?: "replace-self" | "append-self";
    strategy?: "replace-self" | "append-self";
    content: string;
    timestamp?: number;
    metadata?: Record<string, any>;
  }): ContextIngestResult {
    const source = entry.source || entry.key || "unknown";
    const strategy = entry.strategy || entry.policy || "replace-self";
    return this.ingest({
      source,
      content: entry.content,
      strategy,
      timestamp: entry.timestamp,
      metadata: entry.metadata,
    });
  }

  /**
   * Retrieves active entries for a specific source/key.
   */
  getEntries(source: string): ContextMessage[] {
    const key = source.trim().toLowerCase();
    return this.activeBuckets.get(key) || [];
  }

  /**
   * Clears context for a specific writer/source.
   */
  removeWriter(source: string): boolean {
    return this.activeBuckets.delete(source.trim().toLowerCase());
  }

  /**
   * Returns a snapshot of all active context messages formatted for prompt injection.
   */
  snapshot(): Record<string, ContextMessage[]> {
    const out: Record<string, ContextMessage[]> = {};
    for (const [k, v] of this.activeBuckets.entries()) {
      out[k] = [...v];
    }
    return out;
  }

  /**
   * Formats all active context buckets into a concise XML/text block for system prompts.
   */
  renderPromptBlock(): string {
    const parts: string[] = [];
    for (const [source, msgs] of this.activeBuckets.entries()) {
      if (msgs.length === 0) continue;
      const combined = msgs.map((m) => m.content).join("\n");
      parts.push(`<context_source name="${source}">\n${combined}\n</context_source>`);
    }
    return parts.join("\n\n");
  }

  /**
   * Resets all buckets and history.
   */
  reset(): void {
    this.activeBuckets.clear();
    this.history = [];
  }
}

// Global singleton instance
let globalContextRegistry: ContextRegistry | null = null;

export function getContextRegistry(): ContextRegistry {
  if (!globalContextRegistry) {
    globalContextRegistry = new ContextRegistry(400);
  }
  return globalContextRegistry;
}
