/**
 * Phase 3 Verification Suite: Sovereign Controller & 3-Tier Security Gateway
 *
 * Verifies Exit Gate 3:
 * 1. Fault-Tolerant Tool JSON Repair (DirtyJson parser from Agent Zero)
 * 2. 3-Tier Security Gateway Classification (Open Interpreter pattern)
 * 3. Point-in-time Action Rollbacks (OpenHands pattern)
 * 4. Prompt Injection Security Fence for Web Results (Crawl4AI pattern)
 */

import { getDb } from "../../lib/db/client";
import {
  parseDirtyJson,
  getActionSecurityTier,
  createTask,
  completeTask,
  executeRollback,
  searchWeb,
} from "../../lib/saan/controller";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export async function runPhase3Tests(): Promise<void> {
  console.log("=== Running Phase 3 Controller & 3-Tier Security Tests ===");
  const db = getDb();

  // Test 1: Fault-Tolerant DirtyJson Parser (Agent Zero pattern)
  // Scenario A: Trailing comma in object and array
  const malformedJson1 = `\`\`\`saan_action
  {
    "action": "create_task",
    "params": {
      "title": "Fix Physics formula",
      "priority": 2,
    },
  }
  \`\`\``;
  const parsed1 = parseDirtyJson(malformedJson1);
  assert(parsed1 !== null, "DirtyJson must repair trailing commas");
  assert(parsed1.action === "create_task", "Repaired JSON must have correct action");
  assert(parsed1.params.priority === 2, "Repaired JSON must retain numeric parameters");

  // Scenario B: Single quotes and unquoted property keys
  const malformedJson2 = `{ action: 'search_web', params: { query: 'quantum computing' } }`;
  const parsed2 = parseDirtyJson(malformedJson2);
  assert(parsed2 !== null, "DirtyJson must repair unquoted keys and single quotes");
  assert(parsed2.action === "search_web", "Repaired action must match");
  assert(parsed2.params.query === "quantum computing", "Repaired query must match");

  // Test 2: 3-Tier Security Classification (Open Interpreter pattern)
  assert(getActionSecurityTier("list_tasks") === 1, "list_tasks must be Tier 1 (Safe read)");
  assert(getActionSecurityTier("search_web") === 1, "search_web must be Tier 1 (Safe read)");
  assert(getActionSecurityTier("create_task") === 2, "create_task must be Tier 2 (Staged mutation with rollback)");
  assert(getActionSecurityTier("complete_task") === 2, "complete_task must be Tier 2 (Staged mutation)");
  assert(getActionSecurityTier("delete_task") === 3, "delete_task must be Tier 3 (Destructive, modal confirmation)");

  // Test 3: Action Rollback Snapshot (OpenHands pattern)
  const taskTitle = `Rollback Test Task ${Date.now()}`;
  const createRes = createTask(taskTitle, "Testing 1-click undo", 2);
  assert(createRes.success === true, "createTask should succeed");
  assert(Boolean(createRes.snapshotId), "createTask must emit a snapshotId");

  const createdId = createRes.data.id;
  const inDb = db.prepare("SELECT id, status FROM tasks WHERE id = ?").get(createdId) as { id: number; status: string };
  assert(Boolean(inDb), "Task must exist in SQLite tasks table");

  // Execute 1-click rollback
  const rollbackRes = executeRollback(createRes.snapshotId!);
  assert(rollbackRes.success === true, "executeRollback must succeed");

  const afterRollback = db.prepare("SELECT id FROM tasks WHERE id = ?").get(createdId);
  assert(!afterRollback, "Task must be deleted after rollback");

  // Test 4: Task Completion and Status Revert Rollback
  const completeTaskTitle = `Complete Revert Test Task ${Date.now()}`;
  const taskToComplete = createTask(completeTaskTitle, "Testing status undo", 1);
  const targetTaskId = taskToComplete.data.id;

  const compRes = completeTask(targetTaskId);
  assert(compRes.success === true, "completeTask should succeed");
  assert(Boolean(compRes.snapshotId), "completeTask must emit a snapshotId");

  const completedInDb = db.prepare("SELECT status FROM tasks WHERE id = ?").get(targetTaskId) as { status: string };
  assert(completedInDb.status === "done", "Task status must be 'done'");

  const undoComp = executeRollback(compRes.snapshotId!);
  assert(undoComp.success === true, "executeRollback for completion must succeed");

  const revertedInDb = db.prepare("SELECT status FROM tasks WHERE id = ?").get(targetTaskId) as { status: string };
  assert(revertedInDb.status === "todo", "Task status must be reverted back to 'todo'");

  // Clean up
  db.prepare("DELETE FROM tasks WHERE id = ?").run(targetTaskId);

  // Test 5: Prompt Injection Security Fence (Crawl4AI pattern)
  const searchRes = await searchWeb("latest physics breakthroughs");
  assert(searchRes.success === true, "searchWeb should succeed");
  assert(searchRes.data.includes("<untrusted_web_source"), "Web search results must be fenced with <untrusted_web_source>");
  assert(searchRes.data.includes("</untrusted_web_source>"), "Web search results must close the XML fence");

  console.log("\n>>> ALL PHASE 3 EXIT GATE TESTS PASSED (100% SUCCESS) <<<\n");
}

runPhase3Tests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
