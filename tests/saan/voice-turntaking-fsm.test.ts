/**
 * @file voice-turntaking-fsm.test.ts
 * @description Comprehensive unit tests for Voice Turn-Taking FSM & Spoken Utterance Normalizer
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  VoiceTurnTakingFSM,
  UtteranceNormalizer,
} from '../../lib/saan/voice-turntaking-fsm';

describe('Voice Turn-Taking FSM & Utterance Normalizer (Repo #37)', () => {
  const fsm = new VoiceTurnTakingFSM();
  const normalizer = new UtteranceNormalizer();

  test('FSM Lifecycle - Standard conversational turn transitions', () => {
    fsm.handleEvent('force_reset');
    assert.equal(fsm.getState(), 'IDLE');

    // 1. User starts speaking -> LISTENING
    let res = fsm.handleEvent('user_speech_start');
    assert.equal(res.currentState, 'LISTENING');
    assert.equal(res.bargeInDetected, false);

    // 2. User stops speaking -> THINKING
    res = fsm.handleEvent('user_speech_end');
    assert.equal(res.currentState, 'THINKING');

    // 3. LLM finishes thinking -> SPEAKING
    res = fsm.handleEvent('llm_response_ready');
    assert.equal(res.currentState, 'SPEAKING');

    // 4. TTS audio completes -> IDLE
    res = fsm.handleEvent('bot_speech_end');
    assert.equal(res.currentState, 'IDLE');
  });

  test('Barge-In Detection - User speech during SPEAKING triggers barge-in and transitions to LISTENING', () => {
    fsm.handleEvent('force_reset');

    // Fast-forward to SPEAKING
    fsm.handleEvent('user_speech_start');
    fsm.handleEvent('user_speech_end');
    fsm.handleEvent('llm_response_ready');
    assert.equal(fsm.getState(), 'SPEAKING');

    // User interrupts!
    const res = fsm.handleEvent('user_speech_start');
    assert.equal(res.currentState, 'LISTENING');
    assert.equal(res.bargeInDetected, true, 'Must flag barge-in when interrupted while speaking');
  });

  test('Utterance Normalizer - Stutter removal', () => {
    const raw = 'I I want to to go to the the market.';
    const clean = normalizer.normalize(raw);
    assert.equal(clean, 'I want to go to the market.');
  });

  test('Utterance Normalizer - Acoustic filler and disfluency elimination', () => {
    const raw = 'Um, I was thinking like, uh, we should start the task now.';
    const clean = normalizer.normalize(raw);
    assert.ok(!clean.toLowerCase().includes('um'));
    assert.ok(!clean.toLowerCase().includes('uh'));
    assert.ok(clean.includes('start the task now'));
  });

  test('Utterance Normalizer - Graceful handling of empty string and whitespace', () => {
    assert.equal(normalizer.normalize(''), '');
    assert.equal(normalizer.normalize('   '), '');
  });
});
