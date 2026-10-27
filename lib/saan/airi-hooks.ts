/**
 * 10-Point Agent Hook Lifecycle Registry (from moeru-ai/airi core-agent runtime)
 *
 * Implements:
 * Complete lifecycle pipeline hooks for conversation and agent turn execution:
 * 1. onBeforeMessageComposed
 * 2. onAfterMessageComposed
 * 3. onBeforeSend
 * 4. onAfterSend
 * 5. onTokenLiteral
 * 6. onTokenSpecial
 * 7. onStreamEnd
 * 8. onAssistantResponseEnd
 * 9. onAssistantMessage
 * 10. onChatTurnComplete
 */

export type HookCallback<T = any> = (payload: T) => Promise<void> | void;

export class AgentHookRegistry {
  private hooks: Record<string, HookCallback[]> = {
    beforeMessageComposed: [],
    afterMessageComposed: [],
    beforeSend: [],
    afterSend: [],
    tokenLiteral: [],
    tokenSpecial: [],
    streamEnd: [],
    assistantResponseEnd: [],
    assistantMessage: [],
    chatTurnComplete: [],
  };

  onBeforeMessageComposed(cb: HookCallback<{ message: string }>): () => void {
    return this.subscribe("beforeMessageComposed", cb);
  }

  onAfterMessageComposed(cb: HookCallback<{ message: string }>): () => void {
    return this.subscribe("afterMessageComposed", cb);
  }

  onBeforeSend(cb: HookCallback<{ message: string; model: string }>): () => void {
    return this.subscribe("beforeSend", cb);
  }

  onAfterSend(cb: HookCallback<{ message: string }>): () => void {
    return this.subscribe("afterSend", cb);
  }

  onTokenLiteral(cb: HookCallback<{ literal: string }>): () => void {
    return this.subscribe("tokenLiteral", cb);
  }

  onTokenSpecial(cb: HookCallback<{ special: string }>): () => void {
    return this.subscribe("tokenSpecial", cb);
  }

  onStreamEnd(cb: HookCallback<void>): () => void {
    return this.subscribe("streamEnd", cb);
  }

  onAssistantResponseEnd(cb: HookCallback<{ text: string }>): () => void {
    return this.subscribe("assistantResponseEnd", cb);
  }

  onAssistantMessage(cb: HookCallback<{ message: string }>): () => void {
    return this.subscribe("assistantMessage", cb);
  }

  onChatTurnComplete(cb: HookCallback<{ user: string; assistant: string }>): () => void {
    return this.subscribe("chatTurnComplete", cb);
  }

  on(event: string, cb: HookCallback): () => void {
    return this.subscribe(event, cb);
  }

  async emit(event: string, payload?: any): Promise<void> {
    const list = this.hooks[event] || [];
    for (const fn of list) {
      await fn(payload);
    }
  }

  private subscribe(event: string, cb: HookCallback): () => void {
    if (!this.hooks[event]) this.hooks[event] = [];
    this.hooks[event].push(cb);
    return () => {
      const idx = this.hooks[event].indexOf(cb);
      if (idx >= 0) this.hooks[event].splice(idx, 1);
    };
  }

  clear(): void {
    for (const k of Object.keys(this.hooks)) {
      this.hooks[k] = [];
    }
  }
}

// Global agent hooks singleton
let globalHooks: AgentHookRegistry | null = null;

export function getAgentHooks(): AgentHookRegistry {
  if (!globalHooks) {
    globalHooks = new AgentHookRegistry();
  }
  return globalHooks;
}

export const agentHooks = getAgentHooks();
