import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  TemporalEdgeGraphStore,
  extractTripleFromFact,
  type TemporalEntityEdge,
} from "../../lib/saan/temporal-edge-graph";

describe("Repo 10: Graphiti Bi-Temporal Knowledge Graph & Contradiction Resolution", () => {
  test("extractTripleFromFact extracts Subject-Predicate-Object triples correctly", () => {
    const t1 = extractTripleFromFact("User prefers ginger tea", "user");
    assert.ok(t1);
    assert.equal(t1.sourceNode, "User");
    assert.equal(t1.relation, "PREFERS");
    assert.equal(t1.targetNode, "Ginger tea");

    const t2 = extractTripleFromFact("User lives in Jaipur", "user");
    assert.ok(t2);
    assert.equal(t2.sourceNode, "User");
    assert.equal(t2.relation, "LIVES_IN");
    assert.equal(t2.targetNode, "Jaipur");

    const t3 = extractTripleFromFact("works as software engineer", "user");
    assert.ok(t3);
    assert.equal(t3.sourceNode, "User");
    assert.equal(t3.relation, "OCCUPATION");
    assert.equal(t3.targetNode, "Software engineer");

    const t4 = extractTripleFromFact("Saan is devoted companion to User", "assistant");
    assert.ok(t4);
    assert.equal(t4.relation, "RELATES_TO");
  });

  test("addEdge creates bi-temporal edges with validAt and referenceTime", () => {
    const store = new TemporalEdgeGraphStore([]);
    const now = 1700000000000;

    const res = store.addEdge({
      sourceNode: "User",
      targetNode: "Deep Work",
      relation: "SCHEDULE",
      fact: "User works deeply in afternoons",
      validAt: now,
      referenceTime: now,
      episodes: ["turn_1"],
    });

    assert.ok(res.edge.id);
    assert.equal(res.edge.sourceNode, "User");
    assert.equal(res.edge.targetNode, "Deep Work");
    assert.equal(res.edge.relation, "SCHEDULE");
    assert.equal(res.edge.validAt, now);
    assert.equal(res.edge.invalidAt, undefined);
    assert.equal(res.supersededEdgeIds.length, 0);
  });

  test("contradictory edge invalidates predecessor without hard deletion", () => {
    const store = new TemporalEdgeGraphStore([]);
    const t0 = 1700000000000;
    const t1 = 1700086400000;

    const edge1 = store.addEdge({
      sourceNode: "User",
      targetNode: "City",
      relation: "LIVES_IN",
      fact: "User lives in Jaipur",
      validAt: t0,
      referenceTime: t0,
      episodes: ["turn_1"],
    });

    const edge2 = store.addEdge({
      sourceNode: "User",
      targetNode: "City",
      relation: "LIVES_IN",
      fact: "User moved to Bengaluru",
      validAt: t1,
      referenceTime: t1,
      episodes: ["turn_2"],
    });

    // edge1 must have been superseded
    assert.equal(edge2.supersededEdgeIds.length, 1);
    assert.equal(edge2.supersededEdgeIds[0], edge1.edge.id);

    const oldEdge = store.getEdge(edge1.edge.id);
    assert.ok(oldEdge);
    assert.equal(oldEdge.invalidAt, t1);
    assert.ok(oldEdge.expiredAt);

    // Both edges must still exist in memory (forensic audit intact)
    assert.equal(store.getAllEdges().length, 2);
  });

  test("getActiveEdgesAsOf performs point-in-time state reconstruction", () => {
    const store = new TemporalEdgeGraphStore([]);
    const t0 = 1700000000000;
    const t1 = 1700086400000;
    const t2 = 1700172800000;

    const edge1 = store.addEdge({
      sourceNode: "User",
      targetNode: "City",
      relation: "LIVES_IN",
      fact: "User lives in Jaipur",
      validAt: t0,
      referenceTime: t0,
      episodes: ["turn_1"],
    });

    store.addEdge({
      sourceNode: "User",
      targetNode: "City",
      relation: "LIVES_IN",
      fact: "User lives in Bengaluru",
      validAt: t1,
      referenceTime: t1,
      episodes: ["turn_2"],
    });

    // At past point t0 + 1 hour: only edge1 is active
    const activeAtPast = store.getActiveEdgesAsOf(t0 + 3600000);
    assert.equal(activeAtPast.length, 1);
    assert.equal(activeAtPast[0].id, edge1.edge.id);
    assert.equal(activeAtPast[0].fact, "User lives in Jaipur");

    // At present point t2: only edge2 is active
    const activeAtPresent = store.getActiveEdgesAsOf(t2);
    assert.equal(activeAtPresent.length, 1);
    assert.equal(activeAtPresent[0].fact, "User lives in Bengaluru");
  });

  test("findConnectedEdges finds 1-hop connected edges for given entity", () => {
    const store = new TemporalEdgeGraphStore([]);
    const now = Date.now();

    store.addEdge({
      sourceNode: "Saan",
      targetNode: "User",
      relation: "COMPANION_OF",
      fact: "Saan is devoted companion",
      validAt: now,
      referenceTime: now,
      episodes: ["ep1"],
    });

    store.addEdge({
      sourceNode: "User",
      targetNode: "Chai",
      relation: "DRINKS",
      fact: "User drinks Chai",
      validAt: now,
      referenceTime: now,
      episodes: ["ep2"],
    });

    const userEdges = store.findConnectedEdges("User", now);
    assert.equal(userEdges.length, 2);

    const chaiEdges = store.findConnectedEdges("Chai", now);
    assert.equal(chaiEdges.length, 1);
    assert.equal(chaiEdges[0].relation, "DRINKS");
  });

  test("getSnapshot formats full snapshot with node categories and edge statistics", () => {
    const store = new TemporalEdgeGraphStore([]);
    const now = Date.now();

    store.addEdge({
      sourceNode: "Saan",
      targetNode: "User",
      relation: "BOND",
      fact: "Saan and User share bond",
      validAt: now,
      referenceTime: now,
      episodes: [],
    });

    store.addEdge({
      sourceNode: "User",
      targetNode: "Jaipur",
      relation: "VISITED",
      fact: "User visited Jaipur",
      validAt: now,
      referenceTime: now,
      episodes: [],
    });

    const snap = store.getSnapshot();
    assert.equal(snap.stats.totalNodes, 3);
    assert.equal(snap.stats.totalEdges, 2);
    assert.equal(snap.stats.activeEdges, 2);
    assert.equal(snap.stats.supersededEdges, 0);

    const userNode = snap.nodes.find((n) => n.label === "User");
    assert.ok(userNode);
    assert.equal(userNode.type, "user");
    assert.equal(userNode.degree, 2);
  });
});
