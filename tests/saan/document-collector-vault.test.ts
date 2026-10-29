import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DocumentCollector,
  DocumentCollectorVault,
  globalDocumentCollectorVault,
} from '../../lib/saan/document-collector-vault.js';

test('DocumentCollector: slugify handles extensions, casing, and special characters', () => {
  const collector = new DocumentCollector();
  assert.equal(collector.slugify('Project Alpha Overview.pdf'), 'project-alpha-overview');
  assert.equal(collector.slugify('AI / LLM Research Notes (2026).md'), 'ai-llm-research-notes-2026');
  assert.equal(collector.slugify('___Clean___'), 'clean');
  assert.equal(collector.slugify(''), 'untitled');
});

test('DocumentCollector: normalizePublishedDate defends against JavaScript 1970 Epoch coercion', () => {
  const collector = new DocumentCollector();

  // Falsy / empty values should produce valid current ISO strings, not 1970-01-01
  const epochBugInputs = [null, undefined, false, true, [], '', '   '];
  for (const input of epochBugInputs) {
    const res = collector.normalizePublishedDate(input);
    assert.ok(res.startsWith('202'), `Expected current year for ${input}, got ${res}`);
    assert.ok(!res.startsWith('1970'), `Coerced to 1970 for input ${input}`);
  }

  // Valid timestamps should parse correctly
  const validIso = '2026-05-15T12:00:00.000Z';
  assert.equal(collector.normalizePublishedDate(validIso), validIso);
});

test('DocumentCollector: extractWikilinks extracts targets and handles aliases', () => {
  const collector = new DocumentCollector();
  const sample = `
Here is a reference to [[Saan Architecture]] and [[Cognitive Core|Core Engine]].
We also mention [[Saan Architecture]] again, and [[Memory Stream]].
  `;
  const links = collector.extractWikilinks(sample);
  assert.deepEqual(links, ['Saan Architecture', 'Cognitive Core', 'Memory Stream']);
});

test('DocumentCollector: processRawText creates chunks with SHA-256 checksums and wikilinks', () => {
  const collector = new DocumentCollector();
  const text = `
Paragraph 1 discusses [[Autonomous Agents]] and how they communicate with users. It introduces the main concept.

Paragraph 2 expands on [[Bitemporal Memory]] models and chronological invalidation logic.

Paragraph 3 explores [[Sovereign Vault]] security and zero-cloud architecture.
  `;

  const doc = collector.processRawText(
    text,
    { title: 'Saan Deep Architecture Guide.txt', docAuthor: 'Krishna' },
    { maxChunkWords: 20 }
  );

  assert.equal(doc.title, 'Saan Deep Architecture Guide.txt');
  assert.equal(doc.docAuthor, 'Krishna');
  assert.ok(doc.chunks.length >= 2, `Expected at least 2 chunks, got ${doc.chunks.length}`);
  assert.ok(doc.chunks[0].checksum.length === 64, 'Checksum must be valid 64-char SHA-256');
  assert.ok(doc.detectedWikilinks.includes('Autonomous Agents'));
  assert.ok(doc.detectedWikilinks.includes('Bitemporal Memory'));
  assert.ok(doc.detectedWikilinks.includes('Sovereign Vault'));
});

test('DocumentCollectorVault: manages ingestion, chunk search, and wikilink graph', () => {
  const vault = new DocumentCollectorVault();
  vault.clear();

  const doc1 = vault.ingestDocument(
    'Neural sync active with [[Saan Cognitive Engine]]. High resonance.',
    { title: 'Sync Memo 1' }
  );
  const doc2 = vault.ingestDocument(
    'Deep indexing [[Saan Cognitive Engine]] alongside [[Local Memory]].',
    { title: 'Sync Memo 2' }
  );

  assert.equal(vault.getDocuments().length, 2);

  const searchHits = vault.searchChunks('neural');
  assert.equal(searchHits.length, 1);
  assert.equal(searchHits[0].docTitle, 'Sync Memo 1');

  const graph = vault.getWikilinkGraph();
  const engineNode = graph.find(g => g.tag === 'Saan Cognitive Engine');
  assert.ok(engineNode, 'Expected Saan Cognitive Engine in graph');
  assert.equal(engineNode.count, 2);
  assert.equal(engineNode.docIds.length, 2);
});
