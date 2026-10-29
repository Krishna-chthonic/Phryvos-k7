import test from "node:test";
import assert from "node:assert/strict";
import {
  AgentLifecycleHookManager,
  type RegisteredHook,
  type HookStage,
} from "../../lib/saan/huginn";

test("Huginn Hooks - Initialization with Default Lifecycle Registry", () => {
  const manager = new AgentLifecycleHookManager();
  const allHooks = manager.getHooks();

  assert.ok(allHooks.length >= 6, "Should initialize with at least 6 default hooks");
  
  const stages: HookStage[] = ["beforeTurn", "afterTurn", "onError", "onToolCall"];
  for (const st of stages) {
    const stageHooks = manager.getHooks(st);
    assert.ok(stageHooks.length > 0, `Should contain at least one hook for ${st}`);
  }
});

test("Huginn Hooks - Priority Ordering Execution", () => {
  const manager = new AgentLifecycleHookManager();
  const beforeHooks = manager.getHooks("beforeTurn");

  // Verify priority sorted in ascending order (lower number = runs first)
  for (let i = 0; i < beforeHooks.length - 1; i++) {
    assert.ok(
      beforeHooks[i].priority <= beforeHooks[i + 1].priority,
      `Hook ${beforeHooks[i].id} (P:${beforeHooks[i].priority}) should precede ${beforeHooks[i+1].id} (P:${beforeHooks[i+1].priority})`
    );
  }
});

test("Huginn Hooks - Enable/Disable Toggle Lifecycle", () => {
  const manager = new AgentLifecycleHookManager();
  const targetId = "anti_slop_scrubber";

  // Initially enabled
  const initial = manager.getHooks().find((h) => h.id === targetId);
  assert.equal(initial?.enabled, true);

  // Toggle off
  const turnedOff = manager.toggleHook(targetId, false);
  assert.equal(turnedOff, false);
  const afterOff = manager.getHooks().find((h) => h.id === targetId);
  assert.equal(afterOff?.enabled, false);

  // Toggle on
  const turnedOn = manager.toggleHook(targetId, true);
  assert.equal(turnedOn, true);
});

test("Huginn Hooks - Context Propagation Across Hooks", async () => {
  const manager = new AgentLifecycleHookManager();
  
  manager.register({
    id: "test_modifier_1",
    name: "Test Modifier 1",
    stage: "beforeTurn",
    priority: 1,
    enabled: true,
    description: "Appends tag to message",
    handler: (ctx) => {
      return {
        ...ctx,
        userMessage: `${ctx.userMessage || ""} [TAG_1]`,
      };
    },
  });

  manager.register({
    id: "test_modifier_2",
    name: "Test Modifier 2",
    stage: "beforeTurn",
    priority: 2,
    enabled: true,
    description: "Appends second tag",
    handler: (ctx) => {
      return {
        ...ctx,
        userMessage: `${ctx.userMessage || ""} [TAG_2]`,
      };
    },
  });

  const finalContext = await manager.executeHooks("beforeTurn", {
    userMessage: "Hello",
  });

  assert.equal(finalContext.userMessage, "Hello [TAG_1] [TAG_2]");
});

test("Huginn Hooks - Error Isolation & Execution Audit Logging", async () => {
  const manager = new AgentLifecycleHookManager();

  manager.register({
    id: "failing_hook",
    name: "Failing Hook",
    stage: "afterTurn",
    priority: 1,
    enabled: true,
    description: "Throws error to test resilience",
    handler: () => {
      throw new Error("Simulated hook runtime failure");
    },
  });

  // Execute hooks - must NOT throw
  const result = await manager.executeHooks("afterTurn", {
    assistantReply: "Hi there!",
  });

  assert.equal(result.assistantReply, "Hi there!");

  // Verify failure recorded in audit log
  const audit = manager.getAuditLog();
  const failingRecord = audit.find((r) => r.hookId === "failing_hook");
  assert.ok(failingRecord, "Should record audit log for failing hook");
  assert.equal(failingRecord?.status, "error");
  assert.match(failingRecord?.errorDetails || "", /Simulated hook runtime failure/);
});

test("Huginn Hooks - Simulated Lifecycle Trace", () => {
  const manager = new AgentLifecycleHookManager();
  const sim = manager.simulateLifecycleRun("Test prompt");

  assert.ok(sim.totalDurationMs >= 0);
  assert.ok(sim.trace.length >= 3, "Simulation trace should include hooks from multiple stages");
  assert.ok(sim.trace.some((t) => t.stage === "beforeTurn"));
  assert.ok(sim.trace.some((t) => t.stage === "afterTurn"));
});
