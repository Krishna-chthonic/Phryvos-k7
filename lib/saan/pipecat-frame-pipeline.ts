/**
 * @file pipecat-frame-pipeline.ts
 * @description Clean-room TypeScript adaptation of Pipecat AI's streaming frame
 * pipeline. Provides monotonic presentation timestamps (pts), typed audio/text frames,
 * and priority queue draining for low-latency conversational audio.
 */

let globalFrameCounter = 0;

export abstract class Frame {
  public readonly id: number;
  public readonly name: string;
  public readonly pts: bigint;
  public readonly interruptible: boolean;
  public readonly metadata: Record<string, any>;

  constructor(interruptible = true, metadata: Record<string, any> = {}) {
    this.id = ++globalFrameCounter;
    this.name = `${this.constructor.name}_${this.id}`;
    // Monotonic presentation timestamp in nanoseconds
    this.pts = process.hrtime.bigint();
    this.interruptible = interruptible;
    this.metadata = metadata;
  }
}

export class AudioRawFrame extends Frame {
  constructor(
    public readonly audio: Uint8Array | Buffer,
    public readonly sampleRate = 16000,
    public readonly channels = 1,
    interruptible = true,
    metadata = {}
  ) {
    super(interruptible, metadata);
  }
}

export class TextFrame extends Frame {
  constructor(
    public readonly text: string,
    interruptible = true,
    metadata = {}
  ) {
    super(interruptible, metadata);
  }
}

export class UserStartedSpeakingFrame extends Frame {
  constructor(metadata = {}) {
    super(false, metadata); // User control frames are never interruptible
  }
}

export class UserStoppedSpeakingFrame extends Frame {
  constructor(metadata = {}) {
    super(false, metadata);
  }
}

export class BotStartedSpeakingFrame extends Frame {
  constructor(metadata = {}) {
    super(true, metadata);
  }
}

export class BotStoppedSpeakingFrame extends Frame {
  constructor(metadata = {}) {
    super(false, metadata);
  }
}

export class CancelFrame extends Frame {
  constructor(public readonly reason = 'user_interruption', metadata = {}) {
    super(false, metadata); // Cancel command cannot be cancelled
  }
}

export class StartInterruptionFrame extends Frame {
  constructor(metadata = {}) {
    super(false, metadata);
  }
}

export class PipecatFramePipeline {
  private queue: Frame[] = [];

  /**
   * Pushes a frame into the streaming pipeline.
   * If a CancelFrame or StartInterruptionFrame is received, instantly purges
   * all queued interruptible frames (barge-in cancellation).
   */
  public push(frame: Frame): void {
    if (frame instanceof CancelFrame || frame instanceof StartInterruptionFrame) {
      this.drainInterruptibles();
      this.queue.push(frame);
    } else {
      this.queue.push(frame);
    }
  }

  /**
   * Dequeues the next frame in FIFO sequence.
   */
  public pop(): Frame | null {
    return this.queue.shift() || null;
  }

  /**
   * Drains all pending frames marked as interruptible.
   * Returns the count of dropped frames.
   */
  public drainInterruptibles(): number {
    const originalCount = this.queue.length;
    this.queue = this.queue.filter(f => !f.interruptible);
    return originalCount - this.queue.length;
  }

  /**
   * Returns current queue size.
   */
  public size(): number {
    return this.queue.length;
  }

  /**
   * Inspects all currently queued frames.
   */
  public getQueuedFrames(): Frame[] {
    return [...this.queue];
  }
}
