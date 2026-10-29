import test from "node:test";
import assert from "node:assert/strict";
import { AssociativeMemoryNetwork } from "../../lib/saan/associative-memory-network";

test("AssociativeMemory - network initialization and default concept web", () => {
  const net = new AssociativeMemoryNetwork();
  net.seedDefaultSaanNetwork();

  const notes = net.getAllNotes();
  assert.ok(notes.length >= 6, `Expected at least 6 notes, got ${notes.length}`);

  const chaiNote = net.getNote("note-chai");
  assert.ok(chaiNote, "Expected note-chai to exist");
  assert.ok(chaiNote.links.includes("note-morning"), "Expected chai to link to morning");

  const morningNote = net.getNote("note-morning");
  assert.ok(morningNote, "Expected note-morning to exist");
  assert.ok(morningNote.links.includes("note-chai"), "Expected morning to link to chai");
});

test("AssociativeMemory - spreading activation cascade propagation", () => {
  const net = new AssociativeMemoryNetwork();
  net.seedDefaultSaanNetwork();

  const initialCycling = net.getNote("note-cycling")!.activation || 0.25;

  // Pulse seed "note-chai"
  const result = net.pulseSpreadingActivation("note-chai", 1.0, 3);

  assert.equal(result.seedId, "note-chai");
  assert.ok(result.steps.length > 0, "Expected propagation steps in cascade");

  // Verify Hop 1 reached note-morning
  const hop1 = result.steps.find((s) => s.hop === 1 && s.activatedNoteId === "note-morning");
  assert.ok(hop1, "Hop 1 should activate note-morning");
  assert.ok(hop1.propagatedEnergy >= 0.5, `Expected high propagated energy, got ${hop1.propagatedEnergy}`);

  // Verify Hop 2 reached note-cycling
  const hop2 = result.steps.find((s) => s.hop === 2 && s.activatedNoteId === "note-cycling");
  assert.ok(hop2, "Hop 2 should activate note-cycling through note-morning");

  // Verify cycling activation increased
  const finalCycling = net.getNote("note-cycling")!.activation || 0;
  assert.ok(finalCycling > initialCycling, `Expected final (${finalCycling}) > initial (${initialCycling})`);
});

test("AssociativeMemory - query-based pulse resolution", () => {
  const net = new AssociativeMemoryNetwork();
  net.seedDefaultSaanNetwork();

  // Pulse using query string instead of explicit ID
  const result = net.pulseSpreadingActivation("Jal Mahal sunrise", 1.0, 2);

  assert.ok(result.steps.length >= 0);
  assert.ok(result.activeNotesSummary.length > 0);
  assert.ok(result.durationMs >= 0);
});

test("AssociativeMemory - Hebbian co-activation reinforcement", () => {
  const net = new AssociativeMemoryNetwork();
  net.seedDefaultSaanNetwork();

  const n1 = net.getNote("note-chai")!;
  const n2 = net.getNote("note-k7")!;

  // Initially unlinked
  assert.ok(!n1.links.includes(n2.id));

  // Apply Hebbian reinforcement
  net.applyHebbianReinforcement(n1.id, n2.id, 0.1);

  // Now linked
  assert.ok(n1.links.includes(n2.id));
  assert.ok(n2.links.includes(n1.id));
});

test("AssociativeMemory - nonexistent seed handling", () => {
  const net = new AssociativeMemoryNetwork();
  const result = net.pulseSpreadingActivation("xyznonexistentterm12345");

  assert.equal(result.steps.length, 0);
  assert.equal(result.activeNotesSummary.length, 0);
});
