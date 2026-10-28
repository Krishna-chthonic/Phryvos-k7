import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  VaultBackupEngine,
  BACKUP_FORMAT,
  type BackupManifest,
} from "../../lib/saan/vault-backup-engine";

import {
  ComposerDraftBus,
  QUERY_RULES,
} from "../../lib/saan/composer-draft-bus";

import {
  DocumentCollector,
} from "../../lib/saan/document-collector-vault";

import {
  MemoryBenchmarkHarness,
  BiTemporalCalculus,
  Mem0PromptBuilder,
  type TemporalEdge,
} from "../../lib/saan/memory-benchmark-bitemporal";

describe("Maximum Capability Extraction Verification (Repos 44-50)", () => {
  // ==========================================
  // REPO 44: Chatbox Maximum Capability
  // ==========================================
  describe("Repo 44: Chatbox Deep Manifest Validation, Sanitization & Conflict Restore", () => {
    test("Validates manifest graph and detects duplicate session IDs and illegal scope", () => {
      const engine = new VaultBackupEngine();

      const invalidManifest: BackupManifest = {
        format: BACKUP_FORMAT,
        version: "2.0.0",
        exportedAt: new Date().toISOString(),
        application: { name: "Saan Sovereign Companion", version: "1.0.0", node: "phryvos-k7" },
        stats: { sessionCount: 2, memoryCount: 0, taskCount: 0, resourceCount: 1, deduplicatedCount: 0 },
        checksums: {},
        sessions: [
          { id: "s1", meta: { id: "s1", title: "Session 1" } },
          { id: "s1", meta: { id: "s1", title: "Duplicate Session 1" } }, // Duplicate!
        ],
        resources: [
          {
            id: "res_1",
            originalStorageKeys: ["k1"],
            sessionIds: ["s1", "s2"], // Session scope with >1 sessions is illegal
            scope: "session",
          },
        ],
      };

      const result = engine.validateBackupManifestGraph(invalidManifest);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes("Duplicate session id")));
      assert.ok(result.errors.some(e => e.includes("must be bound to exactly one session")));
    });

    test("Protects filesystem by hashing path components longer than 200 bytes", () => {
      const engine = new VaultBackupEngine();
      const shortId = "daily-chat-session";
      assert.equal(engine.safeSessionPathComponent(shortId), encodeURIComponent(shortId));

      const longId = "a".repeat(250);
      const safePath = engine.safeSessionPathComponent(longId);
      assert.ok(safePath.startsWith("id-"));
      assert.equal(safePath.length, 67); // "id-" + 64 hex characters
    });

    test("Cleans private API keys and tokens from settings unless explicitly requested", () => {
      const engine = new VaultBackupEngine();
      const settings = {
        theme: "dark",
        apiKey: "sk-secret12345",
        user_token: "jwt.token.val",
        font_size: 14,
      };

      const cleaned = engine.cleanSettingsForBackup(settings, false);
      assert.equal(cleaned.theme, "dark");
      assert.equal(cleaned.font_size, 14);
      assert.equal(cleaned.apiKey, undefined);
      assert.equal(cleaned.user_token, undefined);

      const preserved = engine.cleanSettingsForBackup(settings, true);
      assert.equal(preserved.apiKey, "sk-secret12345");
    });

    test("Restores backup with conflict resolution modes (overwrite vs skip)", () => {
      const engine = new VaultBackupEngine();
      const pkg = engine.packageBackup({
        sessions: [{ id: "sess_1", title: "Existing Session" }],
        memories: [{ id: 101, content: "Existing memory" }],
      });

      const existing = {
        sessions: [{ id: "sess_1" }],
        memories: [{ id: 101 }],
      };

      // Skip mode
      const skipRes = engine.restoreBackup(pkg, existing, { conflictResolution: "skip" });
      assert.equal(skipRes.success, true);
      assert.equal(skipRes.conflictsHandled, 2);
      assert.equal(skipRes.restoredSessions, 0);
      assert.equal(skipRes.restoredMemories, 0);

      // Overwrite mode
      const owRes = engine.restoreBackup(pkg, existing, { conflictResolution: "overwrite" });
      assert.equal(owRes.success, true);
      assert.equal(owRes.conflictsHandled, 2);
      assert.equal(owRes.restoredSessions, 1);
      assert.equal(owRes.restoredMemories, 1);
    });
  });

  // ==========================================
  // REPO 45: LobeHub Maximum Capability
  // ==========================================
  describe("Repo 45: LobeHub Privacy Queries, Shell Stripping & Event Bus", () => {
    test("Strips prompt shells and classifies fixed queries without leaking private text", () => {
      const bus = new ComposerDraftBus();

      // Strips shell boilerplate
      const shellPrompt = "帮我创建一个 code review 检查助手";
      const stripped = bus.removeAgentShell(shellPrompt);
      assert.ok(!stripped.includes("帮我"));
      assert.ok(!stripped.includes("助手"));

      // Valid category gets market query
      const queries = bus.buildAgentSkillSuggestionQueries("帮我做一个 resume review checklist");
      assert.ok(queries.includes("resume review"));

      // Private bespoke prompt returns empty query array to prevent external leak
      const privatePrompt = "帮我创建一个 Acme 客户续约 SOP 检查清单，包含内部报价策略";
      const privateQueries = bus.buildAgentSkillSuggestionQueries(privatePrompt);
      assert.deepEqual(privateQueries, []);
    });

    test("Suppresses skill suggestion when companion memory patterns are present", () => {
      const bus = new ComposerDraftBus();
      // Has workflow words (skill) BUT also companion words (habit, remember)
      const mixedPrompt = "Create a daily habit checklist to remember my medicine";
      assert.equal(bus.isHighConfidenceSkillSuggestionPrompt(mixedPrompt), false);

      const classification = bus.classifyIntent(mixedPrompt);
      assert.equal(classification.intent, "companion_memory");
      assert.ok(classification.matchedKeywords.length > 0);
    });

    test("Notifies subscribed UI listeners on draft events", () => {
      const bus = new ComposerDraftBus();
      let notifiedCount = 0;
      let lastText = "";

      const unsubscribe = bus.subscribe((draft) => {
        notifiedCount++;
        if (draft) lastText = draft.text;
      });

      bus.postDraft("Hello from sidebar drawer");
      assert.equal(notifiedCount, 1);
      assert.equal(lastText, "Hello from sidebar drawer");

      bus.consumeDraft();
      assert.equal(notifiedCount, 2);

      unsubscribe();
      bus.postDraft("Another draft");
      assert.equal(notifiedCount, 2, "Unsubscribed listener must not receive events");
    });
  });

  // ==========================================
  // REPO 46: Anything-LLM Maximum Capability
  // ==========================================
  describe("Repo 46: Anything-LLM Wikilinks, Sliding Overlap & Epoch Defense", () => {
    test("Safely normalizes published date guarding against JS falsy epoch coercion", () => {
      const collector = new DocumentCollector();

      // Falsy values that JS Number() coerces to 0
      assert.ok(!collector.normalizePublishedDate(null).startsWith("1970"));
      assert.ok(!collector.normalizePublishedDate(false).startsWith("1970"));
      assert.ok(!collector.normalizePublishedDate("").startsWith("1970"));
      assert.ok(!collector.normalizePublishedDate([] as any).startsWith("1970"));

      // Valid timestamp
      const validEpoch = 1700000000000;
      assert.equal(collector.normalizePublishedDate(validEpoch), new Date(validEpoch).toISOString());
    });

    test("Extracts Obsidian wikilinks and applies sliding window overlap chunking", () => {
      const collector = new DocumentCollector();
      const content = `First paragraph introduces [[Architecture Principles]] and link to [[Neural Memory|Memory Model]].\n\nSecond paragraph discusses [[Security Guardrails]] and vault encryption.\n\nThird paragraph expands on deployment strategies.`;

      const doc = collector.processRawText(
        content,
        { title: "Vault System Overview" },
        { maxChunkWords: 15, overlapWords: 5 }
      );

      assert.equal(doc.title, "Vault System Overview");
      assert.ok(doc.detectedWikilinks.includes("Architecture Principles"));
      assert.ok(doc.detectedWikilinks.includes("Neural Memory"));
      assert.ok(doc.detectedWikilinks.includes("Security Guardrails"));
      assert.ok(doc.chunks.length >= 2);
      assert.ok(doc.chunks[0].checksum);
    });
  });

  // ==========================================
  // REPOS 47 & 48: Benchmarks Maximum Capability
  // ==========================================
  describe("Repos 47 & 48: Dual-Judge Arbitration, Disagreement Logging & Tail Latency", () => {
    test("Tracks judge disagreement between normalized string match and semantic judge", () => {
      const harness = new MemoryBenchmarkHarness();

      // Normalization tests
      assert.equal(harness.normalise("The user's favorite tea is Earl Grey!"), "user s favorite tea earl grey");

      // String match
      assert.equal(harness.stringMatch("Earl Grey", "User likes Earl Grey tea"), true);

      // Probe with string match failure but semantic match
      harness.addProbe({
        id: "p1",
        question: "When was user born?",
        gold: "7 May 2000",
        answer: "May 7th, 2000",
        correct: true,
        adversarial: false,
        abstained: false,
        searchLatencyMs: 3.5,
        category: "temporal",
      });

      // Adversarial probe correctly abstained
      harness.addProbe({
        id: "p2",
        question: "What is user's dog's name?",
        gold: "",
        answer: "I do not know",
        correct: true,
        adversarial: true,
        abstained: true,
        searchLatencyMs: 2.1,
        category: "adversarial",
      });

      // Adversarial probe hallucinated
      harness.addProbe({
        id: "p3",
        question: "Where did user vacation in 2012?",
        gold: "",
        answer: "User went to Paris",
        correct: false,
        adversarial: true,
        abstained: false,
        searchLatencyMs: 4.8,
        category: "adversarial",
      });

      const summary = harness.getSummary();
      assert.equal(summary.totalProbes, 3);
      assert.equal(summary.answerableCount, 1);
      assert.equal(summary.correctCount, 1);
      assert.equal(summary.recallPercent, 100);
      assert.equal(summary.adversarialCount, 2);
      assert.equal(summary.adversarialAbstainedCount, 1);
      assert.equal(summary.refusedAdversarialPercent, 50);
      assert.equal(summary.hallucinatedCount, 1);
      assert.ok(summary.sub10msTargetMet);
      assert.ok(summary.categoryRecall["adversarial"] !== undefined);
    });
  });

  // ==========================================
  // REPO 49: Mem0 Maximum Capability
  // ==========================================
  describe("Repo 49: Mem0 Token Truncation & Multilingual Code-Switching Prompting", () => {
    test("Truncates message history over 300 characters while preserving Hinglish code-switching instructions", () => {
      const longMessage = "Yeh message bohot lamba hai aur 300 characters se zyada lamba hai ".repeat(8);
      assert.ok(longMessage.length > 300);

      const prompt = Mem0PromptBuilder.generateAdditiveExtractionPrompt({
        summary: "Contextual recap",
        lastKMessages: [
          { role: "user", content: longMessage },
        ],
        newMessages: [
          { role: "user", content: "Mera chai preference yaad rakhna" },
        ],
        observationDate: "2026-10-28",
        preserveLanguageAndDialect: true,
      });

      assert.ok(prompt.includes("... [truncated]"), "Long messages in history must be truncated to prevent token bloat");
      assert.ok(prompt.includes("Respond in the SAME LANGUAGE, SCRIPT, and DIALECT"));
      assert.ok(prompt.includes("If the input mixes languages (e.g., Hinglish)"));
      assert.ok(prompt.includes("Mera chai preference yaad rakhna"));
    });
  });

  // ==========================================
  // REPO 50: Graphiti Maximum Capability
  // ==========================================
  describe("Repo 50: Graphiti Future Bounds & Reciprocal Rank Fusion Hybrid Search", () => {
    test("Normalizes future bounds for promises without prematurely invalidating soft deadlines", () => {
      const calculus = new BiTemporalCalculus();
      const bounds = calculus.normalizeFutureTemporalBounds(
        "User promises to submit research paper by Friday",
        "2026-10-28T10:00:00Z"
      );

      assert.equal(bounds.validAtMs, new Date("2026-10-28T10:00:00Z").getTime());
      assert.equal(bounds.invalidAtMs, null, "Soft deadline 'by Friday' must not invalidate promise before contradiction");
    });

    test("Performs Reciprocal Rank Fusion (RRF) combining vector similarity and lexical ranks", () => {
      const calculus = new BiTemporalCalculus();

      const e1: TemporalEdge = {
        id: "edge_lexical_dense",
        fact: "User drinks green matcha tea every morning",
        validAtMs: 1000,
        referenceTimeMs: 1000,
        embeddingScore: 0.95,
      };

      const e2: TemporalEdge = {
        id: "edge_lexical_only",
        fact: "User drinks black coffee",
        validAtMs: 1000,
        referenceTimeMs: 1000,
        embeddingScore: 0.30,
      };

      const e3: TemporalEdge = {
        id: "edge_unrelated",
        fact: "User works on Linux kernel patches",
        validAtMs: 1000,
        referenceTimeMs: 1000,
        embeddingScore: 0.10,
      };

      calculus.addEdge(e1);
      calculus.addEdge(e2);
      calculus.addEdge(e3);

      const results = calculus.hybridSearchRRF("green tea", 2000, 60);
      assert.equal(results.length, 3);
      assert.equal(results[0].id, "edge_lexical_dense", "Best combined vector and lexical score ranks first");
      assert.ok(results[0].rrfScore > results[1].rrfScore);
      assert.ok(results[1].rrfScore > results[2].rrfScore);
    });
  });
});
