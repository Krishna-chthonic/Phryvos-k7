/**
 * HerAndHim Deep Capability Verification Suite
 *
 * Verifies all 7 production capabilities extracted from ericwang915/HerAndHim:
 * 1. Humanize Engine: reply delays, multi-bubble splitBurst, selective emoji reactions, gap phrasing, open threads
 * 2. Personal Dates Engine: real calendar tracking, 7-day anticipation window, prompt formatting
 * 3. Long-running Wishlist Engine: scoring math (urgency * time * recency), due detection, fulfillment
 * 4. 4D Relationship Tensor: temperature, trust, intimacy, understanding sentiment updating
 * 5. Proactive Absence Ledger: unanswered ping tracking and streak detection
 * 6. Structured Compaction: 6 mandatory companion sections preservation
 * 7. Tier-0 Deterministic Crisis Safety: zero-latency helpline diversion
 * 8. Sovereign Controller Actions: remember_date, add_wish, fulfill_wish tool dispatch
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateReplyDelay,
  splitBurst,
  pickReaction,
  humanizeGap,
  findOpenThread,
} from "../../lib/saan/humanize";
import {
  addPersonalDate,
  listPersonalDates,
  getUpcomingDates,
  formatDatesForPrompt,
  deletePersonalDate,
} from "../../lib/saan/personal-dates";
import {
  addWish,
  listPendingWishes,
  calculateWishScore,
  getDueWishes,
  markWishSurfaced,
  markWishFulfilled,
} from "../../lib/saan/wishlist";
import {
  recordProactiveSent,
  recordUserReplied,
  getUnansweredCount,
  hasIgnoredStreak,
} from "../../lib/saan/proactive";
import { checkCrisisSignals } from "../../lib/saan/safety";
import {
  buildCompactionPrompt,
  parseCompactionSummary,
  estimateTokens,
} from "../../lib/saan/compaction";
import {
  getRelationshipTensor,
  updateRelationshipFromSentiment,
  buildSaanSystemPrompt,
} from "../../lib/saan/soul";
import { dispatchSaanAction } from "../../lib/saan/controller";

test("=== HERANDHIM EXTRACTION AUDIT & CAPABILITY VERIFICATION ===", async (t) => {
  // ── 1. HUMANIZE ENGINE ──────────────────────────────────────────────────
  await t.test("Humanize: reply delay calculation", () => {
    const shortDelay = calculateReplyDelay("Haan theek hai", 14);
    assert.ok(shortDelay >= 600, "Short reply delay must be at least 600ms");
    assert.ok(shortDelay <= 4000, "Daytime short delay must not exceed 4000ms");

    const nightDelay = calculateReplyDelay("Haan theek hai", 2);
    assert.ok(nightDelay > shortDelay, "Night sleep hours (2am) must add groggy delay");
  });

  await t.test("Humanize: splitBurst paragraph bubble decomposition", () => {
    const singlePara = "Single message without breaks.";
    assert.deepEqual(splitBurst(singlePara), [singlePara]);

    const multiPara = "First bubble thought.\n\nSecond bubble follow-up.\n\nThird bubble closing.";
    const bubbles = splitBurst(multiPara, 3);
    assert.equal(bubbles.length, 3, "Must split into exactly 3 bubbles on blank lines");
    assert.equal(bubbles[0], "First bubble thought.");
    assert.equal(bubbles[1], "Second bubble follow-up.");
    assert.equal(bubbles[2], "Third bubble closing.");

    const fiveParas = "P1\n\nP2\n\nP3\n\nP4\n\nP5";
    const clamped = splitBurst(fiveParas, 3);
    assert.ok(clamped.length <= 3, "Must clamp to maxParts by merging neighbours");
  });

  await t.test("Humanize: pickReaction selective emoji responses", () => {
    // Photos have high probability (85%)
    const photoReactions = Array.from({ length: 5 }, () => pickReaction("Check this out", true));
    assert.ok(photoReactions.some((r) => r !== null), "Photos should trigger emoji reaction across samples");

    const winReact = pickReaction("I passed my exam! cleared it!");
    // Win keyword has 80% chance
    if (winReact) {
      assert.ok(["🎉", "🏆", "👏", "🔥"].includes(winReact), "Win reaction must match achievement emoji");
    }

    const mundane = pickReaction("Ok got it");
    assert.equal(mundane, null, "Mundane logistical messages should not get robotic emoji reactions");
  });

  await t.test("Humanize: humanizeGap absence phrasing", () => {
    assert.equal(humanizeGap(0.5), "just now");
    assert.equal(humanizeGap(25), "about 25 minutes ago");
    assert.equal(humanizeGap(180), "about 3 hours ago");
    assert.equal(humanizeGap(2880), "about 2 days ago");
  });

  await t.test("Humanize: findOpenThread identifies emotional follow-ups", () => {
    const events = [
      { topic: "weather", summary: "it rained today", sentiment: "neutral", intensity: 0.2 },
      { topic: "job interview", summary: "feeling super nervous about tomorrow", sentiment: "negative", intensity: 0.9, followUp: true },
      { topic: "lunch", summary: "had dal chawal", sentiment: "positive", intensity: 0.3 },
    ];
    const thread = findOpenThread(events);
    assert.ok(thread?.includes("job interview"), "Must prioritize high-intensity distressed event");
    assert.ok(thread?.includes("nervous"), "Must preserve exact context summary");
  });

  // ── 2. PERSONAL DATES ENGINE ────────────────────────────────────────────
  await t.test("Personal Dates: record, list, anticipation window, prompt injection", () => {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + 2);
    const dateStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, "0")}-${String(futureDate.getDate()).padStart(2, "0")}`;

    const item = addPersonalDate(dateStr, "K7 Major Release Exam", false, "Important milestone");
    assert.ok(item.id, "Must generate unique ID");

    const allDates = listPersonalDates();
    const found = allDates.find((d) => d.id === item.id);
    assert.ok(found, "Personal date must be retrievable from SQLite");
    assert.equal(found.label, "K7 Major Release Exam");

    const upcoming = getUpcomingDates(7, today);
    const inUpcoming = upcoming.find((u) => u.id === item.id);
    assert.ok(inUpcoming, "Date within 2 days must be in 7-day lookahead window");
    assert.equal(inUpcoming.daysAway, 2, "Days away must equal 2");

    const promptText = formatDatesForPrompt(7, today);
    assert.ok(promptText.includes("K7 Major Release Exam"), "Prompt must include upcoming date");
    assert.ok(promptText.includes("In 2 days"), "Prompt must state days countdown");

    const deleted = deletePersonalDate(item.id);
    assert.equal(deleted, true, "Must delete personal date successfully");
  });

  // ── 3. WISHLIST ENGINE ──────────────────────────────────────────────────
  await t.test("Wishlist: add, score formula, due detection, fulfillment", () => {
    const wish = addWish("Eat authentic ramen in Tokyo", "high");
    assert.ok(wish.id, "Wish must have ID");
    assert.equal(wish.urgency, "high");

    const pending = listPendingWishes();
    assert.ok(pending.some((w) => w.id === wish.id), "Wish must be in pending list");

    // Evening time (8pm = 20:00) gives time factor 1.0
    const eveningDate = new Date();
    eveningDate.setHours(20, 0, 0, 0);

    const score = calculateWishScore(wish, eveningDate);
    // high urgency (1.0) * evening time (1.0) * fresh recency (1.0) = ~1.0
    assert.ok(score >= 0.9, `Score for high urgency wish in evening must be high (got ${score})`);

    // Quiet hour (3am = 03:00) gives time factor 0.0
    const nightDate = new Date();
    nightDate.setHours(3, 0, 0, 0);
    const nightScore = calculateWishScore(wish, nightDate);
    assert.equal(nightScore, 0.0, "Score during quiet hours must be 0.0");

    markWishSurfaced(wish.id);
    const afterSurface = listPendingWishes().find((w) => w.id === wish.id);
    assert.equal(afterSurface?.surfaceCount, 1, "Surface count must increment to 1");

    const fulfilled = markWishFulfilled(wish.id);
    assert.equal(fulfilled, true, "Mark fulfilled must succeed");

    const pendingAfter = listPendingWishes();
    assert.ok(!pendingAfter.some((w) => w.id === wish.id), "Fulfilled wish must no longer be pending");
  });

  // ── 4. 4D RELATIONSHIP TENSOR ───────────────────────────────────────────
  await t.test("4D Relationship Tensor: temperature, trust, intimacy, understanding", () => {
    const initial = getRelationshipTensor();
    assert.ok(initial.temperature >= 0 && initial.temperature <= 100);
    assert.ok(initial.trust >= 0 && initial.trust <= 100);
    assert.ok(initial.intimacy >= 0 && initial.intimacy <= 100);
    assert.ok(initial.understanding >= 0 && initial.understanding <= 100);

    // Update with positive sentiment
    const positiveUpdated = updateRelationshipFromSentiment("positive", 1.0);
    assert.ok(positiveUpdated.temperature >= initial.temperature, "Positive turn must increase warmth/temperature");
    assert.ok(positiveUpdated.trust >= initial.trust, "Positive turn must increase trust");
    assert.ok(positiveUpdated.totalTurns > initial.totalTurns, "Turn counter must increment");

    // Verify persistence in SQLite
    const persisted = getRelationshipTensor();
    assert.equal(persisted.totalTurns, positiveUpdated.totalTurns, "Relationship tensor must persist in SQLite");
  });

  // ── 5. PROACTIVE ABSENCE LEDGER ─────────────────────────────────────────
  await t.test("Proactive State: recordSent, streak detection, user reply reset", () => {
    const testSession = "test_user_session";
    recordUserReplied(testSession);
    assert.equal(getUnansweredCount(testSession), 0);
    assert.equal(hasIgnoredStreak(testSession), false);

    recordProactiveSent(testSession);
    assert.equal(getUnansweredCount(testSession), 1);
    assert.equal(hasIgnoredStreak(testSession), false);

    recordProactiveSent(testSession);
    assert.equal(getUnansweredCount(testSession), 2);
    assert.equal(hasIgnoredStreak(testSession), true, ">= 2 unanswered messages must trigger ignored streak");

    recordUserReplied(testSession);
    assert.equal(getUnansweredCount(testSession), 0, "User replying must clear streak");
    assert.equal(hasIgnoredStreak(testSession), false);
  });

  // ── 6. TIER-0 CRISIS SAFETY GUARDRAIL ───────────────────────────────────
  await t.test("Crisis Safety: deterministic zero-latency helpline diversion", () => {
    const safeMsg = "Hey Saan, how are you doing today?";
    assert.equal(checkCrisisSignals(safeMsg).isCrisis, false);

    const crisisMsg1 = "I just want to end my life, can't take it anymore";
    const check1 = checkCrisisSignals(crisisMsg1);
    assert.equal(check1.isCrisis, true);
    assert.ok(check1.response?.includes("14416"), "Crisis response must contain Tele-MANAS helpline");
    assert.ok(check1.response?.includes("Vandrevala"), "Crisis response must contain Vandrevala helpline");

    const hindiCrisis = "mujhe mar jane ka man kar raha hai sab khatam";
    const check2 = checkCrisisSignals(hindiCrisis);
    assert.equal(check2.isCrisis, true);
  });

  // ── 7. COMPACTION PROMPT & PARSER ───────────────────────────────────────
  await t.test("Structured Compaction: 6 mandatory companion sections", () => {
    const messages = [
      { role: "user", content: "I love drinking masala chai every morning." },
      { role: "assistant", content: "Haha me too, chai is non-negotiable!" },
    ];
    const prompt = buildCompactionPrompt(messages);
    assert.ok(prompt.includes("### RELATIONSHIP THREAD"));
    assert.ok(prompt.includes("### CONFIRMED USER FACTS"));
    assert.ok(prompt.includes("### OPEN PLANS & DATES"));
    assert.ok(prompt.includes("### EMOTIONAL TONE"));
    assert.ok(prompt.includes("### PENDING ASKS & PROMISES"));
    assert.ok(prompt.includes("### DO-NOT-LOSE"));

    const sampleSummary = `
### RELATIONSHIP THREAD
Bonded over morning chai banter.

### CONFIRMED USER FACTS
- Drinks masala chai every morning

### OPEN PLANS & DATES
- Trip to Manali in December

### EMOTIONAL TONE
Happy, energetic

### PENDING ASKS & PROMISES
- Promised to remind him about hotel bookings

### DO-NOT-LOSE
- Code 9942 for vault access
`;
    const parsed = parseCompactionSummary(sampleSummary);
    assert.equal(parsed.relationshipThread, "Bonded over morning chai banter.");
    assert.deepEqual(parsed.confirmedFacts, ["Drinks masala chai every morning"]);
    assert.deepEqual(parsed.openPlansAndDates, ["Trip to Manali in December"]);
    assert.deepEqual(parsed.doNotLose, ["Code 9942 for vault access"]);
  });

  // ── 8. SOVEREIGN CONTROLLER ACTION DISPATCHER ───────────────────────────
  await t.test("Sovereign Controller: HerAndHim action execution", async () => {
    // remember_date action
    const dateRes = await dispatchSaanAction("remember_date", {
      date: "2026-11-15",
      label: "Anniversary Celebration",
      recurring: true,
    });
    assert.equal(dateRes.success, true);
    assert.equal(dateRes.action, "remember_date");

    // list_dates action
    const listDatesRes = await dispatchSaanAction("list_dates");
    assert.equal(listDatesRes.success, true);
    assert.ok(Array.isArray(listDatesRes.data));

    // add_wish action
    const wishRes = await dispatchSaanAction("add_wish", {
      text: "Buy a mechanical keyboard with tactile switches",
      urgency: "medium",
    });
    assert.equal(wishRes.success, true);
    assert.equal(wishRes.action, "add_wish");
    assert.ok(wishRes.data.id);

    // fulfill_wish action
    const fulfillRes = await dispatchSaanAction("fulfill_wish", {
      wishId: wishRes.data.id,
    });
    assert.equal(fulfillRes.success, true);
    assert.equal(fulfillRes.data.fulfilled, true);

    // Clean up created date
    deletePersonalDate(dateRes.data.id);
  });

  // ── 9. SYSTEM PROMPT ANCHOR INTEGRATION ─────────────────────────────────
  await t.test("Soul System Prompt includes HerAndHim dynamics", () => {
    const prompt = buildSaanSystemPrompt(["Loves hiking in nature"], 60);
    assert.ok(prompt.includes("Relationship Dynamics: Warmth"), "Prompt must include 4D warmth");
    assert.ok(prompt.includes("Trust"), "Prompt must include 4D trust");
    assert.ok(prompt.includes("Intimacy"), "Prompt must include 4D intimacy");
    assert.ok(prompt.includes("UPCOMING PERSONAL DATES"), "Prompt must have anticipation section if dates exist");
  });
});
