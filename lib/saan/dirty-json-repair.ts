/**
 * AutoGPT & Agent-Zero Recursive-Descent Dirty JSON Repair Engine & Audit Drawer
 *
 * Clean-room adaptation synthesizing AutoGPT + Agent-Zero:
 * 1. Resilient repair of common LLM hallucinations and malformed JSON syntax:
 *    - Markdown fences (```json, ```action)
 *    - Single-line (//) and multi-line (/* *\/) comments
 *    - Unquoted keys ({action: "search"} -> {"action": "search"})
 *    - Single-quoted strings ('value' -> "value")
 *    - Python literals (True -> true, False -> false, None -> null)
 *    - Trailing commas ({a: 1,} -> {"a": 1})
 *    - Missing closing braces or brackets (heuristic balancing)
 * 2. In-memory repair audit logger with anomaly categorization.
 * 3. Side-by-side raw vs repaired verification.
 */

export interface JsonRepairAuditEvent {
  id: string;
  rawInput: string;
  repairedText: string;
  parsedData: any;
  success: boolean;
  anomaliesFixed: string[];
  durationMs: number;
  createdAt: string;
  errorMessage?: string;
}

export interface RepairResult {
  success: boolean;
  data: any;
  repairedText: string;
  anomalies: string[];
  durationMs: number;
  error?: string;
}

export class DirtyJsonRepairEngine {
  /**
   * Comprehensive multi-pass dirty JSON sanitizer and parser.
   */
  public static repairAndParse(raw: string): RepairResult {
    const startTime = Date.now();
    const anomalies: string[] = [];

    if (!raw || typeof raw !== "string" || !raw.trim()) {
      return {
        success: false,
        data: null,
        repairedText: "",
        anomalies: ["empty_input"],
        durationMs: Date.now() - startTime,
        error: "Empty or non-string input provided",
      };
    }

    let text = raw.trim();

    // Pass 1: Strip markdown code block wrappers
    if (/^```(?:json|saan_action)?/i.test(text) || /\s*```$/.test(text)) {
      text = text.replace(/^```(?:json|saan_action)?\s*/i, "").replace(/\s*```$/i, "");
      anomalies.push("stripped_markdown_fence");
    }

    // Pass 2: Strip comments
    if (/\/\/.*$/m.test(text) || /\/\*[\s\S]*?\*\//.test(text)) {
      text = text
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      anomalies.push("stripped_comments");
    }

    // Pass 3: Replace Python literals
    if (/\b(?:True|False|None)\b/.test(text)) {
      text = text
        .replace(/\bTrue\b/g, "true")
        .replace(/\bFalse\b/g, "false")
        .replace(/\bNone\b/g, "null");
      anomalies.push("replaced_python_literals");
    }

    // Pass 4: Fix single-quoted strings to double-quoted strings
    if (/'([^'\\]*(?:\\.[^'\\]*)*)'/.test(text)) {
      text = text.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_m, content) => {
        return `"${content.replace(/"/g, '\\"')}"`;
      });
      anomalies.push("normalized_single_quotes");
    }

    // Pass 5: Quote unquoted object keys: { key: "val" } -> { "key": "val" }
    const unquotedKeyRegex = /([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g;
    if (unquotedKeyRegex.test(text)) {
      text = text.replace(unquotedKeyRegex, '$1"$2"$3');
      anomalies.push("fixed_unquoted_keys");
    }

    // Pass 6: Remove trailing commas before } or ]
    if (/,\s*([\]}])/g.test(text)) {
      text = text.replace(/,\s*([\]}])/g, "$1");
      anomalies.push("removed_trailing_commas");
    }

    // Pass 7: Heuristic bracket and brace balancing
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (c === "\\") {
        escapeNext = true;
        continue;
      }
      if (c === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (c === "{") openBraces++;
        else if (c === "}") openBraces = Math.max(0, openBraces - 1);
        else if (c === "[") openBrackets++;
        else if (c === "]") openBrackets = Math.max(0, openBrackets - 1);
      }
    }

    if (openBrackets > 0) {
      text += "]".repeat(openBrackets);
      anomalies.push(`balanced_${openBrackets}_brackets`);
    }
    if (openBraces > 0) {
      text += "}".repeat(openBraces);
      anomalies.push(`balanced_${openBraces}_braces`);
    }

    // Attempt final parse
    try {
      const parsed = JSON.parse(text);
      return {
        success: true,
        data: parsed,
        repairedText: text,
        anomalies: anomalies.length > 0 ? anomalies : ["clean_json"],
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        success: false,
        data: null,
        repairedText: text,
        anomalies,
        durationMs: Date.now() - startTime,
        error: err.message,
      };
    }
  }
}

export class DirtyJsonRepairAuditor {
  private events: JsonRepairAuditEvent[] = [];
  private maxHistory: number;

  constructor(options?: { maxHistory?: number }) {
    this.maxHistory = options?.maxHistory ?? 30;
  }

  public recordRepair(raw: string, result: RepairResult): JsonRepairAuditEvent {
    const event: JsonRepairAuditEvent = {
      id: `repair_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      rawInput: raw,
      repairedText: result.repairedText,
      parsedData: result.data,
      success: result.success,
      anomaliesFixed: result.anomalies,
      durationMs: result.durationMs,
      createdAt: new Date().toISOString(),
      errorMessage: result.error,
    };

    this.events.unshift(event);
    if (this.events.length > this.maxHistory) {
      this.events.pop();
    }

    return event;
  }

  public getEvents(): JsonRepairAuditEvent[] {
    return [...this.events];
  }

  public getStats(): {
    totalAudits: number;
    successCount: number;
    failCount: number;
    anomalyFrequencies: Record<string, number>;
  } {
    const anomalyFrequencies: Record<string, number> = {};
    let successCount = 0;
    let failCount = 0;

    for (const e of this.events) {
      if (e.success) successCount++;
      else failCount++;

      for (const a of e.anomaliesFixed) {
        anomalyFrequencies[a] = (anomalyFrequencies[a] || 0) + 1;
      }
    }

    return {
      totalAudits: this.events.length,
      successCount,
      failCount,
      anomalyFrequencies,
    };
  }

  public clear(): void {
    this.events = [];
  }
}

/**
 * Singleton Auditor instance
 */
let globalAuditor: DirtyJsonRepairAuditor | null = null;

export function getDirtyJsonRepairAuditor(): DirtyJsonRepairAuditor {
  if (!globalAuditor) {
    globalAuditor = new DirtyJsonRepairAuditor({ maxHistory: 30 });
    // Seed initial representative repair trace
    const seedRaw = `
      // AutoGPT Tool Invocation
      \`\`\`json
      {
        action: "search_temporal_graph",
        query: 'adrak chai',
        recursive: True,
        depth: 2,
        notes: None,
      }
      \`\`\`
    `;
    const res = DirtyJsonRepairEngine.repairAndParse(seedRaw);
    globalAuditor.recordRepair(seedRaw, res);
  }
  return globalAuditor;
}
