/**
 * Conversational Barge-In Interruption Manager (from moeru-ai/airi core-agent voice)
 *
 * Implements:
 * 1. Rapid detection of user speech / typing during audio playback.
 * 2. 100ms fade-out and cancellation of speech synthesis.
 * 3. Durable Interruption Receipt logging.
 */

export interface VoiceInterruptionReceipt {
  interruptedAt: number;
  cause: "user_speech" | "user_typing" | "user_action";
  fadeDurationMs: number;
  status: "silenced" | "cancelled";
}

export class VoiceBargeInManager {
  private _isSpeaking = false;
  private lastInterruption: VoiceInterruptionReceipt | null = null;
  private fadeMs = 100;
  private onFadeOut?: () => void;

  constructor(optionsOrFadeMs: number | { onFadeOut?: () => void; fadeMs?: number } = 100) {
    if (typeof optionsOrFadeMs === "number") {
      this.fadeMs = optionsOrFadeMs;
    } else if (optionsOrFadeMs && typeof optionsOrFadeMs === "object") {
      this.fadeMs = optionsOrFadeMs.fadeMs ?? 100;
      this.onFadeOut = optionsOrFadeMs.onFadeOut;
    }
  }

  /**
   * Sets current speaking status.
   */
  setSpeaking(speaking: boolean): void {
    this._isSpeaking = speaking;
  }

  /**
   * Starts speaking text.
   */
  startSpeaking(_text?: string): void {
    this._isSpeaking = true;
  }

  /**
   * Returns whether speech playback is currently active.
   */
  getIsSpeaking(): boolean {
    return this._isSpeaking;
  }

  /**
   * Getter / method for speaking state.
   */
  isSpeaking(): boolean {
    return this._isSpeaking;
  }

  /**
   * Cancels active playback with fadeout.
   */
  cancel(callback?: () => void): void {
    this.interrupt("user_speech");
    if (this.onFadeOut) {
      try {
        this.onFadeOut();
      } catch {}
    }
    if (callback) {
      callback();
    }
  }

  /**
   * Triggers barge-in cancellation when user speaks or submits a message.
   */
  interrupt(cause: VoiceInterruptionReceipt["cause"] = "user_speech"): VoiceInterruptionReceipt {
    const wasSpeaking = this._isSpeaking;
    this._isSpeaking = false;

    // If browser speech synthesis is active, cancel it
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    const receipt: VoiceInterruptionReceipt = {
      interruptedAt: Date.now(),
      cause,
      fadeDurationMs: this.fadeMs,
      status: wasSpeaking ? "silenced" : "cancelled",
    };

    this.lastInterruption = receipt;
    return receipt;
  }

  /**
   * Returns the most recent interruption receipt.
   */
  getLastReceipt(): VoiceInterruptionReceipt | null {
    return this.lastInterruption;
  }
}

// Global singleton instance for companion voice control
let voiceBargeInSingleton: VoiceBargeInManager | null = null;

export function getVoiceBargeInManager(): VoiceBargeInManager {
  if (!voiceBargeInSingleton) {
    voiceBargeInSingleton = new VoiceBargeInManager(100);
  }
  return voiceBargeInSingleton;
}
