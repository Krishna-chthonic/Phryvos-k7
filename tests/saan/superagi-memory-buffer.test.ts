import test from "node:test";
import assert from "node:assert/strict";
import {
  BufferedMemoryQueue,
  computeSyntheticEmbedding,
  cosineSimilarity,
  type BufferedMemoryCandidate,
  type MemoryPriority,
} from "../../lib/saan/buffered-memory-queue";

test("Repo 16: SuperAGI & TeleMem Multi-Tier Buffered Memory Queue", async (t) => {
  await t.test("cosineSimilarity and computeSyntheticEmbedding compute consistent semantic footprints", () => {
    const textA = "User loves drinking adrak chai late at night";
    const textB = "User loves drinking adrak chai late at night";
    const textC = "Saan manages the production deployment docker container";

    const embA = computeSyntheticEmbedding(textA);
    const embB = computeSyntheticEmbedding(textB);
    const embC = computeSyntheticEmbedding(textC);

    assert.equal(embA.length, 64);
    const simIdentical = cosineSimilarity(embA, embB);
    assert.ok(simIdentical > 0.999, `Identical texts should have ~1.0 similarity, got ${simIdentical}`);

    const simDiff = cosineSimilarity(embA, embC);
    assert.ok(simDiff < simIdentical, "Different texts should have lower similarity than identical texts");
  });

  await t.test("enqueue enforces priority-ordered insertion (CRITICAL > HIGH > NORMAL > EPHEMERAL)", () => {
    const queue = new BufferedMemoryQueue({ bufferSize: 10 });
    const userId = "test_user_prio";

    queue.enqueue({
      userId,
      text: "Normal fact: user woke up at 8 AM",
      axis: "events",
      priority: "NORMAL",
      confidence: 0.8,
    });

    queue.enqueue({
      userId,
      text: "Ephemeral note: user mentioned it was raining",
      axis: "events",
      priority: "EPHEMERAL",
      confidence: 0.6,
    });

    queue.enqueue({
      userId,
      text: "Critical security rule: never expose master API keys",
      axis: "traits",
      priority: "CRITICAL",
      confidence: 0.99,
    });

    queue.enqueue({
      userId,
      text: "High preference: user strictly prefers dark mode interfaces",
      axis: "traits",
      priority: "HIGH",
      confidence: 0.9,
    });

    const pending = queue.getPendingItems(userId);
    assert.equal(pending.length, 4);
    assert.equal(pending[0].priority, "CRITICAL");
    assert.equal(pending[1].priority, "HIGH");
    assert.equal(pending[2].priority, "NORMAL");
    assert.equal(pending[3].priority, "EPHEMERAL");
  });

  await t.test("priority promotion occurs when identical facts are re-enqueued", () => {
    const queue = new BufferedMemoryQueue({ bufferSize: 10 });
    const userId = "test_user_promo";

    // Initial enqueue as NORMAL
    const first = queue.enqueue({
      userId,
      text: "User prefers reading books before sleeping",
      axis: "traits",
      priority: "NORMAL",
      confidence: 0.7,
    });
    assert.equal(first.promoted, false);
    assert.equal(first.item.priority, "NORMAL");

    // Second enqueue of identical text promotes NORMAL -> HIGH
    const second = queue.enqueue({
      userId,
      text: "User prefers reading books before sleeping",
      axis: "traits",
      priority: "NORMAL",
      confidence: 0.85,
    });
    assert.equal(second.promoted, true);
    assert.equal(second.item.priority, "HIGH");
    assert.equal(second.item.confidence, 0.85);

    // Third enqueue promotes HIGH -> CRITICAL
    const third = queue.enqueue({
      userId,
      text: "User prefers reading books before sleeping",
      axis: "traits",
      priority: "NORMAL",
      confidence: 0.95,
    });
    assert.equal(third.promoted, true);
    assert.equal(third.item.priority, "CRITICAL");
    assert.equal(third.item.confidence, 0.95);
    assert.equal(third.item.accessCount, 3);
  });

  await t.test("getQueueMetrics calculates capacity, utilization, and category breakdowns", () => {
    const queue = new BufferedMemoryQueue({ bufferSize: 20 });
    const userId = "test_user_metrics";

    queue.enqueue({
      userId,
      text: "Event milestone 1",
      axis: "events",
      priority: "HIGH",
      confidence: 0.8,
    });
    queue.enqueue({
      userId,
      text: "Event milestone 2",
      axis: "events",
      priority: "NORMAL",
      confidence: 0.8,
    });
    queue.enqueue({
      userId,
      text: "Relationship note",
      axis: "relationships",
      priority: "NORMAL",
      confidence: 0.9,
    });

    const metrics = queue.getQueueMetrics(userId);
    assert.equal(metrics.totalPending, 3);
    assert.equal(metrics.capacity, 20);
    assert.equal(metrics.utilizationPct, 15);
    assert.equal(metrics.byPriority.HIGH, 1);
    assert.equal(metrics.byPriority.NORMAL, 2);
    assert.equal(metrics.byAxis.events, 2);
    assert.equal(metrics.byAxis.relationships, 1);
    assert.ok(metrics.oldestItemAgeMs >= 0);
  });

  await t.test("flush executes semantic cosine clustering, deduplication, and cold storage persistence", () => {
    const queue = new BufferedMemoryQueue({ bufferSize: 10, similarityThreshold: 0.5 });
    const userId = "test_user_flush";

    // Enqueue 2 facts on traits axis that share significant semantic overlap
    queue.enqueue({
      userId,
      text: "User drinks hot masala chai every morning before work",
      axis: "traits",
      priority: "NORMAL",
      confidence: 0.8,
    });
    queue.enqueue({
      userId,
      text: "User drinks hot masala chai every morning while planning",
      axis: "traits",
      priority: "HIGH",
      confidence: 0.92,
    });

    // Enqueue 1 independent distinct fact on events axis
    queue.enqueue({
      userId,
      text: "Completed the production Next.js route migration",
      axis: "events",
      priority: "HIGH",
      confidence: 0.95,
    });

    assert.equal(queue.getPendingCount(userId), 3);

    const flushRes = queue.flush(userId);
    assert.equal(queue.getPendingCount(userId), 0, "Buffer queue should be empty after flush");
    assert.ok(flushRes.added.length >= 2, "Should have added memories to cold storage");
    assert.ok(flushRes.fused.clusterCount >= 1, "Should have fused at least 1 cluster of overlapping facts");
  });

  await t.test("searchUnified searches both warm pending buffer and cold committed storage", () => {
    const queue = new BufferedMemoryQueue({ bufferSize: 10 });
    const userId = "test_user_unified";

    // 1. Put item in cold storage via flush
    queue.enqueue({
      userId,
      text: "Archived fact: user loves astrophysics and deep space exploration",
      axis: "traits",
      priority: "HIGH",
      confidence: 0.95,
    });
    queue.flush(userId);

    // 2. Put item in warm buffer (uncommitted)
    queue.enqueue({
      userId,
      text: "In-flight recent turn: user is researching quantum gravity calculus",
      axis: "traits",
      priority: "CRITICAL",
      confidence: 0.9,
    });

    // Search query related to physics / space
    const results = queue.searchUnified(userId, "quantum gravity physics space", 5);
    assert.ok(results.length >= 1, "Unified search should return matching facts");
    const sources = results.map((r) => r.source);
    assert.ok(sources.includes("warm_buffer") || sources.includes("cold_storage"));
  });

  await t.test("BufferedMemoryQueue.getPersonPrompt formats 4-axis extraction prompt", () => {
    const prompt = BufferedMemoryQueue.getPersonPrompt("Saan", "User: I need to finalize the roadmap today.\nSaan: I got your back!");
    assert.ok(prompt.systemPrompt.includes("cognitive persona memory extractor"));
    assert.ok(prompt.userPrompt.includes('character "Saan"'));
    assert.ok(prompt.userPrompt.includes("1. relationships:"));
    assert.ok(prompt.userPrompt.includes("2. events:"));
    assert.ok(prompt.userPrompt.includes("3. traits:"));
    assert.ok(prompt.userPrompt.includes("4. items:"));
  });
});
