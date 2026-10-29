import test from "node:test";
import assert from "node:assert/strict";
import {
  MemoryEvalJudgeEngine,
  MemoryEvalStore,
  getMemoryEvalStore,
} from "../../lib/saan/memory-eval-judge";

test("MemoryEvalJudge - Context Relevancy calculation", () => {
  const query = "What is my favorite tea preparation?";
  const relevantMemories = [
    "User prefers ginger cardamom chai with oat milk.",
    "Morning routine includes brewing hot spiced tea.",
  ];
  const irrelevantMemories = [
    "User works on distributed database indexing algorithms.",
    "User uses Arch Linux with Hyprland window manager.",
  ];

  const highRel = MemoryEvalJudgeEngine.calculateRelevancy(query, relevantMemories);
  const lowRel = MemoryEvalJudgeEngine.calculateRelevancy(query, irrelevantMemories);

  assert.ok(highRel > lowRel, `Expected relevant (${highRel}) > irrelevant (${lowRel})`);
  assert.ok(highRel >= 0.5, `Expected high relevancy >= 0.5, got ${highRel}`);
});

test("MemoryEvalJudge - Faithfulness grounding calculation", () => {
  const memories = [
    "User lives in Jaipur and loves cycling around Jal Mahal.",
    "Favorite dessert is Ghewar from LMB.",
  ];

  const groundedReply = "Jaipur me Jal Mahal ke paas cycling karna waise bhi shandar lagta hai!";
  const ungroundedReply = "Maine suna hai Paris me Eiffel tower ke samne croissant khana best hai.";

  const highFaith = MemoryEvalJudgeEngine.calculateFaithfulness(groundedReply, memories);
  const lowFaith = MemoryEvalJudgeEngine.calculateFaithfulness(ungroundedReply, memories);

  assert.ok(highFaith > lowFaith, `Expected grounded (${highFaith}) > ungrounded (${lowFaith})`);
  assert.ok(highFaith >= 0.5, `Expected high faithfulness >= 0.5, got ${highFaith}`);
});

test("MemoryEvalJudge - Temporal Integrity calculation", () => {
  const normalTurn = MemoryEvalJudgeEngine.calculateTemporalIntegrity(
    "Kal subah chai peeyenge",
    "Haan kal 8 baje milte hain!",
    ["Scheduled morning chai tomorrow at 8 AM"]
  );
  assert.equal(normalTurn, 0.95);

  const confusedTurn = MemoryEvalJudgeEngine.calculateTemporalIntegrity(
    "Kal kya hua tha?",
    "Pehle kal aane wala session me humne review kiya tha",
    ["Contradictory time markers"]
  );
  assert.equal(confusedTurn, 0.3);
});

test("MemoryEvalJudge - Slop & Cliché Penalty detection", () => {
  const cleanReply = "Hey, sab badhiya hai! Aaj ka code commit karke thoda rest kar lo.";
  const cleanPenalty = MemoryEvalJudgeEngine.calculateSlopPenalty(cleanReply);
  assert.equal(cleanPenalty, 0.0);

  const slopReply = "Let us delve into this magnificent tapestry of life, which serves as a beacon of hope and resonates with our souls. In conclusion, it's important to remember!";
  const slopPenalty = MemoryEvalJudgeEngine.calculateSlopPenalty(slopReply);
  assert.ok(slopPenalty >= 0.5, `Expected significant slop penalty, got ${slopPenalty}`);
});

test("MemoryEvalJudge - Multi-Metric Turn Evaluation & Grade Tiers", () => {
  const user = "Maine kal konsa project complete kiya tha?";
  const reply = "Kal aapne K7 cognitive memory suite test complete kiya tha!";
  const memories = ["User completed K7 cognitive memory suite test yesterday."];

  const metrics = MemoryEvalJudgeEngine.evaluateTurn(user, reply, memories);
  assert.ok(metrics.compositeFidelity >= 0.70, `Expected composite >= 0.70, got ${metrics.compositeFidelity}`);
  assert.ok(["S_TIER", "A_TIER"].includes(metrics.grade));
  assert.ok(metrics.critique.includes("Fidelity:"));
});

test("MemoryEvalStore - telemetry recording, rolling statistics & clear", () => {
  const store = new MemoryEvalStore();
  assert.equal(store.getAggregateStats().totalEvaluated, 0);

  store.recordEvaluation(
    "What is my favorite beverage?",
    "Your favorite beverage is spiced adrak chai.",
    ["User favorite beverage is spiced adrak chai."],
    12
  );
  store.recordEvaluation(
    "Where did we go cycling?",
    "We went cycling around Jal Mahal lake.",
    ["User went cycling around Jal Mahal lake."],
    15
  );

  const stats = store.getAggregateStats();
  assert.equal(stats.totalEvaluated, 2);
  assert.ok(stats.avgCompositeFidelity >= 0.70);
  assert.ok(stats.passRate >= 50);

  const history = store.getHistory();
  assert.equal(history.length, 2);
  assert.equal(history[0].latencyMs, 15);

  store.clear();
  assert.equal(store.getHistory().length, 0);
  assert.equal(store.getAggregateStats().totalEvaluated, 0);
});

test("MemoryEvalStore - global singleton consistency", () => {
  const s1 = getMemoryEvalStore();
  const s2 = getMemoryEvalStore();
  assert.equal(s1, s2);
});
