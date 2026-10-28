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
   * Resolves language configuration for multilingual and Hinglish code-switching environments.
   */
  public getDecodingConfig(detectedOrRequestedLang = 'auto', userContextPrompt?: string): AsrDecodingConfig {
    const lang = detectedOrRequestedLang.toLowerCase().trim();
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
