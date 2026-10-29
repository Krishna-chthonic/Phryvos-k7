import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  MemobaseProfileManager,
  MemobaseProfileStore,
  type ProfileAttribute,
  type UserEventEntry,
} from "../../lib/saan/profile-extractor";

describe("Repo 15: Memobase Categorical User Profile & Fact Merger Engine", () => {
  test("truncateProfiles enforces recency and preferTopics priority ordering", () => {
    const profiles: ProfileAttribute[] = [
      {
        topic: "interaction_history",
        subTopic: "turn_1",
        content: "First turn",
        confidence: 0.9,
        updatedAt: "2026-10-20T10:00:00Z",
      },
      {
        topic: "basic_info",
        subTopic: "name",
        content: "Krishna",
        confidence: 0.99,
        updatedAt: "2026-10-21T10:00:00Z",
      },
      {
        topic: "companion_preferences",
        subTopic: "chai",
        content: "Loves ginger chai",
        confidence: 0.95,
        updatedAt: "2026-10-22T10:00:00Z",
      },
    ];

    // Priority ordering: basic_info first, then companion_preferences
    const truncated = MemobaseProfileManager.truncateProfiles(profiles, {
      preferTopics: ["basic_info", "companion_preferences"],
    });

    assert.equal(truncated.length, 3);
    assert.equal(truncated[0].topic, "basic_info");
    assert.equal(truncated[1].topic, "companion_preferences");
    assert.equal(truncated[2].topic, "interaction_history");
  });

  test("truncateProfiles enforces subtopic count limit per topic", () => {
    const profiles: ProfileAttribute[] = [
      { topic: "hobbies", subTopic: "reading", content: "Sci-fi", confidence: 0.9, updatedAt: "2026-10-22T10:00:00Z" },
      { topic: "hobbies", subTopic: "gaming", content: "RPGs", confidence: 0.9, updatedAt: "2026-10-21T10:00:00Z" },
      { topic: "hobbies", subTopic: "cooking", content: "Chai", confidence: 0.9, updatedAt: "2026-10-20T10:00:00Z" },
    ];

    const capped = MemobaseProfileManager.truncateProfiles(profiles, {
      maxSubtopicSize: 2,
    });

    assert.equal(capped.length, 2);
    // Most recent 2 should be retained
    assert.equal(capped[0].subTopic, "reading");
    assert.equal(capped[1].subTopic, "gaming");
  });

  test("evaluateMergeDecision performs 3-state fact merger protocol (APPEND, UPDATE, ABORT)", () => {
    // 1. Novel fact into empty memo -> APPEND
    const dAppend = MemobaseProfileManager.evaluateMergeDecision(null, "Prefers ginger chai in morning");
    assert.equal(dAppend.action, "APPEND");
    assert.ok(dAppend.updatedContent?.includes("Prefers ginger chai"));

    // 2. Duplicate fact already covered -> ABORT
    const dAbort = MemobaseProfileManager.evaluateMergeDecision("Prefers ginger chai in morning", "ginger chai");
    assert.equal(dAbort.action, "ABORT");

    // 3. Evolving fact with negation / switch keyword -> UPDATE
    const dUpdate = MemobaseProfileManager.evaluateMergeDecision(
      "Prefers ginger chai in morning",
      "Now prefers green tea instead"
    );
    assert.equal(dUpdate.action, "UPDATE");
    assert.ok(dUpdate.updatedContent?.includes("[Updated]"));
  });

  test("MemobaseProfileStore initializes default attributes and merges novel updates", () => {
    const store = new MemobaseProfileStore();
    const all = store.getAll();
    assert.ok(all.length >= 5);

    const res = store.setAttribute({
      topic: "companion_preferences",
      subTopic: "beverage_rituals",
      content: "Now prefers iced chai during warm weather",
      confidence: 0.96,
    });

    assert.equal(res.decision.action, "UPDATE");
    assert.ok(res.attribute.content.includes("iced chai"));
  });

  test("parseTabularEventTags parses tabular format - TAG\\tVALUE", () => {
    const raw = "- USER_MOOD\tcheerful\n- CHAI_TIME\t08:30 AM\nInvalid line";
    const parsed = MemobaseProfileManager.parseTabularEventTags(raw);

    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].tag, "USER_MOOD");
    assert.equal(parsed[0].value, "cheerful");
    assert.equal(parsed[1].tag, "CHAI_TIME");
    assert.equal(parsed[1].value, "08:30 AM");
  });

  test("filterRecentEvents filters events outside 21-day window", () => {
    const now = new Date("2026-10-29T12:00:00Z");
    const events: UserEventEntry[] = [
      { id: "e1", tag: "RECENT", value: "ok", createdAt: "2026-10-25T12:00:00Z" }, // 4 days ago
      { id: "e2", tag: "OLD", value: "too old", createdAt: "2026-09-15T12:00:00Z" }, // 44 days ago
    ];

    const filtered = MemobaseProfileManager.filterRecentEvents(events, 21, now);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, "e1");
  });
});
