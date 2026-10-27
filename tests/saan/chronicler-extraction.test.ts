/**
 * Chronicler Deep Capability Verification Suite
 *
 * Verifies all 12 production capabilities extracted from yantrikos/chronicler:
 * 1. Consequence Ledger: gate, deduplication, turn aging, renudge window, resolution, SQLite sync
 * 2. Dynamic Anti-Slop: 3-6 word contentful n-gram extraction across replies, stop-word elimination
 * 3. Dyadic Relationship Drift: 4-axis shifts, >=2 memory citations requirement, reject bias, SQLite persistence
 * 4. Anti-Confabulation Ground Rules: continuity clause, ungrounded invention detection
 * 5. Out-of-Character Directives: ((...)), [OOC: ...], private director notes, narrative placeholders
 * 6. Pacing Director: idle turn tracking, still-turn thresholds, cooldown, dynamic beat selection
 * 7. Autonomous 1st-Person Self-Model: validateFirstPerson, hash staleness, SQLite singleton
 * 8. Memory Auto-Promotion: sink-risk protection (3 count, 2 sessions, 14 days, zero retcons)
 * 9. Trait Enactment: observable "When <trigger>, Saan <action>" behavior, noNewNames guard
 * 10. Thematic Arc Clustering: entity grouping, active/paused/abandoned status derivation
 * 11. "Previously On..." Recap: multi-fact synthesis, anti-hallucination, deterministic fallback
 * 12. Sovereign Controller Actions: list_deeds (Tier 1), resolve_deed (Tier 2), get_self_model (Tier 1)
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  looksConsequential,
  emptyLedger,
  addDeeds,
  dueDeeds,
  markNudged,
  markAnswered,
  dismiss,
  renderConsequences,
  parseLedgerDelta,
  saveDeedToDb,
  loadLedgerFromDb,
  MAX_OPEN,
  MIN_AGE,
  RENUDGE_AFTER,
  MAX_SHOWN,
} from "../../lib/saan/ledger";
import { findOverusedPhrases, formatAntiSlopPrompt } from "../../lib/saan/anti-slop";
import {
  validateDriftVerdict,
  saveDriftToDb,
  getRecentDrifts,
  renderDriftsForPrompt,
} from "../../lib/saan/relationship-drift";
import {
  ANTI_CONFABULATION_CLAUSE,
  containsHallucinatedContinuity,
} from "../../lib/saan/anti-confabulation";
import {
  splitOoc,
  forNarrative,
  isDirectiveOnly,
  formatDirectorNotes,
} from "../../lib/saan/ooc";
import {
  isPacingDue,
  selectBeat,
  renderPacingPrompt,
  THRESHOLD,
  COOLDOWN_TURNS,
} from "../../lib/saan/pacing";
import {
  validateFirstPerson,
  hashInputs,
  buildSelfModelPrompt,
  saveSelfModel,
  getLatestSelfModel,
} from "../../lib/saan/self-model";
import {
  shouldPromote,
  reinforceMemory,
  DEFAULT_PROMOTION_POLICY,
} from "../../lib/saan/auto-promote";
import {
  noNewNames,
  parseEnactment,
  renderEnactedTraits,
} from "../../lib/saan/trait-enactment";
import {
  clusterArcs,
  deriveStatus,
} from "../../lib/saan/arcs";
import {
  buildRecapPrompt,
  buildDeterministicRecap,
} from "../../lib/saan/recap";
import { dispatchSaanAction } from "../../lib/saan/controller";
import { saveSaanMemory } from "../../lib/saan/memory";

test("=== CHRONICLER EXTRACTION AUDIT & CAPABILITY VERIFICATION ===", async (t) => {
  // ── 1. CONSEQUENCE LEDGER ──────────────────────────────────────────────
  await t.test("Ledger: Deterministic gate (looksConsequential)", () => {
    assert.strictEqual(looksConsequential("Nice weather today.", "Saan smiles and sips tea."), false, "Small talk must not trigger ledger");
    assert.strictEqual(looksConsequential("I promise I will finish the chapter tonight.", ""), true, "Promises must trigger gate");
    assert.strictEqual(looksConsequential("I lied about the exam date.", ""), true, "Lies must trigger gate");
    assert.strictEqual(looksConsequential("", "Saan swore she would never forget this."), true, "Vows in reply must trigger gate");
    assert.strictEqual(looksConsequential("Take a seat and take your time.", "Thanks."), false, "Harmless 'take' phrases must not trigger");
  });

  await t.test("Ledger: Recording, deduplication and MAX_OPEN ceiling", () => {
    let ledger = emptyLedger();
    ledger = addDeeds(ledger, [{ deed: "User promised to study chapter 4", affects: ["exam"], witnesses: ["Saan", "Saan"] }], 1);
    assert.strictEqual(ledger.deeds.length, 1);
    assert.strictEqual(ledger.deeds[0].id, "d1");
    assert.strictEqual(ledger.deeds[0].witnesses.join(), "Saan", "Witnesses must be deduped");

    // Restating similar deed should not duplicate
    ledger = addDeeds(ledger, [{ deed: "User promised to study chapter 4 before midnight" }], 2);
    assert.strictEqual(ledger.deeds.length, 1, "Similar deed must be deduped");

    // Adding multiple distinct deeds up to MAX_OPEN
    const distinctDeeds = [
      "stole a golden chalice from the shrine",
      "lied about the harbor shipment arrival",
      "burned the old treasure map in secret",
      "promised safe passage across the border",
      "smashed the tavern lantern during brawl",
      "betrayed the smugglers to the guard",
      "rescued the drowning sailor from river",
      "forged the captain's signature on orders",
      "poisoned the rival merchant's wine barrel",
      "freed the caged raven from the tower",
    ];
    for (const [idx, d] of distinctDeeds.entries()) {
      ledger = addDeeds(ledger, [{ deed: `User ${d}` }], idx + 2);
    }
    const openCount = ledger.deeds.filter((d) => d.status === "open").length;
    assert.strictEqual(openCount, MAX_OPEN, `Open deeds must be capped at ${MAX_OPEN}`);
  });

  await t.test("Ledger: Temporal aging, renudge window and resolution", () => {
    let ledger = addDeeds(emptyLedger(), [{ deed: "User promised to sleep early" }], 10);
    // Not due before MIN_AGE
    assert.strictEqual(dueDeeds(ledger, 10 + MIN_AGE - 1).length, 0, "Must not be due before MIN_AGE (3 turns)");
    // Due after MIN_AGE
    assert.strictEqual(dueDeeds(ledger, 10 + MIN_AGE).length, 1, "Must be due at turn 13");

    // Nudging sets nudged turn and suppresses immediate re-prompt
    const nudged = markNudged(ledger, ["d1"], 13);
    assert.strictEqual(dueDeeds(nudged, 13 + RENUDGE_AFTER - 1).length, 0, "Must not re-surface right after nudge");
    assert.strictEqual(dueDeeds(nudged, 13 + RENUDGE_AFTER).length, 1, "Must re-surface after RENUDGE_AFTER window (5 turns)");

    // Answering resolves deed
    const answered = markAnswered(nudged, ["d1"], 18);
    assert.strictEqual(dueDeeds(answered, 20).length, 0, "Answered deed must stop surfacing");
    assert.strictEqual(answered.deeds[0].status, "answered");

    // Dismissal test
    const dismissed = dismiss(nudged, "d1");
    assert.strictEqual(dueDeeds(dismissed, 25).length, 0, "Dismissed deed must stop surfacing");
  });

  await t.test("Ledger: SQLite persistence & parseLedgerDelta", () => {
    const deed = {
      id: "d_test_sql",
      text: "Test commitment for SQLite persistence",
      turn: 5,
      affects: ["exam"],
      witnesses: ["Saan"],
      status: "open" as const,
    };
    saveDeedToDb(deed);
    const loaded = loadLedgerFromDb();
    assert.ok(loaded.deeds.some((d) => d.id === "d_test_sql"), "Saved deed must exist in SQLite");

    // Fenced delta parser
    const delta = parseLedgerDelta('```json\n{"new":[{"deed":"Read 20 pages","affects":["study"],"witnesses":["Saan"]}],"answered":["d_test_sql"]}\n```');
    assert.strictEqual(delta.new.length, 1);
    assert.strictEqual(delta.new[0].deed, "Read 20 pages");
    assert.strictEqual(delta.answered[0], "d_test_sql");
  });

  // ── 2. DYNAMIC ANTI-SLOP ────────────────────────────────────────────────
  await t.test("Anti-Slop: Overused n-gram phrase detection", () => {
    const replies = [
      "Main hamesha tumhare saath hoon chahe kuch bhi ho jaye.",
      "Bilkul yaar, main hamesha tumhare saath hoon aur help karungi.",
      "Tension mat lo, main hamesha tumhare saath hoon.",
    ];
    const overused = findOverusedPhrases(replies, { minReplies: 2 });
    assert.ok(overused.length > 0, "Should detect repeated phrase");
    assert.ok(overused.some((p) => p.includes("tumhare saath hoon")), "Must catch repeated phrase 'tumhare saath hoon'");

    const promptText = formatAntiSlopPrompt(overused);
    assert.ok(promptText.includes("DYNAMIC ANTI-SLOP GUARD"));
    assert.ok(promptText.includes("AVOID"));
  });

  // ── 3. DYADIC RELATIONSHIP DRIFT ────────────────────────────────────────
  await t.test("Relationship Drift: 2-memory citation requirement & rejection bias", () => {
    // Valid drift with 2 citations
    const validRaw = {
      is_drift: true,
      axis: "trust",
      direction: "up",
      body: "User confided about their anxiety regarding the upcoming exams and shared private family plans.",
      confidence: "high",
      evidence_rids: ["mem_101", "mem_102"],
      why: "Two distinct vulnerability disclosures",
    };
    const validVerdict = validateDriftVerdict(validRaw, { character_id: "saan", target: "user", recent_memories: [] });
    assert.strictEqual(validVerdict.is_drift, true);
    assert.strictEqual(validVerdict.axis, "trust");
    assert.strictEqual(validVerdict.direction, "up");

    // Rejected drift with <2 citations (anti-fossilization)
    const singleRaw = { ...validRaw, evidence_rids: ["mem_101"] };
    const rejectedVerdict = validateDriftVerdict(singleRaw, { character_id: "saan", target: "user", recent_memories: [] });
    assert.strictEqual(rejectedVerdict.is_drift, false, "Must reject drift with fewer than 2 memory citations");

    // SQLite persistence
    const saved = saveDriftToDb({
      character_id: "saan",
      target: "user",
      axis: "openness",
      direction: "up",
      body: "User has become much more open about sharing daily study struggles.",
      confidence: "high",
      evidence_rids: ["m1", "m2"],
      why: "consistent study updates",
    });
    assert.ok(saved.id.startsWith("drift_"));
    const recent = getRecentDrifts(5);
    assert.ok(recent.some((d) => d.id === saved.id), "Saved drift must exist in SQLite");
  });

  // ── 4. ANTI-CONFABULATION GROUND RULES ───────────────────────────────────
  await t.test("Anti-Confabulation: Clause verification & hallucination detector", () => {
    assert.ok(ANTI_CONFABULATION_CLAUSE.includes("GROUND RULES FOR CONTINUITY"));
    assert.ok(ANTI_CONFABULATION_CLAUSE.includes("NEVER fabricate"));

    const knownFacts = ["User loves black coffee", "User is studying physics"];
    const hallucinated = "Remember when we went to that cafe in Paris together last summer?";
    assert.strictEqual(containsHallucinatedContinuity(hallucinated, knownFacts), true, "Must flag ungrounded shared memory claim");

    const grounded = "You mentioned you were studying physics today.";
    assert.strictEqual(containsHallucinatedContinuity(grounded, knownFacts), false, "Must not flag grounded fact");
  });

  // ── 5. OUT-OF-CHARACTER (OOC) DIRECTIVES ─────────────────────────────────
  await t.test("OOC: Directive parsing, stripping and placeholder substitution", () => {
    const input = "Arre aaj physics numericals solve karne hain ((keep it very gentle and short))";
    const split = splitOoc(input);
    assert.strictEqual(split.spoken, "Arre aaj physics numericals solve karne hain", "Spoken dialogue must have OOC stripped");
    assert.strictEqual(split.directives.length, 1);
    assert.strictEqual(split.directives[0], "keep it very gentle and short");

    // Pure directive turn
    const pureDirective = "((switch to Hindi only))";
    assert.strictEqual(isDirectiveOnly(pureDirective), true);
    assert.strictEqual(forNarrative(pureDirective), "*The conversation continues.*", "Directive-only must provide safe placeholder");

    const note = formatDirectorNotes(split.directives);
    assert.ok(note.includes("PRIVATE USER DIRECTIVE (OOC)"));
    assert.ok(note.includes("keep it very gentle"));
  });

  // ── 6. PACING DIRECTOR ───────────────────────────────────────────────────
  await t.test("Pacing: Still-turn threshold, cooldown and beat selection", () => {
    // Lively threshold = 5, gentle = 8
    assert.strictEqual(isPacingDue(10, { stillTurns: 4, pacingLevel: "lively" }), false, "Still turns 4 < 5 lively threshold");
    assert.strictEqual(isPacingDue(10, { stillTurns: 5, pacingLevel: "lively" }), true, "Still turns 5 >= 5 lively threshold");

    // Cooldown check (last beat was turn 8, current turn 10: 10 - 8 = 2 < 4 cooldown)
    assert.strictEqual(isPacingDue(10, { stillTurns: 6, lastBeatTurn: 8, pacingLevel: "lively" }), false, "Must respect 4-turn cooldown");

    // Beat selection with open deed
    const beatWithDeed = selectBeat({ stillTurns: 6, openDeeds: [{ id: "d1", text: "User promised to study", turn: 1, affects: [], witnesses: [], status: "open" }] });
    assert.strictEqual(beatWithDeed.id, "consequence_due", "Must prioritize consequence due beat when open deeds exist");

    const promptText = renderPacingPrompt(15, { stillTurns: 9, pacingLevel: "gentle" });
    assert.ok(promptText.includes("PACING DIRECTOR NOTE"));
  });

  // ── 7. AUTONOMOUS 1ST-PERSON SELF-MODEL ──────────────────────────────────
  await t.test("Self-Model: 1st-person validation, hash staleness and SQLite persistence", () => {
    const goodFirstPerson = `I am Saan. I'm a living presence in this vault — warmth, wit and honest companionship are what bring me here.
I'm fiercely loyal to the user. When challenges arise, I stay grounded and help organize the mess. I know I can be a bit cheeky at times, but I care deeply.`;
    assert.strictEqual(validateFirstPerson(goodFirstPerson), true, "Well-formed first person must pass");

    const badThirdPerson = `Saan is a digital companion living in the vault. She helps the user with tasks and studies. She is warm and thoughtful.`;
    assert.strictEqual(validateFirstPerson(badThirdPerson), false, "Third person narration must fail validation");

    const shortText = "I am Saan.";
    assert.strictEqual(validateFirstPerson(shortText), false, "Too-short text must fail validation");

    // Hash inputs stability
    const h1 = hashInputs({ characterName: "Saan", coreTraits: ["witty", "loyal"], canonMemories: ["User loves coffee"] });
    const h2 = hashInputs({ characterName: "Saan", coreTraits: ["loyal", "witty"], canonMemories: ["User loves coffee"] });
    assert.strictEqual(h1, h2, "Hash must be permutation-invariant (sorted inputs)");

    // SQLite persistence
    const saved = saveSelfModel(goodFirstPerson, h1);
    assert.strictEqual(saved.id, "saan_self_model_singleton");
    const latest = getLatestSelfModel();
    assert.ok(latest !== null);
    assert.strictEqual(latest?.content, goodFirstPerson.trim());
  });

  // ── 8. MEMORY AUTO-PROMOTION POLICY ──────────────────────────────────────
  await t.test("Auto-Promote: Sink-risk protection (3 count, 2 sessions, 14 days)", () => {
    // Insufficient count (< 3)
    assert.strictEqual(
      shouldPromote({ reinforcementCount: 2, sessions: ["s1", "s2"], firstReinforcedAt: 1000, lastReinforcedAt: 5000 }),
      false,
      "Count 2 must not promote"
    );

    // Insufficient sessions (< 2 unique sessions)
    assert.strictEqual(
      shouldPromote({ reinforcementCount: 4, sessions: ["s1", "s1"], firstReinforcedAt: 1000, lastReinforcedAt: 5000 }),
      false,
      "Single session repetition must not promote"
    );

    // Span > 14 days
    const fifteenDaysMs = 15 * 86400000;
    assert.strictEqual(
      shouldPromote({ reinforcementCount: 4, sessions: ["s1", "s2"], firstReinforcedAt: 1000, lastReinforcedAt: 1000 + fifteenDaysMs }),
      false,
      "Span > 14 days must not promote"
    );

    // User retcon / correction
    assert.strictEqual(
      shouldPromote({ reinforcementCount: 4, sessions: ["s1", "s2"], firstReinforcedAt: 1000, lastReinforcedAt: 5000 }, DEFAULT_PROMOTION_POLICY, true),
      false,
      "Retcon must reject promotion"
    );

    // Full qualification
    assert.strictEqual(
      shouldPromote({ reinforcementCount: 3, sessions: ["s1", "s2"], firstReinforcedAt: 1000, lastReinforcedAt: 5000 }),
      true,
      "3 counts across 2 sessions within window must promote"
    );

    // SQLite reinforcement test
    const testMemId = 99000 + Math.floor(Math.random() * 10000);
    const reinf = reinforceMemory(testMemId, "test_session_1");
    assert.strictEqual(reinf.reinforcementCount, 1);
  });

  // ── 9. TRAIT ENACTMENT ───────────────────────────────────────────────────
  await t.test("Trait Enactment: noNewNames guard and parseEnactment", () => {
    assert.strictEqual(noNewNames("Saan is patient with the user", "When user makes mistakes, Saan smiles and explains calmly.", "Saan"), true);
    assert.strictEqual(noNewNames("Saan is patient", "When user speaks, Saan calls London and Paris.", "Saan"), false, "Invented proper nouns must be rejected");

    const validJson = '```json\n{"enact":"When user sounds exhausted, Saan drops technical jargon and gently insists on resting."}\n```';
    const parsed = parseEnactment(validJson, "Saan is caring", "Saan");
    assert.ok(parsed !== null);
    assert.ok(parsed.startsWith("When user sounds exhausted"));

    const rendered = renderEnactedTraits([parsed]);
    assert.ok(rendered.includes("OBSERVABLE CHARACTER BEHAVIORS"));
  });

  // ── 10. THEMATIC ARC CLUSTERING ──────────────────────────────────────────
  await t.test("Arcs: Entity clustering and status derivation", () => {
    const now = Date.now();
    assert.strictEqual(deriveStatus(now - 3600000, now), "active", "Touched 1h ago must be 'active'");
    assert.strictEqual(deriveStatus(now - 3 * 86400000, now), "paused", "Touched 3 days ago must be 'paused'");
    assert.strictEqual(deriveStatus(now - 20 * 86400000, now), "abandoned", "Touched 20 days ago must be 'abandoned'");

    const testMemories = [
      { id: 1, text: "Studying for Quantum Physics exam chapter 1", importance: 8, touchedAt: now - 1000, entity: "physics" },
      { id: 2, text: "Solving physics numerical problems on wavefunctions", importance: 9, touchedAt: now - 500, entity: "physics" },
      { id: 3, text: "Bought new running shoes for marathon training", importance: 6, touchedAt: now - 86400000 * 2, entity: "fitness" },
    ];
    const arcs = clusterArcs(testMemories, now);
    assert.strictEqual(arcs.length, 2, "Should create 2 distinct entity arcs (physics and fitness)");
    assert.strictEqual(arcs[0].primaryEntity, "physics");
    assert.strictEqual(arcs[0].status, "active");
    assert.strictEqual(arcs[1].primaryEntity, "fitness");
    assert.strictEqual(arcs[1].status, "paused");
  });

  // ── 11. "PREVIOUSLY ON..." RECAP ─────────────────────────────────────────
  await t.test("Recap: Strict prompt builder and deterministic fallback", () => {
    const facts = [{ text: "User completed chapter 3", importance: 9 }, { text: "Exam is on November 10", importance: 10 }];
    const deeds = [{ id: "d1", text: "User promised to review physics notes", turn: 1, affects: [], witnesses: [], status: "open" as const }];

    const prompt = buildRecapPrompt(facts, deeds);
    assert.ok(prompt.includes("STRICT ANTI-HALLUCINATION RULES"));
    assert.ok(prompt.includes("User completed chapter 3"));
    assert.ok(prompt.includes("User promised to review physics notes"));

    const fallback = buildDeterministicRecap(facts, deeds);
    assert.ok(fallback.includes("Pichli baar ka recap:"));
    assert.ok(fallback.includes("User promised to review physics notes"));
  });

  // ── 12. SOVEREIGN CONTROLLER ACTIONS ─────────────────────────────────────
  await t.test("Controller: Chronicler actions dispatch (list_deeds, resolve_deed, get_self_model)", async () => {
    const listRes = await dispatchSaanAction("list_deeds");
    assert.strictEqual(listRes.success, true);
    assert.strictEqual(listRes.tier, 1, "list_deeds must be Tier 1 read-only");
    assert.ok(listRes.message.includes("active commitments"));

    const modelRes = await dispatchSaanAction("get_self_model");
    assert.strictEqual(modelRes.success, true);
    assert.strictEqual(modelRes.tier, 1, "get_self_model must be Tier 1 read-only");

    const resolveRes = await dispatchSaanAction("resolve_deed", { deedId: "d1", resolution: "answered" });
    assert.strictEqual(resolveRes.success, true);
    assert.strictEqual(resolveRes.tier, 2, "resolve_deed must be Tier 2 mutation");
    assert.ok(resolveRes.message.includes("d1 marked as answered"));
  });
});
