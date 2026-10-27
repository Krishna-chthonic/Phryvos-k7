/**
 * Phase 1 Verification Suite: Bi-Temporal Schema & Cryptographic Deletion Contract
 *
 * Verifies Exit Gate 1:
 * 1. Migration version 3 applied cleanly in schema_versions
 * 2. Bi-temporal valid_since and valid_until calculus
 * 3. Non-destructive invalidation & state replacement (Graphiti pattern)
 * 4. Cryptographic tombstone enforcement & anti-resurrection (Gate 3 contract)
 * 5. Associative task-memory linking (A-mem pattern)
 * 6. SQLite lease locking for crash resilience (Temporal pattern)
 * 7. Stateful agent checkpoints (LangGraph pattern)
 */

import { getDb } from "../../lib/db/client";
import {
  saveSaanMemory,
  getSaanMemories,
  getMemoriesAtTimestamp,
  invalidateAndReplaceMemory,
  deleteSaanMemory,
  linkTaskMemory,
  getTaskMemories,
  acquireDaemonLease,
  releaseDaemonLease,
  saveAgentCheckpoint,
  getLatestCheckpoint,
  INFINITE_VALID_UNTIL,
} from "../../lib/saan/memory";
import { isMemoryTombstoned } from "../../lib/governance/data-ownership";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export function runPhase1Tests(): void {
  console.log("=== Running Phase 1 Bi-Temporal & Memory Contract Tests ===");
  const db = getDb();

  // Test 1: Check schema_versions
  const schemaVer = db.prepare("SELECT MAX(version) as ver FROM schema_versions").get() as { ver: number };
  assert(schemaVer.ver >= 3, `Schema version must be >= 3 (current: ${schemaVer.ver})`);

  // Test 2: Insert fact and verify bi-temporal fields
  const testFact = `Test user loves black coffee ${Date.now()}`;
  const saveSuccess = saveSaanMemory(testFact, "preference", 8, "explicit_directive");
  assert(saveSuccess === true, "saveSaanMemory should succeed for fresh fact");

  const memories = getSaanMemories(50);
  const found = memories.find((m) => m.point === testFact);
  assert(Boolean(found), "Fresh memory must be retrievable in active memories");
  assert(found!.status === "active", "Fresh memory status must be 'active'");
  assert(found!.validUntil === INFINITE_VALID_UNTIL, "Fresh memory validUntil must be infinity default");
  assert(found!.sourceType === "explicit_directive", "Source type must match saved value");

  // Test 3: Historical time-travel query
  const pastMemories = getMemoriesAtTimestamp(found!.createdAt - 10000);
  const foundPast = pastMemories.find((m) => m.point === testFact);
  assert(!foundPast, "Fact must not exist in historical query prior to its creation timestamp");

  // Test 4: Invalidate and replace (Graphiti pattern)
  const updatedFact = `Test user loves green tea now ${Date.now()}`;
  const replaceSuccess = invalidateAndReplaceMemory(found!.id, updatedFact, "preference", 8);
  assert(replaceSuccess === true, "invalidateAndReplaceMemory should succeed");

  // Verify old record is superseded
  const oldRow = db.prepare("SELECT status, valid_until FROM saan_memories WHERE id = ?").get(found!.id) as {
    status: string;
    valid_until: number;
  };
  assert(oldRow.status === "superseded", "Old memory must be marked 'superseded'");
  assert(oldRow.valid_until < INFINITE_VALID_UNTIL, "Old memory valid_until must be closed");

  // Verify new record is active
  const activeNow = getSaanMemories(5);
  const foundUpdated = activeNow.find((m) => m.point === updatedFact);
  assert(Boolean(foundUpdated), "Updated replacement fact must be currently active");

  // Test 5: Cryptographic Tombstone Enforcement & Anti-Resurrection
  const tombstoneFact = `Sensitive fact that must be tombstoned ${Date.now()}`;
  saveSaanMemory(tombstoneFact, "fact", 9, "implicit");
  const rowToDel = getSaanMemories(5).find((m) => m.point === tombstoneFact);
  assert(Boolean(rowToDel), "Target memory must exist before deletion");

  const deleteSuccess = deleteSaanMemory(rowToDel!.id);
  assert(deleteSuccess === true, "deleteSaanMemory should succeed");

  // Check tombstone table
  const isTombstoned = isMemoryTombstoned(db, tombstoneFact);
  assert(isTombstoned === true, "Hash of deleted fact must exist in memory_tombstones");

  // Attempt to resurrect
  const resurrectAttempt = saveSaanMemory(tombstoneFact, "fact", 9);
  assert(resurrectAttempt === false, "Anti-resurrection contract: saving tombstoned fact MUST return false");

  // Test 6: Associative Task Linking (A-mem pattern)
  // Insert a real task first to satisfy FOREIGN KEY constraint
  const taskRes = db.prepare(`
    INSERT INTO tasks (title, description, status, priority, created_at, updated_at)
    VALUES ('Phase 1 Test Task', 'Validating A-mem link', 'todo', 2, ?, ?)
  `).run(Date.now(), Date.now());
  const realTaskId = Number(taskRes.lastInsertRowid);

  const taskMemoryFact = `Task context note ${Date.now()}`;
  saveSaanMemory(taskMemoryFact, "fact", 10);
  const taskMem = getSaanMemories(100).find((m) => m.point === taskMemoryFact)!;

  linkTaskMemory(realTaskId, taskMem.id);
  const linked = getTaskMemories(realTaskId);
  assert(linked.some((m) => m.id === taskMem.id), `Task ${realTaskId} must retrieve linked memory`);

  // Clean up test task
  db.prepare("DELETE FROM tasks WHERE id = ?").run(realTaskId);

  // Test 7: SQLite Lease Locking (Temporal pattern)
  const lease1 = acquireDaemonLease("test_pulse_daemon", "worker_A", 5000);
  assert(lease1 === true, "worker_A should acquire unheld lease");

  const lease2 = acquireDaemonLease("test_pulse_daemon", "worker_B", 5000);
  assert(lease2 === false, "worker_B must fail to acquire active lease held by worker_A");

  releaseDaemonLease("test_pulse_daemon", "worker_A");
  const lease3 = acquireDaemonLease("test_pulse_daemon", "worker_B", 5000);
  assert(lease3 === true, "worker_B should acquire lease once released by worker_A");
  releaseDaemonLease("test_pulse_daemon", "worker_B");

  // Test 8: Agent Checkpointing (LangGraph pattern)
  const chkId = saveAgentCheckpoint("sess_123", JSON.stringify({ step: 1, action: "searching" }));
  assert(Boolean(chkId), "saveAgentCheckpoint must return unique checkpoint ID");

  const latestChk = getLatestCheckpoint("sess_123");
  assert(latestChk !== null && latestChk.id === chkId, "getLatestCheckpoint must return saved checkpoint");

  console.log("\n>>> ALL PHASE 1 EXIT GATE TESTS PASSED (100% SUCCESS) <<<\n");
}

runPhase1Tests();
