/**
 * @file composer-draft-bus.ts
 * @description Clean-room TypeScript adaptation of LobeHub's out-of-tree composer draft bus
 * and natural language companion-vs-tool intent classification.
 * Inspired by lobehub/lobehub (f90a92f4).
 */

export interface ComposerDraft {
  text: string;
  append?: boolean;
  targetAgentId?: string;
  timestampMs: number;
}

export type IntentClassification = 'companion_memory' | 'ephemeral_skill';

const COMPANION_INTENT_PATTERNS = [
  /\b(remember|memory|preference|habit|companion|long[-\s]?term|personal|feel|relationship|friend|daily)\b/i,
  /याद|दोस्त|आदत|पसंद|साथी|रोज/i,
];

const SKILL_INTENT_PATTERNS = [
  /\b(workflow|template|checklist|converter|generator|extractor|validator|automation|batch|sop|format)\b/i,
  /फॉर्मेट|प्रक्रिया|टेम्पलेट|स्वचालन|लिस्ट/i,
];

export class ComposerDraftBus {
  private currentDraft: ComposerDraft | null = null;
  private attached: boolean = true;

  /**
   * Sets whether the active chat composer is listening.
   */
  public setAttached(status: boolean): void {
    this.attached = status;
  }

  /**
   * Posts text to the global conversation composer from an external UI element.
   * Returns false if no composer is active.
   */
  public postDraft(
    text: string,
    options: { append?: boolean; targetAgentId?: string } = {}
  ): boolean {
    if (!this.attached) return false;

    this.currentDraft = {
      text,
      append: options.append,
      targetAgentId: options.targetAgentId,
      timestampMs: Date.now(),
    };

    return true;
  }

  /**
   * Consumes and clears the pending draft.
   */
  public consumeDraft(): ComposerDraft | null {
    const draft = this.currentDraft;
    this.currentDraft = null;
    return draft;
  }

  /**
   * Checks if an unconsumed draft is waiting.
   */
  public hasDraft(): boolean {
    return this.currentDraft !== null;
  }

  /**
   * Classifies user intent to distinguish persistent companion memories from
   * ephemeral execution skills.
   */
  public classifyIntent(prompt: string): {
    intent: IntentClassification;
    matchedKeywords: string[];
    confidence: number;
  } {
    if (!prompt || typeof prompt !== 'string') {
      return { intent: 'ephemeral_skill', matchedKeywords: [], confidence: 0 };
    }

    const matchedCompanion: string[] = [];
    for (const pat of COMPANION_INTENT_PATTERNS) {
      const m = prompt.match(pat);
      if (m) matchedCompanion.push(m[0]);
    }

    const matchedSkill: string[] = [];
    for (const pat of SKILL_INTENT_PATTERNS) {
      const m = prompt.match(pat);
      if (m) matchedSkill.push(m[0]);
    }

    if (matchedCompanion.length > 0 && matchedCompanion.length >= matchedSkill.length) {
      return {
        intent: 'companion_memory',
        matchedKeywords: matchedCompanion,
        confidence: Math.min(1.0, 0.5 + matchedCompanion.length * 0.25),
      };
    }

    return {
      intent: 'ephemeral_skill',
      matchedKeywords: matchedSkill,
      confidence: Math.min(1.0, 0.4 + matchedSkill.length * 0.3),
    };
  }
}
