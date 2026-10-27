/**
 * LLM Streaming Performance Control Tokens (from moeru-ai/airi pipelines-audio)
 *
 * Implements:
 * 1. <|DELAY n|>: Injects dramatic or reflective conversational silence in seconds.
 * 2. <|ACT {...}|>: Triggers emotional gestures or physical postures mid-stream.
 * 3. <|CALL {...}|>: Triggers inline UI widget or tool execution.
 */

export interface StreamingDelayToken {
  type: "delay" | "DELAY";
  seconds: number;
  payload: { seconds: number };
}

export interface StreamingActToken {
  type: "act" | "ACT";
  payload: Record<string, any>;
}

export interface StreamingCallToken {
  type: "call" | "CALL";
  component: string;
  props: Record<string, any>;
  payload: { component: string; props: Record<string, any> };
}

export type StreamingControlToken = StreamingDelayToken | StreamingActToken | StreamingCallToken;

export interface ParsedStreamingChunk {
  cleanText: string;
  controls: StreamingControlToken[];
}

/**
 * Parses streaming control tokens from text.
 */
export function parseStreamingControls(text: string): ParsedStreamingChunk {
  if (!text) {
    return { cleanText: "", controls: [] };
  }

  const controls: StreamingControlToken[] = [];

  // 1. Parse <|DELAY n|>
  let cleaned = text.replace(/<\|DELAY\s+(\d+(?:\.\d+)?)\s*\|>/gi, (_, secStr) => {
    const sec = parseFloat(secStr);
    if (Number.isFinite(sec) && sec > 0) {
      controls.push({ type: "DELAY", seconds: sec, payload: { seconds: sec } });
    }
    return "";
  });

  // 2. Parse <|ACT {...}|>
  cleaned = cleaned.replace(/<\|ACT\s+([\s\S]*?)\|>/gi, (_, jsonStr) => {
    try {
      const payload = JSON.parse(jsonStr.trim());
      if (payload && typeof payload === "object") {
        controls.push({ type: "ACT", payload });
      }
    } catch {}
    return "";
  });

  // 3. Parse <|CALL {...}|>
  cleaned = cleaned.replace(/<\|CALL\s+([\s\S]*?)\|>/gi, (_, jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr.trim());
      if (parsed && typeof parsed === "object" && parsed.component) {
        controls.push({
          type: "CALL",
          component: String(parsed.component),
          props: parsed.props || {},
          payload: { component: String(parsed.component), props: parsed.props || {} },
        });
      }
    } catch {}
    return "";
  });

  return {
    cleanText: cleaned.replace(/\s+/g, " ").trim(),
    controls,
  };
}

export const parseStreamingControlTokens = parseStreamingControls;
