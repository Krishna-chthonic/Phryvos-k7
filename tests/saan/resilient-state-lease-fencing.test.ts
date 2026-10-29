import test from "node:test";
import assert from "node:assert/strict";
import { LeaseLockManager } from "../../lib/saan/resilient-state-lease";

test("ResilientStateLease - monotonic fencing tokens and exclusive mutual exclusion", () => {
  const mgr = new LeaseLockManager();

  // Agent 1 acquires memory_blocks
  const lease1 = mgr.acquireLease("memory_blocks", "agent-mem-1", 5000);
  assert.ok(lease1, "Agent 1 should successfully acquire lease");
  assert.equal(lease1.owner, "agent-mem-1");
  assert.equal(lease1.resource, "memory_blocks");
  assert.ok(lease1.fencingToken >= 101, `Expected fencing token >= 101, got ${lease1.fencingToken}`);

  // Agent 2 attempts to acquire the same resource -> should be rejected
  const lease2 = mgr.acquireLease("memory_blocks", "agent-mem-2", 5000);
  assert.equal(lease2, null, "Agent 2 should be rejected due to active lease");

  // Agent 1 releases lease
  lease1.release();

  // Agent 2 tries again -> should succeed with incremented fencing token
  const lease3 = mgr.acquireLease("memory_blocks", "agent-mem-2", 5000);
  assert.ok(lease3, "Agent 2 should acquire lease after Agent 1 released");
  assert.ok(lease3.fencingToken > lease1.fencingToken, "Fencing token must be strictly monotonic");
});

test("ResilientStateLease - heartbeat renewal extends TTL", () => {
  const mgr = new LeaseLockManager();

  const handle = mgr.acquireLease("profile_card", "agent-profile", 1000);
  assert.ok(handle);

  const initialExpiry = handle.expiresAt;

  // Heartbeat renew
  handle.renew(5000);
  assert.ok(handle.expiresAt > initialExpiry, "Expiry timestamp should be extended");

  const active = mgr.getAllActiveLeases();
  assert.equal(active.length, 1);
  assert.equal(active[0].renewalCount, 1);
});

test("ResilientStateLease - fencing token validation rejects stale tokens", () => {
  const mgr = new LeaseLockManager();

  const handle = mgr.acquireLease("consequence_ledger", "agent-ledger", 5000);
  assert.ok(handle);

  // Current token is valid
  assert.equal(mgr.validateFencingToken("consequence_ledger", handle.fencingToken), true);

  // Stale token from earlier era is rejected
  assert.equal(mgr.validateFencingToken("consequence_ledger", handle.fencingToken - 1), false);
});

test("ResilientStateLease - force preemption and metrics tracking", () => {
  const mgr = new LeaseLockManager();

  mgr.acquireLease("chat_turn", "agent-turn-runner", 10000);
  assert.equal(mgr.getAllActiveLeases().length, 1);

  // Force preempt
  const preempted = mgr.forcePreempt("chat_turn");
  assert.equal(preempted, true);
  assert.equal(mgr.getAllActiveLeases().length, 0);

  const metrics = mgr.getMetrics();
  assert.equal(metrics.activeCount, 0);
  assert.equal(metrics.totalAcquisitions, 1);
  assert.equal(metrics.totalPreemptions, 1);
});
