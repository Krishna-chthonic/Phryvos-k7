/**
 * Memory Suite Extraction & Cognitive Capabilities Tests (Repos 9 to 13)
 *
 * Verifies clean-room adaptations of:
 * 1. mem0ai/mem0 (Repo 9): 4-state decision matrix, identity scope sanitizer, audit stream
 * 2. letta-ai/letta (Repo 10): 3-tier memory paging, core memory append/replace tools, character ceilings
 * 3. getzep/graphiti (Repo 11): Bi-temporal knowledge graph edges, non-destructive contradiction resolution
 * 4. topoteretes/cognee (Repo 12): Multi-stage Cognify pipeline with two-phase atomic rollback
 * 5. vectorize-io/hindsight (Repo 13): Relative date interval bounding, knapsack budgeting, and top-rank floor rule
 * 6. Controller: Sovereign action dispatching
 */

import test from "node:test";
import assert from "node:assert/strict";
import { evaluateMem0Decision, sanitizeIdentityScope } from "../../lib/saan/mem0-decision-matrix";
import { CoreMemoryManager } from "../../lib/saan/core-memory-blocks";
import { TemporalEdgeGraphStore } from "../../lib/saan/temporal-edge-graph";
import { CognifyPipelineManager } from "../../lib/saan/cognify-pipeline";
import { parseTemporalQueryBounds, selectFactsWithinBudget, CausalMemoryRegistry } from "../../lib/saan/temporal-query-engine";
import { dispatchSaanAction } from "../../lib/saan/controller";

// 1. Mem0 Tests (Repo 9)
test("Mem0: 4-State Decision Matrix evaluates novel fact as ADD", () => {
  const existing = [
    { id: "m1", text: "User works as a backend engineer", category: "professional", updatedAt: Date.now(), isActive: true },
  ];
  const candidate = {
    text: "User loves dark roast coffee",
    category: "preference" as const,
    sourceRole: "user" as const,
  };

  const decision = evaluateMem0Decision(candidate, existing);
  assert.equal(decision.event, "ADD");
});

test("Mem0: 4-State Decision Matrix evaluates refinement as UPDATE", () => {
  const existing = [
    { id: "m1", text: "User works as a software engineer at Google", category: "professional", updatedAt: Date.now(), isActive: true },
  ];
  const candidate = {
    text: "User is a staff software engineer at Google",
    category: "professional" as const,
    sourceRole: "user" as const,
  };

  const decision = evaluateMem0Decision(candidate, existing);
  assert.equal(decision.event, "UPDATE");
  assert.equal(decision.targetId, "m1");
});

test("Mem0: 4-State Decision Matrix evaluates negation as DELETE", () => {
  const existing = [
    { id: "m1", text: "User lives in New York City", category: "personal", updatedAt: Date.now(), isActive: true },
  ];
  const candidate = {
    text: "User no longer lives in New York City, moved away",
    category: "personal" as const,
    sourceRole: "user" as const,
  };

  const decision = evaluateMem0Decision(candidate, existing);
  assert.equal(decision.event, "DELETE");
  assert.equal(decision.targetId, "m1");
});

test("Mem0: Identity scope sanitizer prevents user metadata injection", () => {
  const { scopeFilters, sanitizedMetadata } = sanitizeIdentityScope({
    userId: "krishna",
    agentId: "saan",
    inputMetadata: {
      userId: "hacker_override", // attempted injection
      agentId: "evil_agent",    // attempted injection
      theme: "dark_mode",       // legitimate freeform metadata
    },
  });

  assert.equal(scopeFilters.userId, "krishna");
  assert.equal(scopeFilters.agentId, "saan");
  assert.equal(sanitizedMetadata.userId, undefined, "Protected userId must be stripped from inputMetadata");
  assert.equal(sanitizedMetadata.agentId, undefined, "Protected agentId must be stripped from inputMetadata");
  assert.equal(sanitizedMetadata.theme, "dark_mode");
});

