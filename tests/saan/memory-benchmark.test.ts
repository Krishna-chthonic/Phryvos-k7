import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MemoryBenchmarkHarness,
  STANDARD_LONGMEMEVAL_PROBES,
} from '../../lib/saan/memory-benchmark-bitemporal.js';

test('MemoryBenchmarkHarness: normalise collapses punctuation, whitespace and stop words', () => {
  const harness = new MemoryBenchmarkHarness();
  const normalized = harness.normalise('The quick, brown fox... jumped in the garden!');
  assert.equal(normalized, 'quick brown fox jumped garden');
});

test('MemoryBenchmarkHarness: stringMatch evaluates normalized bidirectional match', () => {
  const harness = new MemoryBenchmarkHarness();
  assert.ok(harness.stringMatch('Adrak Masala Chai', 'Adrak Masala Chai'));
  assert.ok(harness.stringMatch('User drinks Adrak Masala Chai daily', 'Adrak Masala Chai'));
  assert.ok(!harness.stringMatch('Cold Coffee', 'Hot Chai'));
});

test('MemoryBenchmarkHarness: judgeProbe evaluates standard facts vs adversarial abstention', () => {
  const harness = new MemoryBenchmarkHarness();

  // Standard factual probe
  const normalVerdict = harness.judgeProbe(
    'What is user favorite drink?',
    'Chai',
    'User enjoys hot Chai in morning.',
    false
  );
  assert.ok(normalVerdict.correct, 'Normal factual probe should be evaluated correct');
  assert.ok(!normalVerdict.abstained);

  // Adversarial probe requiring abstention
  const advVerdict = harness.judgeProbe(
    'What is user secret code on Jupiter?',
    '',
    'I do not know and have no information regarding that.',
    true
  );
  assert.ok(advVerdict.correct, 'Adversarial probe must be correct when agent abstains');
  assert.ok(advVerdict.abstained, 'Must detect abstention keywords');

  // Adversarial probe where agent hallucinated
  const hallucinatedVerdict = harness.judgeProbe(
    'What is user secret code on Jupiter?',
    '',
    'The code is JUPITER-999-SECRET',
    true
  );
  assert.ok(!hallucinatedVerdict.correct, 'Adversarial probe must fail when hallucinating');
  assert.ok(!hallucinatedVerdict.abstained);
});

test('MemoryBenchmarkHarness: runStandardSuite computes LoCoMo categories and sub-10ms latency', () => {
  const harness = new MemoryBenchmarkHarness();
  const summary = harness.runStandardSuite();

  assert.equal(summary.totalProbes, STANDARD_LONGMEMEVAL_PROBES.length);
  assert.ok(summary.answerableCount > 0);
  assert.ok(summary.adversarialCount > 0);
  assert.equal(summary.refusedAdversarialPercent, 100);
  assert.ok(summary.recallPercent >= 75);
  assert.ok(summary.sub10msTargetMet, 'Expected P50 search latency to be under 10ms');
  assert.ok(summary.searchLatencyP50Ms < 10);
  assert.ok(summary.categoryRecall['single-hop'] !== undefined);
  assert.ok(summary.categoryRecall['adversarial'] !== undefined);
});
