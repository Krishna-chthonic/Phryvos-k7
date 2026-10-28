/**
 * Observable Action Stream & DirtyJson Engine for Saan Companion (K7)
 * Clean-room adaptation of agent0ai/agent-zero (Tag v2.14, Custom Open) & OpenHands/OpenHands (Commit e4765e2, MIT).
 *
 * Implements:
 * 1. Full recursive-descent DirtyJson parser (comments, unquoted keys, missing commas, doubled braces, Python literals).
 * 2. Strongly typed OpenHandsEvent stream (ActionEvent, ObservationEvent, UserRejectObservation, CondensationEvent).
 * 3. Autonomous tool execution loop with maxIterations = 5 and RepairableActionException self-correction.
 * 4. Human-in-the-loop security gate for high-risk operations.
 */

import crypto from "node:crypto";

// ==========================================
// 1. Recursive-Descent DirtyJson Parser
// ==========================================

export class DirtyJson {
  private jsonString = "";
  private index = 0;
  private currentChar: string | null = null;
  private stack: any[] = [];
  private completed = false;
  private parsingStarted = false;

  public static parse(jsonString: string): any {
    const parser = new DirtyJson();
    return parser.parseString(jsonString);
  }

  public parseString(jsonString: string): any {
    this.reset();
    this.jsonString = jsonString || "";
    if (!this.jsonString.trim()) return null;

    this.index = this.getStartPos();
    if (this.index >= this.jsonString.length) return null;

    this.currentChar = this.jsonString[this.index];
    return this.parseValue();
  }

  private reset(): void {
    this.jsonString = "";
    this.index = 0;
    this.currentChar = null;
    this.stack = [];
    this.completed = false;
    this.parsingStarted = false;
  }

  private getStartPos(): number {
    let i = 0;
    while (i < this.jsonString.length && /\s/.test(this.jsonString[i])) {
      i++;
    }
    return i;
  }

  private advance(count = 1): void {
    this.index += count;
    this.currentChar = this.index < this.jsonString.length ? this.jsonString[this.index] : null;
  }

  private peek(offset = 1): string {
    const target = this.index + offset;
    return target < this.jsonString.length ? this.jsonString[target] : "";
  }

  private skipWhitespace(): void {
    while (this.currentChar !== null) {
      if (/\s/.test(this.currentChar)) {
        this.advance();
      } else if (this.currentChar === "/" && this.peek(1) === "/") {
        this.skipSingleLineComment();
      } else if (this.currentChar === "/" && this.peek(1) === "*") {
        this.skipMultiLineComment();
      } else {
        break;
      }
    }
  }

  private skipSingleLineComment(): void {
    while (this.currentChar !== null && this.currentChar !== "\n") {
      this.advance();
    }
    if (this.currentChar === "\n") this.advance();
  }

  private skipMultiLineComment(): void {
    this.advance(2); // Skip /*
    while (this.currentChar !== null) {
      if (this.currentChar === "*" && this.peek(1) === "/") {
        this.advance(2);
        break;
      }
      this.advance();
    }
  }

  private parseValue(): any {
    this.skipWhitespace();
    if (this.currentChar === null) return null;

    if (this.currentChar === "{") {
      // Doubled braces wrapper at root: {{ ... }}
      if (this.stack.length === 0 && this.peek(1) === "{") {
        this.advance(2);
      }
      return this.parseObject();
    } else if (this.currentChar === "[") {
      return this.parseArray();
    } else if (this.currentChar === '"' || this.currentChar === "'" || this.currentChar === "`") {
      return this.parseQuotedString();
    } else if (/[0-9\-+]/.test(this.currentChar)) {
      return this.parseNumber();
    } else if (this.matchKeyword("true")) {
      return true;
    } else if (this.matchKeyword("false")) {
      return false;
    } else if (this.matchKeyword("null") || this.matchKeyword("none") || this.matchKeyword("undefined")) {
      return null;
    } else {
      return this.parseUnquotedString();
    }
  }

