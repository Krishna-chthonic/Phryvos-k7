/**
 * @file whisper-asr-normalizer.ts
 * @description Clean-room TypeScript adaptation of Whisper's multilingual ASR
 * normalization pipeline, Hinglish/Indic code-switching heuristics, and decoding
 * temperature cascade. Inspired by openai/whisper (8609812).
 */

export interface AsrDecodingConfig {
  language: string;
  task: 'transcribe' | 'translate';
  temperatureCascade: number[];
  promptPrefix?: string;
  suppressNonSpeechTokens: boolean;
}

export interface VadSegment {
  id: number;
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
}

export interface LanguageProfile {
  code: string;
  bcp47: string;
  label: string;
  nativeLabel: string;
  flag: string;
}

export const SUPPORTED_ASR_LANGUAGES: LanguageProfile[] = [
  { code: 'auto', bcp47: 'en-US', label: 'Auto-Detect', nativeLabel: 'Auto', flag: '🌐' },
  { code: 'hinglish', bcp47: 'hi-IN', label: 'Hinglish', nativeLabel: 'Hinglish', flag: '🇮🇳' },
  { code: 'hi', bcp47: 'hi-IN', label: 'Hindi', nativeLabel: 'हिन्दी', flag: '🇮🇳' },
  { code: 'en', bcp47: 'en-US', label: 'English', nativeLabel: 'English', flag: '🇬🇧' },
  { code: 'ja', bcp47: 'ja-JP', label: 'Japanese', nativeLabel: '日本語', flag: '🇯🇵' },
  { code: 'es', bcp47: 'es-ES', label: 'Spanish', nativeLabel: 'Español', flag: '🇪🇸' },
  { code: 'fr', bcp47: 'fr-FR', label: 'French', nativeLabel: 'Français', flag: '🇫🇷' },
  { code: 'de', bcp47: 'de-DE', label: 'German', nativeLabel: 'Deutsch', flag: '🇩🇪' },
];

export class WhisperAsrNormalizer {
  /**
   * Cleans raw speech recognition transcripts by stripping non-speech audio cues,
   * bracketed descriptions, and applying Unicode normalization.
   */
  public normalize(rawTranscript: string): string {
    if (!rawTranscript || typeof rawTranscript !== 'string') return '';

    let text = rawTranscript;

    // 1. Remove bracketed sounds: [laughter], [applause], [cough], etc.
    text = text.replace(/\[[^\]]*\]/g, ' ');

    // 2. Remove parenthetical non-speech notes: (giggles), (sighs)
    text = text.replace(/\([^)]*\)/g, ' ');

    // 3. Normalize Unicode (NFKC)
    text = text.normalize('NFKC');

    // 4. Clean punctuation artifacts and multiple spaces
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }

  /**
   * Fast heuristic language detector for conversational ASR transcripts.
   */
  public detectLanguage(text: string): { code: string; confidence: number } {
    if (!text || text.trim().length === 0) return { code: 'en', confidence: 0.5 };

    // Devanagari script: U+0900 - U+097F
    if (/[\u0900-\u097F]/.test(text)) {
      return { code: 'hi', confidence: 0.95 };
    }

    // Japanese CJK / Kana
    if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) {
      return { code: 'ja', confidence: 0.95 };
    }

    // Hinglish keywords heuristic
    const hinglishMarkers = /\b(haan|theek|karo|bhai|yaar|achha|matlab|mera|meri|kya|kyun|nahin|nahi|aur|kab|kaise)\b/i;
    if (hinglishMarkers.test(text)) {
      return { code: 'hinglish', confidence: 0.88 };
    }

    // Spanish / French / German common accents
    if (/[áéíóúñ¿¡]/.test(text)) {
      return { code: 'es', confidence: 0.85 };
    }
    if (/[àâçéèêëîïôûùüÿœæ]/.test(text)) {
      return { code: 'fr', confidence: 0.85 };
    }
    if (/[äöüß]/.test(text)) {
      return { code: 'de', confidence: 0.85 };
    }

    return { code: 'en', confidence: 0.80 };
  }

  /**
   * Voice Activity Detection (VAD) Speech Segmenter.
   * Splits normalized utterance streams into timed conversational audio segments.
   */
  public splitIntoVadSegments(text: string, maxSegmentWords = 15): VadSegment[] {
    const clean = this.normalize(text);
    if (!clean) return [];

    const words = clean.split(/\s+/);
    const segments: VadSegment[] = [];

    let currentWords: string[] = [];
    let currentStartMs = 0;
    let segId = 0;

    for (let i = 0; i < words.length; i++) {
      currentWords.push(words[i]);
      const word = words[i];
      const isTerminal = /[.!?]$/.test(word);

      if (isTerminal || currentWords.length >= maxSegmentWords || i === words.length - 1) {
        const segText = currentWords.join(' ');
        const durationMs = Math.max(800, currentWords.length * 280);
        segments.push({
          id: segId++,
          text: segText,
          startMs: currentStartMs,
          endMs: currentStartMs + durationMs,
          confidence: 0.94,
        });
        currentStartMs += durationMs + 200; // 200ms inter-speech silence
        currentWords = [];
      }
    }

    return segments;
  }

  /**
   * Resolves language configuration for multilingual and Hinglish code-switching environments.
   */
  public getDecodingConfig(detectedOrRequestedLang = 'auto', userContextPrompt?: string): AsrDecodingConfig {
    let lang = detectedOrRequestedLang.toLowerCase().trim();

    if (lang === 'auto') {
      lang = 'en';
    }

    let selectedLang = 'en';
    if (lang === 'hi' || lang === 'hin' || lang === 'hindi' || lang === 'hinglish') {
      selectedLang = 'hi';
    } else if (lang === 'es' || lang === 'fr' || lang === 'de' || lang === 'ja' || lang === 'zh') {
      selectedLang = lang;
    }

    return {
      language: selectedLang,
      task: 'transcribe',
      temperatureCascade: [0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
      promptPrefix: userContextPrompt ? userContextPrompt.slice(0, 200) : undefined,
      suppressNonSpeechTokens: true,
    };
  }

  /**
   * Evaluates next decoding temperature if repetition or low confidence is detected.
   */
  public evaluateTemperatureFallback(
    currentTemp: number,
    repetitionDetected: boolean,
    avgLogprob?: number
  ): { nextTemperature: number; shouldFallback: boolean; reason?: string } {
    const cascade = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0];
    const currentIndex = cascade.indexOf(currentTemp);

    if (repetitionDetected) {
      const nextIdx = Math.min(currentIndex + 1, cascade.length - 1);
      return {
        nextTemperature: cascade[nextIdx],
        shouldFallback: nextIdx > currentIndex,
        reason: 'Repetitive loop detected in decoding output',
      };
    }

    if (avgLogprob !== undefined && avgLogprob < -1.0) {
      const nextIdx = Math.min(currentIndex + 1, cascade.length - 1);
      return {
        nextTemperature: cascade[nextIdx],
        shouldFallback: nextIdx > currentIndex,
        reason: 'Low logprob confidence score',
      };
    }

    return {
      nextTemperature: currentTemp,
      shouldFallback: false,
    };
  }
}

export const globalWhisperNormalizer = new WhisperAsrNormalizer();

