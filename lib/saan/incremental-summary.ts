/**
 * Incremental Running Summary & Context Guard Engine
 *
 * Clean-room adaptation synthesizing:
 * 1. LangMem (`langchain-ai/langmem`): RunningSummary state, summarizedMessageIds set,
 *    lastSummarizedMessageId tracking, and atomic tool call message pairing.
 * 2. MemGPT (`cpacker/MemGPT`): 75% context warning trigger (MESSAGE_SUMMARY_WARNING_FRAC),
 *    preserve last N messages (MESSAGE_SUMMARY_TRUNC_KEEP_N_LAST = 3), and disallowToolAsFirst invariant.
 * 3. Zep (`getzep/zep`): Incremental summary fold-in, extracted named entity tags with confidence.
 */

export interface MessagePayload {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: string;
  }>;
}

export interface RunningSummaryState {
  summary: string;
  summarizedMessageIds: string[];
  lastSummarizedMessageId: string | null;
  updatedAt: string;
}

export interface SummarizationConfig {
  maxContextTokens: number;
  warningFraction?: number; // Default: 0.75 (MemGPT)
  truncationFraction?: number; // Default: 0.75
  keepNLast?: number; // Default: 3 (MemGPT MESSAGE_SUMMARY_TRUNC_KEEP_N_LAST)
  maxSummaryTokens?: number; // Default: 250
  tokenCounter?: (text: string) => number;
}

export interface SummarizationEvaluation {
  shouldWarn: boolean;
  warningPrompt?: string;
  shouldSummarize: boolean;
  messagesToSummarize: MessagePayload[];
  retainedMessages: MessagePayload[];
  currentTokens: number;
}

export interface EntityTag {
  name: string;
  category: "person" | "concept" | "place" | "preference" | "schedule";
  confidence: number;
  occurrences: number;
}

export interface IncrementalSummarySnapshot {
  summary: string;
  summarizedMessageCount: number;
  lastSummarizedId: string | null;
  updatedAt: string;
  entityTags: EntityTag[];
  contextPressure: {
    warningFraction: number;
    currentTokens: number;
    maxContextTokens: number;
    pressurePercent: number;
    isWarningTriggered: boolean;
  };
}

export const MEMGPT_SUMMARY_WARNING =
  '[This is an automated system message hidden from the user] The conversation history will soon reach its maximum length and be trimmed. ' +
  'Do NOT tell the user about this system alert, they should not know that the history is reaching max length. ' +
  'If there is any important new information or general memories about you or the user that you would like to save, ' +
  'you should save that information immediately by calling function core_memory_append, core_memory_replace, or archival_memory_insert.';

/**
 * Standard token estimator (~4 characters per token).
 */
