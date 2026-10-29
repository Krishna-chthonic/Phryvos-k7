/**
 * @file whisper-asr-normalizer.test.ts
 * @description Comprehensive unit tests for Whisper ASR Normalizer & Temperature Fallback Cascade
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { WhisperAsrNormalizer } from '../../lib/saan/whisper-asr-normalizer';

describe('Whisper Multilingual ASR Normalizer & Temperature Cascade (Repo #38)', () => {
  const normalizer = new WhisperAsrNormalizer();

  test('Audio Cue Stripping - Removes bracketed and parenthetical non-speech sounds', () => {
    const raw = '[laughter] Haan bilkul theek hai (applause), let us do this [cough] now!';
    const clean = normalizer.normalize(raw);
    assert.ok(!clean.includes('[laughter]'));
    assert.ok(!clean.includes('(applause)'));
    assert.ok(!clean.includes('[cough]'));
    assert.equal(clean, 'Haan bilkul theek hai , let us do this now!');
  });

  test('Unicode NFKC Normalization - Normalizes full-width and accented characters', () => {
    const raw = 'Ｈｅｌｌｏ [music] Ｗｏｒｌｄ';
    const clean = normalizer.normalize(raw);
    assert.equal(clean, 'Hello World');
  });

  test('Decoding Config - Auto-detects and prioritizes Hinglish / Indic context', () => {
    const hinglishCfg = normalizer.getDecodingConfig('hinglish', 'Discussion about chai and samosa');
    assert.equal(hinglishCfg.language, 'hi');
    assert.equal(hinglishCfg.task, 'transcribe');
    assert.ok(hinglishCfg.promptPrefix?.includes('chai and samosa'));

    const esCfg = normalizer.getDecodingConfig('es');
    assert.equal(esCfg.language, 'es');
  });

  test('Temperature Fallback Cascade - Steps to higher temperature upon repetition', () => {
    // Starting at 0.0 with repetition detected -> next should be 0.2
    let res = normalizer.evaluateTemperatureFallback(0.0, true);
    assert.equal(res.shouldFallback, true);
    assert.equal(res.nextTemperature, 0.2);
    assert.ok(res.reason?.includes('Repetitive loop'));

    // Next step from 0.2 -> 0.4
    res = normalizer.evaluateTemperatureFallback(0.2, true);
    assert.equal(res.nextTemperature, 0.4);

    // At maximum 1.0 -> shouldFallback is false
    res = normalizer.evaluateTemperatureFallback(1.0, true);
    assert.equal(res.shouldFallback, false);
    assert.equal(res.nextTemperature, 1.0);
  });

  test('Temperature Fallback Cascade - Steps upon low logprob confidence score', () => {
    const res = normalizer.evaluateTemperatureFallback(0.0, false, -1.8);
    assert.equal(res.shouldFallback, true);
    assert.equal(res.nextTemperature, 0.2);
    assert.ok(res.reason?.includes('Low logprob'));
  });
});
