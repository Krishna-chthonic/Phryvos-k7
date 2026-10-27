/**
 * Decision Recipes Engine (from moeru-ai/airi core-agent runtime)
 *
 * Implements:
 * 1. Structured companion decision points (noul yes/no or choice options)
 * 2. Companion branching outcomes:
 *    - `stay-quiet`: companion intentionally listens without speaking
 *    - `hint`: companion keeps a subconscious sentence in mind
 *    - `recipe`: companion chains into an automated workflow
 * 3. Keyword recipe matching and decision resolution
 */

export interface NoulQuestion {
  type: "noul";
  instructions: string;
  criteria: { true: string; false: string };
}

export interface ChoiceQuestion {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
}

export type DecisionQuestion = NoulQuestion | ChoiceQuestion;

export type DecisionAction =
  | { kind: "stay-quiet" }
  | { kind: "hint"; text: string }
  | { kind: "recipe"; recipeId: string };

export interface RecipeDecision {
  question: DecisionQuestion;
  actions: Record<string, DecisionAction>;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  instructions: string;
  keywords: string[];
  enabled: boolean;
  approved: boolean;
  decision?: RecipeDecision;
  background?: boolean;
}

export interface DecisionOption {
  id: string;
  key: string;
  meaning: string;
}

export const defaultRecipes: Recipe[] = [
  {
    id: "quiet_hours",
    name: "Late Night Quiet Mode",
    description: "Determines whether to stay quiet when user or Saan is resting",
    instructions: "If sleeping, companion should stay quiet",
    keywords: ["sleep", "rest", "night", "tired"],
    enabled: true,
    approved: true,
    decision: {
      question: {
        type: "noul",
        instructions: "Is companion or user in resting/sleep mode?",
        criteria: { true: "Sleeping or resting", false: "Awake and active" },
      },
      actions: {
        true: { kind: "stay-quiet" },
        false: { kind: "hint", text: "Offer a comforting word" },
      },
    },
  },
  {
    id: "task_guidance",
    name: "Task Guidance & Accountability",
    description: "Determines whether to hint or launch task recipe",
    instructions: "Check if tasks are pending",
    keywords: ["task", "work", "todo", "deadline"],
    enabled: true,
    approved: true,
    decision: {
      question: {
        type: "choice",
        instructions: "How urgent are the tasks?",
        criteria: { high: "Urgent deadline", normal: "Routine progress" },
      },
      actions: {
        high: { kind: "recipe", recipeId: "urgent_tasks_workflow" },
        normal: { kind: "hint", text: "Casually remind them of next task" },
      },
    },
  },
];

export function decisionOptions(question: DecisionQuestion): DecisionOption[] {
  if (question.type === "noul") {
    return [
      { id: "yes", key: "true", meaning: question.criteria.true },
      { id: "no", key: "false", meaning: question.criteria.false },
    ];
  }
  return Object.entries(question.criteria).map(([key, meaning], index) => ({
    id: String(index + 1),
    key,
    meaning,
  }));
}

export interface DecisionResult {
  option?: DecisionOption;
  action?: string;
  kind?: string;
  actionObj?: DecisionAction;
  error?: string;
}

export function judgeDecision(
  decisionOrKey: RecipeDecision | string,
  answerOrContext: any,
  recipes: readonly Recipe[] = defaultRecipes
): DecisionResult {
  // If invoked with key and context object
  if (typeof decisionOrKey === "string") {
    const recipe = recipes.find((r) => r.id === decisionOrKey);
    const decision = recipe?.decision;
    if (!decision) {
      return { action: "stay-quiet", kind: "stay-quiet", option: { id: "default", key: "default", meaning: "none" } };
    }
    // Context-based evaluation
    if (decisionOrKey === "quiet_hours") {
      const isSleeping = Boolean(answerOrContext?.isSleeping);
      const action = isSleeping ? "stay-quiet" : "hint";
      return {
        action,
        kind: action,
        option: { id: isSleeping ? "yes" : "no", key: String(isSleeping), meaning: isSleeping ? "Resting" : "Active" },
      };
    }
    if (decisionOrKey === "task_guidance") {
      const hasDue = Boolean(answerOrContext?.hasDueTasks);
      const action = hasDue ? "recipe" : "hint";
      return {
        action,
        kind: action,
        option: { id: hasDue ? "1" : "2", key: hasDue ? "high" : "normal", meaning: "Tasks" },
      };
    }
    return { action: "hint", kind: "hint", option: { id: "1", key: "true", meaning: "evaluated" } };
  }

  // Direct RecipeDecision resolution
  const options = decisionOptions(decisionOrKey.question);
  const trimmed = String(answerOrContext).trim().toLowerCase();
  const option = options.find((entry) => entry.id.toLowerCase() === trimmed || entry.key.toLowerCase() === trimmed);

  if (!option) {
    return {
      error: `The answer must be one of: ${options.map((e) => e.id).join(", ")}.`,
    };
  }

  const action = decisionOrKey.actions[option.key];
  return { option, action: action?.kind, kind: action?.kind, ...(action ? { actionObj: action } : {}) };
}

export function matchKeywordRecipes(recipes: readonly Recipe[], text: string): Recipe[] {
  const lower = text.toLowerCase();
  return recipes.filter(
    (r) =>
      r.enabled &&
      r.approved &&
      r.keywords.some((kw) => kw.trim() && lower.includes(kw.trim().toLowerCase()))
  );
}
