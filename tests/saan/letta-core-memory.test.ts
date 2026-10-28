/**
 * Letta Core Memory Blocks & Self-Editing Test Suite (letta-ai/letta)
 * Verifies clean-room implementations:
 * 1. Pinned in-context core memory blocks (human and persona).
 * 2. Self-editing tool contracts: updateBlock, append, replace.
 * 3. Character ceiling limit (2500 chars) enforcement.
 * 4. Real-time edit history / revision audit log.
 * 5. Accurate capacity summary with near-capacity alerts.
 * 6. Single source of truth persistence for system prompt rendering.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  CoreMemoryManager,
  getCoreMemoryManager,
} from "../../lib/saan/core-memory-blocks";
import { dispatchSaanAction } from "../../lib/saan/controller";

test("Letta Core Memory: initializes default human and persona blocks", () => {
  const manager = new CoreMemoryManager();
  const human = manager.getBlock("human");
  const persona = manager.getBlock("persona");

  assert.ok(human !== null, "Human block must exist");
  assert.ok(persona !== null, "Persona block must exist");
  assert.ok(human?.content.includes("Krishna"));
  assert.ok(persona?.content.includes("Saan"));
});

test("Letta Core Memory: updates human block and validates newLength", () => {
  const manager = new CoreMemoryManager();
  const updatedContent = "Name: Krishna\nRole: Lead Architect\nGoal: Build sovereign AI.";
  const res = manager.updateBlock("human", updatedContent, "user");

  assert.equal(res.success, true);
  assert.equal(res.newLength, updatedContent.length);
  assert.equal(manager.getBlock("human")?.content, updatedContent);
});

test("Letta Core Memory: appends new habit with character ceiling safety check", () => {
  const manager = new CoreMemoryManager();
  const res = manager.append("human", "Loves drinking cardamom masala chai during late-night coding.", "saan");

  assert.equal(res.success, true);
  assert.ok(manager.getBlock("human")?.content.includes("cardamom masala chai"));
});

test("Letta Core Memory: replaces substring without modifying the rest", () => {
  const manager = new CoreMemoryManager();
  manager.updateBlock("human", "Name: Krishna\nStatus: Online\nFocus: Rust", "user");

  const res = manager.replace("human", "Focus: Rust", "Focus: TypeScript & Quantum Physics", "saan");
  assert.equal(res.success, true);
  assert.equal(res.replaced, true);

  const finalContent = manager.getBlock("human")?.content;
  assert.ok(finalContent?.includes("Focus: TypeScript & Quantum Physics"));
  assert.ok(!finalContent?.includes("Focus: Rust"));
  assert.ok(finalContent?.includes("Status: Online"));
});

test("Letta Core Memory: rejects text exceeding maxCharactersPerBlock ceiling", () => {
  const manager = new CoreMemoryManager({ maxCharactersPerBlock: 100 });
  const oversizedText = "X".repeat(150);

  const resUpdate = manager.updateBlock("human", oversizedText, "user");
  assert.equal(resUpdate.success, false);
  assert.ok(resUpdate.message.includes("exceeds block ceiling"));

  const resAppend = manager.append("human", oversizedText, "saan");
  assert.equal(resAppend.success, false);
  assert.ok(resAppend.message.includes("exceeds block ceiling"));
});

test("Letta Core Memory: tracks edit history with author, operation, and diffSummary", () => {
  const manager = new CoreMemoryManager();
  manager.append("human", "Fact A: Enjoys rainy mornings.", "saan");
  manager.replace("human", "Fact A: Enjoys rainy mornings.", "Fact A: Enjoys monsoon tea.", "saan");

  const history = manager.getHistory();
  assert.ok(history.length >= 3, "History should record init, append, and replace");

  const latest = history[history.length - 1];
  assert.equal(latest.operation, "replace");
  assert.equal(latest.author, "saan");
  assert.ok(latest.diffSummary.includes("Replaced"));
});

test("Letta Core Memory: renders valid XML structure for system prompt", () => {
  const manager = new CoreMemoryManager();
  manager.updateBlock("human", "Fact: Creator of Phryvos.", "user");
  manager.updateBlock("persona", "Fact: Devoted sovereign companion.", "user");

  const xml = manager.renderForSystemPrompt();
  assert.ok(xml.includes("<core_memory>"));
  assert.ok(xml.includes("<human_profile>"));
  assert.ok(xml.includes("Fact: Creator of Phryvos."));
  assert.ok(xml.includes("</human_profile>"));
  assert.ok(xml.includes("<persona_identity>"));
  assert.ok(xml.includes("Fact: Devoted sovereign companion."));
  assert.ok(xml.includes("</persona_identity>"));
  assert.ok(xml.includes("</core_memory>"));
});

test("Letta Core Memory: calculates accurate capacity summary and isNearCapacity flag", () => {
  const manager = new CoreMemoryManager({ maxCharactersPerBlock: 100 });
  manager.updateBlock("human", "A".repeat(85), "user"); // 85%
  manager.updateBlock("persona", "B".repeat(20), "user"); // 20%

  const summary = manager.getCapacitySummary();
  const humanSummary = summary.find((s) => s.label === "human");
  const personaSummary = summary.find((s) => s.label === "persona");

  assert.equal(humanSummary?.length, 85);
  assert.equal(humanSummary?.percentage, 85);
  assert.equal(humanSummary?.isNearCapacity, true);

  assert.equal(personaSummary?.length, 20);
  assert.equal(personaSummary?.percentage, 20);
  assert.equal(personaSummary?.isNearCapacity, false);
});

test("Letta Core Memory: controller dispatch edit_core_memory append operation", async () => {
  const res = await dispatchSaanAction("edit_core_memory", {
    operation: "append",
    block: "human",
    content: "New habit recorded via autonomous action stream.",
  });

  assert.equal(res.success, true);
  assert.equal(res.tier, 1);
  assert.ok(getCoreMemoryManager().getBlock("human")?.content.includes("New habit recorded via autonomous action stream."));
});

test("Letta Core Memory: controller dispatch edit_core_memory replace operation", async () => {
  const manager = getCoreMemoryManager();
  manager.append("human", "TargetToReplaceKeyword: OldStatus", "saan");

  const res = await dispatchSaanAction("edit_core_memory", {
    operation: "replace",
    block: "human",
    oldContent: "TargetToReplaceKeyword: OldStatus",
    content: "TargetToReplaceKeyword: UpgradedStatus",
  });

  assert.equal(res.success, true);
  assert.ok(manager.getBlock("human")?.content.includes("TargetToReplaceKeyword: UpgradedStatus"));
});

test("Letta Core Memory: singleton persistence preserves state across module lookups", () => {
  const mgr1 = getCoreMemoryManager();
  mgr1.updateBlock("persona", "Identity: Sovereign Saan Singleton Test", "user");

  const mgr2 = getCoreMemoryManager();
  assert.equal(mgr2.getBlock("persona")?.content, "Identity: Sovereign Saan Singleton Test");
});

test("Letta Core Memory: rejects substring replacement when target text does not exist", () => {
  const manager = new CoreMemoryManager();
  const res = manager.replace("human", "NonExistentString12345", "NewString", "saan");

  assert.equal(res.success, false);
  assert.equal(res.replaced, false);
  assert.ok(res.message.includes("not found"));
});