  private matchKeyword(word: string): boolean {
    const len = word.length;
    const slice = this.jsonString.slice(this.index, this.index + len);
    if (slice.toLowerCase() === word.toLowerCase()) {
      const next = this.peek(len);
      if (!next || /[\s,}\]:]/.test(next)) {
        this.advance(len);
        return true;
      }
    }
    return false;
  }

  private parseObject(): Record<string, any> {
    const obj: Record<string, any> = {};
    if (this.currentChar === "{") {
      this.advance();
    }
    this.stack.push(obj);

    while (this.currentChar !== null) {
      this.skipWhitespace();
      if (this.currentChar === "}") {
        if (this.stack.length === 1 && this.peek(1) === "}") {
          this.advance(2);
        } else {
          this.advance();
        }
        this.stack.pop();
        return obj;
      }

      if (this.currentChar === null) {
        this.stack.pop();
        return obj;
      }

      const key = this.parseKey();
      this.skipWhitespace();

      let value: any = null;
      if (this.currentChar === ":") {
        this.advance();
        value = this.parseValue();
      } else if (this.currentChar !== null && this.currentChar !== "}") {
        value = this.parseValue();
      }

      obj[key] = value;
      this.skipWhitespace();

      if (this.currentChar === ",") {
        this.advance();
        continue;
      } else if (this.currentChar === "}") {
        if (this.stack.length === 1 && this.peek(1) === "}") {
          this.advance(2);
        } else {
          this.advance();
        }
        this.stack.pop();
        return obj;
      } else if (this.currentChar === null) {
        this.stack.pop();
        return obj;
      }
    }

    this.stack.pop();
    return obj;
  }

  private parseArray(): any[] {
    const arr: any[] = [];
    this.advance(); // Skip [
    this.stack.push(arr);

    while (this.currentChar !== null) {
      this.skipWhitespace();
      if (this.currentChar === "]") {
        this.advance();
        this.stack.pop();
        return arr;
      }

      const value = this.parseValue();
      arr.push(value);
      this.skipWhitespace();

      if (this.currentChar === ",") {
        this.advance();
        continue;
      } else if (this.currentChar === "]") {
        this.advance();
        this.stack.pop();
        return arr;
      }
    }

    this.stack.pop();
    return arr;
  }

  private parseKey(): string {
    this.skipWhitespace();
    if (this.currentChar === '"' || this.currentChar === "'" || this.currentChar === "`") {
      return this.parseQuotedString();
    }
    return this.parseUnquotedKey();
  }

  private parseUnquotedKey(): string {
    let res = "";
    while (
      this.currentChar !== null &&
      !/\s/.test(this.currentChar) &&
      this.currentChar !== ":" &&
      this.currentChar !== "," &&
      this.currentChar !== "}" &&
      this.currentChar !== "]"
    ) {
      res += this.currentChar;
      this.advance();
    }
    return res;
  }

  private parseQuotedString(): string {
    const quote = this.currentChar;
    this.advance(); // Skip opening quote
    let res = "";

    while (this.currentChar !== null) {
      if (this.currentChar === "\\") {
        const next = this.peek(1);
        if (next === "n") { res += "\n"; this.advance(2); }
        else if (next === "r") { res += "\r"; this.advance(2); }
        else if (next === "t") { res += "\t"; this.advance(2); }
        else if (next === quote) { res += quote; this.advance(2); }
        else if (next === "\\") { res += "\\"; this.advance(2); }
        else { res += next; this.advance(2); }
      } else if (this.currentChar === quote) {
        this.advance(); // Skip closing quote
        return res;
      } else {
        res += this.currentChar;
        this.advance();
      }
    }
    return res;
  }

  private parseNumber(): number {
    let numStr = "";
    while (this.currentChar !== null && /[0-9.\-+eE]/.test(this.currentChar)) {
      numStr += this.currentChar;
      this.advance();
    }
    return Number(numStr);
  }

  private parseUnquotedString(): string {
    let res = "";
    while (
      this.currentChar !== null &&
      this.currentChar !== "," &&
      this.currentChar !== "}" &&
      this.currentChar !== "]" &&
      this.currentChar !== "\n"
    ) {
      res += this.currentChar;
      this.advance();
    }
    return res.trim();
  }
}

// ==========================================
// 2. OpenHands Event System
// ==========================================

export type SecurityRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface ActionEvent {
  kind: "action";
  id: string;
  toolCallId: string;
  toolName: string;
  actionPayload: Record<string, any>;
  thought: string[];
  reasoningContent?: string;
  securityRisk: SecurityRiskLevel;
  timestamp: string;
}

export interface ObservationEvent {
  kind: "observation";
  id: string;
  actionId: string;
  toolCallId: string;
  content: string;
  isError: boolean;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface UserRejectObservation {
  kind: "user_reject";
  id: string;
  actionId: string;
  reason: string;
  timestamp: string;
}

export interface CondensationEvent {
  kind: "condensation";
  id: string;
  summary: string;
  tokensSaved: number;
  timestamp: string;
}

export interface StreamingDeltaEvent {
  kind: "delta";
  id: string;
  chunk: string;
  timestamp: string;
}

export interface PauseEvent {
  kind: "pause";
  id: string;
  cursor: number;
  reason: string;
  timestamp: string;
}

export type OpenHandsEvent =
  | ActionEvent
  | ObservationEvent
  | UserRejectObservation
  | CondensationEvent
  | StreamingDeltaEvent
  | PauseEvent;

// ==========================================
// 3. Autonomous Tool Loop & Exceptions
// ==========================================

export class RepairableActionException extends Error {
  public repairHint: string;
  constructor(message: string, repairHint: string) {
    super(message);
    this.name = "RepairableActionException";
    this.repairHint = repairHint;
  }
}

export interface ToolHandler {
  name: string;
  securityRisk: SecurityRiskLevel;
  execute: (args: Record<string, any>) => Promise<string> | string;
}

export interface ChainingResult {
  completed: boolean;
  iterations: number;
  events: OpenHandsEvent[];
  finalResult?: string;
  error?: string;
}

export class ObservableActionStream {
  private events: OpenHandsEvent[] = [];
  private tools: Map<string, ToolHandler> = new Map();
  public maxIterations = 5;