export function defaultTokenCounter(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function countMessageTokens(
  msg: MessagePayload,
  counter: (text: string) => number = defaultTokenCounter
): number {
  let count = counter(msg.content);
  if (msg.toolCalls) {
    for (const tc of msg.toolCalls) {
      count += counter(tc.name) + counter(tc.arguments);
    }
  }
  return count;
}

/**
 * Extracts named entity tags with confidence and occurrence metrics.
 */
export function extractEntityTagsFromText(text: string): EntityTag[] {
  const t = text.toLowerCase();
  const tags: EntityTag[] = [];

  const candidates: Array<{ name: string; category: EntityTag["category"]; regex: RegExp; conf: number }> = [
    { name: "User (Krishna)", category: "person", regex: /\b(user|krishna|mera naam)\b/i, conf: 0.98 },
    { name: "Saan", category: "person", regex: /\b(saan)\b/i, conf: 0.99 },
    { name: "Ginger Chai", category: "preference", regex: /\b(chai|tea|adrak)\b/i, conf: 0.95 },
    { name: "Jaipur", category: "place", regex: /\b(jaipur|pink city)\b/i, conf: 0.92 },
    { name: "Bengaluru", category: "place", regex: /\b(bengaluru|bangalore)\b/i, conf: 0.90 },
    { name: "Deep Work Sprint", category: "schedule", regex: /\b(work|deep work|focus|study)\b/i, conf: 0.94 },
    { name: "Sovereign Privacy", category: "concept", regex: /\b(privacy|sovereign|local|vault)\b/i, conf: 0.96 },
    { name: "Exams & Goals", category: "schedule", regex: /\b(exam|goal|target|milestone)\b/i, conf: 0.88 },
  ];

  for (const c of candidates) {
    const matches = text.match(new RegExp(c.regex.source, "gi"));
    if (matches && matches.length > 0) {
      tags.push({
        name: c.name,
        category: c.category,
        confidence: c.conf,
        occurrences: matches.length,
      });
    }
  }

  return tags;
}

export class IncrementalSummaryManager {
  private config: Required<SummarizationConfig>;
  private state: RunningSummaryState;

  constructor(
    config: SummarizationConfig,
    initialState?: Partial<RunningSummaryState>
  ) {
    this.config = {
      maxContextTokens: config.maxContextTokens,
      warningFraction: config.warningFraction ?? 0.75,
      truncationFraction: config.truncationFraction ?? 0.75,
      keepNLast: config.keepNLast ?? 3,
      maxSummaryTokens: config.maxSummaryTokens ?? 250,
      tokenCounter: config.tokenCounter ?? defaultTokenCounter,
    };

    this.state = {
      summary: initialState?.summary ?? '',
      summarizedMessageIds: initialState?.summarizedMessageIds ?? [],
      lastSummarizedMessageId: initialState?.lastSummarizedMessageId ?? null,
      updatedAt: initialState?.updatedAt ?? new Date().toISOString(),
    };
  }

  public getState(): RunningSummaryState {
    return { ...this.state };
  }

  /**
   * Evaluates memory pressure and identifies candidates for incremental summarization.
   */
  public evaluateContextPressure(messages: MessagePayload[]): SummarizationEvaluation {
    const counter = this.config.tokenCounter;
    const tokenCounts = messages.map((m) => countMessageTokens(m, counter));
    const totalTokens = tokenCounts.reduce((acc, curr) => acc + curr, 0);

    const warningThreshold = this.config.maxContextTokens * this.config.warningFraction;
    const shouldWarn = totalTokens >= warningThreshold;

    const summarizedSet = new Set(this.state.summarizedMessageIds);
    let startIndex = 0;
    if (this.state.lastSummarizedMessageId) {
      const idx = messages.findIndex((m) => m.id === this.state.lastSummarizedMessageId);
      if (idx !== -1) {
        startIndex = idx + 1;
      }
    }

    // Determine unsummarized messages excluding system message at index 0 if present
    const eligibleMessages: { msg: MessagePayload; index: number; tokens: number }[] = [];
    for (let i = startIndex; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === 'system') continue;
      if (summarizedSet.has(msg.id)) continue;
      eligibleMessages.push({ msg, index: i, tokens: tokenCounts[i] });
    }

    // Must preserve at least keepNLast recent messages uncompacted
    const maxSummarizableCount = Math.max(0, eligibleMessages.length - this.config.keepNLast);
    const shouldSummarize = shouldWarn && maxSummarizableCount > 0;

    if (!shouldSummarize) {
      return {
        shouldWarn,
        warningPrompt: shouldWarn ? MEMGPT_SUMMARY_WARNING : undefined,
        shouldSummarize: false,
        messagesToSummarize: [],
        retainedMessages: [...messages],
        currentTokens: totalTokens,
      };
    }

    // Truncate down to truncationFraction target
    let targetTokensToSummarize = Math.floor(totalTokens * (1 - this.config.truncationFraction));
    if (targetTokensToSummarize <= 0) {
      targetTokensToSummarize = Math.floor(totalTokens * 0.5);
    }

    let accumulatedTokens = 0;
    const candidateSummaryItems: MessagePayload[] = [];
    const toolCallMap = new Map<string, MessagePayload>();

    // Map all tool messages by their toolCallId to protect atomic pairings
    for (const m of messages) {
      if (m.role === 'tool' && m.toolCallId) {
        toolCallMap.set(m.toolCallId, m);
      }
    }

    for (let i = 0; i < maxSummarizableCount; i++) {
      const item = eligibleMessages[i];
      candidateSummaryItems.push(item.msg);
      accumulatedTokens += item.tokens;

      // LangMem Atomic Tool Safety Invariant:
      // If the message has tool calls, we must include subsequent tool responses in the summary batch
      if (item.msg.role === 'assistant' && item.msg.toolCalls) {
        for (const tc of item.msg.toolCalls) {
          const matchingTool = toolCallMap.get(tc.id);
          if (matchingTool && !candidateSummaryItems.some((x) => x.id === matchingTool.id)) {
            candidateSummaryItems.push(matchingTool);
            accumulatedTokens += countMessageTokens(matchingTool, counter);
          }
        }
      }

      if (accumulatedTokens >= targetTokensToSummarize) {
        break;
      }
    }

    // Retained messages are those not summarized
    const summarizedIds = new Set(candidateSummaryItems.map((m) => m.id));
    let retained = messages.filter((m) => !summarizedIds.has(m.id));

    // MemGPT Invariant: disallowToolAsFirst
    // If retained messages begin with a tool message (excluding system message), drop or adjust it
    while (retained.length > 0) {
      const firstNonSystemIndex = retained.findIndex((m) => m.role !== 'system');
      if (firstNonSystemIndex === -1) break;
      if (retained[firstNonSystemIndex].role === 'tool') {
        // Drop orphan tool message from context
        retained.splice(firstNonSystemIndex, 1);
      } else {
        break;
      }
    }

    return {
      shouldWarn,
      warningPrompt: shouldWarn ? MEMGPT_SUMMARY_WARNING : undefined,
      shouldSummarize: candidateSummaryItems.length > 0,
      messagesToSummarize: candidateSummaryItems,
      retainedMessages: retained,
      currentTokens: totalTokens,
    };
  }

  /**
   * Incrementally folds newly summarized messages into the running summary.
   */
  public updateRunningSummary(newPartialSummary: string, newlySummarizedIds: string[]): RunningSummaryState {
    const existing = this.state.summary.trim();
    const updated = existing
      ? `${existing}\n\n[Incremental Progress]: ${newPartialSummary.trim()}`
      : newPartialSummary.trim();

    const allIds = Array.from(new Set([...this.state.summarizedMessageIds, ...newlySummarizedIds]));
    const lastId = newlySummarizedIds.length > 0
      ? newlySummarizedIds[newlySummarizedIds.length - 1]
      : this.state.lastSummarizedMessageId;

    this.state = {
      summary: updated,
      summarizedMessageIds: allIds,
      lastSummarizedMessageId: lastId,
      updatedAt: new Date().toISOString(),
    };

    return this.getState();
  }

  /**
   * Generates the prompt template for the LLM to extend an existing summary.
   */
  public buildIncrementalSummaryPrompt(newMessagesText: string): { systemPrompt: string; userPrompt: string } {
    const systemPrompt =
      'You are a high-fidelity conversational summarizer. Keep the running summary under 200 words. ' +
      'Focus on user preferences, key factual milestones, personal disclosures, and pending intentions.';

    const userPrompt = this.state.summary.trim()
      ? `This is the summary of the conversation so far:\n${this.state.summary}\n\nExtend this summary by taking into account the new messages above:\n${newMessagesText}`
      : `Create a concise initial summary of the conversation above:\n${newMessagesText}`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Returns complete snapshot with entity tags and context pressure metrics.
   */
  public getSnapshot(currentTokens = 2400): IncrementalSummarySnapshot {
    const entityTags = extractEntityTagsFromText(this.state.summary);
    const pressurePct = Math.min(100, Math.round((currentTokens / this.config.maxContextTokens) * 100));
    const isWarningTriggered = currentTokens >= this.config.maxContextTokens * this.config.warningFraction;

    return {
      summary: this.state.summary,
      summarizedMessageCount: this.state.summarizedMessageIds.length,
      lastSummarizedId: this.state.lastSummarizedMessageId,
      updatedAt: this.state.updatedAt,
      entityTags,
      contextPressure: {
        warningFraction: this.config.warningFraction,
        currentTokens,
        maxContextTokens: this.config.maxContextTokens,
        pressurePercent: pressurePct,
        isWarningTriggered,
      },
    };
  }
}

// Global Singleton for Saan
let globalSummaryManagerInstance: IncrementalSummaryManager | null = null;

export function getGlobalIncrementalSummaryManager(): IncrementalSummaryManager {
  if (!globalSummaryManagerInstance) {
    globalSummaryManagerInstance = new IncrementalSummaryManager(
      {
        maxContextTokens: 8192,
        warningFraction: 0.75,
        truncationFraction: 0.75,
        keepNLast: 3,
        maxSummaryTokens: 300,
      },
      {
        summary:
          "Conversational Genesis: Krishna and Saan established companion connection. " +
          "User shared preference for morning ginger chai and afternoon deep focus sprints in Jaipur. " +
          "Saan committed to sovereign zero-cloud privacy and empathetic daily check-ins.",
        summarizedMessageIds: ["msg_gen_01", "msg_gen_02", "msg_gen_03"],
        lastSummarizedMessageId: "msg_gen_03",
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
      }
    );
  }
  return globalSummaryManagerInstance;
}
