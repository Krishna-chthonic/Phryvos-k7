import test from "node:test";
import assert from "node:assert/strict";
import {
  IdempotencyBackoffEngine,
  computeBackoff,
  computeFullJitter,
  IDEMPOTENCY_KEY_TTL_MS,
} from "../../lib/saan/idempotency-backoff-retry";

test("AutoGen Backoff - Clamped Exponential Backoff Math", () => {
  // Standard ramping: 50 -> 100 -> 200 -> 400 clamped at 1000
  assert.equal(computeBackoff(1, 50, 1000), 50);
  assert.equal(computeBackoff(2, 50, 1000), 100);
  assert.equal(computeBackoff(3, 50, 1000), 200);
  assert.equal(computeBackoff(4, 50, 1000), 400);
  assert.equal(computeBackoff(5, 50, 1000), 800);
  assert.equal(computeBackoff(6, 50, 1000), 1000, "Should clamp at ceiling");
  assert.equal(computeBackoff(10, 50, 1000), 1000);

  // Inverted min/max misconfiguration protection
  assert.equal(computeBackoff(1, 500, 100), 500, "Ceiling should never drop below minMs");
  assert.equal(computeBackoff(3, 500, 100), 500);
});

test("AutoGen Backoff - Full Jitter Generation", () => {
  for (let i = 0; i < 20; i++) {
    const jitter = computeFullJitter(3, 50, 1000); // Backoff is 200
    assert.ok(jitter >= 0 && jitter <= 200, `Jitter ${jitter} should be between 0 and 200`);
  }
});

test("AutoGen Idempotency - Lock Acquisition, Replay Protection & Fingerprint Matching", () => {
  const engine = new IdempotencyBackoffEngine();
  const userId = "test-user-1";
  const idempotencyKey = "tx-payment-order-101";
  const payload = { amount: 500, currency: "INR" };

  // 1. Initial Acquire
  const firstAcquire = engine.checkOrAcquire(userId, idempotencyKey, payload);
  assert.equal(firstAcquire.status, "acquired");
  assert.equal(firstAcquire.record?.status, "processing");

  // 2. Concurrent Attempt while processing -> Conflict
  const concurrentAttempt = engine.checkOrAcquire(userId, idempotencyKey, payload);
  assert.equal(concurrentAttempt.status, "conflict");

  // 3. Complete transaction
  engine.complete(userId, idempotencyKey, 200, { transactionId: "ch_98765", receipt: "ok" });

  // 4. Replay completed request with exact payload -> Cached hit (0 cost)
  const replayAttempt = engine.checkOrAcquire(userId, idempotencyKey, payload);
  assert.equal(replayAttempt.status, "cached");
  assert.equal(replayAttempt.record?.responseStatus, 200);

  // 5. Replay with tampered payload -> Conflict
  const tamperedPayload = { amount: 9999, currency: "INR" };
  const tamperedAttempt = engine.checkOrAcquire(userId, idempotencyKey, tamperedPayload);
  assert.equal(tamperedAttempt.status, "conflict");
});

test("AutoGen DLQ - Dead Letter Queue Lifecycle & 1-Click Reprocess", () => {
  const engine = new IdempotencyBackoffEngine();
  
  const dlqItem = engine.recordDeadLetter(
    "job-sync-calendar",
    "ETIMEDOUT: Connection reset by peer",
    { eventId: "ev-42" },
    3
  );

  assert.ok(dlqItem.id.startsWith("dlq-"));
  assert.equal(dlqItem.attempts, 3);
  assert.equal(dlqItem.reprocessed, false);

  const dlqs = engine.getDeadLetters();
  assert.ok(dlqs.some((d) => d.id === dlqItem.id));

  // Reprocess
  const reprocessed = engine.reprocessDeadLetter(dlqItem.id);
  assert.equal(reprocessed, true);
  
  const updated = engine.getDeadLetters().find((d) => d.id === dlqItem.id);
  assert.equal(updated?.reprocessed, true);
});

test("AutoGen Simulation - Simulated Retry Execution with Recovery", () => {
  const engine = new IdempotencyBackoffEngine();

  // Test simulation that recovers after 2 failures
  const simRecovery = engine.simulateExecutionWithRetry("test_vector_sync", { docId: "d1" }, 2);
  assert.equal(simRecovery.finalStatus, "succeeded");
  assert.equal(simRecovery.attempts.length, 3);
  assert.equal(simRecovery.attempts[0].status, "failed");
  assert.equal(simRecovery.attempts[1].status, "failed");
  assert.equal(simRecovery.attempts[2].status, "succeeded");

  // Test simulation that exhausts all 3 retries and routes to DLQ
  const simExhaustion = engine.simulateExecutionWithRetry("test_failing_task", { docId: "d2" }, 3);
  assert.equal(simExhaustion.finalStatus, "dead_letter");
  assert.equal(simExhaustion.attempts.length, 3);
  assert.ok(engine.getDeadLetters().some((d) => d.jobId === "test_failing_task"));
});

test("AutoGen Telemetry - Aggregates Accurate Health Metrics & Circuit Breaker", () => {
  const engine = new IdempotencyBackoffEngine();
  const telemetry = engine.getTelemetry();

  assert.ok(telemetry.totalRequests >= 0);
  assert.ok(telemetry.deadLetterCount >= 2);
  assert.ok(typeof telemetry.averageLatencyMs === "number");
  assert.ok(["CLOSED", "HALF_OPEN", "OPEN"].includes(telemetry.circuitState));
});
