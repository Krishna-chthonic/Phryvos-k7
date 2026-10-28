/**
 * @file composer-draft-bus.ts
 * @description Clean-room TypeScript adaptation of LobeHub's out-of-tree composer draft bus,
 * natural language companion-vs-tool intent classification, prompt shell sanitization,
 * and privacy-first market query generation.
 * Inspired by lobehub/lobehub (f90a92f4, Apache-2.0).
 */

export interface ComposerDraft {
  text: string;
  append?: boolean;
  targetAgentId?: string;
  timestampMs: number;
}

export type IntentClassification = 'companion_memory' | 'ephemeral_skill';

export interface QueryRule {
  pattern: RegExp;
  query: string;
}

export const QUERY_RULES: QueryRule[] = [
  { pattern: /简历|履历|resume|cv/i, query: 'resume review' },
  { pattern: /代码审查|code\s*review|pull\s*request|pr\s*review|review.*code/i, query: 'code review' },
  { pattern: /prd|产品需求|需求文档|产品经理|product\s*(requirement|manager)/i, query: 'product requirements' },
  { pattern: /调研|研究|资料收集|research/i, query: 'research' },
  { pattern: /旅行|旅游|行程|travel|trip/i, query: 'travel planning' },
  { pattern: /翻译|translate|translation/i, query: 'translation' },
  { pattern: /写作|文案|文章|公众号|copywriting|writing/i, query: 'writing' },
  { pattern: /会议|纪要|meeting|minutes/i, query: 'meeting notes' },
  { pattern: /邮件|email|mail/i, query: 'email writing' },
  { pattern: /数据|表格|excel|csv|analysis|analytics/i, query: 'data analysis' },
  { pattern: /ui|ux|前端|界面|设计|frontend|design/i, query: 'frontend design' },
  { pattern: /代码|编程|开发|debug|bug|programming|coding/i, query: 'coding' },
  { pattern: /健康|健身|health|fitness/i, query: 'health' },
];

export const SKILL_INTENT_PATTERNS: RegExp[] = [
  /\b(method|workflow|process|template|checklist|rubric|framework|playbook|sop|converter|generator|formatter|extractor|classifier|validator|automation|batch|reusable)\b/i,
  /方法|流程|工作流|模板|检查清单|核对表|评分表|规则|规范|步骤|SOP|转换器|生成器|格式化|提取器|分类器|校验器|自动化|批量|复用|可复用|फॉर्मेट|प्रक्रिया|टेम्पलेट|स्वचालन|लिस्ट/i,
];

export const AGENT_INTENT_PATTERNS: RegExp[] = [
  /\b(long[-\s]?term|memory|remember|preference|follow[-\s]?up|daily|weekly|habit|companion|historical|persistent|soul|friend|personal|relationship)\b/i,
  /长期|持续|跨会话|记住|记忆|偏好|陪伴|跟进|监督|每天|每周|习惯|备考|学习计划|历史|固定人格|固定人设|固定语气|专属语气|人格本身|人设本身|语气本身|याद|दोस्त|आदत|पसंद|साथी|रोज/i,
];

export const ROLE_FRAMING_PATTERNS: RegExp[] = [
  /\b(agent|assistant|bot|advisor|expert|coach|tutor|mentor|analyst|reviewer|editor|translator|planner|manager|designer|engineer)\b/i,
  /角色|专家|顾问|助理|助手|智能体|机器人|导师|教练|分析师|审查员|编辑|翻译官|规划师|经理|设计师|工程师|客服|运营/i,
];

export class ComposerDraftBus {
  private currentDraft: ComposerDraft | null = null;
  private attached: boolean = true;
  private listeners: Set<(draft: ComposerDraft | null) => void> = new Set();

  /**
   * Sets whether the active chat composer is listening.
   */
  public setAttached(status: boolean): void {
    this.attached = status;
  }

  public isAttached(): boolean {
    return this.attached;
  }

  /**
   * Subscribes to composer draft updates.
   */
  public subscribe(listener: (draft: ComposerDraft | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.currentDraft);
    }
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

