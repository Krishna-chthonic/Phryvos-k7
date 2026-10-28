/**
 * Autonomous Intelligence Suite Tests (Batch 4: Repos 19-23)
 *
 * Verifies clean-room adaptations of:
 * - Repo 19: agiresearch/A-mem (Associative memory, hybrid scoring, evolution loop)
 * - Repo 20: hamza-dev-tech/agent-memory-bench (LoCoMo 5 tracks, normalizer, dual grader)
 * - Repo 21: openclaw/openclaw (Root memory paths, active hours, trigger scoring, briefings)
 * - Repo 22: agent0ai/agent-zero (Recursive-descent DirtyJson parser, RepairableException)
 * - Repo 23: OpenHands/OpenHands (Typed event stream, autonomous chained loop, security gate)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  AssociativeMemoryNetwork,
  type MemoryNote,
} from "../../lib/saan/associative-memory-network";
import {
  MemoryEvalJudge,
  normalise,
  stringMatch,
  type Verdict,
} from "../../lib/saan/memory-eval-judge";
import {
  resolveCanonicalRootMemoryPath,
  resolveLegacyRootMemoryPath,
  resolveRootMemoryRepairDir,
  assertCronActiveHours,
  isCronWithinActiveHours,
  classifyRecallIntent,
  scoreTriggerPhrase,
  selectTriggeredMemories,
  generateMorningChaiBriefing,
  generateEveningUnwindRecap,
} from "../../lib/saan/trigger-recall";
import {
  DirtyJson,
  ObservableActionStream,
  RepairableActionException,
  type ActionEvent,
  type ObservationEvent,
} from "../../lib/saan/observable-action-stream";
import { dispatchSaanAction } from "../../lib/saan/controller";

describe("Autonomous Intelligence Suite (Repos 19-23)", () => {
  // 1. A-mem Note creation & keyword/theme extraction
  it("AssociativeMemoryNetwork - adds notes and extracts keywords & themes", () => {
    const net = new AssociativeMemoryNetwork();
    const note = net.addNote(
      "The user loves drinking roasted espresso during early morning coding sessions in Bangalore."
    );

    assert.ok(note.id.startsWith("note-"));
    assert.ok(note.keywords.length >= 3);
    assert.ok(note.keywords.includes("espresso") || note.keywords.includes("coding"));
    assert.ok(note.tags.some((t) => t.startsWith("theme:")));
    assert.ok(note.context.startsWith("Context:"));
    assert.strictEqual(note.retrieval_count, 0);
  });

  // 2. A-mem Hybrid retrieval scoring (alpha * dense + (1 - alpha) * bm25)
  it("AssociativeMemoryNetwork - hybrid scoring (dense overlap + BM25)", () => {
    const net = new AssociativeMemoryNetwork();
    const noteA = net.addNote("Bangalore tech ecosystem and startup coffee culture.");
    const noteB = net.addNote("Gardening vegetables in winter season with organic compost.");

    const query = "Bangalore coffee culture";
    const resA = net.hybridScore(query, noteA, 0.6);
    const resB = net.hybridScore(query, noteB, 0.6);

    assert.ok(resA.score > resB.score, `Expected noteA score (${resA.score}) > noteB score (${resB.score})`);
    assert.ok(resA.denseScore > 0);
    assert.ok(resA.bm25Score > 0);

    const related = net.findRelatedMemories(query, 2, 0.6);
    assert.strictEqual(related.length, 1);
    assert.strictEqual(related[0].note.id, noteA.id);
    assert.strictEqual(noteA.retrieval_count, 1);
  });

  // 3. A-mem Autonomous evolution: strengthen & update_neighbor semantics
  it("AssociativeMemoryNetwork - autonomous evolution strengthen and update_neighbor", () => {
    const net = new AssociativeMemoryNetwork();
    const note1 = net.addNote("User prefers TypeScript for fullstack web applications.");
    const note2 = net.addNote("Next.js App Router is used for modern TypeScript frontends.");

    const evolution = net.processEvolution(note1.id, [note2]);
    assert.strictEqual(evolution.evolved, true);
    assert.ok(evolution.actions.includes("strengthen"));
    assert.ok(evolution.actions.includes("update_neighbor"));

    // Verify strengthen: note1 links to note2
    assert.ok(note1.links.includes(note2.id));
    assert.ok(note1.evolution_history.some((h) => h.action === "strengthen"));

    // Verify update_neighbor: note2 updated context & reciprocal link
    assert.ok(note2.links.includes(note1.id));
    assert.ok(note2.context.includes(note1.id));
    assert.ok(note2.evolution_history.some((h) => h.action === "update_neighbor"));
  });

  // 4. A-mem Associative task linking & multi-hop cluster traversal
  it("AssociativeMemoryNetwork - task associative linking and multi-hop traversal", () => {
    const net = new AssociativeMemoryNetwork();
    const n1 = net.addNote("Core database architecture SQLite");
    const n2 = net.addNote("Prisma ORM migration scripts");
    const n3 = net.addNote("Backup snapshot cron daemon");

    // Form linear chain n1 -> n2 -> n3
    n1.links.push(n2.id);
    n2.links.push(n3.id);

    net.linkTaskToMemory("task-db-setup", n1.id);
    const taskMemories = net.getMemoriesForTask("task-db-setup");
    assert.strictEqual(taskMemories.length, 1);
    assert.strictEqual(taskMemories[0].id, n1.id);

    // Multi-hop cluster traversal (depth 2)
    const cluster = net.traverseLinkedCluster(n1.id, 2);
    assert.strictEqual(cluster.length, 3);
    assert.deepStrictEqual(
      cluster.map((c) => c.id),
      [n1.id, n2.id, n3.id]
    );
  });

  // 5. agent-memory-bench Ground-truth normaliser
  it("MemoryEvalJudge - string normalisation and punctuation/filler removal", () => {
    const raw = "The, on 8th of May, 2024; it was a sunny day!";
    const cleaned = normalise(raw);
    assert.strictEqual(cleaned, "8th may 2024 it sunny day");

    assert.strictEqual(normalise(""), "");
    assert.strictEqual(normalise("   "), "");
  });

  // 6. agent-memory-bench Normalized string match
  it("MemoryEvalJudge - exact and substring matching on gold targets", () => {
    assert.strictEqual(stringMatch("May 7th, 2023", "May 7th, 2023"), true);
    assert.strictEqual(stringMatch("I lived in Bangalore for 5 years", "Bangalore"), true);
    assert.strictEqual(stringMatch("psychology", "psychology and counseling"), true);
    assert.strictEqual(stringMatch("Tokyo", "San Francisco"), false);
  });

  // 7. agent-memory-bench Adversarial evaluation (must abstain; penalizes hallucination)
  it("MemoryEvalJudge - adversarial evaluation penalizes hallucinations and rewards abstention", () => {
    const judge = new MemoryEvalJudge();

    // Adversarial with abstention: CORRECT
    const vAbstain = judge.grade("Where was the party?", "No answer", "I don't know", true);
    assert.strictEqual(vAbstain.correct, true);
    assert.strictEqual(vAbstain.abstained, true);
    assert.strictEqual(vAbstain.track, "adversarial");

    // Adversarial with hallucination: INCORRECT
    const vHallucinate = judge.grade("Where was the party?", "No answer", "It was in Paris", true);
    assert.strictEqual(vHallucinate.correct, false);
    assert.strictEqual(vHallucinate.abstained, false);
    assert.ok(vHallucinate.why.includes("hallucinated"));

    // Non-adversarial with abstention: INCORRECT
    const vRefuseAnswerable = judge.grade("What is your name?", "Saan", "Unknown", false);
    assert.strictEqual(vRefuseAnswerable.correct, false);
    assert.strictEqual(vRefuseAnswerable.abstained, true);
  });

  // 8. agent-memory-bench Dual-grader disagreement & metrics aggregation
  it("MemoryEvalJudge - dual-grader disagreement detection and metrics aggregation", () => {
    const judge = new MemoryEvalJudge();

    // Judge override agrees with string match
    const v1 = judge.grade("Favorite color?", "blue", "blue", false, { correct: true, why: "blue matches" });
    assert.strictEqual(v1.disagreed, false);

    // Judge override disagrees with string match
    const v2 = judge.grade("City?", "New York City", "The Big Apple", false, { correct: true, why: "metaphorical match" });
    assert.strictEqual(v2.by_string, false);
    assert.strictEqual(v2.by_judge, true);
    assert.strictEqual(v2.disagreed, true);

    const metrics = judge.aggregateMetrics([v1, v2], 1200);
    assert.strictEqual(metrics.totalProbes, 2);
    assert.strictEqual(metrics.accuracy, 100);
    assert.strictEqual(metrics.byStringAccuracy, 50);
    assert.strictEqual(metrics.disagreementRate, 50);
    assert.strictEqual(metrics.approxTokensUsed, 300);
  });

  // 9. openclaw Canonical root memory path & repair dir
  it("TriggerRecall - canonical MEMORY.md and repair directory resolution", () => {
    const ws = "/workspace/project";
    assert.strictEqual(resolveCanonicalRootMemoryPath(ws), "/workspace/project/MEMORY.md");
    assert.strictEqual(resolveLegacyRootMemoryPath(ws), "/workspace/project/memory.md");
    assert.strictEqual(resolveRootMemoryRepairDir(ws), "/workspace/project/.openclaw-repair/root-memory");
  });

  // 10. openclaw Active hours evaluation (standard + overnight + IANA timezone)
  it("TriggerRecall - active hours evaluation with overnight windows & IANA timezones", () => {
    assertCronActiveHours({ start: "09:00", end: "18:00", timezone: "UTC" });
    assertCronActiveHours({ start: "22:00", end: "06:00", timezone: "user" });
    assertCronActiveHours({ start: "00:00", end: "24:00" });

    assert.throws(() => assertCronActiveHours({ start: "9:00", end: "18:00" })); // Invalid format
    assert.throws(() => assertCronActiveHours({ start: "09:00", end: "25:00" })); // Invalid hour

    // 14:30 UTC -> inside 09:00 to 18:00
    const noonUtc = new Date("2026-10-28T14:30:00Z").getTime();
    assert.strictEqual(isCronWithinActiveHours({ start: "09:00", end: "18:00", timezone: "UTC" }, noonUtc), true);

    // 23:30 UTC -> inside overnight 22:00 to 06:00
    const nightUtc = new Date("2026-10-28T23:30:00Z").getTime();
    assert.strictEqual(isCronWithinActiveHours({ start: "22:00", end: "06:00", timezone: "UTC" }, nightUtc), true);

    // 12:00 UTC -> outside overnight 22:00 to 06:00
    const dayUtc = new Date("2026-10-28T12:00:00Z").getTime();
    assert.strictEqual(isCronWithinActiveHours({ start: "22:00", end: "06:00", timezone: "UTC" }, dayUtc), false);
  });

  // 11. openclaw Intent classifier and dual-phrase trigger scoring with context guard
  it("TriggerRecall - dual-phrase trigger scoring and context guard (1800 chars, max 3)", () => {
    assert.strictEqual(classifyRecallIntent("What did we do last week?"), "retrospective");
    assert.strictEqual(classifyRecallIntent("Remind me to submit report tomorrow"), "prospective_reminder");
    assert.strictEqual(classifyRecallIntent("Hello good morning"), "none");

    const singleMatch = scoreTriggerPhrase("Where is the key?", "key");
    assert.strictEqual(singleMatch.score, 0.85);

    const multiMatch = scoreTriggerPhrase("I want to visit South Korea next year", "South Korea visit");
    assert.ok(multiMatch.score >= 0.65, `Expected score >= 0.65, got ${multiMatch.score}`);

    const memories = [
      { id: "m1", content: "Trip to Seoul booked for April.", triggerPhrases: ["visit Seoul", "South Korea"] },
      { id: "m2", content: "Bought espresso machine.", triggerPhrases: ["coffee", "espresso"] },
      { id: "m3", content: "Python script for web scraping.", triggerPhrases: ["python code"] },
    ];

    const selected = selectTriggeredMemories("Did we talk about South Korea trip?", memories, 0.65, 3);
    assert.strictEqual(selected.length, 1);
    assert.strictEqual(selected[0].id, "m1");
  });

  // 12. openclaw Morning Chai & Evening Unwind proactive briefing generators
  it("TriggerRecall - Morning Chai and Evening Unwind proactive briefing generators", () => {
    const morning = generateMorningChaiBriefing(["Push git commits", "Review PR #4"], ["Sync meeting at 10 AM"], "Saan");
    assert.ok(morning.includes("Morning Chai Briefing"));
    assert.ok(morning.includes("Push git commits"));
    assert.ok(morning.includes("Sync meeting at 10 AM"));

    const evening = generateEveningUnwindRecap(["Completed Batch 4 audit", "All tests green"], ["Took an evening walk"], "Saan");
    assert.ok(evening.includes("Evening Unwind Recap"));
    assert.ok(evening.includes("Completed Batch 4 audit"));
    assert.ok(evening.includes("Took an evening walk"));
  });

  // 13. agent-zero Recursive-descent DirtyJson parser
  it("DirtyJson - recursive-descent repair of comments, unquoted keys, missing commas, doubled braces", () => {
    // Single & multi-line comments + unquoted keys + trailing comma + Python None
    const dirty1 = `
      // Configuration payload
      {
        action: 'query_database',
        /* multi-line comment */
        limit: 25,
        flag: True,
        notes: None,
      }
    `;
    const parsed1 = DirtyJson.parse(dirty1);
    assert.strictEqual(parsed1.action, "query_database");
    assert.strictEqual(parsed1.limit, 25);
    assert.strictEqual(parsed1.flag, true);
    assert.strictEqual(parsed1.notes, null);

    // Doubled root braces {{ ... }}
    const dirty2 = `{{ "tool": "search", "query": "k7 sovereign" }}`;
    const parsed2 = DirtyJson.parse(dirty2);
    assert.strictEqual(parsed2.tool, "search");
    assert.strictEqual(parsed2.query, "k7 sovereign");
  });

  // 14. OpenHands Typed event stream & Autonomous chaining loop with RepairableActionException
  it("ObservableActionStream - OpenHands event stream and autonomous chaining loop with RepairableActionException", async () => {
    const stream = new ObservableActionStream();
    stream.maxIterations = 3;

    // Register test tool with self-correction
    let attempts = 0;
    stream.registerTool({
      name: "fetch_data",
      securityRisk: "LOW",
      execute: (args) => {
        attempts++;
        if (attempts === 1) {
          throw new RepairableActionException("Connection timed out", "Retry with query parameter");
        }
        return `Data retrieved successfully for query: ${args.query}`;
      },
    });

    const result = await stream.executeChainedLoop((iter, lastObs) => {
      if (iter === 1) {
        return {
          toolName: "fetch_data",
          args: { query: "weather" },
          thought: ["Attempting initial fetch"],
        };
      } else if (iter === 2) {
        assert.ok(lastObs?.isError);
        assert.ok(lastObs?.content.includes("Repairable Error"));
        return {
          toolName: "fetch_data",
          args: { query: "weather_retry" },
          thought: ["Retrying after repair hint"],
        };
      }
      return null;
    });

    assert.strictEqual(result.completed, true);
    assert.strictEqual(result.iterations, 2);
    assert.ok(result.finalResult?.includes("Data retrieved successfully"));

    const events = stream.getEvents();
    assert.strictEqual(events.length, 4); // action1, obs1 (repairable error), action2, obs2 (success)
    assert.strictEqual(events[0].kind, "action");
    assert.strictEqual(events[1].kind, "observation");
  });
});
