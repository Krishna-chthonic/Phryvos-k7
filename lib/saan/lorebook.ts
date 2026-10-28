/**
 * Advanced World Info / Lorebook Selective Engine (from SillyTavern world-info.js:4709-4970)
 *
 * Implements:
 * 1. Primary + Secondary keyword matching.
 * 2. 4 Selective boolean logic modes:
 *    - AND_ANY: at least one secondary key must match.
 *    - AND_ALL: every secondary key must match.
 *    - NOT_ANY: none of the secondary keys may match (negative filter).
 *    - NOT_ALL: at least one secondary key must be absent.
 * 3. Regex pattern matching with flags (/pattern/i).
 * 4. Timed Turn Effects:
 *    - sticky: remains active for N turns after initial activation.
 *    - cooldown: cannot trigger again for M turns after activation.
 *    - delay: only activates after K total conversation turns.
 * 5. Recursive Cascading Activation (entry A triggers entry B up to maxRecursionSteps).
 */

export type SelectiveLogic = "AND_ANY" | "AND_ALL" | "NOT_ANY" | "NOT_ALL";

export interface LoreEntry {
  id: string;
  keys: string[];
  secondaryKeys?: string[];
  selectiveLogic?: SelectiveLogic;
  content: string;
  order?: number;
  depth?: number;
  stickyTurns?: number;   // Stays active for N turns
  cooldownTurns?: number; // Inactive for M turns after activation
  delayTurns?: number;    // Only activates after K turns
  constant?: boolean;     // Always active regardless of keys
  disabled?: boolean;
}

export interface LorebookTurnState {
  currentTurn: number;
  activeSticky: Record<string, number>;    // entryId -> remaining sticky turns
  activeCooldown: Record<string, number>;  // entryId -> remaining cooldown turns
}

export interface ActivatedLoreResult {
  activatedEntries: LoreEntry[];
  combinedContent: string;
  updatedState: LorebookTurnState;
}

/**
 * Matches a keyword (string or /regex/i) against text
 */
export function matchKey(text: string, key: string): boolean {
  if (!text || !key) return false;
  const trimmed = key.trim();
  if (!trimmed) return false;

  // Regex format: /pattern/flags
  if (trimmed.startsWith("/") && trimmed.lastIndexOf("/") > 0) {
    const lastSlash = trimmed.lastIndexOf("/");
    const pattern = trimmed.slice(1, lastSlash);
    const flags = trimmed.slice(lastSlash + 1);
    try {
      const rx = new RegExp(pattern, flags || "i");
      return rx.test(text);
    } catch {
      // Fallback to substring match if regex is invalid
    }
  }

  // Word boundary or substring match
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wordRx = new RegExp(`\\b${escaped}\\b`, "i");
  return wordRx.test(text);
}

/**
 * Checks whether secondary keys condition is satisfied for an entry
 */
export function evaluateSecondaryKeys(
  text: string,
  secondaryKeys: string[] = [],
  logic: SelectiveLogic = "AND_ANY"
): boolean {
  if (secondaryKeys.length === 0) return true;

  const matches = secondaryKeys.map((k) => matchKey(text, k));
  const hasAnyMatch = matches.some(Boolean);
  const hasAllMatch = matches.every(Boolean);

  switch (logic) {
    case "AND_ANY":
      return hasAnyMatch;
    case "AND_ALL":
      return hasAllMatch;
    case "NOT_ANY":
      return !hasAnyMatch;
    case "NOT_ALL":
      return !hasAllMatch;
    default:
      return hasAnyMatch;
  }
}

/**
 * Evaluates lorebook entries against input text and current turn state
 */
export function evaluateLorebook(
  textToScan: string,
  entries: LoreEntry[],
  state: LorebookTurnState,
  maxRecursionSteps = 2,
  tokenBudgetCap = 1500
): ActivatedLoreResult {
  const nextState: LorebookTurnState = {
    currentTurn: state.currentTurn + 1,
    activeSticky: { ...state.activeSticky },
    activeCooldown: { ...state.activeCooldown },
  };

  // Decrement existing cooldowns and sticky states for the new turn
  for (const [id, count] of Object.entries(nextState.activeCooldown)) {
    if (count <= 1) {
      delete nextState.activeCooldown[id];
    } else {
      nextState.activeCooldown[id] = count - 1;
    }
  }

  for (const [id, count] of Object.entries(nextState.activeSticky)) {
    if (count <= 1) {
      delete nextState.activeSticky[id];
    } else {
      nextState.activeSticky[id] = count - 1;
    }
  }

  const activatedSet = new Set<string>();
  const activatedList: LoreEntry[] = [];
  let cumulativeText = textToScan;

  let currentStep = 0;
  let newActivations = true;

  while (newActivations && currentStep <= maxRecursionSteps) {
    newActivations = false;
    currentStep++;

    for (const entry of entries) {
      if (entry.disabled) continue;
      if (activatedSet.has(entry.id)) continue;

      // 1. Check delay requirement
      if (entry.delayTurns && nextState.currentTurn < entry.delayTurns) {
        continue;
      }

      // 2. Check cooldown requirement (unless sticky override)
      const isSticky = Boolean(nextState.activeSticky[entry.id]);
      const isCooldown = Boolean(nextState.activeCooldown[entry.id]);

      if (isCooldown && !isSticky) {
        continue;
      }

      // 3. Constant or Sticky activation
      let shouldActivate = false;
      if (entry.constant || isSticky) {
        shouldActivate = true;
      } else {
        // 4. Primary key match
        const hasPrimary = entry.keys.some((k) => matchKey(cumulativeText, k));
        if (hasPrimary) {
          // 5. Secondary keys check
          const secondaryOk = evaluateSecondaryKeys(
            cumulativeText,
            entry.secondaryKeys || [],
            entry.selectiveLogic || "AND_ANY"
          );
          if (secondaryOk) {
            shouldActivate = true;
          }
        }
      }

      if (shouldActivate) {
        activatedSet.add(entry.id);
        activatedList.push(entry);
        newActivations = true;

        // Set sticky turns if configured
        if (entry.stickyTurns && entry.stickyTurns > 0) {
          nextState.activeSticky[entry.id] = entry.stickyTurns;
        }

        // Set cooldown turns if configured
        if (entry.cooldownTurns && entry.cooldownTurns > 0) {
          nextState.activeCooldown[entry.id] = entry.cooldownTurns;
        }

        // Append content to cumulativeText for recursive matching in subsequent steps
        cumulativeText += `\n${entry.content}`;
      }
    }
  }

  // Sort by order descending (higher order first)
  activatedList.sort((a, b) => (b.order ?? 100) - (a.order ?? 100));

  // Assemble content respecting token budget cap (approx 3.35 chars per token)
  const maxChars = tokenBudgetCap * 3.35;
  let combinedContent = "";
  const finalActivated: LoreEntry[] = [];

  for (const entry of activatedList) {
    if ((combinedContent.length + entry.content.length) > maxChars && combinedContent.length > 0) {
      break;
    }
    finalActivated.push(entry);
    combinedContent += (combinedContent ? "\n\n" : "") + entry.content;
  }

  return {
    activatedEntries: finalActivated,
    combinedContent,
    updatedState: nextState,
  };
}