    this.notify();
    return true;
  }

  /**
   * Consumes and clears the pending draft.
   */
  public consumeDraft(): ComposerDraft | null {
    const draft = this.currentDraft;
    this.currentDraft = null;
    this.notify();
    return draft;
  }

  /**
   * Checks if an unconsumed draft is waiting.
   */
  public hasDraft(): boolean {
    return this.currentDraft !== null;
  }

  /**
   * Strips conversational scaffolding and wrapper tokens from prompt to isolate
   * functional intent.
   */
  public removeAgentShell(prompt: string): string {
    return prompt
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/[`*_#>(){}\[\]]/g, ' ')
      .replace(
        /(帮我|请|我想|我希望|希望|需要|想要|能不能|可以)?\s*(创建|新建|做一个|做个|做|搭建|生成|配置|制作|build|create|make|set up)/gi,
        ' '
      )
      .replace(/\b(agent|assistant|bot|advisor|expert|coach)\b/gi, ' ')
      .replace(
        /(一个|一位|一名|专门|能够|可以|用于|用来|负责|智能体|助手|助理|机器人|专家|顾问|教练)/g,
        ' '
      )
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Evaluates if a prompt has high-confidence reusable skill intent, while
   * strictly suppressing suggestion if persistent companion memory intent is detected.
   */
  public isHighConfidenceSkillSuggestionPrompt(prompt: string): boolean {
    const cleaned = this.removeAgentShell(prompt);
    const combined = `${prompt} ${cleaned}`;

    const hasReusableSkillIntent = SKILL_INTENT_PATTERNS.some(p => p.test(combined));
    const hasRoleFraming = ROLE_FRAMING_PATTERNS.some(p => p.test(prompt));
    const hasSkillCategoryMatch = QUERY_RULES.some(
      r => r.pattern.test(prompt) || r.pattern.test(cleaned)
    );

    // If persistent memory patterns are matched, suppress skill suggestion
    const hasAgentMemoryIntent = AGENT_INTENT_PATTERNS.some(p => p.test(combined));
    if (hasAgentMemoryIntent) {
      return false;
    }

    return hasReusableSkillIntent || (hasRoleFraming && hasSkillCategoryMatch);
  }

  /**
   * Builds privacy-first skill search queries from fixed categories only.
   * Returns empty array for free-form private agent prompts to prevent data leakage.
   */
  public buildAgentSkillSuggestionQueries(prompt: string): string[] {
    if (!this.isHighConfidenceSkillSuggestionPrompt(prompt)) {
      return [];
    }

    const cleaned = this.removeAgentShell(prompt);
    const queries: string[] = [];

    for (const rule of QUERY_RULES) {
      if (rule.pattern.test(prompt) || rule.pattern.test(cleaned)) {
        if (!queries.includes(rule.query)) {
          queries.push(rule.query);
        }
      }
    }

    return queries;
  }

  /**
   * Classifies user intent to distinguish persistent companion memories from
   * ephemeral execution skills.
   */
  public classifyIntent(prompt: string): {
    intent: IntentClassification;
    matchedKeywords: string[];
    confidence: number;
    suggestedQueries?: string[];
  } {
    if (!prompt || typeof prompt !== 'string') {
      return { intent: 'ephemeral_skill', matchedKeywords: [], confidence: 0 };
    }

    const cleaned = this.removeAgentShell(prompt);
    const combined = `${prompt} ${cleaned}`;

    const matchedCompanion: string[] = [];
    for (const pat of AGENT_INTENT_PATTERNS) {
      const m = combined.match(pat);
      if (m) matchedCompanion.push(m[0]);
    }

    const matchedSkill: string[] = [];
    for (const pat of SKILL_INTENT_PATTERNS) {
      const m = combined.match(pat);
      if (m) matchedSkill.push(m[0]);
    }

    const queries = this.buildAgentSkillSuggestionQueries(prompt);

    if (matchedCompanion.length > 0) {
      return {
        intent: 'companion_memory',
        matchedKeywords: matchedCompanion,
        confidence: Math.min(1.0, 0.5 + matchedCompanion.length * 0.25),
        suggestedQueries: [],
      };
    }

    if (matchedSkill.length > 0 || queries.length > 0) {
      return {
        intent: 'ephemeral_skill',
        matchedKeywords: matchedSkill,
        confidence: Math.min(1.0, 0.4 + (matchedSkill.length + queries.length) * 0.25),
        suggestedQueries: queries,
      };
    }

    return {
      intent: 'ephemeral_skill',
      matchedKeywords: [],
      confidence: 0.3,
      suggestedQueries: [],
    };
  }
}
