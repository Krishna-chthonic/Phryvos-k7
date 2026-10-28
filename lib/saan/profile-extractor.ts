/**
 * Memobase Topic-Constrained User Profile & Fact Merger Engine
 *
 * Clean-room adaptation synthesizing memodb-io/memobase:
 * 1. Companion profile topic taxonomy (basic_info, companion_preferences, interaction_history, personalization).
 * 2. Deterministic budgeting via truncateProfiles:
 *    - Descending recency ordering (updatedAt).
 *    - Priority topic reordering (preferTopics).
 *    - Per-topic subtopic limits (maxSubtopicSize / topicLimits).
 *    - Token budget floor trimming.
 * 3. 3-State fact merger protocol (APPEND, UPDATE, ABORT) with THOUGHT --- ACTION formatting.
 * 4. Sliding window event recency filtering (timeRangeInDays = 21).
 */

export interface ProfileAttribute {
  topic: string;
  subTopic: string;
  content: string;
  confidence: number;
  updatedAt: string;
}

export interface ProfileTruncationOptions {
  preferTopics?: string[];
  onlyTopics?: string[];
  maxSubtopicSize?: number;
  topicLimits?: Record<string, number>;
  maxTokenSize?: number;
  topK?: number;
  tokenEstimator?: (text: string) => number;
}

export type MergeActionType = 'APPEND' | 'UPDATE' | 'ABORT';

export interface MergeDecision {
  action: MergeActionType;
  thought: string;
  updatedContent?: string;
}

export interface UserEventEntry {
  id: string;
  tag: string;
  value: string;
  createdAt: string;
}

export class MemobaseProfileManager {
  public static readonly COMPANION_TOPICS = {
    BASIC_INFO: 'basic_info',
    COMPANION_PREFS: 'companion_preferences',
    INTERACTION_HIST: 'interaction_history',
    PERSONALIZATION: 'personalization',
  } as const;

  /**
   * Deterministic profile truncation algorithm adapted from memobase truncate_profiles controller.
   */
  public static truncateProfiles(
    profiles: ProfileAttribute[],
    options: ProfileTruncationOptions = {}
  ): ProfileAttribute[] {
    if (!profiles || profiles.length === 0) return [];

    let working = [...profiles];

    // 1. Sort by updatedAt descending (recency first)
    working.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    // 2. Priority topic re-ordering (preferTopics)
    if (options.preferTopics && options.preferTopics.length > 0) {
      const priorityMap = new Map<string, number>();
      options.preferTopics.forEach((t, i) => priorityMap.set(t.trim(), i));

      const priorityItems: ProfileAttribute[] = [];
      const nonPriorityItems: ProfileAttribute[] = [];

      for (const p of working) {
        if (priorityMap.has(p.topic.trim())) {
          priorityItems.push(p);
        } else {
          nonPriorityItems.push(p);
        }
      }

      priorityItems.sort(
        (a, b) => (priorityMap.get(a.topic.trim()) ?? 999) - (priorityMap.get(b.topic.trim()) ?? 999)
      );

      working = [...priorityItems, ...nonPriorityItems];
    }

    // 3. Filter by onlyTopics
    if (options.onlyTopics && options.onlyTopics.length > 0) {
      const allowed = new Set(options.onlyTopics.map((t) => t.trim()));
      working = working.filter((p) => allowed.has(p.topic.trim()));
    }

    // 4. Subtopic count capping per topic
    if (options.maxSubtopicSize || options.topicLimits) {
      const defaultLimit = options.maxSubtopicSize ?? -1;
      const limits = options.topicLimits ?? {};
      const counts: Record<string, number> = {};
      const filtered: ProfileAttribute[] = [];

      for (const p of working) {
        const topicKey = p.topic.trim();
        const limit = limits[topicKey] ?? defaultLimit;
        counts[topicKey] = (counts[topicKey] ?? 0) + 1;

        if (limit > 0 && counts[topicKey] > limit) {
          continue;
        }
        filtered.push(p);
      }
      working = filtered;
    }

    // 5. topK limit
    if (options.topK && options.topK > 0) {
      working = working.slice(0, options.topK);
    }

    // 6. maxTokenSize budgeting
    if (options.maxTokenSize && options.maxTokenSize > 0) {
      const estimator = options.tokenEstimator ?? ((t: string) => Math.ceil(t.length / 4));
      let currentTokens = 0;
      let cutoffIndex = working.length;

      for (let i = 0; i < working.length; i++) {
        const p = working[i];
        const line = `${p.topic}::${p.subTopic}: ${p.content}`;
        const tokens = estimator(line);
        if (currentTokens + tokens > options.maxTokenSize) {
          cutoffIndex = i;
          break;
        }
        currentTokens += tokens;
      }

      working = working.slice(0, cutoffIndex);
    }

    return working;
  }

  /**
   * Evaluates a 3-state merger decision between an existing memo and supplementary information.
   */
  public static evaluateMergeDecision(existingMemo: string | null, supplementaryInfo: string): MergeDecision {
    const existing = (existingMemo || '').trim().toLowerCase();
    const supplementary = (supplementaryInfo || '').trim().toLowerCase();

    // Empty supplementary info -> ABORT
    if (!supplementary) {
      return {
        action: 'ABORT',
        thought: 'Supplementary information is empty or invalid.',
      };
    }

    // Empty existing memo -> APPEND
    if (!existing) {
      return {
        action: 'APPEND',
        thought: 'Current memo is empty; directly adding supplementary information.',
        updatedContent: supplementaryInfo.trim(),
      };
    }

    // Existing memo already fully covers the supplementary text -> ABORT
    if (existing.includes(supplementary)) {
      return {
        action: 'ABORT',
        thought: 'Supplementary information is already completely covered by the existing memo.',
      };
    }

    // Contradiction or refinement detection (e.g. "prefers dark mode" vs "now prefers light mode")
    const negationKeywords = ['now', 'instead', 'changed to', 'switched to', 'no longer', 'prefers', 'hates', 'loves'];
    const hasEvolution = negationKeywords.some((kw) => supplementary.includes(kw));

    if (hasEvolution) {
      return {
        action: 'UPDATE',
        thought: 'Supplementary information provides updated or conflicting status; updating memo.',
        updatedContent: `${existingMemo?.trim()}; [Updated]: ${supplementaryInfo.trim()}`,
      };
    }

    // Novel non-conflicting addition -> APPEND
    return {
      action: 'APPEND',
      thought: 'Supplementary information brings distinct, non-conflicting details.',
      updatedContent: `${existingMemo?.trim()}; ${supplementaryInfo.trim()}`,
    };
  }

  /**
   * Filters events within the 21-day sliding window recency boundary.
   */
  public static filterRecentEvents(
    events: UserEventEntry[],
    timeRangeInDays: number = 21,
    now: Date = new Date()
  ): UserEventEntry[] {
    const cutoffTime = now.getTime() - timeRangeInDays * 24 * 60 * 60 * 1000;
    return events.filter((ev) => new Date(ev.createdAt).getTime() >= cutoffTime);
  }

  /**
   * Parses tabular event tags in the format: `- TAG\tVALUE`.
   */
  public static parseTabularEventTags(rawOutput: string): Array<{ tag: string; value: string }> {
    const lines = rawOutput.split('\n');
    const results: Array<{ tag: string; value: string }> = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('- ')) continue;
      const content = line.slice(2).trim();
      const parts = content.split('\t');
      if (parts.length >= 2) {
        results.push({
          tag: parts[0].trim(),
          value: parts.slice(1).join('\t').trim(),
        });
      }
    }

    return results;
  }
}
