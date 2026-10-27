/**
 * Psycheros Deep Capability Verification Suite
 *
 * Verifies all 6 production capabilities extracted from PsycherosAI/Psycheros:
 * 1. Fontaine 80-term GRID Emotion Catalogue: Euclidean distance in PAD space, quiet state detection
 * 2. Mood Organ: 3D PAD affective engine, 2h exponential decay, anti-mirror baseline shift
 * 3. Subconscious Dreamer: Residue extraction, dream fragment persistence, morning dream continuity
 * 4. Familiarity Anti-Repetition Engine: Rolling window habituation, Jaccard novelty ratio, catchphrase suppression
 * 5. Hierarchical Multi-Scale Consolidation: ISO week calculation, prompt generation, SQLite persistence
 * 6. Sovereign Controller Actions: get_mindfulness (Tier 1) and consolidate_memories (Tier 2)
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  FONTAINE_80_EMOTIONS,
  nearestEmotions,
  nameEmotion,
  isQuietState,
} from "../../lib/saan/emotion-catalogue";
import { getMoodOrgan, MoodOrgan } from "../../lib/saan/mood-organ";
import {
  extractMemorableResidue,
  recordDreamFragment,
  getRecentDreamFragments,
  getMorningDreamPrompt,
} from "../../lib/saan/dreamer";
import {
  recordSpoken,
  calculateNoveltyRatio,
  shouldSuppress,
  resetFamiliarityWindow,
} from "../../lib/saan/familiarity";
import {
  getISOWeek,
  getISOWeekKey,
  getMonthKey,
  buildWeeklyConsolidationPrompt,
  buildMonthlyConsolidationPrompt,
  saveConsolidation,
  getLatestConsolidation,
  runWeeklyConsolidationPass,
} from "../../lib/saan/consolidation";
import { dispatchSaanAction } from "../../lib/saan/controller";
import { saveSaanMemory } from "../../lib/saan/memory";

test("=== PSYCHEROS EXTRACTION AUDIT & CAPABILITY VERIFICATION ===", async (t) => {
  // ── 1. FONTAINE 80-TERM EMOTION CATALOGUE ──────────────────────────────
  await t.test("Fontaine Catalogue: 80-term completeness & coordinates", () => {
    assert.strictEqual(FONTAINE_80_EMOTIONS.length, 80, "Must contain exactly 80 empirical Fontaine terms");

    for (const item of FONTAINE_80_EMOTIONS) {
      assert.ok(item.term.length > 0, "Term name must not be empty");
      assert.ok(item.valence >= -3 && item.valence <= 3, `Valence of ${item.term} must be in factor range [-3, 3]`);
      assert.ok(item.arousal >= -3 && item.arousal <= 3, `Arousal of ${item.term} must be in factor range [-3, 3]`);
      assert.ok(item.power >= -3 && item.power <= 3, `Power/dominance of ${item.term} must be in factor range [-3, 3]`);
    }
  });

  await t.test("Fontaine Catalogue: Nearest emotion distance & ranking", () => {
    // High valence, high arousal, high dominance => triumphant, joyful, ecstatic
    const matches = nearestEmotions(0.8, 0.7, 0.6, 5);
    assert.ok(matches.length > 0, "Should return nearest emotions");
    assert.ok(matches[0].distance < 0.6, "Closest match should be within near range");

    // Distances should be in ascending order
    for (let i = 1; i < matches.length; i++) {
      assert.ok(
        matches[i].distance >= matches[i - 1].distance,
        "Matches must be strictly sorted by Euclidean distance"
      );
    }
  });

  await t.test("Fontaine Catalogue: Quiet State & Naming", () => {
    // Near zero PAD must be quiet state
    assert.strictEqual(isQuietState(0.02, -0.04, 0.05), true, "Sub-0.10 state must be recognized as quiet");
    assert.strictEqual(isQuietState(0.35, 0.1, 0.0), false, "Valence 0.35 must not be quiet");

    const quietNamed = nameEmotion(0.01, 0.02, -0.01);
    assert.strictEqual(quietNamed, null, "Quiet state must suppress naming (returns null)");

    const joyNamed = nameEmotion(0.7, 0.5, 0.5);
    assert.ok(joyNamed !== null, "Active state must return a named emotion");
    assert.ok(joyNamed.term.length > 0, "Named emotion must have valid term");
  });

  // ── 2. MOOD ORGAN ───────────────────────────────────────────────────────
  await t.test("Mood Organ: State retrieval, clamping and exponential fade", () => {
    const organ = getMoodOrgan();
    const state = organ.getState();

    assert.ok(typeof state.valence === "number");
    assert.ok(typeof state.arousal === "number");
    assert.ok(typeof state.dominance === "number");

    // Ingest positive affective delta
    organ.ingest({ valence: 0.3, arousal: 0.2, dominance: 0.1, source: "user_turn" });
    const updated = organ.getState();
    assert.ok(updated.valence >= -1 && updated.valence <= 1);
    assert.ok(updated.arousal >= -1 && updated.arousal <= 1);
    assert.ok(updated.dominance >= -1 && updated.dominance <= 1);

    // Exponential fade test
    const baseline = organ.getBaseline();
    const offsetBefore = Math.abs(updated.valence - baseline.valence);
    organ.applyFade(Date.now() + 7200000); // 2 hours = 1 half-life
    const faded = organ.getState();
    const offsetAfter = Math.abs(faded.valence - baseline.valence);
    if (offsetBefore > 0.01) {
      assert.ok(offsetAfter <= offsetBefore, "Valence offset should decay after 2h half-life");
    }
  });

  await t.test("Mood Organ: Anti-Mirror principle", () => {
    const organ = getMoodOrgan();
    const baselineBefore = organ.getBaseline().valence;

    // Self-turn (Saan's own output) should NOT shift baseline
    organ.ingest({ valence: 0.4, arousal: 0.2, dominance: 0.1, source: "self" });
    const baselineAfterSelf = organ.getBaseline().valence;
    assert.strictEqual(
      baselineAfterSelf,
      baselineBefore,
      "Self turn must NEVER shift emotional baseline (Anti-Mirror principle)"
    );
  });

  // ── 3. SUBCONSCIOUS DREAMER ─────────────────────────────────────────────
  await t.test("Dreamer: Residue extraction & morning awakening prompt", () => {
    const longInput = "Today we spent hours debugging the quantum ledger and finally got the consensus algorithm working perfectly before dinner";
    const residue = extractMemorableResidue(longInput);
    const words = residue.split(/\s+/);
    assert.ok(words.length <= 12, "Residue must be at most 12 words");
    assert.ok(residue.length > 0, "Residue must not be empty");

    // Record dream fragment
    const saved = recordDreamFragment(residue, "peaceful contemplation");
    assert.ok(saved.id.length > 0);
    assert.strictEqual(saved.fragment, residue);

    // Recent fragments should contain saved
    const recent = getRecentDreamFragments(5);
    assert.ok(recent.some((f) => f.id === saved.id), "Recent fragments must include newly saved fragment");

    // Morning prompt builder
    const morningPrompt = getMorningDreamPrompt();
    assert.ok(morningPrompt.includes("DREAM RESIDUE"), "Morning prompt must include dream residue section");
    assert.ok(morningPrompt.includes(residue), "Morning prompt must contain the dream snippet");
  });

  // ── 4. FAMILIARITY ENGINE (ANTI-REPETITION) ──────────────────────────────
  await t.test("Familiarity: Habituation and repetitive phrase suppression", () => {
    resetFamiliarityWindow();

    const phrase = "Bilkul! Main tumhare saath har kadam par hoon!";
    
    // First time phrase is spoken: novelty ratio should be 1.0 (novel)
    const initialNovelty = calculateNoveltyRatio(phrase);
    assert.strictEqual(initialNovelty, 1.0, "Novel text should have 1.0 novelty ratio");
    assert.strictEqual(shouldSuppress(phrase), false, "Novel text should not be suppressed");

    // Record it as spoken
    recordSpoken(phrase);

    // If candidate text repeated immediately, novelty drops significantly
    const repeatedNovelty = calculateNoveltyRatio(phrase);
    assert.ok(repeatedNovelty < 0.2, `Repeated text novelty should be low, got ${repeatedNovelty}`);
    assert.strictEqual(shouldSuppress(phrase), true, "Identical catchphrase repeated immediately must be suppressed");

    // Distinct fresh text should NOT be suppressed
    const freshPhrase = "Aao calendar par ek naya event schedule karte hain";
    assert.strictEqual(shouldSuppress(freshPhrase), false, "Fresh text must not be suppressed");
  });

  // ── 5. MULTI-SCALE MEMORY CONSOLIDATION ──────────────────────────────────
  await t.test("Consolidation: ISO week & month calculations", () => {
    const fixedDate = new Date("2026-10-28T12:00:00Z");
    const weekKey = getISOWeekKey(fixedDate);
    assert.ok(/^2026-W\d{2}$/.test(weekKey), `Week key must match 2026-Wxx format, got ${weekKey}`);

    const monthKey = getMonthKey(fixedDate);
    assert.strictEqual(monthKey, "2026-10", "Month key must be 2026-10");
  });

  await t.test("Consolidation: Prompt templates & SQLite persistence", () => {
    const memories = ["Completed K7 migration 0005", "Refined Saan affective mood engine"];
    const weeklyPrompt = buildWeeklyConsolidationPrompt(memories);
    assert.ok(weeklyPrompt.toLowerCase().includes("weekly summary"), "Prompt must describe weekly summary task");
    assert.ok(weeklyPrompt.includes("Completed K7 migration 0005"), "Prompt must include daily memories");

    const monthlyPrompt = buildMonthlyConsolidationPrompt(["Week 43: Built core controllers", "Week 44: Extracted Psycheros"]);
    assert.ok(monthlyPrompt.includes("WEEKLY RETROSPECTIVE"), "Prompt must include weekly retrospect headers");

    // Persistence test
    const record = saveConsolidation("weekly", "2026-W99", "Test weekly summary for unit verification", 2);
    assert.strictEqual(record.periodKey, "2026-W99");

    const latest = getLatestConsolidation("weekly");
    assert.ok(latest !== null, "Latest consolidation should not be null");
    assert.strictEqual(latest?.periodKey, "2026-W99");
  });

  await t.test("Consolidation: runWeeklyConsolidationPass execution", () => {
    // Insert a dummy Saan memory to guarantee data for pass
    saveSaanMemory("Psycheros capability verification test item", "fact", 10);
    const result = runWeeklyConsolidationPass();
    assert.ok(result !== null, "Weekly pass should succeed when memories exist");
    assert.ok(result.summary.includes("Weekly Retrospective"));
    assert.ok(result.sourceMemoryCount > 0);
  });

  // ── 6. CONTROLLER ACTIONS ───────────────────────────────────────────────
  await t.test("Controller: get_mindfulness and consolidate_memories actions", async () => {
    const mindResult = await dispatchSaanAction("get_mindfulness");
    assert.strictEqual(mindResult.success, true);
    assert.strictEqual(mindResult.tier, 1, "get_mindfulness must be Tier 1 read-only");
    assert.ok(mindResult.message.includes("Current emotional state:"));
    assert.ok(mindResult.data?.pad);
    assert.ok(mindResult.data?.felt);

    const consolResult = await dispatchSaanAction("consolidate_memories");
    assert.strictEqual(consolResult.success, true);
    assert.strictEqual(consolResult.tier, 2, "consolidate_memories must be Tier 2 mutation");
    assert.ok(consolResult.message.includes("Consolidated") || consolResult.message.includes("skipped"));
  });
});
