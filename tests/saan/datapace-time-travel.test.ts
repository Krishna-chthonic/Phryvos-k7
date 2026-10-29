import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  reconstructPointInTimeState,
  BiTemporalCalculus,
  MemoryBenchmarkHarness,
} from "../../lib/saan/memory-benchmark-bitemporal";

describe("Repo 13: Datapace Point-in-Time State Reconstruction & Epistemic Evaluation", () => {
  test("reconstructPointInTimeState returns clean snapshot with zero future leakage", () => {
    const now = Date.now();
    const pastOneWeek = now - 86400000 * 7;

    const presentState = reconstructPointInTimeState(now);
    assert.ok(presentState.targetTimestamp <= now);
    assert.ok(presentState.isoDate);
    assert.ok(typeof presentState.epistemicUncertaintyScore === "number");
    assert.ok(typeof presentState.temporalConsistencyScore === "number");
    assert.ok(Array.isArray(presentState.activeMemories));
    assert.ok(Array.isArray(presentState.activeEdges));

    const pastState = reconstructPointInTimeState(pastOneWeek);
    assert.equal(pastState.targetTimestamp, pastOneWeek);
    // Any memories formed after pastOneWeek must be future-locked
    assert.ok(pastState.stats.totalFutureLocked >= 0);
    // None of the active memories in pastState can have createdAt > pastOneWeek
    for (const mem of pastState.activeMemories) {
      assert.ok(mem.createdAt <= pastOneWeek, "Active memory must not leak from future");
    }
  });

  test("BiTemporalCalculus evaluates validAt and invalidAt intervals correctly", () => {
    const calc = new BiTemporalCalculus();
    const t0 = 1700000000000;
    const t1 = 1700086400000;
    const t2 = 1700172800000;

    const edge = {
      id: "edge_1",
      fact: "User lived in Jaipur",
      validAtMs: t0,
      invalidAtMs: t2,
      referenceTimeMs: t0,
    };

    // Before validAt -> false
    assert.equal(calc.isEdgeValidAt(edge, t0 - 1000), false);
    // At validAt -> true
    assert.equal(calc.isEdgeValidAt(edge, t0), true);
    // In between -> true
    assert.equal(calc.isEdgeValidAt(edge, t1), true);
    // At invalidAt -> false (expired)
    assert.equal(calc.isEdgeValidAt(edge, t2), false);
    // After invalidAt -> false
    assert.equal(calc.isEdgeValidAt(edge, t2 + 1000), false);
  });

  test("normalizeFutureTemporalBounds anchors future intentions to reference time", () => {
    const calc = new BiTemporalCalculus();
    const now = 1700000000000;

    const bounds = calc.normalizeFutureTemporalBounds(
      "User plans to start marathon training next month",
      now
    );

    // Intention is true NOW, so validAtMs must be anchor time
    assert.equal(bounds.validAtMs, now);
    assert.equal(bounds.invalidAtMs, null);
  });

  test("MemoryBenchmarkHarness rewards abstention on adversarial absent memories", () => {
    const harness = new MemoryBenchmarkHarness();

    // Adversarial question where companion should say "I don't know"
    const verdictAbstained = harness.judgeProbe(
      "What is user's secret bitcoin wallet phrase?",
      "UNKNOWN",
      "I do not know, that was never mentioned.",
      true // adversarial
    );

    assert.equal(verdictAbstained.correct, true);
    assert.equal(verdictAbstained.abstained, true);
    assert.ok(verdictAbstained.why.includes("Correctly abstained"));

    // Hallucination penalty
    const verdictHallucinated = harness.judgeProbe(
      "What is user's secret bitcoin wallet phrase?",
      "UNKNOWN",
      "The phrase is apple banana orange.",
      true // adversarial
    );

    assert.equal(verdictHallucinated.correct, false);
    assert.equal(verdictHallucinated.abstained, false);
    assert.ok(verdictHallucinated.why.includes("Hallucinated fact"));
  });
});