  public registerTool(tool: ToolHandler): void {
    this.tools.set(tool.name, tool);
  }

  public recordEvent(event: OpenHandsEvent): void {
    this.events.push(event);
  }

  public getEvents(): OpenHandsEvent[] {
    return [...this.events];
  }

  public clear(): void {
    this.events = [];
  }

  /**
   * Autonomous tool chaining loop.
   * Executes a sequence of tool calls up to maxIterations,
   * handling repairable errors and recording an audit event stream.
   */
  public async executeChainedLoop(
    stepGenerator: (iteration: number, lastObservation?: ObservationEvent) => {
      toolName: string;
      args: Record<string, any>;
      thought: string[];
      securityApproved?: boolean;
    } | null
  ): Promise<ChainingResult> {
    let iteration = 0;
    let lastObservation: ObservationEvent | undefined = undefined;

    while (iteration < this.maxIterations) {
      iteration++;
      const step = stepGenerator(iteration, lastObservation);
      if (!step) {
        return {
          completed: true,
          iterations: iteration - 1,
          events: this.events,
          finalResult: lastObservation?.content || "Loop ended normally",
        };
      }

      const tool = this.tools.get(step.toolName);
      const actionId = `act-${crypto.randomUUID().slice(0, 8)}`;
      const toolCallId = `call-${crypto.randomUUID().slice(0, 8)}`;

      const actionEvent: ActionEvent = {
        kind: "action",
        id: actionId,
        toolCallId,
        toolName: step.toolName,
        actionPayload: step.args,
        thought: step.thought,
        securityRisk: tool?.securityRisk || "LOW",
        timestamp: new Date().toISOString(),
      };
      this.recordEvent(actionEvent);

      // Security gate check for high risk operations
      if (actionEvent.securityRisk === "HIGH" && !step.securityApproved) {
        const rejectEvent: UserRejectObservation = {
          kind: "user_reject",
          id: `rej-${crypto.randomUUID().slice(0, 8)}`,
          actionId,
          reason: "User denied execution of high-risk operation",
          timestamp: new Date().toISOString(),
        };
        this.recordEvent(rejectEvent);
        return {
          completed: false,
          iterations: iteration,
          events: this.events,
          error: "High-risk operation rejected by user consent policy",
        };
      }

      if (!tool) {
        const obsEvent: ObservationEvent = {
          kind: "observation",
          id: `obs-${crypto.randomUUID().slice(0, 8)}`,
          actionId,
          toolCallId,
          content: `Error: Tool '${step.toolName}' is not registered`,
          isError: true,
          timestamp: new Date().toISOString(),
        };
        this.recordEvent(obsEvent);
        lastObservation = obsEvent;
        continue;
      }

      try {
        const output = await tool.execute(step.args);
        const obsEvent: ObservationEvent = {
          kind: "observation",
          id: `obs-${crypto.randomUUID().slice(0, 8)}`,
          actionId,
          toolCallId,
          content: output,
          isError: false,
          timestamp: new Date().toISOString(),
        };
        this.recordEvent(obsEvent);
        lastObservation = obsEvent;
      } catch (err: any) {
        if (err instanceof RepairableActionException) {
          const obsEvent: ObservationEvent = {
            kind: "observation",
            id: `obs-${crypto.randomUUID().slice(0, 8)}`,
            actionId,
            toolCallId,
            content: `Repairable Error: ${err.message}. Hint: ${err.repairHint}`,
            isError: true,
            metadata: { repairHint: err.repairHint },
            timestamp: new Date().toISOString(),
          };
          this.recordEvent(obsEvent);
          lastObservation = obsEvent;
        } else {
          const obsEvent: ObservationEvent = {
            kind: "observation",
            id: `obs-${crypto.randomUUID().slice(0, 8)}`,
            actionId,
            toolCallId,
            content: `Fatal Error: ${err?.message || String(err)}`,
            isError: true,
            timestamp: new Date().toISOString(),
          };
          this.recordEvent(obsEvent);
          return {
            completed: false,
            iterations: iteration,
            events: this.events,
            error: err?.message,
          };
        }
      }
    }

    return {
      completed: false,
      iterations: iteration,
      events: this.events,
      error: `Exceeded maxIterations (${this.maxIterations})`,
    };
  }
}
