/**
 * @file whisper-multilingual-decoding.test.ts
 * @description Comprehensive unit tests for Whisper ASR Multilingual VAD Decoding & Language Selection (Repo #40)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  WhisperAsrNormalizer,
  SUPPORTED_ASR_LANGUAGES,
} from '../../lib/saan/whisper-asr-normalizer';

describe('Whisper ASR Multilingual VAD Decoding & Language Selection (Repo #40)', () => {
  const normalizer = new WhisperAsrNormalizer();

  test('Language Registry - Exposes all 8 supported language profiles with BCP-47 tags', () => {
    assert.equal(SUPPORTED_ASR_LANGUAGES.length, 8);
    const hinglish = SUPPORTED_ASR_LANGUAGES.find((l) => l.code === 'hinglish');
    assert.ok(hinglish);
    assert.equal(hinglish?.bcp47, 'hi-IN');

    const japanese = SUPPORTED_ASR_LANGUAGES.find((l) => l.code === 'ja');
    assert.ok(japanese);
    assert.equal(japanese?.nativeLabel, '日本語');
  });

  test('Heuristic Language Detection - Accurately categorizes Hinglish, Hindi, and Japanese', () => {
    // Hindi Devanagari
    const hiResult = normalizer.detectLanguage('नमस्ते! आप कैसे हैं?');
    assert.equal(hiResult.code, 'hi');
    assert.ok(hiResult.confidence > 0.9);

    // Japanese Kanji & Kana
    const jaResult = normalizer.detectLanguage('こんにちは世界');
    assert.equal(jaResult.code, 'ja');
    assert.ok(jaResult.confidence > 0.9);

    // Hinglish Latin colloquial
    const hinglishResult = normalizer.detectLanguage('Haan bhai bilkul theek hai yaar');
    assert.equal(hinglishResult.code, 'hinglish');
    assert.ok(hinglishResult.confidence > 0.8);

    // English fallback
    const enResult = normalizer.detectLanguage('The sovereign agent architecture is operational.');
    assert.equal(enResult.code, 'en');
  });

  test('VAD Speech Chunking - Splits utterance streams into timed segments with valid bounds', () => {
    const speechStream =
      'Hello there. This is a complete test of voice activity detection. We want to ensure proper timing.';
    const segments = normalizer.splitIntoVadSegments(speechStream, 6);

    assert.ok(segments.length >= 2);
    assert.equal(segments[0].id, 0);
    assert.ok(segments[0].startMs >= 0);
    assert.ok(segments[0].endMs > segments[0].startMs);
    assert.ok(segments[1].startMs >= segments[0].endMs);
  });

  test('Decoding Config Adaptation - Preserves prompt prefixes and suppresses non-speech tokens', () => {
    const config = normalizer.getDecodingConfig('auto', 'Technical conversation about kernel drivers');
    assert.equal(config.language, 'en');
    assert.equal(config.suppressNonSpeechTokens, true);
    assert.equal(config.temperatureCascade.length, 6);
    assert.ok(config.promptPrefix?.includes('Technical conversation'));
  });
});
