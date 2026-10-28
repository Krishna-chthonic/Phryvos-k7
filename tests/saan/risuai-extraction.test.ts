/**
 * RisuAI Extraction & Capabilities Test Suite (kwaroran/Risuai)
 * Verifies clean-room implementations:
 * 1. Provider Cascade & Resiliency Engine (fallback, retry, blank failover)
 * 2. Token Headroom & Dynamic Budget Clamping
 * 3. Task Rate Limiter & Concurrency Queue
 * 4. Graph Associative Memory Engine (BFS traversal)
 * 5. Cryptographically Sound Session Vault (AES-256-GCM unique IV)
 * 6. Sovereign Controller Action Dispatching
 */

import test from "node:test";
import assert from "node:assert/strict";
import { ProviderCascadeEngine } from "../../lib/saan/provider-cascade";
import { clampOutputTokens, pruneContextTurns, estimateTokenCount } from "../../lib/saan/token-budget";
import { TaskRateLimiter } from "../../lib/saan/task-rate-limiter";
import { GraphMemoryStore, DEFAULT_SAAN_GRAPH_NODES, getGraphMemoryStore, searchGlobalGraph } from "../../lib/saan/graph-memory";
import { globalChatVariables } from "../../lib/saan/chat-variables";
import { encryptSessionPayload, decryptSessionPayload } from "../../lib/saan/session-crypto";
import { dispatchSaanAction } from "../../lib/saan/controller";

test("RisuAI Extraction: Provider Cascade - Primary Success", async () => {
  const cascade = new ProviderCascadeEngine({
    primaryModel: "claude-3-5-sonnet",
    fallbackModels: ["gpt-4o", "gemini-1.5-pro"],
    maxRetriesPerModel: 2,
  });

  const res = await cascade.execute(async (model) => {
    assert.equal(model, "claude-3-5-sonnet");
    return { text: "Hello from primary!" };
  });

  assert.equal(res.success, true);
  assert.equal(res.modelUsed, "claude-3-5-sonnet");
  assert.equal(res.fallbackTriggered, false);
  assert.equal(res.reason, "success");
});

test("RisuAI Extraction: Provider Cascade - Primary Failure Steps Down to Fallback", async () => {
  const cascade = new ProviderCascadeEngine({
    primaryModel: "claude-3-5-sonnet",
    fallbackModels: ["gpt-4o-mini", "mistral-large"],
    maxRetriesPerModel: 1,
  });

  const res = await cascade.execute(async (model) => {
    if (model === "claude-3-5-sonnet") {
      throw new Error("HTTP 503 Provider Outage");
    }
    return { text: `Resolved by ${model}` };
  });

  assert.equal(res.success, true);
  assert.equal(res.modelUsed, "gpt-4o-mini");
  assert.equal(res.fallbackTriggered, true);
  assert.equal(res.reason, "success");
});

test("RisuAI Extraction: Provider Cascade - Blank Response Recovery Failover", async () => {
  const cascade = new ProviderCascadeEngine({
    primaryModel: "unstable-model",
    fallbackModels: ["reliable-fallback"],
    maxRetriesPerModel: 1,
    fallbackOnBlankResponse: true,
  });

  const res = await cascade.execute(async (model) => {
    if (model === "unstable-model") {
      return { text: "   \n\t  " }; // empty whitespace output
    }
    return { text: "Valid content from fallback" };
  });

  assert.equal(res.success, true);
  assert.equal(res.modelUsed, "reliable-fallback");
  assert.equal(res.fallbackTriggered, true);
});

test("RisuAI Extraction: Token Budget - Headroom & Output Clamping", () => {
  // Case A: Plenty of headroom
  const outNormal = clampOutputTokens(1000, 8192, 2048, 32);
  assert.equal(outNormal, 2048);

  // Case B: Constrained context
  const outConstrained = clampOutputTokens(7500, 8192, 2048, 32);
  // Max available = 8192 - 7500 - 32 = 660
  assert.equal(outConstrained, 660);

  // Case C: Exhausted context ensures minimum floor
  const outFloor = clampOutputTokens(8180, 8192, 2048, 32);
  assert.equal(outFloor, 16);
});

test("RisuAI Extraction: Token Budget - Iterative Removable Pruning", () => {
  const messages = [
    { role: "system", content: "You are Saan, a companion." },
    { role: "user", content: "Turn 1: " + "A".repeat(800), removable: true },
    { role: "assistant", content: "Turn 2: " + "B".repeat(800), removable: true },
    { role: "user", content: "Turn 3: " + "C".repeat(800), removable: true },
    { role: "user", content: "Turn 4: Recent critical question" },
  ];

  // Request small context limit forcing eviction of older removable turns
  const { prunedMessages, budget } = pruneContextTurns(messages, 500, 100);

  assert.equal(budget.wasPruned, true);
  assert.ok(budget.prunedTurnCount > 0);
  // System prompt must always be preserved
  assert.equal(prunedMessages[0].role, "system");
  // Total tokens must now safely fit
  assert.ok(budget.inputTokens <= 500);
});

test("RisuAI Extraction: Task Rate Limiter & Concurrency Queue", async () => {
  const limiter = new TaskRateLimiter({
    tasksPerMinute: 120,
    maxConcurrentTasks: 2,
  });

  let activePeak = 0;
  let currentlyActive = 0;

  const runTask = async (id: number) => {
    currentlyActive++;
    activePeak = Math.max(activePeak, currentlyActive);
    await new Promise((r) => setTimeout(r, 20));
    currentlyActive--;
    return id * 2;
  };

  const promises = [1, 2, 3, 4, 5].map((id) => limiter.enqueue(() => runTask(id)));
  const results = await Promise.all(promises);

  assert.equal(results.length, 5);
  assert.ok(activePeak <= 2, `Active peak (${activePeak}) should not exceed maxConcurrentTasks (2)`);
  assert.deepEqual(
    results.map((r) => r.data),
    [2, 4, 6, 8, 10]
  );
});

