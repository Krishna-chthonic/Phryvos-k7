/**
 * Provider Cascade & Resiliency Engine
 * Clean-room TypeScript adaptation inspired by kwaroran/Risuai request/fallback architecture.
 *
 * Implements:
 * 1. Multi-tier provider and model fallback cascading (primary -> secondary -> tertiary).
 * 2. Blank response detection & auto-failover (recovers gracefully from blank frontier model outputs).
 * 3. Exponential anti-server-overload backoff for rate-limit storms.
 * 4. Cancellation token (AbortSignal) support.
 */

export interface CascadeModelSpec {
  modelId: string;
  provider?: string;
  maxRetries?: number;
}

export interface ProviderCascadeConfig {
  primaryModel: string;
  fallbackModels: string[];
  maxRetriesPerModel?: number;
  fallbackOnBlankResponse?: boolean;
  baseOverloadDelayMs?: number;
  antiServerOverloads?: boolean;
}

export interface CascadeAttemptResult<T> {
  success: boolean;
  modelUsed: string;
  data?: T;
  error?: string;
  attemptsCount: number;
  fallbackTriggered: boolean;
  reason?: "success" | "blank_response" | "server_error" | "aborted" | "max_retries_exceeded";
}

export type DispatchFn<T> = (modelId: string, signal?: AbortSignal) => Promise<{
  text: string;
  data?: T;
  isServerError?: boolean;
}>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ProviderCascadeEngine {
  private config: Required<ProviderCascadeConfig>;

  constructor(config: ProviderCascadeConfig) {
    this.config = {
      primaryModel: config.primaryModel,
      fallbackModels: config.fallbackModels || [],
      maxRetriesPerModel: Math.max(1, config.maxRetriesPerModel ?? 2),
      fallbackOnBlankResponse: config.fallbackOnBlankResponse ?? true,
      baseOverloadDelayMs: Math.max(10, config.baseOverloadDelayMs ?? 200),
      antiServerOverloads: config.antiServerOverloads ?? true,
    };
  }

  /**
   * Executes request across the model chain.
   * If primary fails or yields empty content, it steps down to fallback models.
   */
  public async execute<T = string>(
    dispatch: DispatchFn<T>,
    signal?: AbortSignal
  ): Promise<CascadeAttemptResult<T>> {
    const candidateChain = [this.config.primaryModel, ...this.config.fallbackModels];
    let totalAttempts = 0;
    let fallbackTriggered = false;

    for (let modelIdx = 0; modelIdx < candidateChain.length; modelIdx++) {
      const currentModel = candidateChain[modelIdx];
      if (modelIdx > 0) {
        fallbackTriggered = true;
      }

      let tries = 0;
      const maxRetries = this.config.maxRetriesPerModel;

      while (tries < maxRetries) {
        if (signal?.aborted) {
          return {
            success: false,
            modelUsed: currentModel,
            error: "Request aborted",
            attemptsCount: totalAttempts,
            fallbackTriggered,
            reason: "aborted",
          };
        }

        totalAttempts++;
        tries++;

        try {
          const res = await dispatch(currentModel, signal);

          // Check blank response recovery
          if (this.config.fallbackOnBlankResponse && (!res.text || res.text.trim().length === 0)) {
            // If this is not the last model in the chain, cascade immediately
            if (modelIdx < candidateChain.length - 1) {
              break; // break retry loop to move to next model in candidateChain
            }
          }

          if (res.text && res.text.trim().length > 0) {
            return {
              success: true,
              modelUsed: currentModel,
              data: (res.data !== undefined ? res.data : (res.text as unknown as T)),
              attemptsCount: totalAttempts,
              fallbackTriggered,
              reason: "success",
            };
          }
        } catch (err: any) {
          const isServerOverload = err?.status === 429 || err?.status >= 500 || err?.isServerError;
          if (isServerOverload && this.config.antiServerOverloads) {
            // Anti-server overload: exponential backoff delay with reduced penalty
            const delay = this.config.baseOverloadDelayMs * Math.pow(1.5, tries);
            await sleep(delay);
          }

          if (tries >= maxRetries) {
            // Model exhausted; step to next fallback in chain
            break;
          }
        }
      }
    }

    return {
      success: false,
      modelUsed: candidateChain[candidateChain.length - 1],
      error: "All providers and fallback models in cascade chain failed",
      attemptsCount: totalAttempts,
      fallbackTriggered,
      reason: "max_retries_exceeded",
    };
  }
}
