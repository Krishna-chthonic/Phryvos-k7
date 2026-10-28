/**
 * Consecutive Role Merge Engine (from SillyTavern prompt-converters.js:80-360)
 *
 * Implements:
 * Strict turn alternation for LLM APIs (Anthropic Claude, Gemini, Vertex AI).
 * Many frontier providers immediately return HTTP 400 Bad Request if:
 * 1. Two consecutive messages share the same role (e.g. user followed by user).
 * 2. An assistant message ends the request when prefilling is not structured correctly.
 *
 * This engine cleanly merges adjacent messages of the same role and normalizes conversation turns.
 */

import { type MessageTurn } from "./depth-injector";

export interface PromptMergeOptions {
  assistantPrefill?: string;
  allowSystemInMiddle?: boolean;
}

/**
 * Merges consecutive messages with the same role into a single message turn.
 */
export function mergeConsecutiveRoles(
  messages: MessageTurn[],
  options: PromptMergeOptions = {}
): MessageTurn[] {
  if (!messages || messages.length === 0) return [];

  const merged: MessageTurn[] = [];

  for (const msg of messages) {
    if (!msg.content && msg.content !== "") continue;

    if (merged.length > 0) {
      const prev = merged[merged.length - 1];

      // If roles match, merge contents
      if (prev.role === msg.role) {
        prev.content = `${prev.content}\n\n${msg.content}`.trim();
        continue;
      }

      // If system message appears in middle and provider disallows it, convert to user
      if (!options.allowSystemInMiddle && msg.role === "system") {
        if (prev.role === "user") {
          prev.content = `${prev.content}\n\n[System Note: ${msg.content}]`.trim();
          continue;
        } else {
          merged.push({ role: "user", content: `[System Note: ${msg.content}]` });
          continue;
        }
      }
    }

    merged.push({ ...msg, content: msg.content.trim() });
  }

  // Handle optional assistant prefill
  if (options.assistantPrefill && options.assistantPrefill.trim().length > 0) {
    const prefill = options.assistantPrefill.trim();
    if (merged.length > 0 && merged[merged.length - 1].role === "assistant") {
      merged[merged.length - 1].content = `${merged[merged.length - 1].content} ${prefill}`.trim();
    } else {
      merged.push({ role: "assistant", content: prefill });
    }
  }

  return merged;
}