test("RisuAI Extraction: Graph Associative Memory - Node Storage", () => {
  const store = new GraphMemoryStore();

  store.addNode({
    name: "Quantum Computing",
    summary: "Qubits and superposition principles",
    connections: ["Cryptography", "Physics"],
  });

  store.addNode({
    name: "Cryptography",
    summary: "Public-key ciphers and AES algorithms",
    connections: ["Quantum Computing", "Security"],
  });

  const node = store.getNode("quantum computing");
  assert.ok(node !== null);
  assert.equal(node?.name, "Quantum Computing");
  assert.deepEqual(node?.connections, ["Cryptography", "Physics"]);
});

test("RisuAI Extraction: Graph Associative Memory - Breadth-First Multi-Hop Traversal", () => {
  const store = new GraphMemoryStore([
    { name: "Alpha", summary: "Start node", connections: ["Beta"] },
    { name: "Beta", summary: "Intermediate node", connections: ["Gamma"] },
    { name: "Gamma", summary: "Target node 2 hops away", connections: ["Delta"] },
    { name: "Delta", summary: "Target node 3 hops away", connections: [] },
  ]);

  // Traversal with depth = 2 should reach Alpha, Beta, and Gamma, but NOT Delta
  const traversed = store.traverse(["Alpha"], 2);
  const names = traversed.map((n) => n.name);

  assert.ok(names.includes("Alpha"));
  assert.ok(names.includes("Beta"));
  assert.ok(names.includes("Gamma"));
  assert.ok(!names.includes("Delta"), "Depth 2 traversal should not include Delta (3 hops away)");
});

test("RisuAI Extraction: Cryptographically Sound Session Vault (AES-256-GCM)", () => {
  const secretKey = "super-secure-passphrase-k7";
  const plaintext = JSON.stringify({ userId: "krishna", secretToken: "saan-sovereign-99" });

  const enc1 = encryptSessionPayload(plaintext, secretKey);
  const enc2 = encryptSessionPayload(plaintext, secretKey);

  // Remediation check: Every encryption must have a DIFFERENT unique IV
  assert.notEqual(enc1.iv, enc2.iv, "Unique random IV must be generated per encryption");

  // Decryption must restore identical plaintext
  const decrypted = decryptSessionPayload(enc1, secretKey);
  assert.equal(decrypted, plaintext);

  // Decryption with incorrect key must throw error
  assert.throws(() => {
    decryptSessionPayload(enc1, "wrong-passphrase-attempt");
  });
});

test("RisuAI Extraction: Controller Action Dispatching", async () => {
  // 1. get_token_budget
  const resBudget = await dispatchSaanAction("get_token_budget", {
    inputTokens: 2000,
    maxContext: 8192,
    maxResponse: 1024,
  });
  assert.equal(resBudget.success, true);
  assert.equal(resBudget.tier, 1);
  assert.equal(resBudget.data.outputTokens, 1024);

  // 2. query_graph_memory
  const resGraph = await dispatchSaanAction("query_graph_memory", {
    query: "computing",
    searchDepth: 1,
  });
  assert.equal(resGraph.success, true);
  assert.equal(resGraph.tier, 1);

  // 3. test_provider_cascade
  const resCascade = await dispatchSaanAction("test_provider_cascade", {
    primaryModel: "primary-model",
    fallbackModels: ["fallback-model-1"],
  });
  assert.equal(resCascade.success, true);
  assert.equal(resCascade.tier, 1);
  assert.equal(resCascade.data.fallbackTriggered, true);
});

test("RisuAI Extraction: DEFAULT_SAAN_GRAPH_NODES & Global Search", () => {
  assert.ok(DEFAULT_SAAN_GRAPH_NODES.length >= 6, "Must define at least 6 default Saan knowledge nodes");
  const store = getGraphMemoryStore();
  const allNodes = store.getAllNodes();
  assert.ok(allNodes.some((n) => n.name === "Krishna"));
  assert.ok(allNodes.some((n) => n.name === "Phryvos"));
  assert.ok(allNodes.some((n) => n.name === "Masala Chai"));

  // 1-hop search on Krishna should retrieve Krishna and its direct connections
  const searchResult = searchGlobalGraph("Krishna", 1);
  const matchedNames = searchResult.matchedNodes.map((n) => n.name);
  assert.ok(matchedNames.includes("Krishna"));
  assert.ok(matchedNames.includes("Phryvos"));
  assert.ok(matchedNames.includes("Masala Chai"));
});

test("RisuAI Extraction: Chat Variable Store Defaults & Dynamic Mutations", () => {
  const vars = globalChatVariables.getAll();
  assert.equal(vars.user, "Krishna");
  assert.equal(vars.char, "Saan");

  // Dynamic increment
  const startChai = Number(globalChatVariables.get("chai_count", 0));
  const nextChai = globalChatVariables.add("chai_count", 1);
  assert.equal(nextChai, startChai + 1);

  // Dynamic boolean toggle
  const prevFocus = Boolean(globalChatVariables.get("deep_focus_mode", false));
  const toggledFocus = globalChatVariables.toggle("deep_focus_mode");
  assert.equal(toggledFocus, !prevFocus);

  // Custom set
  globalChatVariables.set("custom_affinity_chip", "infinite_resonance");
  assert.equal(globalChatVariables.get("custom_affinity_chip"), "infinite_resonance");
});
