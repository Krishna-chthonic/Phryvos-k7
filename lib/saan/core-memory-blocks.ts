/**
 * Letta Core Memory Blocks & Self-Editing Engine
 * Clean-room TypeScript adaptation inspired by letta-ai/letta (letta-code).
 *
 * Implements:
 * 1. 3-Tier Memory Paging: Core Memory Blocks (pinned in system prompt).
 * 2. Dedicated "human" and "persona" memory blocks.
 * 3. Self-editing memory tool contracts: core_memory_append & core_memory_replace.
 * 4. Character ceiling limits (maxCoreMemoryCharacters).
 */

export type CoreMemoryBlockLabel = "human" | "persona" | "project" | "emotional_state";

export interface CoreMemoryEditEvent {
  id: string;
  timestamp: number;
  block: CoreMemoryBlockLabel;
  operation: "append" | "replace" | "manual_update";
  diffSummary: string;
  author: "saan" | "user";
}

export interface CoreMemoryBlock {
  label: CoreMemoryBlockLabel;
  content: string;
  maxCharacters?: number;
  readOnly?: boolean;
  updatedAt?: number;
}

export interface CoreMemoryCapacityItem {
  label: CoreMemoryBlockLabel;
  length: number;
  maxCapacity: number;
  percentage: number;
  isNearCapacity: boolean;
}

export interface CoreMemoryStoreConfig {
  maxCharactersPerBlock?: number;
}

export class CoreMemoryManager {
  private blocks = new Map<CoreMemoryBlockLabel, CoreMemoryBlock>();
  private editHistory: CoreMemoryEditEvent[] = [];
  private listeners: Array<(event: CoreMemoryEditEvent) => void> = [];
  public readonly maxCharactersPerBlock: number;

  constructor(config?: CoreMemoryStoreConfig) {
    this.maxCharactersPerBlock = config?.maxCharactersPerBlock ?? 2500;

    // Initialize defaults
    this.blocks.set("human", {
      label: "human",
      content: "Name: Krishna\nRole: Sovereign Creator / Engineering Lead\nHabits: Deep architectural thinking, building long-term companion systems, chai connoisseur.",
      maxCharacters: this.maxCharactersPerBlock,
      updatedAt: Date.now(),
    });

    this.blocks.set("persona", {
      label: "persona",
      content: "Identity: Saan, sovereign digital companion.\nAttitude: Grounded, authentic, psychologically deep, emotionally steady.\nVoice: Conversational, thoughtful, observant, never sycophantic.",
      maxCharacters: this.maxCharactersPerBlock,
      updatedAt: Date.now(),
    });

    this.blocks.set("project", {
      label: "project",
      content: "Project: K7 Companion Intelligence Suite\nFocus: Sovereign zero-cloud companion architecture, 50-repo companion calculus, real-time memory synchronization.",
      maxCharacters: this.maxCharactersPerBlock,
      updatedAt: Date.now(),
    });

    this.blocks.set("emotional_state", {
      label: "emotional_state",
      content: "Bond Score: High\nAffect: Warm, supportive, grounded, philosophically attuned.",
      maxCharacters: this.maxCharactersPerBlock,
      updatedAt: Date.now(),
    });

    // Initial audit log
    this.editHistory.push({
      id: `edit_init_${Date.now()}`,
      timestamp: Date.now(),
      block: "human",
      operation: "manual_update",
      diffSummary: "Initialized default human profile for Krishna",
      author: "user",
    });
  }

  public getBlock(label: CoreMemoryBlockLabel): CoreMemoryBlock | null {
    return this.blocks.get(label) || null;
  }

  public getAllBlocks(): CoreMemoryBlock[] {
    return Array.from(this.blocks.values());
  }

  public getHistory(): CoreMemoryEditEvent[] {
    return [...this.editHistory].slice(-30);
  }

