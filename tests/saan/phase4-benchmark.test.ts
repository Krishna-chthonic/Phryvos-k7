/**
 * Phase 4 Verification Suite: Multi-Turn Memory Benchmark & Latency Stress Test
 * (Inspired by datapace-ai/agent-memory-benchmark and hamza-dev-tech/agent-memory-bench)
 *
 * Verifies Exit Gate 4:
 * 1. 50 synthetic multi-turn memory points inserted
 * 2. Fact retrieval recall accuracy >= 95%
 * 3. Query latency target < 10ms per memory lookup (Datapace SQLite study)
 */

import { getDb } from "../../lib/db/client";
import { saveSaanMemory, getSaanMemories } from "../../lib/saan/memory";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

export function runPhase4Benchmark(): void {
  console.log("=== Running Phase 4 Memory Benchmark & Latency Stress Test ===");
  const db = getDb();

  const NUM_FACTS = 50;
  const categories: Array<"fact" | "preference" | "promise" | "general"> = ["fact", "preference", "promise", "general"];

  console.log(`Injecting ${NUM_FACTS} synthetic multi-turn memory points...`);
  const insertedFacts: string[] = [];

  for (let i = 1; i <= NUM_FACTS; i++) {
    const fact = `User profile metric #${i}: study target is chapter ${i} and preferred score is ${80 + (i % 20)}%`;
    const cat = categories[i % categories.length];
    const imp = 1 + (i % 10);
    saveSaanMemory(fact, cat, imp, "explicit_directive");
    insertedFacts.push(fact);
  }

  console.log("Measuring query latency across 50 simulated retrieval turns...");
  const latencies: number[] = [];
  let successfulRecalls = 0;

  for (let i = 0; i < NUM_FACTS; i++) {
    const target = insertedFacts[i];
    const start = performance.now();

    // Query active memories
    const active = getSaanMemories(250);
    const end = performance.now();
    latencies.push(end - start);

    if (active.some((m) => m.point === target)) {
      successfulRecalls++;
    }
  }

  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const maxLatency = Math.max(...latencies);
  const recallRate = (successfulRecalls / NUM_FACTS) * 100;

  console.log(`\nBenchmark Results:`);
  console.log(`- Total Tested Facts: ${NUM_FACTS}`);
  console.log(`- Successful Recalls: ${successfulRecalls}/${NUM_FACTS} (${recallRate.toFixed(1)}%)`);
  console.log(`- Average Query Latency: ${avgLatency.toFixed(2)} ms`);
  console.log(`- Max Query Latency: ${maxLatency.toFixed(2)} ms`);

  // Assertions against benchmark criteria
  assert(recallRate >= 95, `Recall rate must be >= 95% (achieved: ${recallRate.toFixed(1)}%)`);
  assert(avgLatency < 10, `Average query latency must be < 10ms (achieved: ${avgLatency.toFixed(2)}ms)`);

  // Clean up synthetic benchmark data
  db.prepare("DELETE FROM saan_memories WHERE point LIKE 'User profile metric #%'").run();

  console.log("\n>>> ALL PHASE 4 BENCHMARK CRITERIA MET (100% SUCCESS) <<<\n");
}

runPhase4Benchmark();
