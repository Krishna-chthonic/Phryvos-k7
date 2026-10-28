import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  VaultBackupEngine,
} from "../../lib/saan/vault-backup-engine";

import {
  ComposerDraftBus,
} from "../../lib/saan/composer-draft-bus";

import {
  DocumentCollector,
} from "../../lib/saan/document-collector-vault";

import {
  MemoryBenchmarkHarness,
  BiTemporalCalculus,
  Mem0PromptBuilder,
  type TemporalEdge,
  type ProbeRecord,
} from "../../lib/saan/memory-benchmark-bitemporal";

import {
  dispatchSaanAction,
} from "../../lib/saan/controller";

describe("Category 6 & 7 Capstone: Vault Persistence, Benchmarks & Temporal Calculus (Repos 44-50)", () => {
  // ==========================================
  // REPO 44: Chatbox Sovereign Vault Backup
  // ==========================================
  describe("Repo 44: Chatbox Sovereign Vault Backup & Deduplication", () => {
    test("Packages memories, tasks and deduplicates identical resources by checksum", () => {
      const engine = new VaultBackupEngine();
      const sharedContent = "console.log('shared tool script');";

      const pkg = engine.packageBackup({
        memories: [{ id: 1, content: "User likes green tea" }],
        tasks: [{ id: 1, title: "Review thesis draft" }],
        rawResources: [
          { filename: "tool-session1.js", mimeType: "application/javascript", content: sharedContent },
          { filename: "tool-session2.js", mimeType: "application/javascript", content: sharedContent },
          { filename: "notes.txt", mimeType: "text/plain", content: "Unique notes content" },
        ],
      });

      assert.equal(pkg.manifest.format, "phryvos-vault-backup");
      assert.equal(pkg.manifest.stats.memoryCount, 1);
      assert.equal(pkg.manifest.stats.taskCount, 1);
      assert.equal(pkg.manifest.stats.resourceCount, 2, "Duplicate resource must be deduplicated into 1 entry");
      assert.equal(pkg.manifest.stats.deduplicatedCount, 1);

      const verification = engine.verifyBackup(pkg);
      assert.equal(verification.valid, true);
      assert.equal(verification.errors.length, 0);
    });

    test("Detects corrupted or tampered backup data via checksum mismatch", () => {
      const engine = new VaultBackupEngine();
      const pkg = engine.packageBackup({
        memories: [{ id: 1, content: "Original memory" }],
      });

      // Tamper with data
      pkg.data.memories.push({ id: 2, content: "Tampered injection" });

      const verification = engine.verifyBackup(pkg);
      assert.equal(verification.valid, false);
      assert.ok(verification.errors.some(e => e.includes("checksum mismatch")));
    });
  });

  // ==========================================
  // REPO 45: LobeHub Composer Draft Bus & Intent Classifier
  // ==========================================
  describe("Repo 45: LobeHub Composer Draft Bus & Intent Classification", () => {
    test("Transfers drafts out-of-tree to the main conversation composer", () => {
      const bus = new ComposerDraftBus();
      assert.equal(bus.hasDraft(), false);

      const success = bus.postDraft("Please analyze my research paper", { append: true });
      assert.equal(success, true);
      assert.equal(bus.hasDraft(), true);

      const draft = bus.consumeDraft();
      assert.ok(draft);
      assert.equal(draft.text, "Please analyze my research paper");
      assert.equal(draft.append, true);
      assert.equal(bus.hasDraft(), false, "Consumed draft must be cleared");
    });

    test("Classifies companion memories vs ephemeral execution skills", () => {
      const bus = new ComposerDraftBus();

      const r1 = bus.classifyIntent("Remember my morning tea preference and companion habit");
      assert.equal(r1.intent, "companion_memory");
      assert.ok(r1.confidence >= 0.5);

      const r2 = bus.classifyIntent("Create a reusable CSV validator workflow and template checklist");
      assert.equal(r2.intent, "ephemeral_skill");
      assert.ok(r2.confidence >= 0.5);
    });
  });

  // ==========================================
  // REPO 46: Anything-LLM Document Ingestion
  // ==========================================
  describe("Repo 46: Anything-LLM Document Collector & Semantic Chunking", () => {
    test("Sanitizes metadata keys and avoids 1970 epoch fallback bug", () => {
      const collector = new DocumentCollector();
      const now = new Date().toISOString().slice(0, 10);

      // Falsy published value must not resolve to 1970-01-01
      const date1 = collector.normalizePublishedDate(null);
      assert.ok(date1.startsWith(now));

      const date2 = collector.normalizePublishedDate("");
      assert.ok(date2.startsWith(now));

      // Valid timestamp in ms
      const validEpochMs = 1730000000000;
      const date3 = collector.normalizePublishedDate(validEpochMs);
      assert.ok(date3.startsWith("2024"));
    });

    test("Chunks text along paragraph boundaries and computes token estimates", () => {
      const collector = new DocumentCollector();
      const content = `
        Paragraph 1 describes sovereign agent memory networks.
        
        Paragraph 2 expands on SQLite vector indexing.
        
        Paragraph 3 covers bi-temporal intervals.
      `;

      const doc = collector.processRawText(content, {
        title: "Sovereign Architecture Notes",
        docAuthor: "Krishna",
      }, { maxChunkWords: 15 });

      assert.equal(doc.title, "Sovereign Architecture Notes");
      assert.equal(doc.docAuthor, "Krishna");
      assert.ok(doc.chunks.length >= 2, "Should chunk across paragraphs when word limit is reached");
      assert.ok(doc.tokenCountEstimate > 0);
    });
  });

  // ==========================================
  // REPOS 47 & 48: Memory Recall & Cognitive Latency Benchmarks
  // ==========================================
  describe("Repos 47 & 48: Memory Benchmarks & Sub-10ms Latency Target", () => {
    test("Calculates recall rate, adversarial refusal rate, and p50 latency", () => {
      const harness = new MemoryBenchmarkHarness();

      // 4 answerable probes (3 correct, 1 wrong)
      harness.addProbe({ id: "p1", question: "q1", gold: "g1", answer: "g1", correct: true, adversarial: false, abstained: false, searchLatencyMs: 3.2 });
      harness.addProbe({ id: "p2", question: "q2", gold: "g2", answer: "g2", correct: true, adversarial: false, abstained: false, searchLatencyMs: 4.1 });
      harness.addProbe({ id: "p3", question: "q3", gold: "g3", answer: "g3", correct: true, adversarial: false, abstained: false, searchLatencyMs: 2.8 });
      harness.addProbe({ id: "p4", question: "q4", gold: "g4", answer: "wrong", correct: false, adversarial: false, abstained: false, searchLatencyMs: 5.0 });

      // 2 adversarial probes (both correctly abstained)
      harness.addProbe({ id: "p5", question: "adv1", gold: "none", answer: "I do not know", correct: false, adversarial: true, abstained: true, searchLatencyMs: 2.1 });
      harness.addProbe({ id: "p6", question: "adv2", gold: "none", answer: "I do not recall", correct: false, adversarial: true, abstained: true, searchLatencyMs: 3.5 });

      const summary = harness.getSummary();

      assert.equal(summary.totalProbes, 6);
      assert.equal(summary.answerableCount, 4);
      assert.equal(summary.correctCount, 3);
      assert.equal(summary.recallPercent, 75.0); // 3 / 4 = 75%
      assert.equal(summary.adversarialCount, 2);
      assert.equal(summary.adversarialAbstainedCount, 2);
      assert.equal(summary.refusedAdversarialPercent, 100.0); // 2 / 2 = 100%
      assert.equal(summary.hallucinatedCount, 0);
      assert.ok(summary.searchLatencyP50Ms < 10.0, "Sub-10ms target must be met");
      assert.equal(summary.sub10msTargetMet, true);
    });
  });

  // ==========================================
  // REPO 49: Mem0 Structured Extraction Prompts
  // ==========================================
  describe("Repo 49: Mem0 Structured Additive Extraction Prompts", () => {
    test("Builds structured prompt with observation dates and Hinglish requirements", () => {
      const builder = new Mem0PromptBuilder();
      const prompt = builder.buildAdditivePrompt({
        summary: "User prefers morning walks and chai.",
        lastKMessages: [
          { role: "user", content: "Ajj ka din kaisa raha?" },
          { role: "assistant", content: "Sab badhiya! Ready to help you." },
        ],
        existingMemories: ["User drinks ginger tea in morning"],
        currentDate: "2026-10-28",
        preserveHinglishStyle: true,
      });

      assert.ok(prompt.includes("## Summary"));
      assert.ok(prompt.includes("## Last k Messages"));
      assert.ok(prompt.includes("Ajj ka din kaisa raha?"));
      assert.ok(prompt.includes("## Existing Memories"));
      assert.ok(prompt.includes("## Current Date\n2026-10-28"));
      assert.ok(prompt.includes("Language Requirement"));
      assert.ok(prompt.includes("Hinglish"));
    });
  });

  // ==========================================
  // REPO 50: Graphiti Bi-Temporal Interval Calculus
  // ==========================================
  describe("Repo 50: Graphiti Bi-Temporal Interval Validity Calculus", () => {
    test("Enforces interval validity rule valid_at <= t < invalid_at", () => {
      const calculus = new BiTemporalCalculus();
      const edge: TemporalEdge = {
        id: "e1",
        source: "user",
        target: "city:sf",
        relation: "lives_in",
        fact: "User lives in San Francisco",
        validAtMs: 1000,
        invalidAtMs: 5000,
        referenceTimeMs: 1000,
        createdAtMs: 1000,
      };

      assert.equal(calculus.isEdgeValidAt(edge, 500), false, "t < valid_at is invalid");
      assert.equal(calculus.isEdgeValidAt(edge, 1000), true, "t == valid_at is valid");
      assert.equal(calculus.isEdgeValidAt(edge, 3000), true, "valid_at < t < invalid_at is valid");
      assert.equal(calculus.isEdgeValidAt(edge, 5000), false, "t >= invalid_at is invalid");
      assert.equal(calculus.isEdgeValidAt(edge, 7000), false, "t > invalid_at is invalid");
    });

    test("Supersedes outdated relation when user state updates", () => {
      const calculus = new BiTemporalCalculus();
      const oldEdge: TemporalEdge = {
        id: "e1",
        source: "user",
        target: "company:acme",
        relation: "works_at",
        fact: "User works at Acme Corp",
        validAtMs: 1000,
        referenceTimeMs: 1000,
        createdAtMs: 1000,
      };

      // User moves to Phryvos at t=2000
      const { invalidatedEdge, newEdge } = calculus.supersedeEdge(oldEdge, {
        fact: "User works at Phryvos Labs",
        validAtMs: 2000,
      });

      assert.equal(invalidatedEdge.invalidAtMs, 2000, "Old edge must be invalidated at t=2000");
      assert.equal(newEdge.validAtMs, 2000, "New edge must be valid from t=2000");
      assert.equal(newEdge.fact, "User works at Phryvos Labs");

      // Historical query at t=1500
      assert.equal(calculus.isEdgeValidAt(invalidatedEdge, 1500), true, "At t=1500, old job was active");
      assert.equal(calculus.isEdgeValidAt(newEdge, 1500), false, "At t=1500, new job was not yet started");

      // Current query at t=2500
      assert.equal(calculus.isEdgeValidAt(invalidatedEdge, 2500), false, "At t=2500, old job is defunct");
      assert.equal(calculus.isEdgeValidAt(newEdge, 2500), true, "At t=2500, new job is active");
    });
  });

  // ==========================================
  // CONTROLLER INTEGRATION
  // ==========================================
  describe("Controller Action Dispatch Integration", () => {
    test("Dispatches package_vault_backup action", async () => {
      const res = await dispatchSaanAction("package_vault_backup", {
        input: {
          memories: [{ id: 10, content: "Sovereign memory" }],
          tasks: [{ id: 20, title: "Sovereign task" }],
        },
      });

      assert.equal(res.success, true);
      assert.equal(res.tier, 1);
      assert.equal(res.data.package.manifest.stats.memoryCount, 1);
      assert.equal(res.data.verification.valid, true);
    });

    test("Dispatches queue_composer_draft action", async () => {
      const res = await dispatchSaanAction("queue_composer_draft", {
        text: "Remember I love morning walks in the park",
        append: false,
      });

      assert.equal(res.success, true);
      assert.equal(res.data.posted, true);
      assert.equal(res.data.classification.intent, "companion_memory");
    });

    test("Dispatches process_vault_document action", async () => {
      const res = await dispatchSaanAction("process_vault_document", {
        textContent: "Chapter 1: Sovereign AI.\n\nChapter 2: Cryptographic Vaults.",
        metadata: { title: "Architecture Book", docAuthor: "Saan Team" },
        maxChunkWords: 3,
      });

      assert.equal(res.success, true);
      assert.equal(res.data.docAuthor, "Saan Team");
      assert.ok(res.data.chunks.length >= 2);
    });

    test("Dispatches run_memory_benchmark_evaluation action", async () => {
      const res = await dispatchSaanAction("run_memory_benchmark_evaluation", {
        probes: [
          { id: "1", question: "q", gold: "a", answer: "a", correct: true, adversarial: false, abstained: false, searchLatencyMs: 3.0 },
          { id: "2", question: "q", gold: "none", answer: "no", correct: false, adversarial: true, abstained: true, searchLatencyMs: 2.5 },
        ],
      });

      assert.equal(res.success, true);
      assert.equal(res.data.recallPercent, 100);
      assert.equal(res.data.sub10msTargetMet, true);
    });

    test("Dispatches evaluate_bitemporal_validity action", async () => {
      const res = await dispatchSaanAction("evaluate_bitemporal_validity", {
        edges: [
          { id: "e1", source: "u", target: "c", relation: "in", fact: "fact 1", validAtMs: 1000, invalidAtMs: 3000, referenceTimeMs: 1000, createdAtMs: 1000 },
          { id: "e2", source: "u", target: "c", relation: "in", fact: "fact 2", validAtMs: 3000, referenceTimeMs: 3000, createdAtMs: 3000 },
        ],
        queryTimeMs: 2000,
      });

      assert.equal(res.success, true);
      assert.equal(res.data.validEdges.length, 1);
      assert.equal(res.data.validEdges[0].id, "e1");
    });
  });
});
