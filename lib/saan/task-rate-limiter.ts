/**
 * Sliding-Window Task Rate Limiter & Concurrency Queue
 * Clean-room TypeScript adaptation inspired by kwaroran/Risuai TaskRateLimiter.
 *
 * Implements:
 * 1. Sliding-window per-minute rate limiting.
 * 2. Strict concurrency ceilings (`maxConcurrentTasks`).
 * 3. FIFO task queueing with promise resolution.
 * 4. Backpressure status callbacks.
 */

export interface TaskRateLimiterOptions {
  tasksPerMinute?: number;
  maxConcurrentTasks?: number;
  failFast?: boolean;
}

export interface TaskExecutionResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
}

export class TaskRateLimiter {
  private timestamps: number[] = [];
  private activeCount = 0;
  private queue: Array<{
    task: () => Promise<any>;
    resolve: (res: TaskExecutionResult<any>) => void;
  }> = [];

  public readonly options: Required<TaskRateLimiterOptions>;
  public onQueueChange?: (queuedCount: number) => void;

  constructor(options?: TaskRateLimiterOptions) {
    this.options = {
      tasksPerMinute: Math.max(1, options?.tasksPerMinute ?? 60),
      maxConcurrentTasks: Math.max(1, options?.maxConcurrentTasks ?? 5),
      failFast: options?.failFast ?? false,
    };

    if (this.options.maxConcurrentTasks > this.options.tasksPerMinute) {
      this.options.maxConcurrentTasks = this.options.tasksPerMinute;
    }
  }

  public getQueuedCount(): number {
    return this.queue.length;
  }

  public getActiveCount(): number {
    return this.activeCount;
  }

  /**
   * Cleans timestamps older than 60 seconds from the sliding window.
   */
  private sweepWindow(now = Date.now()): void {
    const cutoff = now - 60000;
    while (this.timestamps.length > 0 && this.timestamps[0] <= cutoff) {
      this.timestamps.shift();
    }
  }

  /**
   * Enqueues an asynchronous task to run within rate limits.
   */
  public enqueue<T>(task: () => Promise<T>): Promise<TaskExecutionResult<T>> {
    return new Promise((resolve) => {
      this.queue.push({ task, resolve });
      if (this.onQueueChange) {
        this.onQueueChange(this.queue.length);
      }
      this.processNext();
    });
  }

  private processNext(): void {
    if (this.queue.length === 0) return;
    if (this.activeCount >= this.options.maxConcurrentTasks) return;

    const now = Date.now();
    this.sweepWindow(now);

    if (this.timestamps.length >= this.options.tasksPerMinute) {
      // Calculate delay until the oldest timestamp exits the 60s sliding window
      const oldest = this.timestamps[0];
      const waitMs = Math.max(10, 60000 - (now - oldest) + 5);
      setTimeout(() => this.processNext(), waitMs);
      return;
    }

    const next = this.queue.shift();
    if (!next) return;

    if (this.onQueueChange) {
      this.onQueueChange(this.queue.length);
    }

    this.activeCount++;
    this.timestamps.push(Date.now());

    (async () => {
      try {
        const val = await next.task();
        next.resolve({ success: true, data: val });
      } catch (err: any) {
        next.resolve({ success: false, error: err instanceof Error ? err : new Error(String(err)) });
      } finally {
        this.activeCount--;
        this.processNext();
      }
    })();
  }
}
