/**
 * @file voice-turntaking-fsm.ts
 * @description Clean-room TypeScript adaptation of voice agent turn-taking FSM
 * (LiveKit Agents) and spoken utterance normalization (OVOS Core). Provides
 * state transitions (IDLE, LISTENING, THINKING, SPEAKING), barge-in voice
 * interruption handling, and acoustic filler/disfluency scrubbing.
 */

export type VoiceAgentState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING';

export type VoiceTurnEvent =
  | 'user_speech_start'
  | 'user_speech_end'
  | 'llm_response_ready'
  | 'bot_speech_end'
  | 'force_reset';

export interface TurnTransitionResult {
  previousState: VoiceAgentState;
  currentState: VoiceAgentState;
  event: VoiceTurnEvent;
  bargeInDetected: boolean;
  timestampMs: number;
}

const ACOUSTIC_FILLERS = new Set([
  'um',
  'uh',
  'erm',
  'ah',
  'like',
  'you know',
  'i mean',
  'hmm',
]);

export class UtteranceNormalizer {
  /**
   * Cleans spoken disfluencies, stutter repetitions, and acoustic fillers (inspired by OVOS Core).
   */
  public normalize(rawUtterance: string): string {
    if (!rawUtterance || typeof rawUtterance !== 'string') return '';

    let cleaned = rawUtterance.trim();

    // 1. Remove stuttered word repetitions: e.g. "I I want to to go" -> "I want to go"
    cleaned = cleaned.replace(/\b(\w+)\s+\1\b/gi, '$1');

    // 2. Remove acoustic fillers when isolated by punctuation or whitespace
    for (const filler of ACOUSTIC_FILLERS) {
      const regex = new RegExp(`(^|\\s|[.,!?])${filler}([.,!?]|\\s|$)`, 'gi');
      cleaned = cleaned.replace(regex, ' ');
    }

    // 3. Clean up multiple spaces and punctuation artifacts
    cleaned = cleaned
      .replace(/\s+([.,!?])/g, '$1')
      .replace(/([.,!?])\1+/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned;
  }
}

export class VoiceTurnTakingFSM {
  private state: VoiceAgentState = 'IDLE';
  private normalizer = new UtteranceNormalizer();
  private silenceHysteresisMs: number;
  private lastStateChangeMs: number = Date.now();

  constructor(silenceHysteresisMs = 500) {
    this.silenceHysteresisMs = silenceHysteresisMs;
  }

  public getState(): VoiceAgentState {
    return this.state;
  }

  public getNormalizer(): UtteranceNormalizer {
    return this.normalizer;
  }

  /**
   * Processes a turn-taking event and manages state transitions and barge-in interrupts.
   */
  public handleEvent(event: VoiceTurnEvent): TurnTransitionResult {
    const prev = this.state;
    let bargeIn = false;

    switch (event) {
      case 'user_speech_start': {
        if (this.state === 'SPEAKING') {
          // Barge-in interruption!
          bargeIn = true;
          this.state = 'LISTENING';
        } else if (this.state === 'IDLE' || this.state === 'THINKING') {
          this.state = 'LISTENING';
        }
        break;
      }

      case 'user_speech_end': {
        if (this.state === 'LISTENING') {
          this.state = 'THINKING';
        }
        break;
      }

      case 'llm_response_ready': {
        if (this.state === 'THINKING') {
          this.state = 'SPEAKING';
        }
        break;
      }

      case 'bot_speech_end': {
        if (this.state === 'SPEAKING') {
          this.state = 'IDLE';
        }
        break;
      }

      case 'force_reset': {
        this.state = 'IDLE';
        break;
      }
    }

    this.lastStateChangeMs = Date.now();

    return {
      previousState: prev,
      currentState: this.state,
      event,
      bargeInDetected: bargeIn,
      timestampMs: this.lastStateChangeMs,
    };
  }

  public normalizeSpokenInput(text: string): string {
    return this.normalizer.normalize(text);
  }
}
