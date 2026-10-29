import test from "node:test";
import assert from "node:assert/strict";
import {
  WorkingScratchpadManager,
  type ScratchpadStep,
  type ScratchpadPhase,
} from "../../lib/saan/working-scratchpad";

test("Repo 18: MemGPT v2 Ephemeral Working Scratchpad & Tiered Recall Engine", async (t) => {
  await t.test("startSession, addStep, and completeSession manage full cognitive reasoning lifecycle", () => {
    const mgr = new WorkingScratchpadManager({ maxSessions: 5 });
    const turnId = "turn_test_1";

    const session = mgr.startSession(turnId, "How should we organize the system architecture?");
    assert.equal(session.turnId, turnId);
    assert.equal(session.steps.length, 0);

    const step1 = mgr.addStep("HYPOTHESIS", "Analyze modular boundaries and decouple core layers.", {
      turnId,
      confidence: 0.92,
      durationMs: 15,
    });
    assert.equal(step1.phase, "HYPOTHESIS");
    assert.equal(session.steps.length, 1);

    const step2 = mgr.addStep("RECURSIVE_RECALL", "Query past decisions on zero-cloud sovereignty.", {
      turnId,
      recalledFactIds: ["fact_privacy_local", "fact_offline_sqlite"],
      confidence: 0.95,
      durationMs: 25,
    });
    assert.equal(step2.phase, "RECURSIVE_RECALL");
    assert.equal(session.steps.length, 2);

    const completed = mgr.completeSession(turnId, "Architecture proposal synthesized.");
    assert.ok(completed?.completedAt);
    assert.equal(completed?.synthesisResult, "Architecture proposal synthesized.");
    assert.ok((completed?.totalDurationMs ?? 0) >= 0);
  });

  await t.test("addStep tracks recursive recall queries accurately in metrics", () => {
    const mgr = new WorkingScratchpadManager();
    const turnId = "turn_recall_test";
    mgr.startSession(turnId, "Recall query test");

    mgr.addStep("HYPOTHESIS", "Initial conjecture", { turnId });
    mgr.addStep("RECURSIVE_RECALL", "Query archival 1", { turnId });
    mgr.addStep("RECURSIVE_RECALL", "Query archival 2", { turnId });
    mgr.addStep("SYNTHESIS", "Final output", { turnId });

    const metrics = mgr.getMetrics(1200, 45);
    assert.equal(metrics.coreMemoryChars, 1200);
    assert.equal(metrics.archivalFactCount, 45);
    assert.equal(metrics.recursiveQueriesExecuted, 2);
    assert.equal(metrics.workingScratchpadSteps, 4);
  });

  await t.test("maxSessions bounds memory capacity to prevent unbounded session leaks", () => {
    const mgr = new WorkingScratchpadManager({ maxSessions: 3 });

    for (let i = 1; i <= 5; i++) {
      const turnId = `turn_cap_${i}`;
      mgr.startSession(turnId, `Prompt ${i}`);
      mgr.addStep("PLAN", `Plan ${i}`, { turnId });
    }

    const recent = mgr.getRecentSessions(10);
    assert.equal(recent.length, 3, "Should bound to maxSessions = 3");
    assert.equal(recent[0].turnId, "turn_cap_5", "Newest session must be at index 0");
    assert.equal(recent[2].turnId, "turn_cap_3", "Oldest retained session must be turn_cap_3");
  });

  await t.test("simulateReasoningTrace generates complete 5-phase trace with fact IDs and durations", () => {
    const mgr = new WorkingScratchpadManager();
    const steps = mgr.simulateReasoningTrace(
      "Let's review our offline vector search benchmark results",
      "Saan"
    );

    assert.equal(steps.length, 5);
    const phases: ScratchpadPhase[] = steps.map((s) => s.phase);
    assert.deepEqual(phases, [
      "HYPOTHESIS",
      "RECURSIVE_RECALL",
      "FACT_CHECK",
      "PLAN",
      "SYNTHESIS",
    ]);

    const recallStep = steps.find((s) => s.phase === "RECURSIVE_RECALL");
    assert.ok(recallStep);
    assert.ok((recallStep?.recalledFactIds?.length || 0) > 0);

    const current = mgr.getCurrentSession();
    assert.ok(current?.completedAt);
    assert.ok(current?.synthesisResult);
  });
});