// 2. Letta Tests (Repo 10)
test("Letta: Core Memory Blocks initialize human and persona sections and format for prompt", () => {
  const manager = new CoreMemoryManager();
  const human = manager.getBlock("human");
  const persona = manager.getBlock("persona");

  assert.ok(human && human.content.includes("Krishna"));
  assert.ok(persona && persona.content.includes("Saan"));

  const rendered = manager.renderForSystemPrompt();
  assert.ok(rendered.includes("<core_memory>"));
  assert.ok(rendered.includes("<human_profile>"));
  assert.ok(rendered.includes("<persona_identity>"));
});

test("Letta: Core Memory self-editing tools (append & replace) with character limits", () => {
  const manager = new CoreMemoryManager({ maxCharactersPerBlock: 300 });

  // Append
  const appendRes = manager.append("human", "Goal: Master quantum systems.");
  assert.equal(appendRes.success, true);
  assert.ok(manager.getBlock("human")?.content.includes("Master quantum systems"));

  // Replace
  const replaceRes = manager.replace("human", "Master quantum systems", "Build sovereign companion");
  assert.equal(replaceRes.success, true);
  assert.ok(manager.getBlock("human")?.content.includes("Build sovereign companion"));

  // Reject oversized append
  const oversized = "X".repeat(500);
  const rejectRes = manager.append("human", oversized);
  assert.equal(rejectRes.success, false);
});

// 3. Graphiti Tests (Repo 11)
test("Graphiti: Bi-temporal knowledge graph edges record validAt and referenceTime", () => {
  const store = new TemporalEdgeGraphStore();
  const now = Date.now();

  const { edge } = store.addEdge({
    sourceNode: "Krishna",
    targetNode: "Phryvos",
    relation: "DEVELOPING",
    fact: "Krishna is actively developing Phryvos companion core",
    validAt: now,
    referenceTime: now,
    episodes: ["ep_turn_1"],
  });

  assert.equal(edge.relation, "DEVELOPING");
  assert.equal(edge.validAt, now);
  assert.equal(edge.invalidAt, undefined);
});

test("Graphiti: Temporal contradiction invalidates predecessor edge non-destructively", () => {
  const store = new TemporalEdgeGraphStore();
  const t1 = Date.now() - 100000;
  const t2 = Date.now();

  // Edge 1: Works at Company A
  const { edge: edge1 } = store.addEdge({
    sourceNode: "Krishna",
    targetNode: "CompanyA",
    relation: "EMPLOYED_BY",
    fact: "Krishna works as an engineer at CompanyA",
    validAt: t1,
    referenceTime: t1,
    episodes: ["ep_1"],
  });

  // Edge 2: New contradicting fact
  const { edge: edge2, supersededEdgeIds } = store.addEdge({
    sourceNode: "Krishna",
    targetNode: "CompanyA",
    relation: "EMPLOYED_BY",
    fact: "Krishna resigned and no longer works at CompanyA",
    validAt: t2,
    referenceTime: t2,
    episodes: ["ep_2"],
  });

  assert.ok(supersededEdgeIds.includes(edge1.id));
  const fetchedEdge1 = store.getEdge(edge1.id);
  assert.ok(fetchedEdge1?.invalidAt !== undefined, "Predecessor edge must have invalidAt set");
  assert.ok(fetchedEdge1?.expiredAt !== undefined, "Predecessor edge must have expiredAt set");

  // Query asOf t1: edge1 should be active
  const activeAtT1 = store.getActiveEdgesAsOf(t1);
  assert.ok(activeAtT1.some((e) => e.id === edge1.id));

  // Query asOf t2 + 10: edge1 should NOT be active
  const activeAtT2 = store.getActiveEdgesAsOf(t2 + 10);
  assert.ok(!activeAtT2.some((e) => e.id === edge1.id));
  assert.ok(activeAtT2.some((e) => e.id === edge2.id));
});

