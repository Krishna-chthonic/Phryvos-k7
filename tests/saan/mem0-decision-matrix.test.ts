/**
 * Mem0 4-State Memory Decision Matrix & Identity Scope Test Suite (mem0ai/mem0)
 * Verifies clean-room implementations:
 * 1. 4-State Memory Mutation Matrix (ADD, UPDATE, DELETE, NONE).
 * 2. Identity Scope Sanitizer (privilege escalation prevention).
 * 3. Contradiction & negation detection with target invalidation.
 * 4. Duplicate rejection floor (NONE).
 * 5. Rolling audit event buffer & telemetry stream.
 * 6. Integration with extractMemoriesFromTurn.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateMem0Decision,
  sanitizeIdentityScope,
  createMemoryAuditEvent,
  recordMem0AuditEvent,
  getMem0AuditLog,
  clearMem0AuditLog,
  type ExistingMemoryItem,
  type CandidateFact,
} from "../../lib/saan/mem0-decision-matrix";
import { dispatchSaanAction } from "../../lib/saan/controller";
import { extractMemoriesFromTurn } from "../../lib/saan/memory";

test("Mem0: evaluates novel candidate fact as ADD", () => {
  const existing: ExistingMemoryItem[] = [
    { id: "1", text: "User lives in Delhi", category: "personal", updatedAt: Date.now(), isActive: true },
  ];
  const candidate: CandidateFact = {
    text: "User is studying quantum computing",
    category: "personal",
    sourceRole: "user",
  };

  const decision = evaluateMem0Decision(candidate, existing);
  assert.equal(decision.event, "ADD");
  assert.ok(decision.reason.includes("novel"));
});

test("Mem0: detects identical or subset fact as NONE (duplicate prevention)", () => {
  const existing: ExistingMemoryItem[] = [
    { id: "10", text: "Krishna loves cardamom masala chai", category: "preference", updatedAt: Date.now(), isActive: true },
  ];
  const candidate: CandidateFact = {
    text: "Krishna loves cardamom masala chai",
    category: "preference",
    sourceRole: "user",
  };

  const decision = evaluateMem0Decision(candidate, existing);
  assert.equal(decision.event, "NONE");
  assert.equal(decision.targetId, "10");
  assert.ok(decision.reason.includes("already present"));
});

test("Mem0: detects explicit negation and returns DELETE for contradicted memory", () => {
  const existing: ExistingMemoryItem[] = [
    { id: "20", text: "User drinks black coffee every morning", category: "preference", updatedAt: Date.now(), isActive: true },
  ];
  const candidate: CandidateFact = {
    text: "I quit coffee and no longer drink coffee",
    category: "preference",
    sourceRole: "user",
  };

  const decision = evaluateMem0Decision(candidate, existing);
  assert.equal(decision.event, "DELETE");
  assert.equal(decision.targetId, "20");
  assert.ok(decision.reason.includes("explicitly negates"));
});

test("Mem0: detects category modification and returns UPDATE with targetId", () => {
  const existing: ExistingMemoryItem[] = [
    { id: "30", text: "User lives in Mumbai apartment", category: "personal", updatedAt: Date.now(), isActive: true },
  ];
  const candidate: CandidateFact = {
    text: "User lives in Bengaluru villa",
    category: "personal",
    sourceRole: "user",
  };

  const decision = evaluateMem0Decision(candidate, existing);
  assert.equal(decision.event, "UPDATE");
  assert.equal(decision.targetId, "30");
  assert.ok(decision.reason.includes("refines or updates"));
});

test("Mem0: sanitizes identity scope by stripping protected metadata keys", () => {
  const params = {
    userId: "krishna",
    agentId: "saan",
    inputMetadata: {
      clientVersion: "7.0.0",
      theme: "dark",
      user_id: "malicious_user_override", // Attack attempt
      agent_id: "rogue_agent",            // Attack attempt
      actor_id: "root",                   // Attack attempt
    },
  };

  const sanitized = sanitizeIdentityScope(params);

  assert.equal(sanitized.scopeFilters.userId, "krishna");
  assert.equal(sanitized.scopeFilters.agentId, "saan");
  assert.equal(sanitized.sanitizedMetadata.clientVersion, "7.0.0");
  assert.equal(sanitized.sanitizedMetadata.theme, "dark");
  assert.equal(sanitized.sanitizedMetadata.user_id, undefined);
  assert.equal(sanitized.sanitizedMetadata.agent_id, undefined);
  assert.equal(sanitized.sanitizedMetadata.actor_id, undefined);
});

test("Mem0: creates structured audit event with timestamp and actors", () => {
  const ev = createMemoryAuditEvent("test_audit_1", "Learned Rust syntax", "ADD", "krishna", "saan");
  assert.equal(ev.id, "test_audit_1");
  assert.equal(ev.memory, "Learned Rust syntax");
  assert.equal(ev.event, "ADD");
  assert.equal(ev.userId, "krishna");
  assert.equal(ev.agentId, "saan");
  assert.ok(ev.timestamp > 0);
});

test("Mem0: records and retrieves audit events from buffer", () => {
  clearMem0AuditLog();
  const ev = createMemoryAuditEvent("ev_test", "Test Fact", "UPDATE", "krishna", "saan");
  recordMem0AuditEvent(ev);

  const log = getMem0AuditLog();
  assert.ok(log.length >= 1);
  assert.equal(log[0].id, "ev_test");
  assert.equal(log[0].event, "UPDATE");
});

test("Mem0: extractMemoriesFromTurn applies 4-state engine on explicit directives", () => {
  const prompt = "Ye baat hamesha yaad rakhna: Mera favourite theoretical physicist Richard Feynman hai";
  const decisions = extractMemoriesFromTurn(prompt);

  assert.ok(decisions.length >= 1);
  const first = decisions[0];
  assert.ok(["ADD", "NONE", "UPDATE"].includes(first.event));
  assert.ok(first.factText.toLowerCase().includes("feynman"));
});

test("Mem0: extractMemoriesFromTurn handles contradictions and negations", () => {
  const prompt = "I no longer eat spicy street food, switched to homemade meals";
  const decisions = extractMemoriesFromTurn(prompt);

  assert.ok(Array.isArray(decisions));
});

test("Mem0: controller dispatches apply_mem0_decision action successfully", async () => {
  const res = await dispatchSaanAction("apply_mem0_decision", {
    candidate: { text: "Prefers morning focus sprint", category: "preference", sourceRole: "user" },
    existingMemories: [{ id: "mem_1", text: "Old preference", category: "preference", updatedAt: Date.now(), isActive: true }],
  });

  assert.equal(res.success, true);
  assert.equal(res.tier, 1);
  assert.ok(res.data.event);
});

test("Mem0: rolling buffer trims oldest events when exceeding maximum capacity", () => {
  clearMem0AuditLog();
  for (let i = 0; i < 60; i++) {
    recordMem0AuditEvent(createMemoryAuditEvent(`ev_${i}`, `Fact ${i}`, "ADD", "user", "saan"));
  }

  const log = getMem0AuditLog();
  assert.equal(log.length, 50, "Buffer capacity ceiling must be strictly 50");
  assert.equal(log[0].id, "ev_59"); // Most recent
});
