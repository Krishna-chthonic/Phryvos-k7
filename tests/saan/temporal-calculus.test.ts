import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BiTemporalCalculus,
  type TemporalEdge,
} from '../../lib/saan/memory-benchmark-bitemporal.js';

test('BiTemporalCalculus: isEdgeValidAt respects [validAt, invalidAt) interval', () => {
  const calculus = new BiTemporalCalculus();
  const edge: TemporalEdge = {
    id: 'e1',
    fact: 'User lives in Mumbai',
    validAtMs: 1000,
    invalidAtMs: 5000,
  };

  assert.equal(calculus.isEdgeValidAt(edge, 500), false, 'Before validAt');
  assert.equal(calculus.isEdgeValidAt(edge, 1000), true, 'At validAt');
  assert.equal(calculus.isEdgeValidAt(edge, 3000), true, 'Inside interval');
  assert.equal(calculus.isEdgeValidAt(edge, 5000), false, 'At invalidAt');
  assert.equal(calculus.isEdgeValidAt(edge, 6000), false, 'After invalidAt');
});

test('BiTemporalCalculus: normalizeFutureTemporalBounds handles future plans and promises', () => {
  const calculus = new BiTemporalCalculus();
  const refTime = '2026-05-01T12:00:00Z';
  const bounds = calculus.normalizeFutureTemporalBounds(
    'User plans to visit Vrindavan next month',
    refTime
  );

  // Future plan validAt must equal referenceTime, not the future target date
  assert.equal(bounds.validAtMs, new Date(refTime).getTime());
  assert.equal(bounds.invalidAtMs, null);
});

test('BiTemporalCalculus: findContradictions detects overlapping valid intervals for contradictory facts', () => {
  const calculus = new BiTemporalCalculus();
  calculus.seedSampleContradictionGraph();

  const contradictions = calculus.findContradictions();
  assert.ok(contradictions.length >= 1, 'Should find at least 1 contradiction');

  const locConflict = contradictions.find(c => c.relation === 'lives_in');
  assert.ok(locConflict, 'Expected location contradiction between Mumbai and Vrindavan');
  assert.equal(locConflict.subject, 'user');
});

test('BiTemporalCalculus: resolveContradiction invalidates old edge and clears overlap', () => {
  const calculus = new BiTemporalCalculus();
  calculus.seedSampleContradictionGraph();

  const res = calculus.resolveContradiction(
    'edge_loc_vrindavan',
    'edge_loc_mumbai',
    new Date('2026-06-01T00:00:00Z').getTime()
  );

  assert.equal(res.resolved, true);
  assert.equal(res.invalidatedEdge?.invalidAtMs, new Date('2026-06-01T00:00:00Z').getTime());

  // After resolution, contradictions should be resolved
  const remaining = calculus.findContradictions();
  assert.equal(remaining.length, 0, 'No contradictions should remain after resolution');
});

test('BiTemporalCalculus: topologicalSort orders edges chronologically', () => {
  const calculus = new BiTemporalCalculus();
  calculus.seedSampleContradictionGraph();

  const sorted = calculus.topologicalSort();
  assert.equal(sorted[0].id, 'edge_loc_mumbai', 'Earliest edge should be first');
  assert.equal(sorted[1].id, 'edge_tea_chai');
  assert.equal(sorted[2].id, 'edge_loc_vrindavan', 'Latest edge should be last');
});
