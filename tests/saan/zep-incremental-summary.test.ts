import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  IncrementalSummaryManager,
  extractEntityTagsFromText,
  countMessageTokens,
  type MessagePayload,
  MEMGPT_SUMMARY_WARNING,
} from "../../lib/saan/incremental-summary";

describe("Repo 14: Zep / LangMem Incremental Summarization & Entity Tags", () => {
  test("extractEntityTagsFromText identifies named entities across categories", () => {
    const text =
      "Krishna loves morning ginger chai in Jaipur, focusing on deep work sprint and sovereign privacy.";
    const tags = extractEntityTagsFromText(text);

    assert.ok(tags.length >= 4);

    const personTag = tags.find((t) => t.name.includes("Krishna"));
    assert.ok(personTag);
    assert.equal(personTag.category, "person");
    assert.ok(personTag.confidence >= 0.95);

    const chaiTag = tags.find((t) => t.name === "Ginger Chai");
    assert.ok(chaiTag);
    assert.equal(chaiTag.category, "preference");

    const jaipurTag = tags.find((t) => t.name === "Jaipur");
    assert.ok(jaipurTag);
    assert.equal(jaipurTag.category, "place");
  });

  test("IncrementalSummaryManager evaluates 75% context warning threshold", () => {
    const manager = new IncrementalSummaryManager({
      maxContextTokens: 100,
      warningFraction: 0.75,
      keepNLast: 2,
    });

    // 50 tokens (below 75% warning)
    const lowPressureMessages: MessagePayload[] = [
      { id: "m1", role: "user", content: "A".repeat(100) }, // 25 tokens
      { id: "m2", role: "assistant", content: "B".repeat(100) }, // 25 tokens
    ];
    const evalLow = manager.evaluateContextPressure(lowPressureMessages);
    assert.equal(evalLow.shouldWarn, false);
    assert.equal(evalLow.shouldSummarize, false);

    // 80 tokens (above 75% warning)
    const highPressureMessages: MessagePayload[] = [
      { id: "m1", role: "user", content: "A".repeat(100) }, // 25 tokens
      { id: "m2", role: "assistant", content: "B".repeat(100) }, // 25 tokens
      { id: "m3", role: "user", content: "C".repeat(120) }, // 30 tokens
      { id: "m4", role: "assistant", content: "D".repeat(40) }, // 10 tokens
    ];
    const evalHigh = manager.evaluateContextPressure(highPressureMessages);
    assert.equal(evalHigh.shouldWarn, true);
    assert.equal(evalHigh.warningPrompt, MEMGPT_SUMMARY_WARNING);
    assert.equal(evalHigh.shouldSummarize, true);
    assert.ok(evalHigh.messagesToSummarize.length > 0);
  });

  test("atomic tool call pairing invariant pulls matching tool messages into summary batch", () => {
    const manager = new IncrementalSummaryManager({
      maxContextTokens: 30,
      warningFraction: 0.5,
      keepNLast: 1,
    });

    const messages: MessagePayload[] = [
      {
        id: "msg_ai_tool",
        role: "assistant",
        content: "Let me check memory.",
        toolCalls: [{ id: "call_123", name: "search_memory", arguments: "{}" }],
      },
      {
        id: "msg_tool_resp",
        role: "tool",
        toolCallId: "call_123",
        content: "Found 2 matching preferences.",
      },
      {
        id: "msg_user_recent",
        role: "user",
        content: "Great, thanks!",
      },
    ];

    const res = manager.evaluateContextPressure(messages);

    // Both the assistant tool call and its corresponding tool return must be in the summary batch
    const summarizedIds = res.messagesToSummarize.map((m) => m.id);
    assert.ok(summarizedIds.includes("msg_ai_tool"));
    assert.ok(summarizedIds.includes("msg_tool_resp"));
  });

  test("disallowToolAsFirst invariant ensures retained messages never begin with orphan tool response", () => {
    const manager = new IncrementalSummaryManager({
      maxContextTokens: 60,
      warningFraction: 0.5,
      keepNLast: 1,
    });

    const messages: MessagePayload[] = [
      { id: "m1", role: "user", content: "Old message ".repeat(10) },
      { id: "m2", role: "tool", toolCallId: "orphan_call", content: "Orphan tool output" },
      { id: "m3", role: "assistant", content: "Active assistant reply" },
    ];

    const res = manager.evaluateContextPressure(messages);

    // Retained messages must not start with role === 'tool'
    if (res.retainedMessages.length > 0) {
      assert.notEqual(res.retainedMessages[0].role, "tool");
    }
  });

  test("updateRunningSummary and getSnapshot maintain running summary state", () => {
    const manager = new IncrementalSummaryManager(
      { maxContextTokens: 1000 },
      { summary: "Initial summary" }
    );

    const nextState = manager.updateRunningSummary("User mentioned moving to Bengaluru.", ["m10"]);
    assert.ok(nextState.summary.includes("Initial summary"));
    assert.ok(nextState.summary.includes("User mentioned moving to Bengaluru"));
    assert.equal(nextState.lastSummarizedMessageId, "m10");

    const snapshot = manager.getSnapshot(300);
    assert.equal(snapshot.summarizedMessageCount, 1);
    assert.ok(snapshot.entityTags.length > 0);
    assert.equal(snapshot.contextPressure.isWarningTriggered, false);
  });
});
