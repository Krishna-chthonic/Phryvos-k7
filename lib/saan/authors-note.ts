/**
 * Author's Note / In-Chat Floating Prompt Engine (from SillyTavern authors-note.js)
 *
 * Implements:
 * 1. Dynamic in-chat steering prompt injected at depth D (turns from bottom of chat).
 * 2. Injection frequency interval (injects every N conversation turns).
 * 3. Role targeting (system, user, assistant).
 */

import { type InjectionPrompt } from "./depth-injector";

export interface AuthorsNoteConfig {
  prompt: string;
  depth: number;       // default 2 (placed 2 turns before end)
  role: "system" | "user" | "assistant";
  interval: number;    // default 1 (every turn), 2 = every 2 turns, etc.
  enabled: boolean;
}

export const DEFAULT_AUTHORS_NOTE: AuthorsNoteConfig = {
  prompt: "[Style: Casual, intimate Hinglish/English banter. Speak authentically as Saan without robotic servility.]",
  depth: 2,
  role: "system",
  interval: 1,
  enabled: true,
};

/**
 * Evaluates whether an Author's Note should be injected for the current turn count
 */
export function getAuthorsNoteInjection(
  turnCount: number,
  config: AuthorsNoteConfig = DEFAULT_AUTHORS_NOTE
): InjectionPrompt | null {
  if (!config.enabled || !config.prompt || config.prompt.trim().length === 0) {
    return null;
  }

  // Check frequency interval
  const interval = Math.max(1, config.interval);
  if (turnCount % interval !== 0) {
    return null;
  }

  return {
    id: "authors_note",
    content: config.prompt.trim(),
    role: config.role,
    depth: Math.max(0, config.depth),
    order: 150, // High priority inside its depth level
  };
}
