import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getDb } from "@/lib/db/client";
import {
  rankMemoriesComposite,
  checkIsFlashbulb,
  calculateVividness,
  touchMemory,
  addVolatileFact,
  getVolatileFacts,
  addLesson,
  getLessons,
  recordLessonReuse,
  reframeMemory,
  reliveMemory,
  driftAnalysis,
  FLASHBULB_STABILITY_FLOOR,
  FLASHBULB_VIVIDNESS_FLOOR,
  ZEIGARNIK_BOOST,
} from "@/lib/saan/mimir-cognitive";
import { runHuginnScan, getHuginnInsights } from "@/lib/saan/huginn";
import {
  buildYggdrasilGraph,
  spreadingActivation,
  findAssociativePath,
  getYggdrasilVizSummary,
} from "@/lib/saan/yggdrasil";
import { saveSaanMemory, getSaanMemories } from "@/lib/saan/memory";
import { dispatchSaanAction } from "@/lib/saan/controller";
import { loadLedgerFromDb, addDeeds, syncLedgerToDb } from "@/lib/saan/ledger";

describe("Mimir Cognitive Architecture Tests (Kronic90/Mimirs-Memory-Hub)", () => {
  it("verifies Flashbulb Memory detection criteria and stability floor", () => {
    // Normal memory: importance 5, arousal 0.2 -> not flashbulb
    assert.equal(checkIsFlashbulb(5, [0.1, 0.2, 0.0]), false);

    // High importance but low arousal -> not flashbulb
    assert.equal(checkIsFlashbulb(9, [0.5, 0.3, 0.2]), false);

    // High importance and high arousal (>= 0.6) -> flashbulb!
    assert.equal(checkIsFlashbulb(8, [0.8, 0.7, 0.5]), true);
    assert.equal(checkIsFlashbulb(10, [-0.7, 0.85, -0.4]), true);

    // Retention floor check: even after 500 days, flashbulb never drops below floor
    const ancientTime = Date.now() - 500 * 86400 * 1000;
    const viv = calculateVividness(ancientTime, FLASHBULB_STABILITY_FLOOR, true, false);
    assert.ok(viv >= FLASHBULB_VIVIDNESS_FLOOR, `Flashbulb vividness ${viv} should be >= ${FLASHBULB_VIVIDNESS_FLOOR}`);
  });

  it("verifies 5-factor composite re-ranking and state-dependent mood congruence", () => {
    const now = Date.now();
    const testMemories: any[] = [
      {
        id: 101,
        point: "Scott loves working on autonomous robotics systems",
        category: "preference",
        importance: 8,
        confidence: 1.0,
        createdAt: now - 3600 * 1000,
        validSince: now - 3600 * 1000,
        validUntil: 253402300799000,
        status: "active",
        sourceType: "explicit_directive",
        emotion_pad: [0.7, 0.5, 0.6], // positive active
      },
      {
        id: 102,
        point: "Rainy contemplative afternoon listening to ambient music",
        category: "general",
        importance: 4,
        confidence: 0.9,
        createdAt: now - 86400 * 1000 * 10,
        validSince: now - 86400 * 1000 * 10,
        validUntil: 253402300799000,
        status: "active",
        sourceType: "implicit",
        emotion_pad: [0.2, -0.4, 0.1], // calm reflective
      },
      {
        id: 103,
        point: "Critical database configuration for postgres port 5432",
        category: "fact",
        importance: 9,
        confidence: 1.0,
        createdAt: now - 1800 * 1000,
        validSince: now - 1800 * 1000,
        validUntil: 253402300799000,
        status: "active",
        sourceType: "explicit_directive",
        emotion_pad: [0.0, 0.0, 0.0],
      },
    ];

    // Query 1: Factual query about postgres configuration
    const factualRanked = rankMemoriesComposite(testMemories, "what is the postgres port setting?", [0.0, 0.0, 0.0]);
    assert.equal(factualRanked[0].memory.id, 103, "Postgres memory should rank #1 for factual query");
    assert.ok(factualRanked[0].factors.keyword > 0.3, "Keyword factor should be prominent");

    // Query 2: Positive active mood congruence
    const happyRanked = rankMemoriesComposite(testMemories, "robotics", [0.8, 0.6, 0.5]);
    assert.equal(happyRanked[0].memory.id, 101, "Robotics memory should rank highest with high positive mood");
    assert.ok(happyRanked[0].factors.mood > 0.7, "Mood score should be high for matching PAD vector");
  });

  it("verifies Zeigarnik effect boost for open consequence deeds", () => {
    const deedTag = `fix_mimir_${Date.now()}`;
    const ledger = loadLedgerFromDb();
    const updated = addDeeds(ledger, [{ deed: `must test deployment of ${deedTag} urgently`, weight: "major" } as any], 1);
    syncLedgerToDb(updated);

    const testMemories: any[] = [
      {
        id: 201,
        point: `Notes regarding deployment of ${deedTag} cluster`,
        category: "promise",
        importance: 5,
        confidence: 1.0,
        createdAt: Date.now() - 100000,
        status: "active",
      },
      {
        id: 202,
        point: "Unrelated notes about coffee roasting temperatures",
        category: "general",
        importance: 5,
        confidence: 1.0,
        createdAt: Date.now() - 100000,
        status: "active",
      },
    ];

    const ranked = rankMemoriesComposite(testMemories, "deployment", [0.0, 0.0, 0.0]);
    const matched = ranked.find((r) => r.memory.id === 201);
    assert.ok(matched, "Should score candidate memory");
    assert.equal(matched!.factors.zeigarnikBoost, ZEIGARNIK_BOOST, "Open deed must trigger +0.50 Zeigarnik boost");
    assert.ok(matched!.score > 0.8, "Score must reflect Zeigarnik boost");
  });

  it("verifies Volatile 12-Hour Short-Term Facts lifecycle", () => {
    const fact = addVolatileFact("Scott", "desk_monitor", "34-inch ultrawide OLED", 12);
    assert.ok(fact.id.startsWith("vf_"));
    assert.equal(fact.entity, "Scott");
    assert.equal(fact.value, "34-inch ultrawide OLED");

    const facts = getVolatileFacts("Scott");
    const found = facts.find((f) => f.attribute === "desk_monitor");
    assert.ok(found, "Fact should be retrieved");
    assert.ok(found!.vividness > 0.95, "Fresh fact vividness should be near 1.0");
  });

  it("verifies Procedural Lessons & Solutions store", () => {
    const topic = `docker_port_conflict_${Date.now()}`;
    const lesson = addLesson(topic, "Run fuser -k 3000/tcp before starting nextjs server", 7);
    assert.ok(lesson.id.startsWith("les_"));
    assert.equal(lesson.importance, 7);

    const retrieved = getLessons(topic);
    assert.equal(retrieved.length, 1);
    assert.equal(retrieved[0].strategy, "Run fuser -k 3000/tcp before starting nextjs server");

    recordLessonReuse(lesson.id);
    const updated = getLessons(topic);
    assert.equal(updated[0].reuseCount, 1, "Reuse count should increment");
  });

  it("verifies Huginn emergent pattern detection scan", () => {
    const db = getDb();
    const testEntity = `Marcus_${Date.now()}`;

    // Seed 4 memories with warming trajectory: early negative, later positive
    const early = Date.now() - 40 * 86400 * 1000;
    const mid = Date.now() - 20 * 86400 * 1000;
    const recent = Date.now() - 2 * 86400 * 1000;

    saveSaanMemory(`${testEntity} felt distant and guarded during our initial meeting`, "emotion", 6, "implicit", [-0.5, 0.2, -0.3]);
    saveSaanMemory(`${testEntity} expressed hesitation regarding the joint venture`, "emotion", 5, "implicit", [-0.3, 0.1, -0.2]);
    saveSaanMemory(`${testEntity} shared warm appreciation for our collaborative milestone`, "emotion", 7, "implicit", [0.7, 0.4, 0.5]);
    saveSaanMemory(`${testEntity} feels deeply aligned and excited for upcoming launches`, "emotion", 8, "implicit", [0.8, 0.6, 0.6]);

    const insights = runHuginnScan();
    const entityArc = insights.find((ins) => ins.type === "sentiment_arc" && ins.entity === testEntity.toLowerCase());
    assert.ok(entityArc, "Huginn must detect sentiment trajectory arc");
    assert.ok(entityArc!.insight.includes("warming"), "Trajectory should be classified as warming");
  });

  it("verifies Yggdrasil graph construction and spreading activation", () => {
    const tag = `ygg_${Date.now()}`;
    saveSaanMemory(`Core kernel architecture design for ${tag} engine`, "fact", 8, "implicit", [0.3, 0.1, 0.4]);
    saveSaanMemory(`Refactoring kernel architecture and data cache for ${tag}`, "fact", 7, "implicit", [0.3, 0.1, 0.4]);
    saveSaanMemory(`Testing performance metrics for ${tag} system`, "fact", 6, "implicit", [0.2, 0.0, 0.2]);

    const edges = buildYggdrasilGraph();
    assert.ok(edges.length > 0, "Yggdrasil should build lexical/temporal/emotional edges");

    const memories = getSaanMemories(3);
    const seedId = memories[0].id;
    const activation = spreadingActivation([seedId], 2, 0.5, 0.05);
    assert.ok(activation.has(seedId), "Seed memory should have 1.0 activation");

    const viz = getYggdrasilVizSummary();
    assert.ok(viz.totalNodes > 0, "Visualization summary should report nodes");
  });

  it("verifies Cognitive Reappraisal (reframe) and Mental Time Travel (relive)", () => {
    const uniqueMem = `Emotional memory to test reframe ${Date.now()}`;
    saveSaanMemory(uniqueMem, "emotion", 7, "implicit", [-0.6, 0.7, -0.4]);

    const db = getDb();
    const saved = db.prepare(`SELECT * FROM saan_memories WHERE point = ?`).get(uniqueMem) as any;
    assert.ok(saved, "Memory should exist");

    // Intentional Cognitive Reappraisal: Reframe to "serene"
    const reframed = reframeMemory(saved.id, "serene", "Gained perspective through meditation");
    assert.equal(reframed, true, "Reframe should succeed");

    // Mental Time Travel: Relive
    const relived = reliveMemory(saved.id);
    assert.equal(relived.success, true, "Relive memory should succeed");
    assert.ok(relived.blendedMood, "Blended mood should be computed");
  });

  it("verifies Cognitive Drift and Bias analysis", () => {
    const report = driftAnalysis();
    assert.ok(typeof report.totalAnalyzed === "number");
    assert.ok(typeof report.averageValence === "number");
    assert.ok(Array.isArray(report.biases));
  });

  it("verifies sovereign controller actions dispatch for Mimir cognitive tools", async () => {
    // 1. get_cognitive_state (Tier 1)
    const cogState = await dispatchSaanAction("get_cognitive_state");
    assert.equal(cogState.success, true);
    assert.equal(cogState.tier, 1);
    assert.ok(cogState.data.driftReport);

    // 2. add_lesson (Tier 2)
    const lessonRes = await dispatchSaanAction("add_lesson", {
      topic: "SQLite WAL optimization",
      strategy: "Set PRAGMA synchronous = NORMAL and journal_mode = WAL",
      importance: 8,
    });
    assert.equal(lessonRes.success, true);
    assert.equal(lessonRes.tier, 2);

    // 3. get_memory_graph (Tier 1)
    const graphRes = await dispatchSaanAction("get_memory_graph");
    assert.equal(graphRes.success, true);
    assert.equal(graphRes.tier, 1);
    assert.ok(graphRes.data.totalNodes >= 0);
  });
});
