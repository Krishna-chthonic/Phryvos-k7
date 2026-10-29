/**
 * @file kokoro-cadence-pacing.test.ts
 * @description Comprehensive unit tests for Kokoro Text Splitter & Circadian Cadence Pacing Engine
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  KokoroTextSplitter,
  CircadianCadenceEngine,
} from '../../lib/saan/kokoro-cadence-pacing';

describe('Kokoro TTS Text Splitter & Circadian Cadence Engine (Repo #39)', () => {
  const splitter = new KokoroTextSplitter();
  const cadence = new CircadianCadenceEngine();

  test('Text Splitter - Does not split on abbreviations or currency numbers', () => {
    const text = 'Dr. Sharma visited Mr. Verma at 10.30 AM. They spent $9.99 on coffee.';
    const sentences = splitter.split(text);

    assert.equal(sentences.length, 2);
    assert.equal(sentences[0], 'Dr. Sharma visited Mr. Verma at 10.30 AM.');
    assert.equal(sentences[1], 'They spent $9.99 on coffee.');
  });

  test('Text Splitter - Respects quoted dialogue and does not break inside quotes', () => {
    const text = 'Saan asked, "Are you ready? Let us begin!" Then she smiled.';
    const sentences = splitter.split(text);

    assert.equal(sentences.length, 2);
    assert.equal(sentences[0], 'Saan asked, "Are you ready? Let us begin!"');
    assert.equal(sentences[1], 'Then she smiled.');
  });

  test('Circadian Pacing - Applies distinct prosody across 4 daily time slots', () => {
    const morning = cadence.getCadenceSettings(7);
    assert.equal(morning.timeSlot, 'morning');
    assert.equal(morning.tone, 'energetic');
    assert.ok(morning.speed >= 1.05);

    const day = cadence.getCadenceSettings(14);
    assert.equal(day.timeSlot, 'day');
    assert.equal(day.tone, 'focused');
    assert.equal(day.speed, 1.00);

    const evening = cadence.getCadenceSettings(20);
    assert.equal(evening.timeSlot, 'evening');
    assert.equal(evening.tone, 'warm');
    assert.ok(evening.periodPauseMs > day.periodPauseMs);

    const night = cadence.getCadenceSettings(23);
    assert.equal(night.timeSlot, 'night');
    assert.equal(night.tone, 'gentle');
    assert.ok(night.speed <= 0.90);
    assert.equal(night.periodPauseMs, 500);
  });

  test('Pace Text - Enriches sentences with pause durations and speed metadata', () => {
    const text = 'Good evening. How was your day? I hope it was peaceful.';
    const result = cadence.paceText(text, 21); // Evening 9 PM

    assert.equal(result.sentenceCount, 3);
    assert.equal(result.settings.tone, 'warm');
    assert.equal(result.sentences[0].pauseAfterMs, result.settings.periodPauseMs);
    assert.equal(result.sentences[2].pauseAfterMs, 0, 'Last sentence has zero trailing pause');
  });
});
