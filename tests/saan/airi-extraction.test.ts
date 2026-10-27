import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { categorizeResponse } from "@/lib/saan/airi-reasoning";
import {
  toNaturalSpeechText,
  escapePrices,
  MarkdownSegmenter,
} from "@/lib/saan/speech-transformer";
import { parseStreamingControlTokens } from "@/lib/saan/airi-streaming-control";
import { getDynamicStarterChips } from "@/lib/saan/airi-starter-chips";
import { formatTimePrefix } from "@/lib/saan/airi-datetime";
import { VoiceBargeInManager } from "@/lib/saan/airi-voice";
import { judgeDecision, defaultRecipes } from "@/lib/saan/airi-recipes";
import { ContextRegistry } from "@/lib/saan/airi-context-registry";
import { agentHooks } from "@/lib/saan/airi-hooks";
import { dispatchSaanAction, getActionSecurityTier } from "@/lib/saan/controller";

describe("moeru-ai/airi Extraction & Cognitive Architecture Tests", () => {
  it("isolates <think>, <thought>, and <plan> tags using response-categoriser", () => {
    const raw = `<think>
Analyzing user sentiment...
They seem stressed about deadlines.
</think>
<plan>
1. Acknowledge emotion
2. Check pending tasks
</plan>
Arre tension mat lo yaar, sab sambhal lenge. Batao kya hua?`;

    const res = categorizeResponse(raw);
    assert.equal(res.thoughts.length, 1);
    assert.ok(res.thoughts[0].includes("Analyzing user sentiment"));
    assert.equal(res.plans.length, 1);
    assert.ok(res.plans[0].includes("Acknowledge emotion"));
    assert.equal(res.speech.trim(), "Arre tension mat lo yaar, sab sambhal lenge. Batao kya hua?");
    assert.ok(!res.speech.includes("<think>"));
    assert.ok(!res.speech.includes("<plan>"));

    // Case with no reasoning tags
    const simple = "Direct answer without reasoning blocks";
    const simpleRes = categorizeResponse(simple);
    assert.equal(simpleRes.speech, simple);
    assert.equal(simpleRes.thoughts.length, 0);
    assert.equal(simpleRes.plans.length, 0);
  });

  it("transforms LaTeX math and chemistry formulas into natural spoken speech", () => {
    // Fraction conversion
    const frac = "The probability is \\frac{1}{2}.";
    const spokenFrac = toNaturalSpeechText(frac);
    assert.ok(spokenFrac.includes("1 over 2"), `Expected "1 over 2", got "${spokenFrac}"`);

    // Square root
    const sqrt = "Calculate \\sqrt{x + 1}.";
    const spokenSqrt = toNaturalSpeechText(sqrt);
    assert.ok(spokenSqrt.includes("square root of x + 1"), `Got "${spokenSqrt}"`);

    // Exponents
    const exp = "E equals m c^2";
    const spokenExp = toNaturalSpeechText(exp);
    assert.ok(spokenExp.includes("squared"), `Got "${spokenExp}"`);

    // Chemistry
    const chem = "We need \\ce{H2O} and \\ce{CO2}.";
    const spokenChem = toNaturalSpeechText(chem);
    assert.ok(
      spokenChem.includes("water") || spokenChem.includes("H 2 O"),
      `Got "${spokenChem}"`
    );
    assert.ok(
      spokenChem.includes("carbon dioxide") || spokenChem.includes("C O 2"),
      `Got "${spokenChem}"`
    );

    // Greek letters
    const greek = "Angles \\alpha, \\beta, and \\pi.";
    const spokenGreek = toNaturalSpeechText(greek);
    assert.ok(spokenGreek.includes("alpha"), `Got "${spokenGreek}"`);
    assert.ok(spokenGreek.includes("pi"), `Got "${spokenGreek}"`);
  });

  it("escapes currency prices so dollar signs do not corrupt LaTeX math delimiters", () => {
    const raw = "The book costs $5.99, while lunch was $12.";
    const escaped = escapePrices(raw);
    assert.ok(escaped.includes("\\$5.99"));
    assert.ok(escaped.includes("\\$12"));

    // Natural speech conversion of price
    const spoken = toNaturalSpeechText("That will be $25 please.");
    assert.ok(spoken.includes("25 dollars"), `Expected "25 dollars", got "${spoken}"`);
  });

  it("segments streaming speech chunks cleanly at delimiter boundaries using MarkdownSegmenter", () => {
    const segmenter = new MarkdownSegmenter();

    // Incomplete sentence should be buffered
    const chunk1 = segmenter.feed("Hey friend, ");
    assert.deepEqual(chunk1, []);

    // Sentence completion produces a segment
    const chunk2 = segmenter.feed("how are you doing today? ");
    assert.equal(chunk2.length, 1);
    assert.ok(chunk2[0].includes("how are you doing today?"));

    // Code block contents should not split mid-sentence inside fence
    segmenter.feed("```js\nconsole.log('hi.');\n");
    const insideFence = segmenter.feed("return true;");
    assert.deepEqual(insideFence, []);

    // Closing fence followed by unpunctuated text flushes cleanly
    segmenter.feed("\n```\nDone and concluding");
    const flushed = segmenter.flush();
    assert.ok(flushed.length > 0);
    assert.ok(flushed[0].includes("Done and concluding"));
  });

  it("parses streaming cadence controls (<|DELAY|>, <|ACT|>, <|CALL|>)", () => {
    const raw = "Let me think <|DELAY 1.5|> okay, I got it! <|ACT {\"action\":\"nod\"}|>";
    const parsed = parseStreamingControlTokens(raw);

    assert.equal(parsed.controls.length, 2);
    assert.equal(parsed.controls[0].type, "DELAY");
    assert.equal(parsed.controls[0].payload.seconds, 1.5);
    assert.equal(parsed.controls[1].type, "ACT");
    assert.equal(parsed.controls[1].payload.action, "nod");
    assert.equal(parsed.cleanText.trim(), "Let me think okay, I got it!");
  });

  it("formats temporal anchor prefix [YYYY-MM-DD HH:MM] for user grounding", () => {
    const now = 1714561200000; // Fixed timestamp
    const prefix = formatTimePrefix(now);
    assert.match(prefix, /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\] $/);
  });

  it("generates contextual dynamic starter chips based on circadian state", () => {
    const chips = getDynamicStarterChips();
    assert.ok(Array.isArray(chips));
    assert.ok(chips.length >= 2, "Should return at least 2 contextual starter chips");
    assert.ok(chips.some((c) => typeof c.label === "string" && c.label.length > 0));
  });

  it("evaluates decision recipes with stay-quiet, hint, and recipe branching", () => {
    const context = {
      isSleeping: true,
      hasDueTasks: false,
      userMood: "tired",
    };

    const quietDecision = judgeDecision("quiet_hours", context, defaultRecipes);
    assert.ok(quietDecision);
    assert.equal(quietDecision.action, "stay-quiet");

    const workContext = {
      isSleeping: false,
      hasDueTasks: true,
      userMood: "focused",
    };
    const workDecision = judgeDecision("task_guidance", workContext, defaultRecipes);
    assert.ok(workDecision);
    assert.ok(["hint", "recipe"].includes(workDecision.action!));
  });

  it("manages multi-source context registry with replace-self and append-self policies", () => {
    const registry = new ContextRegistry();

    registry.register({
      key: "user_status",
      policy: "replace-self",
      content: "User is coding",
      timestamp: Date.now(),
    });

    // Replace
    registry.register({
      key: "user_status",
      policy: "replace-self",
      content: "User is resting",
      timestamp: Date.now() + 10,
    });

    const entries = registry.getEntries("user_status");
    assert.equal(entries.length, 1);
    assert.equal(entries[0].content, "User is resting");

    // Append policy
    registry.register({
      key: "logs",
      policy: "append-self",
      content: "Log 1",
      timestamp: Date.now(),
    });
    registry.register({
      key: "logs",
      policy: "append-self",
      content: "Log 2",
      timestamp: Date.now() + 5,
    });

    const logEntries = registry.getEntries("logs");
    assert.equal(logEntries.length, 2);
  });

  it("manages barge-in voice interruption lifecycle", () => {
    let fadeOutCalled = false;
    const voiceMgr = new VoiceBargeInManager({
      onFadeOut: () => {
        fadeOutCalled = true;
      },
    });

    voiceMgr.startSpeaking("Hello there");
    assert.equal(voiceMgr.isSpeaking(), true);

    voiceMgr.cancel(() => {
      assert.equal(voiceMgr.isSpeaking(), false);
      assert.equal(fadeOutCalled, true);
    });
  });

  it("executes agent hooks registry lifecycle events cleanly", async () => {
    let beforeCalled = false;
    let afterCalled = false;

    const unreg1 = agentHooks.on("beforeTurn", async (ctx) => {
      beforeCalled = true;
    });
    const unreg2 = agentHooks.on("afterTurn", async (ctx) => {
      afterCalled = true;
    });

    await agentHooks.emit("beforeTurn", { turnId: "test-turn-1" });
    await agentHooks.emit("afterTurn", { turnId: "test-turn-1" });

    assert.equal(beforeCalled, true);
    assert.equal(afterCalled, true);

    unreg1();
    unreg2();
  });

  it("dispatches new controller actions with Tier 1 auto-permissions", async () => {
    assert.equal(getActionSecurityTier("get_starter_chips"), 1);
    assert.equal(getActionSecurityTier("transform_speech_text"), 1);
    assert.equal(getActionSecurityTier("categorize_text"), 1);
    assert.equal(getActionSecurityTier("parse_streaming_controls"), 1);

    // 1. get_starter_chips
    const chipsRes = await dispatchSaanAction("get_starter_chips");
    assert.equal(chipsRes.success, true);
    assert.equal(chipsRes.tier, 1);
    assert.ok(Array.isArray(chipsRes.data));

    // 2. transform_speech_text
    const speechRes = await dispatchSaanAction("transform_speech_text", {
      text: "Formula \\frac{a}{b} and price $10.",
    });
    assert.equal(speechRes.success, true);
    assert.ok(speechRes.data.spoken.includes("a over b"));

    // 3. categorize_text
    const catRes = await dispatchSaanAction("categorize_text", {
      text: "<think>Step 1</think>Main answer",
    });
    assert.equal(catRes.success, true);
    assert.equal(catRes.data.thoughts.length, 1);
    assert.equal(catRes.data.speech.trim(), "Main answer");

    // 4. parse_streaming_controls
    const ctrlRes = await dispatchSaanAction("parse_streaming_controls", {
      text: "Wait a second <|DELAY 1.0|> done",
    });
    assert.equal(ctrlRes.success, true);
    assert.equal(ctrlRes.data.controls.length, 1);
    assert.equal(ctrlRes.data.controls[0].type, "DELAY");
  });
});
