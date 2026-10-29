/**
 * @file artifact-reasoning-engine.test.ts
 * @description Comprehensive unit tests for LibreChat Modular Artifacts & HuggingFace Reasoning Accordion (Repos #42 & #43)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ArtifactReasoningEngine } from '../../lib/saan/artifact-reasoning-engine';

describe('Modular Interactive Artifacts & Reasoning Accordion (Repos #42 & #43)', () => {
  const engine = new ArtifactReasoningEngine();

  test('Reasoning Accordion - Extracts <think> CoT block and produces clean user answer', () => {
    const raw = `
      <think>
      The user is asking for sovereign architecture guidelines.
      We must prioritize zero cloud transmission and local SQLite state.
      </think>
      Here is the sovereign architecture: all operations run strictly on-device.
    `;

    const result = engine.extractReasoning(raw);
    assert.equal(result.hasReasoning, true);
    assert.ok(result.reasoning.includes('The user is asking for sovereign architecture'));
    assert.ok(result.reasoning.includes('zero cloud transmission'));
    assert.ok(!result.cleanedAnswer.includes('<think>'));
    assert.ok(result.cleanedAnswer.startsWith('Here is the sovereign architecture'));
  });

  test('XML Structured Artifacts - Parses XML <artifact> tags with attributes and MIME types', () => {
    const raw = `
      Check out this diagram:
      <artifact identifier="system-arch" title="Sovereign Architecture Flow" type="mermaid" language="mermaid">
      graph TD
        A[User Input] --> B[Saan Controller]
        B --> C[Local SQLite]
      </artifact>
    `;

    const artifacts = engine.extractArtifacts(raw);
    assert.equal(artifacts.length, 1);
    assert.equal(artifacts[0].identifier, 'system-arch');
    assert.equal(artifacts[0].title, 'Sovereign Architecture Flow');
    assert.equal(artifacts[0].type, 'mermaid');
    assert.equal(artifacts[0].mimeType, 'application/vnd.mermaid');
    assert.equal(artifacts[0].filename, 'system-arch.mmd');
    assert.ok(artifacts[0].content.includes('graph TD'));
  });

  test('Markdown Code Block Fallback - Automatically extracts code fences as artifacts', () => {
    const raw = `
      Here is the helper function:
      \`\`\`typescript
      export function add(a: number, b: number): number {
        return a + b;
      }
      \`\`\`
    `;

    const artifacts = engine.extractArtifacts(raw);
    assert.equal(artifacts.length, 1);
    assert.equal(artifacts[0].language, 'typescript');
    assert.equal(artifacts[0].type, 'code');
    assert.ok(artifacts[0].content.includes('export function add'));
    assert.equal(artifacts[0].filename, 'snippet-1.typescript');
  });

  test('Citations Extraction - Parses web URLs and extracts clean domains and chip indices', () => {
    const raw = 'References: https://github.com/LibreChat-AI/LibreChat and https://huggingface.co/chat-ui.';
    const citations = engine.extractCitations(raw);
    assert.equal(citations.length, 2);
    assert.equal(citations[0].domain, 'github.com');
    assert.equal(citations[0].index, 1);
    assert.equal(citations[1].domain, 'huggingface.co');
    assert.equal(citations[1].index, 2);
  });
});
