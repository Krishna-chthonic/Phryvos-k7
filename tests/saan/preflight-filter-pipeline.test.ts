/**
 * @file preflight-filter-pipeline.test.ts
 * @description Comprehensive unit tests for Open-WebUI Preflight Security Filter Valves (Repo #41)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PreflightFilterPipeline } from '../../lib/saan/preflight-filter-pipeline';

describe('Open-WebUI Preflight Filter Valves & Model Generation Controls (Repo #41)', () => {
  const pipeline = new PreflightFilterPipeline();

  test('Credential Scrubbing - Redacts OpenAI, Anthropic, AWS, GitHub, JWT, and RSA Keys', () => {
    const raw = `
      OpenAI: sk-proj-1234567890abcdef1234567890
      Anthropic: sk-ant-api03-abcdef1234567890abcdef1234
      AWS: AKIAIOSFODNN7EXAMPLE
      GitHub: ghp_1234567890abcdefghijklmnopqrstuvwxyz12
      JWT: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozGz
      Key:
      -----BEGIN RSA PRIVATE KEY-----
      MIIEowIBAAKCAQEA0
      -----END RSA PRIVATE KEY-----
    `;

    const result = pipeline.scrubCredentials(raw);
    assert.ok(result.redactedCount >= 6);
    assert.ok(result.cleanedText.includes('[REDACTED_API_KEY]'));
    assert.ok(result.cleanedText.includes('[REDACTED_AWS_KEY]'));
    assert.ok(result.cleanedText.includes('[REDACTED_GITHUB_TOKEN]'));
    assert.ok(result.cleanedText.includes('[REDACTED_JWT]'));
    assert.ok(result.cleanedText.includes('[REDACTED_PRIVATE_KEY]'));
  });

  test('PII Scrubbing - Masks email addresses and phone numbers cleanly', () => {
    const raw = 'Please contact support@example.com or reach me at +1-555-234-5678 for details.';
    const result = pipeline.scrubPii(raw);
    assert.equal(result.redactedCount, 2);
    assert.ok(result.cleanedText.includes('[REDACTED_EMAIL]'));
    assert.ok(result.cleanedText.includes('[REDACTED_PHONE]'));
    assert.ok(!result.cleanedText.includes('support@example.com'));
    assert.ok(!result.cleanedText.includes('555-234-5678'));
  });

  test('Code Sanitization - Strips ANSI escapes and markdown code fences', () => {
    const rawWithAnsi = '\x1b[32mSuccess:\x1b[0m build complete';
    const cleanAnsi = pipeline.sanitizeCode(rawWithAnsi);
    assert.equal(cleanAnsi, 'Success: build complete');

    const rawWithFences = '```typescript\nconst x = 42;\nconsole.log(x);\n```';
    const cleanCode = pipeline.sanitizeCode(rawWithFences);
    assert.equal(cleanCode, 'const x = 42;\nconsole.log(x);');
  });

  test('Modular Valve Pipeline - Respects active valve toggles and generation parameters', () => {
    pipeline.updateConfig({
      enableCredentialScrubber: true,
      enablePiiScrubber: false,
      temperature: 0.85,
    });

    const input = 'My key is sk-123456789012345678901234 and email is dev@test.com';
    const output = pipeline.applyPreflightPipeline(input);

    assert.ok(output.processedPrompt.includes('[REDACTED_API_KEY]'));
    assert.ok(output.processedPrompt.includes('dev@test.com')); // PII scrubber disabled
    assert.equal(pipeline.getConfig().temperature, 0.85);
  });
});