// 4. Cognee Tests (Repo 12)
test("Cognee: Cognify pipeline executes stages and rolls back atomically on failure", async () => {
  const pipeline = new CognifyPipelineManager();
  const runId = "test_run_cognify_1";

  let rollbackCalled = false;
  let rolledBackNodeCount = 0;

  const result = await pipeline.executePipeline(
    runId,
    [
      {
        name: "entity_stage",
        run: async () => ({ nodeIds: ["node_1", "node_2"], edgeIds: [] }),
      },
      {
        name: "faulty_graph_stage",
        run: async () => {
          throw new Error("Simulated Neo4j network timeout midway through pipeline");
        },
      },
    ],
    async (artifacts) => {
      rollbackCalled = true;
      rolledBackNodeCount = artifacts.createdNodeIds.length;
    }
  );

  assert.equal(result.success, false);
  assert.equal(rollbackCalled, true);
  assert.equal(rolledBackNodeCount, 2);
  assert.equal(result.artifacts.status, "rolled_back");
});

// 5. Hindsight Tests (Repo 13)
test("Hindsight: Temporal query parser normalizes relative date references", () => {
  const refTime = new Date("2026-10-28T12:00:00Z");

  const todayRes = parseTemporalQueryBounds("What did we do today?", refTime);
  assert.equal(todayRes.hasConstraint, true);
  assert.equal(todayRes.matchedPhrase, "today");

  const yesterdayRes = parseTemporalQueryBounds("Did I study yesterday?", refTime);
  assert.equal(yesterdayRes.hasConstraint, true);
  assert.equal(yesterdayRes.matchedPhrase, "yesterday");

  const lastWeekRes = parseTemporalQueryBounds("Summary of last week notes", refTime);
  assert.equal(lastWeekRes.hasConstraint, true);
  assert.equal(lastWeekRes.matchedPhrase, "last week");

  const noTemporal = parseTemporalQueryBounds("Tell me about photosynthesis", refTime);
  assert.equal(noTemporal.hasConstraint, false);
});

test("Hindsight: Knapsack Fact Budgeting & Top-Rank Floor Rule", () => {
  const factIds = ["fact_1", "fact_2", "fact_3"];
  const textById = {
    fact_1: "Fact 1 is moderate length statement.", // ~8 tokens
    fact_2: "Fact 2 is an extremely long detailed explanation with multiple paragraphs that should exceed small headroom.", // ~25 tokens
    fact_3: "Fact 3 short.", // ~4 tokens
  };

  // Case A: Knapsack non-blocking skip
  // Budget = 15 tokens. Fact 1 (8) fits, Fact 2 (25) skips, Fact 3 (4) fits behind it!
  const resKnapsack = selectFactsWithinBudget(factIds, textById, 15);
  assert.deepEqual(resKnapsack.selectedIds, ["fact_1", "fact_3"]);
  assert.equal(resKnapsack.truncated, true);
  assert.equal(resKnapsack.floorApplied, false);

  // Case B: Top-Rank Floor Rule
  // Budget = 2 tokens. All facts (10, 28, 4) individually exceed 2 tokens. Floor rule forces top Fact 1 to return over budget!
  const resFloor = selectFactsWithinBudget(factIds, textById, 2);
  assert.deepEqual(resFloor.selectedIds, ["fact_1"]);
  assert.equal(resFloor.floorApplied, true);
  assert.ok(resFloor.totalTokens > 2);
});

// 6. Sovereign Controller Actions Test
test("Controller: Dispatches Memory Suite Tier 1 actions", async () => {
  // apply_mem0_decision
  const resMem0 = await dispatchSaanAction("apply_mem0_decision", {
    candidate: { text: "I enjoy playing chess", category: "preference", sourceRole: "user" },
    existingMemories: [],
  });
  assert.equal(resMem0.success, true);
  assert.equal(resMem0.tier, 1);
  assert.equal(resMem0.data.event, "ADD");

  // edit_core_memory
  const resEdit = await dispatchSaanAction("edit_core_memory", {
    operation: "append",
    block: "human",
    content: "Current focus: Cognitive architectures.",
  });
  assert.equal(resEdit.success, true);
  assert.equal(resEdit.tier, 1);

  // parse_temporal_query
  const resTime = await dispatchSaanAction("parse_temporal_query", {
    query: "What did we talk about yesterday?",
  });
  assert.equal(resTime.success, true);
  assert.equal(resTime.tier, 1);
  assert.equal(resTime.data.hasConstraint, true);
});
