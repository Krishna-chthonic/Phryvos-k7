import test from "node:test";
import assert from "node:assert/strict";
import {
  scoreTriggerPhrase,
  classifyRecallIntent,
  isCronWithinActiveHours,
  ProactiveTriggerManager,
  getProactiveTriggerManager,
} from "../../lib/saan/trigger-recall";

test("ProactiveTrigger - dual-phrase trigger intent scoring & classification", () => {
  // Test phrase scoring
  const singleWord = scoreTriggerPhrase("aaj chai peete hain", "chai");
  assert.equal(singleWord.score, 0.85);
  assert.deepEqual(singleWord.matchedTokens, ["chai"]);

  const multiWord = scoreTriggerPhrase("subah ho gayi morning chai peete hain", "morning chai");
  assert.ok(multiWord.score >= 0.8, `Expected score >= 0.8, got ${multiWord.score}`);
  assert.deepEqual(multiWord.matchedTokens, ["morning", "chai"]);

  const noMatch = scoreTriggerPhrase("what is the weather today", "evening unwind");
  assert.equal(noMatch.score, 0);

  // Test intent classification
  assert.equal(classifyRecallIntent("yaad hai last week humne kya kiya tha"), "retrospective");
  assert.equal(classifyRecallIntent("kal subah mujhe remind karna please"), "prospective_reminder");
  assert.equal(classifyRecallIntent("what is quantum computing?"), "factual");
  assert.equal(classifyRecallIntent("hello how are you"), "none");
});

test("ProactiveTrigger - active cron hours window evaluation", () => {
  const window = {
    start: "08:00",
    end: "11:00",
    timezone: "UTC",
  };

  // Mock timestamp for 09:30 UTC: 2026-10-29T09:30:00Z
  const activeTimeMs = Date.UTC(2026, 9, 29, 9, 30, 0);
  assert.equal(isCronWithinActiveHours(window, activeTimeMs, "UTC"), true);

  // Mock timestamp for 12:30 UTC: 2026-10-29T12:30:00Z (outside window)
  const inactiveTimeMs = Date.UTC(2026, 9, 29, 12, 30, 0);
  assert.equal(isCronWithinActiveHours(window, inactiveTimeMs, "UTC"), false);

  // Overnight window: 22:00 to 04:00
  const overnightWindow = {
    start: "22:00",
    end: "04:00",
    timezone: "UTC",
  };
  const lateNightMs = Date.UTC(2026, 9, 29, 23, 15, 0);
  const earlyMorningMs = Date.UTC(2026, 9, 30, 2, 45, 0);
  const middayMs = Date.UTC(2026, 9, 29, 14, 0, 0);

  assert.equal(isCronWithinActiveHours(overnightWindow, lateNightMs, "UTC"), true);
  assert.equal(isCronWithinActiveHours(overnightWindow, earlyMorningMs, "UTC"), true);
  assert.equal(isCronWithinActiveHours(overnightWindow, middayMs, "UTC"), false);
});

test("ProactiveTriggerManager - configuration lifecycle & briefing synthesis", () => {
  const mgr = new ProactiveTriggerManager({
    morningChai: {
      enabled: true,
      time: "08:15",
      activeWindow: { start: "07:00", end: "10:00", timezone: "UTC" },
    },
    timezone: "UTC",
  });

  const config = mgr.getConfig();
  assert.equal(config.morningChai.time, "08:15");
  assert.equal(config.morningChai.enabled, true);

  // Update configuration
  const updated = mgr.updateConfig({
    morningChai: {
      enabled: false,
      time: "09:00",
      activeWindow: { start: "08:30", end: "10:30", timezone: "UTC" },
    },
  });
  assert.equal(updated.morningChai.enabled, false);
  assert.equal(updated.morningChai.time, "09:00");

  // Briefing generation for Morning Chai
  const morningBriefing = mgr.generateBriefing("morning_chai", {
    tasks: ["Ship Repo #21 Proactive Engine", "Run Next.js production build"],
    calendar: ["11:00 AM Team autonomous sync"],
  }, "Saan");

  assert.equal(morningBriefing.type, "morning_chai");
  assert.ok(morningBriefing.formatted.includes("Saan"));
  assert.ok(morningBriefing.formatted.includes("Chai"));
  assert.ok(morningBriefing.formatted.includes("Ship Repo #21"));
  assert.ok(morningBriefing.formatted.includes("11:00 AM Team"));

  // Briefing generation for Evening Unwind
  const eveningBriefing = mgr.generateBriefing("evening_unwind", {
    accomplishments: ["21 companion repos synchronized", "Zero test regressions"],
    deeds: ["Kept full data sovereignty"],
  }, "Saan");

  assert.equal(eveningBriefing.type, "evening_unwind");
  assert.ok(eveningBriefing.formatted.includes("21 companion repos"));
  assert.ok(eveningBriefing.formatted.includes("recharge"));
});

test("ProactiveTrigger - global singleton access", () => {
  const s1 = getProactiveTriggerManager();
  const s2 = getProactiveTriggerManager();
  assert.equal(s1, s2, "Singleton instance should match");
});
