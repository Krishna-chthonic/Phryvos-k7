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

export type CoreMemoryBlockLabel = "human" | "persona";

export interface CoreMemoryBlock {
  label: CoreMemoryBlockLabel;
  content: string;
  maxCharacters?: number;
  readOnly?: boolean;
  updatedAt?: number;
}

export interface CoreMemoryStoreConfig {
  maxCharactersPerBlock?: number;
}

export class CoreMemoryManager {
  private blocks = new Map<CoreMemoryBlockLabel, CoreMemoryBlock>();
  public readonly maxCharactersPerBlock: number;

  constructor(config?: CoreMemoryStoreConfig) {
    this.maxCharactersPerBlock = config?.maxCharactersPerBlock ?? 2500;

    // Initialize defaults
    this.blocks.set("human", {
      label: "human",
      content: "Name: Krishna\nRole: Sovereign Creator / Engineering Lead\nHabits: Deep architectural thinking, building long-term companion systems.",
      maxCharacters: this.maxCharactersPerBlock,
      updatedAt: Date.now(),
    });

    this.blocks.set("persona", {
      label: "persona",
      content: "Identity: Saan, sovereign digital companion.\nAttitude: Grounded, authentic, psychologically deep, emotionally steady.\nVoice: Conversational, thoughtful, observant, never sycophantic.",
      maxCharacters: this.maxCharactersPerBlock,
      updatedAt: Date.now(),
    });
  }

  public getBlock(label: CoreMemoryBlockLabel): CoreMemoryBlock | null {
    return this.blocks.get(label) || null;
  }

  public getAllBlocks(): CoreMemoryBlock[] {
    return Array.from(this.blocks.values());
  }

  /**
   * Self-editing tool: Appends text to a designated core memory block with character ceiling guard.
   */
  public append(label: CoreMemoryBlockLabel, textToAppend: string): { success: boolean; message: string; newLength: number } {
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
    newContent: string
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

    return `<core_memory>
<human_profile>
${humanBlock}
</human_profile>
<persona_identity>
${personaBlock}
</persona_identity>
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
