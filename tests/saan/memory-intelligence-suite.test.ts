/**
 * Memory Intelligence Suite Verification Tests
 *
 * Verifies clean-room adaptations for Batch 3 (Repos 14 to 18):
 * - langchain-ai/langmem (Incremental running summary, atomic tool safety)
 * - cpacker/MemGPT (75% context warning, keepNLast exemplars, disallowToolAsFirst)
 * - Gnosys (Sovereign portable JSON-LD snapshot, SHA-256 tamper detection)
 * - TeleAI-UAGI/telemem (Buffered memory queue, cosine similarity clustering >= 0.95, 4-axis persona)
 * - memodb-io/memobase (Topic-constrained profile budgeting, 3-state merger, event parsing)
 * - Controller (Tier 1 safe execution & action dispatching)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IncrementalSummaryManager,
  MEMGPT_SUMMARY_WARNING,
  type MessagePayload,
} from '../../lib/saan/incremental-summary';
import {
  BufferedMemoryQueue,
  cosineSimilarity,
  computeSyntheticEmbedding,
} from '../../lib/saan/buffered-memory-queue';
import {
  GnosysMemoryPortabilityEngine,
  type GnosysSnapshotPayload,
} from '../../lib/saan/portable-memory-spec';
import {
  MemobaseProfileManager,
  type ProfileAttribute,
} from '../../lib/saan/profile-extractor';
import { dispatchSaanAction } from '../../lib/saan/controller';

test('LangMem: Incremental Running Summary avoids re-summarizing earlier turns', () => {
  const mgr = new IncrementalSummaryManager({
    maxContextTokens: 40,
    warningFraction: 0.5,
    truncationFraction: 0.5,
    keepNLast: 2,
  });

  const messages: MessagePayload[] = [
    { id: 'm1', role: 'user', content: 'Hi Saan, I love green tea and study quantum computing.' },
    { id: 'm2', role: 'assistant', content: 'Noted! Green tea and quantum computing.' },
    { id: 'm3', role: 'user', content: 'Also I live in Zurich.' },
    { id: 'm4', role: 'assistant', content: 'Zurich is great.' },
  ];

  const evalResult = mgr.evaluateContextPressure(messages);
  assert.equal(evalResult.shouldWarn, true);
  assert.equal(evalResult.shouldSummarize, true);

  // Summarize first eligible batch
  const toSummarizeIds = evalResult.messagesToSummarize.map((m) => m.id);
  assert.ok(toSummarizeIds.includes('m1'));
  assert.ok(toSummarizeIds.includes('m2'));

  mgr.updateRunningSummary('User likes green tea and studies quantum physics.', toSummarizeIds);

  const state = mgr.getState();
  assert.ok(state.summarizedMessageIds.includes('m1'));
  assert.ok(state.summarizedMessageIds.includes('m2'));
  assert.equal(state.lastSummarizedMessageId, 'm2');

  // Next evaluation should NOT re-summarize m1 or m2
  const nextMessages: MessagePayload[] = [
    ...messages,
    { id: 'm5', role: 'user', content: 'Today I have an exam at ETH.' },
    { id: 'm6', role: 'assistant', content: 'Best of luck for ETH!' },
  ];

  const evalResult2 = mgr.evaluateContextPressure(nextMessages);
  const secondBatchIds = evalResult2.messagesToSummarize.map((m) => m.id);
  assert.ok(!secondBatchIds.includes('m1'));
  assert.ok(!secondBatchIds.includes('m2'));
});

test('LangMem: Atomic tool message pairing prevents orphan tool calls', () => {
  const mgr = new IncrementalSummaryManager({
    maxContextTokens: 100,
    warningFraction: 0.3,
    keepNLast: 1,
  });

  const messages: MessagePayload[] = [
    { id: 'm1', role: 'user', content: 'Search for weather in Tokyo' },
    {
      id: 'm2',
      role: 'assistant',
      content: '',
      toolCalls: [{ id: 'call_123', name: 'search_weather', arguments: '{"city":"Tokyo"}' }],
    },
    { id: 'm3', role: 'tool', toolCallId: 'call_123', content: 'Sunny 22C' },
    { id: 'm4', role: 'assistant', content: 'Tokyo is sunny and 22C.' },
    { id: 'm5', role: 'user', content: 'Thank you' },
  ];

  const evalResult = mgr.evaluateContextPressure(messages);
  const summarizedIds = evalResult.messagesToSummarize.map((m) => m.id);

  // If m2 is summarized, m3 (its tool response) must be included
  if (summarizedIds.includes('m2')) {
    assert.ok(summarizedIds.includes('m3'), 'Matching tool message m3 must be included with m2');
  }
});

test('MemGPT: 75% Context overflow warning alert and keepNLast preservation', () => {
  const mgr = new IncrementalSummaryManager({
    maxContextTokens: 100,
    warningFraction: 0.75,
    keepNLast: 3,
  });

  // Small context: under 75%
  const shortMessages: MessagePayload[] = [
    { id: 'm1', role: 'user', content: 'Hi' },
    { id: 'm2', role: 'assistant', content: 'Hello' },
  ];
  const eval1 = mgr.evaluateContextPressure(shortMessages);
  assert.equal(eval1.shouldWarn, false);
  assert.equal(eval1.warningPrompt, undefined);

  // Long context: exceeds 75 tokens
  const longText = 'This is a long conversational turn about complex software architectures '.repeat(8);
  const longMessages: MessagePayload[] = [
    { id: 'm1', role: 'user', content: longText },
    { id: 'm2', role: 'assistant', content: 'Acknowledged architecture discussion.' },
    { id: 'm3', role: 'user', content: 'What about databases?' },
    { id: 'm4', role: 'assistant', content: 'SQLite is great.' },
    { id: 'm5', role: 'user', content: 'Agreed.' },
  ];

  const eval2 = mgr.evaluateContextPressure(longMessages);
  assert.equal(eval2.shouldWarn, true);
  assert.equal(eval2.warningPrompt, MEMGPT_SUMMARY_WARNING);

  // Retained messages must preserve at least 3 recent turns
  assert.ok(eval2.retainedMessages.length >= 3);
  const retainedIds = eval2.retainedMessages.map((m) => m.id);
  assert.ok(retainedIds.includes('m3'));
  assert.ok(retainedIds.includes('m4'));
  assert.ok(retainedIds.includes('m5'));
});

test('MemGPT: disallowToolAsFirst invariant drops orphan tool message after truncation', () => {
  const mgr = new IncrementalSummaryManager({
    maxContextTokens: 60,
    warningFraction: 0.2,
    keepNLast: 1,
  });

  const messages: MessagePayload[] = [
    { id: 'm1', role: 'user', content: 'Check system status' },
    {
      id: 'm2',
      role: 'assistant',
      content: '',
      toolCalls: [{ id: 'tc_99', name: 'check_status', arguments: '{}' }],
    },
    { id: 'm3', role: 'tool', toolCallId: 'tc_99', content: 'System all green' },
    { id: 'm4', role: 'assistant', content: 'All systems are functional.' },
  ];

  const evalResult = mgr.evaluateContextPressure(messages);
  // Retained messages must never begin with role: 'tool'
  if (evalResult.retainedMessages.length > 0) {
    assert.notEqual(evalResult.retainedMessages[0].role, 'tool');
  }
});

test('TeleMem: Write buffer queue enqueuing and auto-flush threshold', () => {
  const queue = new BufferedMemoryQueue({ bufferSize: 3, similarityThreshold: 0.95 });

  const res1 = queue.enqueue({
    userId: 'u1',
    text: 'User enjoys hiking on weekends',
    axis: 'traits',
    confidence: 0.9,
  });
  assert.equal(res1.pendingCount, 1);
  assert.equal(res1.shouldFlush, false);

  const res2 = queue.enqueue({
    userId: 'u1',
    text: 'User likes walking in the mountains',
    axis: 'traits',
    confidence: 0.85,
  });
  assert.equal(res2.pendingCount, 2);
  assert.equal(res2.shouldFlush, false);

  const res3 = queue.enqueue({
    userId: 'u1',
    text: 'User visited Swiss Alps last summer',
    axis: 'events',
    confidence: 0.95,
  });
  assert.equal(res3.pendingCount, 3);
  assert.equal(res3.shouldFlush, true);
});

test('TeleMem: Cosine similarity clustering (>= 0.95) groups duplicate candidates into fused memory', () => {
  const queue = new BufferedMemoryQueue({ bufferSize: 10, similarityThreshold: 0.95 });

  // Two identical embeddings -> similarity 1.0 >= 0.95
  const embA = computeSyntheticEmbedding('User loves Italian pizza with mushrooms');
  const embB = [...embA]; // Exactly identical

  assert.ok(cosineSimilarity(embA, embB) >= 0.99);

  queue.enqueue({
    userId: 'u2',
    text: 'User loves Italian pizza with mushrooms',
    axis: 'traits',
    embedding: embA,
    confidence: 0.88,
  });

  queue.enqueue({
    userId: 'u2',
    text: 'User loves Italian pizza with mushrooms',
    axis: 'traits',
    embedding: embB,
    confidence: 0.95,
  });

  const flushResult = queue.flush('u2');
  assert.equal(flushResult.fused.clusterCount, 1);
  assert.equal(flushResult.fused.originalCount, 2);
  assert.equal(flushResult.added.length, 1);
  assert.equal(flushResult.added[0].confidence, 0.95);
  assert.equal(queue.getPendingCount('u2'), 0);
});

test('TeleMem: 4-Axis Persona Extraction Prompt generation', () => {
  const prompt = BufferedMemoryQueue.getPersonPrompt('Saan', 'User: I bought a camera today for our trip.');
  assert.ok(prompt.userPrompt.includes('relationships'));
  assert.ok(prompt.userPrompt.includes('events'));
  assert.ok(prompt.userPrompt.includes('traits'));
  assert.ok(prompt.userPrompt.includes('items'));
  assert.ok(prompt.userPrompt.includes('"Saan"'));
});

test('Gnosys: Exporting portable JSON-LD snapshot produces valid SHA-256 checksum', () => {
  const snapshot = GnosysMemoryPortabilityEngine.exportSnapshot({
    agentId: 'saan-k7-test',
    coreMemory: {
      persona: 'Saan is an authentic companion.',
      human: 'User is a systems architect.',
    },
    facts: [
      {
        id: 'f1',
        category: 'preference',
        fact: 'User prefers dark roast coffee',
        confidence: 0.95,
        validAt: '2026-10-28T10:00:00Z',
      },
    ],
    edges: [
      {
        source: 'f1',
        target: 'f2',
        relationship: 'SUPPORTS',
        weight: 0.9,
        validAt: '2026-10-28T10:00:00Z',
      },
    ],
  });

  assert.equal(snapshot['@context'], 'https://w3id.org/gnosys/v1');
  assert.equal(snapshot['@type'], 'MemorySnapshot');
  assert.equal(snapshot.version, '1.0.0');
  assert.ok(snapshot.checksum && snapshot.checksum.length === 64);
});

test('Gnosys: Import validation verifies authentic snapshot and rejects tampered content', () => {
  const validSnapshot = GnosysMemoryPortabilityEngine.exportSnapshot({
    agentId: 'saan-k7-test',
    coreMemory: { persona: 'Core persona', human: 'Core human' },
    facts: [{ id: 'f1', category: 'biography', fact: 'Fact 1', confidence: 1.0, validAt: '2026-01-01T00:00:00Z' }],
    edges: [],
  });

  const checkValid = GnosysMemoryPortabilityEngine.validateAndImport(validSnapshot);
  assert.equal(checkValid.valid, true);
  assert.equal(checkValid.factCount, 1);

  // Tamper with fact content without recalculating checksum
  const tamperedSnapshot: GnosysSnapshotPayload = {
    ...validSnapshot,
    facts: [{ id: 'f1', category: 'biography', fact: 'TAMPERED FACT', confidence: 1.0, validAt: '2026-01-01T00:00:00Z' }],
  };

  const checkTampered = GnosysMemoryPortabilityEngine.validateAndImport(tamperedSnapshot);
  assert.equal(checkTampered.valid, false);
  assert.ok(checkTampered.error?.includes('Checksum mismatch'));
});

test('Memobase: Deterministic profile truncation with preferTopics and subtopic limits', () => {
  const profiles: ProfileAttribute[] = [
    { topic: 'personalization', subTopic: 'theme', content: 'Dark theme', confidence: 0.9, updatedAt: '2026-10-20T10:00:00Z' },
    { topic: 'basic_info', subTopic: 'name', content: 'Aarav', confidence: 1.0, updatedAt: '2026-10-21T10:00:00Z' },
    { topic: 'basic_info', subTopic: 'city', content: 'Mumbai', confidence: 1.0, updatedAt: '2026-10-22T10:00:00Z' },
    { topic: 'basic_info', subTopic: 'lang', content: 'Hindi, English', confidence: 0.95, updatedAt: '2026-10-23T10:00:00Z' },
    { topic: 'basic_info', subTopic: 'extra', content: 'Over limit fact', confidence: 0.8, updatedAt: '2026-10-24T10:00:00Z' },
  ];

  // Limit basic_info to max 2 subtopics and prefer basic_info
  const truncated = MemobaseProfileManager.truncateProfiles(profiles, {
    preferTopics: ['basic_info', 'personalization'],
    maxSubtopicSize: 2,
    maxTokenSize: 500,
  });

  const basicInfoCount = truncated.filter((p) => p.topic === 'basic_info').length;
  assert.equal(basicInfoCount, 2, 'Must cap basic_info subtopics to 2');
  assert.equal(truncated[0].topic, 'basic_info', 'Prefer topic basic_info must be placed first');
});

test('Memobase: 3-State merger protocol (APPEND, UPDATE, ABORT) and tabular event parsing', () => {
  // 1. Novel addition -> APPEND
  const appendRes = MemobaseProfileManager.evaluateMergeDecision('Likes jazz music', 'Also enjoys classical piano');
  assert.equal(appendRes.action, 'APPEND');

  // 2. Evolution / Negation -> UPDATE
  const updateRes = MemobaseProfileManager.evaluateMergeDecision('Prefers light theme', 'Now prefers dark theme instead');
  assert.equal(updateRes.action, 'UPDATE');

  // 3. Duplicate redundancy -> ABORT
  const abortRes = MemobaseProfileManager.evaluateMergeDecision('Lives in Berlin', 'Lives in Berlin');
  assert.equal(abortRes.action, 'ABORT');

  // Tabular event parsing
  const rawTags = '- emotion\thopeful\n- goals\tlaunch k7 release\n- invalid_line_without_tab';
  const parsed = MemobaseProfileManager.parseTabularEventTags(rawTags);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].tag, 'emotion');
  assert.equal(parsed[0].value, 'hopeful');
  assert.equal(parsed[1].tag, 'goals');
  assert.equal(parsed[1].value, 'launch k7 release');
});

test('Controller: Dispatches Memory Intelligence Suite actions via Tier 1 safe execution', async () => {
  // 1. get_running_summary
  const resSummary = await dispatchSaanAction('get_running_summary', {
    messages: [
      { id: '1', role: 'user', content: 'Hello' },
      { id: '2', role: 'assistant', content: 'Hi there!' },
    ],
    maxContextTokens: 4096,
  });
  assert.equal(resSummary.success, true);
  assert.equal(resSummary.tier, 1);
  assert.equal(resSummary.action, 'get_running_summary');

  // 2. flush_buffered_memories
  const resFlush = await dispatchSaanAction('flush_buffered_memories', { userId: 'test_user_ctrl' });
  assert.equal(resFlush.success, true);
  assert.equal(resFlush.tier, 1);
  assert.equal(resFlush.action, 'flush_buffered_memories');

  // 3. export_gnosys_snapshot
  const resExport = await dispatchSaanAction('export_gnosys_snapshot', { agentId: 'saan-k7-ctrl' });
  assert.equal(resExport.success, true);
  assert.equal(resExport.tier, 1);
  assert.ok(resExport.data?.checksum);

  // 4. import_gnosys_snapshot
  const resImport = await dispatchSaanAction('import_gnosys_snapshot', { snapshotJson: resExport.data });
  assert.equal(resImport.success, true);
  assert.equal(resImport.tier, 1);
  assert.equal(resImport.data?.valid, true);

  // 5. get_budgeted_profile
  const resProfile = await dispatchSaanAction('get_budgeted_profile', {
    profiles: [
      { topic: 'basic_info', subTopic: 'name', content: 'Rohan', confidence: 1.0, updatedAt: '2026-10-28T12:00:00Z' },
    ],
    maxTokens: 200,
    preferTopics: ['basic_info'],
  });
  assert.equal(resProfile.success, true);
  assert.equal(resProfile.tier, 1);
  assert.equal(resProfile.data?.length, 1);
});
