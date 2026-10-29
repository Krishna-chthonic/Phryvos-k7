import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  CognifyPipelineManager,
  getCognifyPipelineManager,
} from "../../lib/saan/cognify-pipeline";
import { getTemporalEdgeGraphStore } from "../../lib/saan/temporal-edge-graph";

describe("Repo 11: Cognee Cognify Multi-Stage Pipeline & Two-Phase Atomic Rollback", () => {
  test("disambiguateEntity resolves known aliases to canonical entities", () => {
    const manager = new CognifyPipelineManager();

    const d1 = manager.disambiguateEntity("adrak chai");
    assert.equal(d1.wasDisambiguated, true);
    assert.equal(d1.canonical, "Ginger Chai");

    const d2 = manager.disambiguateEntity("jaipur city");
    assert.equal(d2.wasDisambiguated, true);
    assert.equal(d2.canonical, "Jaipur");

    const d3 = manager.disambiguateEntity("krishna");
    assert.equal(d3.wasDisambiguated, true);
    assert.equal(d3.canonical, "User");

    const d4 = manager.disambiguateEntity("organic matcha");
    assert.equal(d4.wasDisambiguated, false);
    assert.equal(d4.canonical, "Organic Matcha");
  });

  test("cognifyText executes 5-stage pipeline on happy path", async () => {
    const manager = new CognifyPipelineManager();
    const text = "User drinks strong adrak chai in the morning and prepares for exams in Jaipur.";

    const report = await manager.cognifyText(text);

    assert.equal(report.status, "completed");
    assert.ok(report.totalDurationMs >= 0);
    assert.equal(report.stages.length, 5);

    assert.equal(report.stages[0].stageName, "Ingestion & Normalization");
    assert.equal(report.stages[0].status, "completed");

    assert.equal(report.stages[1].stageName, "Semantic Chunking");
    assert.equal(report.stages[1].status, "completed");

    assert.equal(report.stages[2].stageName, "Entity Extraction");
    assert.equal(report.stages[2].status, "completed");

    assert.equal(report.stages[3].stageName, "Entity Disambiguation");
    assert.equal(report.stages[3].status, "completed");

    assert.equal(report.stages[4].stageName, "Graph Topology Construction");
    assert.equal(report.stages[4].status, "completed");

    // Disambiguation must have caught adrak chai
    assert.ok(report.disambiguatedEntities.length > 0);
    const hasAdrak = report.disambiguatedEntities.some(
      (d) => d.alias === "Ginger Chai" || d.canonical === "Ginger Chai"
    );
    assert.ok(hasAdrak);
  });

  test("two-phase rollback cleanly aborts and reverts when stage fails", async () => {
    const manager = new CognifyPipelineManager();
    const text = "User is travelling to Bengaluru for research.";

    const report = await manager.cognifyText(text, { simulateFailureStage: "disambiguate" });

    assert.equal(report.status, "rolled_back");
    assert.ok(report.error?.includes("Cognee Rollback Trigger"));

    // Last recorded stage must be Atomic Rollback
    const lastStage = report.stages[report.stages.length - 1];
    assert.equal(lastStage.stageName, "Atomic Rollback");
    assert.equal(lastStage.status, "rolled_back");
  });

  test("two-phase rollback invalidates provisional graph edges", async () => {
    const manager = new CognifyPipelineManager();
    const text = "User enjoys afternoon coffee in Jaipur.";

    const report = await manager.cognifyText(text, { simulateFailureStage: "topology" });

    assert.equal(report.status, "rolled_back");
    // Any edges that were staged must be invalidated
    const graphStore = getTemporalEdgeGraphStore();
    for (const edgeId of report.createdEdgeIds) {
      const edge = graphStore.getEdge(edgeId);
      if (edge) {
        assert.ok(edge.invalidAt);
      }
    }
  });

  test("executePipeline wrapper maintains backward compatibility with custom rollback handlers", async () => {
    const manager = new CognifyPipelineManager();
    let rollbackCalled = false;

    const res = await manager.executePipeline(
      "test_run_fail",
      [
        {
          name: "provisional_step",
          run: async () => ({ nodeIds: ["temp_node_1"], edgeIds: ["temp_edge_1"] }),
        },
        {
          name: "failing_step",
          run: async () => {
            throw new Error("Mid-pipeline network disconnect");
          },
        },
      ],
      async (artifacts) => {
        rollbackCalled = true;
        assert.equal(artifacts.createdNodeIds[0], "temp_node_1");
      }
    );

    assert.equal(res.success, false);
    assert.equal(res.artifacts.status, "rolled_back");
    assert.equal(rollbackCalled, true);
  });

  test("history records execution runs up to MAX_HISTORY limit", () => {
    const manager = new CognifyPipelineManager();
    const history = manager.getHistory();
    assert.ok(Array.isArray(history));
    assert.ok(history.length >= 1);
  });
});
