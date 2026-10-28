/**
 * Context Depth Injection Engine (from SillyTavern PromptManager.js & openai.js:810-875)
 *
 * Implements:
 * Rather than appending all instructions, memories, and Author's Notes at the very top of
 * a massive system prompt where LLMs suffer from "Lost in the Middle" attention degradation,
 * this engine inserts prompts at a specified depth D (turns from the bottom of chat history).
 *
 * Prompts at depth D=2 to D=4 receive maximum attention from transformer attention heads.
 */

export interface MessageTurn {
  role: "system" | "user" | "assistant";
  content: string;
  injected?: boolean;
}

export interface InjectionPrompt {
  id: string;
  content: string;
  role: "system" | "user" | "assistant";
  depth: number;       // 0 = at very end, 1 = 1 turn back, 2 = 2 turns back, etc.
  order?: number;      // Priority order (higher order placed earlier in same depth)
}

/**
 * Inserts prompts at exact depths within a message history array.
 * Depth 0: inserted at the end of history (right before pending response)
 * Depth 1: inserted 1 turn before the last message
 * Depth D: inserted D turns from the end of history
 */
export function insertPromptsAtDepth(
  history: MessageTurn[],
  prompts: InjectionPrompt[]
): MessageTurn[] {
  if (!prompts || prompts.length === 0) {
    return [...history];
  }

  const result = [...history];
  if (result.length === 0) {
    return prompts.map((p) => ({ role: p.role, content: p.content, injected: true }));
  }

  // Find max requested depth
  const maxDepth = Math.max(...prompts.map((p) => Math.max(0, p.depth)));

  // Process depths from highest to lowest (deepest in history first)
  // to preserve stable insertion indexing
  for (let d = maxDepth; d >= 0; d--) {
    const depthPrompts = prompts
      .filter((p) => p.depth === d && p.content && p.content.trim().length > 0)
      .sort((a, b) => (b.order ?? 100) - (a.order ?? 100)); // Higher order first

    if (depthPrompts.length === 0) continue;

    // Calculate insertion index relative to the end of the history array
    // At depth 0, targetIndex is result.length (end of array)
    // At depth 1, targetIndex is result.length - 1
    // At depth D, targetIndex is Math.max(0, result.length - d)
    const targetIndex = Math.max(0, result.length - d);

    const formattedInjections: MessageTurn[] = depthPrompts.map((p) => ({
      role: p.role,
      content: p.content.trim(),
      injected: true,
    }));

    result.splice(targetIndex, 0, ...formattedInjections);
  }

  return result;
}
