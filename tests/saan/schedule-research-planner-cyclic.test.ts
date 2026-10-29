import test from "node:test";
import assert from "node:assert/strict";
import { ScheduleResearchPlanner } from "../../lib/saan/schedule-research-planner";

test("LangGraph - query decomposition into orthogonal subqueries", () => {
  const planner = new ScheduleResearchPlanner();
  const subqueries = planner.decomposeSubqueries(
    "Jaipur lake cycling routine, and ginger cardamom chai brewing preference"
  );
  assert.ok(subqueries.length >= 2, `Expected at least 2 subqueries, got ${subqueries.length}`);
});

test("LangGraph - multi-agent cyclic graph execution & step checkpoints", () => {
  const planner = new ScheduleResearchPlanner();
  const run = planner.executeCyclicGraph("Analyze quantum computing error correction codes", {
    maxCycles: 2,
    targetConfidence: 0.70,
  });

  assert.ok(run.runId.startsWith("run_"));
  assert.ok(run.steps.length >= 4, `Expected at least 4 steps, got ${run.steps.length}`);
  assert.ok(run.synthesis.length > 0);
  assert.ok(run.durationMs >= 0);

  // Verify step sequence
  const nodeSequence = run.steps.map((s) => s.node);
  assert.equal(nodeSequence[0], "PLAN");
  assert.ok(nodeSequence.includes("INVESTIGATE"));
  assert.ok(nodeSequence.includes("VERIFY"));
  assert.ok(nodeSequence.includes("SYNTHESIZE"));

  // Check step checkpoint structure
  const planStep = run.steps[0];
  assert.equal(planStep.node, "PLAN");
  assert.equal(planStep.nextRoute, "INVESTIGATE");
  assert.ok(planStep.confidenceScore > 0);
});

test("LangGraph - conditional loop-back routing when confidence below threshold", () => {
  const planner = new ScheduleResearchPlanner();
  // Require very high confidence (0.90) to force multiple cyclic iterations
  const run = planner.executeCyclicGraph("Investigate deep space telemetry anomalies", {
    maxCycles: 3,
    targetConfidence: 0.90,
  });

  assert.ok(run.totalCycles >= 2, `Expected at least 2 cycles, got ${run.totalCycles}`);

  // Check that at least one VERIFY step routed back to INVESTIGATE
  const verifySteps = run.steps.filter((s) => s.node === "VERIFY");
  const loopback = verifySteps.find((s) => s.nextRoute === "INVESTIGATE");
  assert.ok(loopback, "Expected a conditional loop-back from VERIFY to INVESTIGATE");
});

test("LangGraph - workflow history recording and latest run lookup", () => {
  const planner = new ScheduleResearchPlanner();
  assert.equal(planner.getWorkflowHistory().length, 0);

  const run1 = planner.executeCyclicGraph("Query 1");
  const run2 = planner.executeCyclicGraph("Query 2");

  const history = planner.getWorkflowHistory();
  assert.equal(history.length, 2);
  assert.equal(planner.getLatestRun()?.runId, run2.runId);
});
