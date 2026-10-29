import test from "node:test";
import assert from "node:assert/strict";
import {
  GnosysMemoryPortabilityEngine,
  type GnosysMemoryFact,
  type GnosysMemoryEdge,
  type GnosysCoreMemoryBlocks,
  type GnosysSnapshotPayload,
} from "../../lib/saan/portable-memory-spec";

test("Repo 17: Gnosys & Dify Sovereign Portable Memory Specification", async (t) => {
  const sampleCore: GnosysCoreMemoryBlocks = {
    persona: "Saan is an attentive, empathetic companion who values deep focus.",
    human: "User is an autonomous systems engineer working in Linux environments.",
  };

  const sampleFacts: GnosysMemoryFact[] = [
    {
      id: "fact_1",
      category: "preference",
      fact: "User prefers hot adrak chai late at night",
      confidence: 0.95,
      validAt: "2026-10-20T10:00:00.000Z",
    },
    {
      id: "fact_2",
      category: "habit",
      fact: "User codes continuously during nighttime hours",
      confidence: 0.88,
      validAt: "2026-10-21T02:00:00.000Z",
    },
  ];

  const sampleEdges: GnosysMemoryEdge[] = [
    {
      source: "fact_1",
      target: "fact_2",
      relationship: "CORRELATES_WITH",
      weight: 0.85,
      validAt: "2026-10-21T02:05:00.000Z",
    },
  ];

  await t.test("computeChecksum produces canonical, order-independent SHA-256 hash", () => {
    const hashA = GnosysMemoryPortabilityEngine.computeChecksum(sampleCore, sampleFacts, sampleEdges);

    // Invert fact order to verify canonical sorting
    const invertedFacts = [sampleFacts[1], sampleFacts[0]];
    const hashB = GnosysMemoryPortabilityEngine.computeChecksum(sampleCore, invertedFacts, sampleEdges);

    assert.equal(hashA, hashB, "Checksums must match regardless of array ordering");
    assert.match(hashA, /^[a-f0-9]{64}$/, "Checksum must be a 64-char hex string");
  });

  await t.test("exportSnapshot serializes valid Gnosys v1.0 JSON-LD envelope", () => {
    const snapshot = GnosysMemoryPortabilityEngine.exportSnapshot({
      agentId: "saan-k7",
      coreMemory: sampleCore,
      facts: sampleFacts,
      edges: sampleEdges,
    });

    assert.equal(snapshot["@context"], "https://w3id.org/gnosys/v1");
    assert.equal(snapshot["@type"], "MemorySnapshot");
    assert.equal(snapshot.version, "1.0.0");
    assert.equal(snapshot.agentId, "saan-k7");
    assert.equal(snapshot.facts.length, 2);
    assert.equal(snapshot.edges.length, 1);
    assert.ok(snapshot.checksum);
  });

  await t.test("validateAndImport validates genuine snapshot and detects tampering", () => {
    const snapshot = GnosysMemoryPortabilityEngine.exportSnapshot({
      agentId: "saan-k7",
      coreMemory: sampleCore,
      facts: sampleFacts,
      edges: sampleEdges,
    });

    const validResult = GnosysMemoryPortabilityEngine.validateAndImport(snapshot);
    assert.equal(validResult.valid, true);
    assert.equal(validResult.factCount, 2);
    assert.equal(validResult.edgeCount, 1);

    // Tamper with fact text without updating checksum
    const tampered: GnosysSnapshotPayload = JSON.parse(JSON.stringify(snapshot));
    tampered.facts[0].fact = "TAMPERED: User drinks cold soda";

    const tamperedResult = GnosysMemoryPortabilityEngine.validateAndImport(tampered);
    assert.equal(tamperedResult.valid, false);
    assert.ok(tamperedResult.error?.includes("Checksum mismatch"));
  });

  await t.test("validateAndImport rejects invalid @context or malformed core memory", () => {
    const badContext = {
      "@context": "https://invalid-uri.org",
      "@type": "MemorySnapshot",
      coreMemory: sampleCore,
      facts: [],
      edges: [],
    };
    const resA = GnosysMemoryPortabilityEngine.validateAndImport(badContext as any);
    assert.equal(resA.valid, false);
    assert.ok(resA.error?.includes("Invalid @context"));

    const badCore = {
      "@context": "https://w3id.org/gnosys/v1",
      "@type": "MemorySnapshot",
      coreMemory: null,
      facts: [],
      edges: [],
    };
    const resB = GnosysMemoryPortabilityEngine.validateAndImport(badCore as any);
    assert.equal(resB.valid, false);
    assert.ok(resB.error?.includes("Malformed coreMemory"));
  });

  await t.test("toDifyDataset formats snapshot into Dify knowledge documents", () => {
    const snapshot = GnosysMemoryPortabilityEngine.exportSnapshot({
      agentId: "saan-k7",
      coreMemory: sampleCore,
      facts: sampleFacts,
      edges: sampleEdges,
    });

    const dify = GnosysMemoryPortabilityEngine.toDifyDataset(snapshot);
    assert.ok(dify.dataset_name.includes("Saan_Memory_saan-k7"));
    assert.equal(dify.documents.length, 4); // 2 core + 2 facts

    const personaDoc = dify.documents.find((d) => d.doc_type === "core_persona");
    assert.ok(personaDoc);
    assert.equal(personaDoc?.text, sampleCore.persona);

    const factDoc = dify.documents.find((d) => d.id === "dify_fact_fact_1");
    assert.ok(factDoc);
    assert.equal(factDoc?.text, sampleFacts[0].fact);
  });

  await t.test("mergeSnapshot executes UNION, OVERWRITE, and CONSERVATIVE strategies", () => {
    const existing = {
      coreMemory: sampleCore,
      facts: [sampleFacts[0]], // Only fact_1
      edges: [],
    };

    const incoming = GnosysMemoryPortabilityEngine.exportSnapshot({
      agentId: "incoming-agent",
      coreMemory: {
        persona: "Incoming persona override",
        human: "Incoming human override",
      },
      facts: [
        sampleFacts[0], // Duplicate of fact_1
        sampleFacts[1], // New fact_2 (conf 0.88)
        {
          id: "fact_3",
          category: "instruction",
          fact: "User likes concise responses",
          confidence: 0.95,
          validAt: "2026-10-22T00:00:00.000Z",
        },
      ],
      edges: sampleEdges,
    });

    // 1. UNION Strategy: adds fact_2 and fact_3, skips duplicate fact_1
    const unionRes = GnosysMemoryPortabilityEngine.mergeSnapshot(existing, incoming, "UNION");
    assert.equal(unionRes.result.importedFactsCount, 2);
    assert.equal(unionRes.result.skippedFactsCount, 1);
    assert.equal(unionRes.mergedFacts.length, 3);
    assert.equal(unionRes.mergedEdges.length, 1);

    // 2. OVERWRITE Strategy: replaces everything with incoming
    const overwriteRes = GnosysMemoryPortabilityEngine.mergeSnapshot(existing, incoming, "OVERWRITE");
    assert.equal(overwriteRes.result.importedFactsCount, 3);
    assert.equal(overwriteRes.mergedCoreMemory.persona, "Incoming persona override");

    // 3. CONSERVATIVE Strategy: only imports facts with confidence >= 0.90 (fact_3 only; fact_2 conf 0.88 is skipped)
    const consRes = GnosysMemoryPortabilityEngine.mergeSnapshot(existing, incoming, "CONSERVATIVE");
    assert.equal(consRes.result.importedFactsCount, 1); // Only fact_3
    assert.equal(consRes.result.skippedFactsCount, 2); // fact_1 (duplicate) + fact_2 (low confidence)
    assert.equal(consRes.mergedCoreMemory.persona, sampleCore.persona); // Unchanged
  });
});
