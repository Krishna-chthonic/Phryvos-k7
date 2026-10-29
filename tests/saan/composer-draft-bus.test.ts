/**
 * @file composer-draft-bus.test.ts
 * @description Comprehensive unit tests for LobeHub Composer Draft Bus & Intent Classification (Repo #45)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ComposerDraftBus } from '../../lib/saan/composer-draft-bus';

describe('LobeHub Composer Draft Bus & Multi-Session Routing (Repo #45)', () => {
  const bus = new ComposerDraftBus();

  test('Draft Bus Lifecycle - Posts, listens, and consumes pending drafts', () => {
    let receivedDraft: any = null;
    const unsubscribe = bus.subscribe((d) => {
      receivedDraft = d;
    });

    assert.equal(bus.hasDraft(), false);
    const posted = bus.postDraft('Hello Saan, let us review the architecture.', {
      append: false,
      targetAgentId: 'saan-main',
    });
    assert.equal(posted, true);
    assert.equal(bus.hasDraft(), true);
    assert.ok(receivedDraft);
    assert.equal(receivedDraft?.text, 'Hello Saan, let us review the architecture.');

    // Consume draft
    const consumed = bus.consumeDraft();
    assert.equal(consumed?.text, 'Hello Saan, let us review the architecture.');
    assert.equal(bus.hasDraft(), false);
    assert.equal(receivedDraft, null);

    unsubscribe();
  });

  test('Shell Stripping - Cleans conversational scaffolding and wrapper tokens', () => {
    const raw = '帮我创建一个 python web scraper agent https://example.com';
    const cleaned = bus.removeAgentShell(raw);
    assert.ok(!cleaned.includes('帮我'));
    assert.ok(!cleaned.includes('创建'));
    assert.ok(!cleaned.includes('https://example.com'));
    assert.ok(cleaned.includes('python web scraper'));
  });

  test('Intent Classification - Distinguishes companion memory from ephemeral skill workflows', () => {
    // Persistent companion intent
    const companionPrompt = 'Please remember my preference for green tea and follow up with me daily.';
    const companionResult = bus.classifyIntent(companionPrompt);
    assert.equal(companionResult.intent, 'companion_memory');
    assert.ok(companionResult.confidence >= 0.7);
    assert.ok(companionResult.matchedKeywords.length > 0);

    // Ephemeral skill workflow intent
    const skillPrompt = 'Generate a reusable template checklist and SOP workflow for code review.';
    const skillResult = bus.classifyIntent(skillPrompt);
    assert.equal(skillResult.intent, 'ephemeral_skill');
    assert.ok(skillResult.confidence >= 0.6);
  });

  test('Privacy-First Skill Query Generation - Generates queries only for high confidence categories', () => {
    const prompt = 'Need an automation workflow for resume review and interview evaluation.';
    const queries = bus.buildAgentSkillSuggestionQueries(prompt);
    assert.ok(queries.length > 0);
    assert.ok(queries.includes('resume review'));
  });
});
