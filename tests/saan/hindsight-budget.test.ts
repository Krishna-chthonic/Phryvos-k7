import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  parseTemporalQueryBounds,
  selectFactsWithinBudget,
  generateKnapsackBudgetReport,
  CausalMemoryRegistry,
} from "../../lib/saan/temporal-query-engine";

describe("Repo 12: Hindsight Knapsack Fact Budgeting & Temporal Query Engine", () => {
  test("parseTemporalQueryBounds normalizes 'today', 'yesterday', and relative days", () => {
    const fixedNow = new Date("2026-10-29T14:30:00Z");

    const tToday = parseTemporalQueryBounds("What did we do today?", fixedNow);
    assert.equal(tToday.hasConstraint, true);
    assert.equal(tToday.matchedPhrase, "today");
    assert.ok(tToday.startTimeMs < tToday.endTimeMs);

    const tYesterday = parseTemporalQueryBounds("Summarize yesterday's discussion", fixedNow);
    assert.equal(tYesterday.hasConstraint, true);
    assert.equal(tYesterday.matchedPhrase, "yesterday");
    assert.ok(tYesterday.endTimeMs < fixedNow.getTime());

    const tDaysAgo = parseTemporalQueryBounds("Check 4 days ago notes", fixedNow);
    assert.equal(tDaysAgo.hasConstraint, true);
    assert.equal(tDaysAgo.matchedPhrase, "4 days ago");

    const tLastWeek = parseTemporalQueryBounds("What was my routine last week?", fixedNow);
    assert.equal(tLastWeek.hasConstraint, true);
    assert.equal(tLastWeek.matchedPhrase, "last week");

    const tUnconstrained = parseTemporalQueryBounds("Explain quantum computing to me", fixedNow);
    assert.equal(tUnconstrained.hasConstraint, false);
  });

  test("selectFactsWithinBudget performs knapsack packing without blocking trailing small facts", () => {
    const ids = ["fact_big", "fact_huge", "fact_small", "fact_tiny"];
    const textById: Record<string, string> = {
      fact_big: "A".repeat(40),   // 10 tokens
      fact_huge: "B".repeat(100), // 25 tokens
      fact_small: "C".repeat(20), // 5 tokens
      fact_tiny: "D".repeat(8),   // 2 tokens
    };

    // Budget: 18 tokens
    // Expect: fact_big (10t) + skips fact_huge (25t) + picks fact_small (5t) + picks fact_tiny (2t) = 17 tokens
    const res = selectFactsWithinBudget(ids, textById, 18, (t) => Math.ceil(t.length / 4));

    assert.equal(res.truncated, true);
    assert.equal(res.floorApplied, false);
    assert.equal(res.totalTokens, 17);
    assert.deepEqual(res.selectedIds, ["fact_big", "fact_small", "fact_tiny"]);
  });

  test("selectFactsWithinBudget enforces Top-Rank Floor Rule when all candidates exceed budget", () => {
    const ids = ["fact_important", "fact_secondary"];
    const textById: Record<string, string> = {
      fact_important: "A".repeat(120), // 30 tokens
      fact_secondary: "B".repeat(80),  // 20 tokens
    };

    // Budget: only 10 tokens (neither fits)
    // Top-Rank Floor Rule must force-include fact_important whole and over budget!
    const res = selectFactsWithinBudget(ids, textById, 10, (t) => Math.ceil(t.length / 4));

    assert.equal(res.floorApplied, true);
    assert.equal(res.selectedIds.length, 1);
    assert.equal(res.selectedIds[0], "fact_important");
    assert.equal(res.totalTokens, 30);
  });

  test("generateKnapsackBudgetReport produces structured category breakdown", () => {
    const report = generateKnapsackBudgetReport(1200);

    assert.equal(report.budgetCapTokens, 1200);
    assert.ok(report.usedTokens >= 0);
    assert.ok(report.remainingTokens <= 1200);
    assert.ok(report.categories.length > 0);

    const hasPreference = report.categories.some((c) => c.category === "PREFERENCE");
    assert.ok(hasPreference);
  });

  test("CausalMemoryRegistry manages cause-effect linkages and bidirectional traversal", () => {
    const registry = new CausalMemoryRegistry();

    const link = registry.addCausalLink(
      "mem_night_owl",
      "mem_sleepy_afternoon",
      "Late night coding causes afternoon drowsiness",
      0.94
    );

    assert.ok(link.id);
    assert.equal(link.causeMemoryId, "mem_night_owl");
    assert.equal(link.effectMemoryId, "mem_sleepy_afternoon");

    const causes = registry.getCausesFor("mem_sleepy_afternoon");
    assert.equal(causes.length, 1);
    assert.equal(causes[0].causeMemoryId, "mem_night_owl");

    const effects = registry.getEffectsOf("mem_night_owl");
    assert.equal(effects.length, 1);
    assert.equal(effects[0].effectMemoryId, "mem_sleepy_afternoon");
  });
});
