import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CoreMemoryManager,
  getCoreMemoryManager,
  type CoreMemoryEditEvent,
} from '../../lib/saan/core-memory-blocks.js';

test('CoreMemoryManager: initializes default human, persona, project, and emotional_state blocks', () => {
  const manager = new CoreMemoryManager();
  const human = manager.getBlock('human');
  const persona = manager.getBlock('persona');
  const project = manager.getBlock('project');
  const emotion = manager.getBlock('emotional_state');

  assert.ok(human && human.content.includes('Krishna'));
  assert.ok(persona && persona.content.includes('Saan'));
  assert.ok(project && project.content.includes('K7'));
  assert.ok(emotion && emotion.content.includes('Bond Score'));
});

test('CoreMemoryManager: append adds text with ceiling protection and dispatches event', () => {
  const manager = new CoreMemoryManager({ maxCharactersPerBlock: 500 });
  let receivedEvent: CoreMemoryEditEvent | null = null;
  const unsubscribe = manager.addListener((ev) => {
    receivedEvent = ev;
  });

  const appendRes = manager.append('human', 'Prefers Himalayan spring water.');
  assert.equal(appendRes.success, true);
  assert.ok(receivedEvent !== null);
  assert.equal((receivedEvent as any)?.block, 'human');
  assert.equal((receivedEvent as any)?.operation, 'append');

  // Verify rejection when exceeding ceiling
  const hugeText = 'A'.repeat(600);
  const rejectRes = manager.append('human', hugeText);
  assert.equal(rejectRes.success, false);
  assert.ok(rejectRes.message.includes('exceeds block ceiling'));

  unsubscribe();
});

test('CoreMemoryManager: replace updates target substring and rejects missing substring', () => {
  const manager = new CoreMemoryManager();
  const resSuccess = manager.replace('human', 'chai connoisseur', 'artisanal tea aficionado');
  assert.equal(resSuccess.success, true);
  assert.equal(resSuccess.replaced, true);

  const block = manager.getBlock('human');
  assert.ok(block?.content.includes('artisanal tea aficionado'));

  const resFail = manager.replace('human', 'non_existent_text_phrase', 'replacement');
  assert.equal(resFail.success, false);
  assert.equal(resFail.replaced, false);
});

test('CoreMemoryManager: getCapacitySummary reports accurate percentages', () => {
  const manager = new CoreMemoryManager({ maxCharactersPerBlock: 1000 });
  const summary = manager.getCapacitySummary();
  assert.equal(summary.length, 4);

  for (const item of summary) {
    assert.ok(item.percentage >= 0 && item.percentage <= 100);
    assert.equal(item.maxCapacity, 1000);
  }
});
