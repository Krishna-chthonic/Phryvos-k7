/**
 * @file pipecat-frame-pipeline.test.ts
 * @description Comprehensive unit tests for Pipecat Low-Latency Audio Streaming Pipeline
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  PipecatFramePipeline,
  AudioRawFrame,
  TextFrame,
  CancelFrame,
  StartInterruptionFrame,
  UserStartedSpeakingFrame,
  UserStoppedSpeakingFrame,
  BotStartedSpeakingFrame,
} from '../../lib/saan/pipecat-frame-pipeline';

describe('Pipecat Low-Latency Streaming Audio Frame Pipeline (Repo #36)', () => {
  test('Monotonic Presentation Timestamps - pts strictly increments in nanoseconds', () => {
    const f1 = new TextFrame('Hello');
    const f2 = new AudioRawFrame(new Uint8Array(160));

    assert.ok(f1.id > 0);
    assert.ok(f2.id > f1.id);
    assert.ok(typeof f1.pts === 'bigint');
    assert.ok(typeof f2.pts === 'bigint');
    assert.ok(f2.pts >= f1.pts, 'Presentation timestamp must be monotonically increasing');
  });

  test('FIFO Queue Ordering - Preserves frame sequence', () => {
    const pipeline = new PipecatFramePipeline();
    pipeline.clear();

    const t1 = new TextFrame('Part 1');
    const t2 = new TextFrame('Part 2');
    const a1 = new AudioRawFrame(new Uint8Array(320));

    pipeline.push(t1);
    pipeline.push(t2);
    pipeline.push(a1);

    assert.equal(pipeline.size(), 3);
    assert.equal(pipeline.pop()?.id, t1.id);
    assert.equal(pipeline.pop()?.id, t2.id);
    assert.equal(pipeline.pop()?.id, a1.id);
    assert.equal(pipeline.size(), 0);
  });

  test('Barge-In Interruption - CancelFrame purges interruptible audio and text frames instantly', () => {
    const pipeline = new PipecatFramePipeline();
    pipeline.clear();

    // Push 3 interruptible frames
    pipeline.push(new AudioRawFrame(new Uint8Array(640), 16000, 1, true));
    pipeline.push(new TextFrame('Assistant sentence in progress...', true));
    pipeline.push(new AudioRawFrame(new Uint8Array(640), 16000, 1, true));

    assert.equal(pipeline.size(), 3);

    // User interrupts (pushes CancelFrame)
    const cancel = new CancelFrame('user_barge_in');
    pipeline.push(cancel);

    // All 3 interruptible frames should be dropped immediately; only CancelFrame remains
    assert.equal(pipeline.size(), 1);
    const popped = pipeline.pop();
    assert.equal(popped?.id, cancel.id);
    assert.equal(popped instanceof CancelFrame, true);
  });

  test('Uninterruptible User Control Frames - Preserved during barge-in drainage', () => {
    const pipeline = new PipecatFramePipeline();
    pipeline.clear();

    const userSpeechStart = new UserStartedSpeakingFrame();
    pipeline.push(userSpeechStart);
    pipeline.push(new AudioRawFrame(new Uint8Array(320), 16000, 1, true));

    const cancel = new CancelFrame();
    pipeline.push(cancel);

    // userSpeechStart is uninterruptible (interruptible: false), so it must NOT be purged
    assert.equal(pipeline.size(), 2);
    const first = pipeline.pop();
    const second = pipeline.pop();
    assert.equal(first?.id, userSpeechStart.id);
    assert.equal(second?.id, cancel.id);
  });

  test('Audit Log Tracking - Records enqueued, popped, and drained frames with timestamps', () => {
    const pipeline = new PipecatFramePipeline();
    pipeline.clear();

    const frame = new TextFrame('Audit test');
    pipeline.push(frame);

    const audit = pipeline.getAuditLog();
    assert.ok(audit.length >= 1);
    assert.equal(audit[0].id, frame.id);
    assert.equal(audit[0].status, 'enqueued');

    pipeline.pop();
    assert.equal(pipeline.getAuditLog()[0].status, 'popped');
  });
});
