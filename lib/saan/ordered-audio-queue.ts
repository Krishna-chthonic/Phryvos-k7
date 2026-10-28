/**
 * Ordered Parallel Audio Synthesis Queue & 20ms RMS Viseme Lip-Sync (from Open-LLM-VTuber)
 *
 * Implements:
 * 1. Monotonic sequence counter for concurrent audio generation with strictly ordered playback delivery.
 * 2. Silent payload bypass for non-vocal action tokens and thought blocks.
 * 3. 20ms RMS volume envelope calculator for zero-latency viseme mouth animation.
 */

export interface AudioPayload {
  sequenceNumber: number;
  audioBase64: string | null;
  text: string;
  isSilent: boolean;
  volumes: number[]; // 20ms normalized RMS envelope
  sliceLengthMs: number;
  actions?: Record<string, any>;
}

export type PlayloadDeliverCallback = (payload: AudioPayload) => Promise<void> | void;

export class OrderedAudioQueue {
  private sequenceCounter = 0;
  private nextSequenceToSend = 0;
  private buffer = new Map<number, AudioPayload>();
  private onDeliver: PlayloadDeliverCallback;

  constructor(onDeliver: PlayloadDeliverCallback) {
    this.onDeliver = onDeliver;
  }

  /**
   * Allocates the next sequential index for a parallel generation task.
   */
  nextSequence(): number {
    return this.sequenceCounter++;
  }

  /**
   * Pushes a completed audio payload (which may arrive out of order from parallel workers).
   * Drains consecutive buffered payloads in strict sequential order (0, 1, 2, ...).
   */
  async pushPayload(payload: AudioPayload): Promise<void> {
    this.buffer.set(payload.sequenceNumber, payload);
    await this.drainBuffer();
  }

  /**
   * Pushes an immediate silent payload for thought blocks or non-vocal actions.
   */
  async pushSilent(text: string, actions?: Record<string, any>): Promise<number> {
    const seq = this.nextSequence();
    const payload: AudioPayload = {
      sequenceNumber: seq,
      audioBase64: null,
      text,
      isSilent: true,
      volumes: [],
      sliceLengthMs: 20,
      actions,
    };
    await this.pushPayload(payload);
    return seq;
  }

  /**
   * Drains the internal buffer in strict monotonically increasing sequence.
   */
  private async drainBuffer(): Promise<void> {
    while (this.buffer.has(this.nextSequenceToSend)) {
      const payload = this.buffer.get(this.nextSequenceToSend)!;
      this.buffer.delete(this.nextSequenceToSend);
      this.nextSequenceToSend++;
      await this.onDeliver(payload);
    }
  }

  /**
   * Returns whether all queued sequences have been delivered.
   */
  isIdle(): boolean {
    return this.nextSequenceToSend === this.sequenceCounter && this.buffer.size === 0;
  }

  /**
   * Resets the sequence counters and clears any pending payloads.
   */
  reset(): void {
    this.sequenceCounter = 0;
    this.nextSequenceToSend = 0;
    this.buffer.clear();
  }
}

/**
 * Computes a normalized 20ms RMS volume envelope for zero-latency viseme lip-sync animation.
 *
 * @param samples Array of audio PCM samples normalized between -1.0 and 1.0 (or 16-bit integers)
 * @param sliceLengthMs Chunk duration in milliseconds (default 20ms)
 * @param sampleRate Audio sample rate in Hz (default 16000)
 */
export function computeRmsVolumeEnvelope(
  samples: number[] | Float32Array,
  sliceLengthMs = 20,
  sampleRate = 16000
): number[] {
  if (!samples || samples.length === 0) return [];

  const samplesPerChunk = Math.max(1, Math.floor((sampleRate * sliceLengthMs) / 1000));
  const rawRmsValues: number[] = [];
  let maxRms = 0.0001;

  for (let i = 0; i < samples.length; i += samplesPerChunk) {
    const chunk = samples.slice(i, i + samplesPerChunk);
    if (chunk.length === 0) break;

    let sumSquares = 0;
    for (let j = 0; j < chunk.length; j++) {
      let val = chunk[j];
      // Normalize 16-bit signed PCM if detected
      if (Math.abs(val) > 1.5) {
        val = val / 32768.0;
      }
      sumSquares += val * val;
    }

    const rms = Math.sqrt(sumSquares / chunk.length);
    rawRmsValues.push(rms);
    if (rms > maxRms) {
      maxRms = rms;
    }
  }

  // Normalize all chunks to 0.0 - 1.0 range
  return rawRmsValues.map((r) => parseFloat((r / maxRms).toFixed(3)));
}