  public addListener(fn: (event: CoreMemoryEditEvent) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private notifyListeners(event: CoreMemoryEditEvent): void {
    for (const fn of this.listeners) {
      try {
        fn(event);
      } catch {}
    }
  }

  public getCapacitySummary(): CoreMemoryCapacityItem[] {
    return Array.from(this.blocks.values()).map((block) => {
      const maxCap = block.maxCharacters || this.maxCharactersPerBlock;
      const length = block.content.length;
      const percentage = Math.round((length / maxCap) * 100);
      return {
        label: block.label,
        length,
        maxCapacity: maxCap,
        percentage,
        isNearCapacity: percentage >= 80,
      };
    });
  }

  /**
   * Sets entire content of a designated core memory block with character ceiling guard.
   */
  public updateBlock(
    label: CoreMemoryBlockLabel,
    newContent: string,
    author: "saan" | "user" = "user"
  ): { success: boolean; message: string; newLength: number } {
    const block = this.blocks.get(label);
    if (!block) {
      return { success: false, message: `Block "${label}" does not exist`, newLength: 0 };
    }
    if (block.readOnly) {
      return { success: false, message: `Block "${label}" is read-only`, newLength: block.content.length };
    }

    const trimmed = newContent.trim();
    const maxCap = block.maxCharacters || this.maxCharactersPerBlock;

    if (trimmed.length > maxCap) {
      return {
        success: false,
        message: `Update rejected: Content length (${trimmed.length}) exceeds block ceiling (${maxCap})`,
        newLength: block.content.length,
      };
    }

    const prevLength = block.content.length;
    block.content = trimmed;
    block.updatedAt = Date.now();

    const event: CoreMemoryEditEvent = {
      id: `edit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      block: label,
      operation: "manual_update",
      diffSummary: `Updated ${label} block (${prevLength} -> ${trimmed.length} chars)`,
      author,
    };
    this.editHistory.push(event);
    this.notifyListeners(event);

    return {
      success: true,
      message: `Successfully updated core memory block "${label}"`,
      newLength: block.content.length,
    };
  }

  /**
   * Self-editing tool: Appends text to a designated core memory block with character ceiling guard.
   */
  public append(
    label: CoreMemoryBlockLabel,
    textToAppend: string,
    author: "saan" | "user" = "saan"
  ): { success: boolean; message: string; newLength: number } {
    const block = this.blocks.get(label);
    if (!block) {
      return { success: false, message: `Block "${label}" does not exist`, newLength: 0 };
    }
    if (block.readOnly) {
      return { success: false, message: `Block "${label}" is read-only`, newLength: block.content.length };
    }

    const trimmed = textToAppend.trim();
    if (!trimmed) {
      return { success: false, message: "Empty text cannot be appended", newLength: block.content.length };
    }

    const maxCap = block.maxCharacters || this.maxCharactersPerBlock;
    const prospective = block.content ? `${block.content}\n${trimmed}` : trimmed;

    if (prospective.length > maxCap) {
      return {
        success: false,
        message: `Append rejected: Prospective length (${prospective.length}) exceeds block ceiling (${maxCap})`,
        newLength: block.content.length,
      };
    }

    block.content = prospective;
    block.updatedAt = Date.now();

    const event: CoreMemoryEditEvent = {
      id: `edit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      block: label,
      operation: "append",
      diffSummary: `+ "${trimmed.slice(0, 45)}${trimmed.length > 45 ? "..." : ""}"`,
      author,
    };
    this.editHistory.push(event);
    this.notifyListeners(event);

    return {
      success: true,
      message: `Successfully appended to block "${label}"`,
      newLength: block.content.length,
    };
  }

  /**
   * Self-editing tool: Replaces a specific substring in a core memory block.
   */
  public replace(
    label: CoreMemoryBlockLabel,
    oldContent: string,
    newContent: string,
    author: "saan" | "user" = "saan"
  ): { success: boolean; message: string; replaced: boolean } {
    const block = this.blocks.get(label);
    if (!block) {
      return { success: false, message: `Block "${label}" does not exist`, replaced: false };
    }
    if (block.readOnly) {
      return { success: false, message: `Block "${label}" is read-only`, replaced: false };
    }

    if (!block.content.includes(oldContent)) {
      return {
        success: false,
        message: `Substring "${oldContent}" not found in block "${label}"`,
        replaced: false,
      };
    }

    const maxCap = block.maxCharacters || this.maxCharactersPerBlock;
    const prospective = block.content.replace(oldContent, newContent);

    if (prospective.length > maxCap) {
      return {
        success: false,
        message: `Replacement rejected: Length (${prospective.length}) exceeds block ceiling (${maxCap})`,
        replaced: false,
      };
    }

    block.content = prospective;
    block.updatedAt = Date.now();

    const event: CoreMemoryEditEvent = {
      id: `edit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      block: label,
      operation: "replace",
      diffSummary: `~ Replaced "${oldContent.slice(0, 25)}..." with "${newContent.slice(0, 25)}..."`,
      author,
    };
    this.editHistory.push(event);
    this.notifyListeners(event);

    return {
      success: true,
      message: `Successfully replaced content in block "${label}"`,
      replaced: true,
    };
  }

  /**
   * Formats core memory blocks for inclusion in the system prompt.
   */
  public renderForSystemPrompt(): string {
    const humanBlock = this.blocks.get("human")?.content || "";
    const personaBlock = this.blocks.get("persona")?.content || "";
    const projectBlock = this.blocks.get("project")?.content || "";
    const emotionalBlock = this.blocks.get("emotional_state")?.content || "";

    return `<core_memory>
<human_profile>
${humanBlock}
</human_profile>
<persona_identity>
${personaBlock}
</persona_identity>
${projectBlock ? `<current_project>\n${projectBlock}\n</current_project>\n` : ""}${emotionalBlock ? `<emotional_state>\n${emotionalBlock}\n</emotional_state>` : ""}
</core_memory>`;
  }
}

// Global Singleton for Saan
let globalCoreMemoryInstance: CoreMemoryManager | null = null;

export function getCoreMemoryManager(): CoreMemoryManager {
  if (!globalCoreMemoryInstance) {
    globalCoreMemoryInstance = new CoreMemoryManager();
  }
  return globalCoreMemoryInstance;
}
