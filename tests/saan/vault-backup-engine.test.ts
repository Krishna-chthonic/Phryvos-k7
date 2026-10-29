/**
 * @file vault-backup-engine.test.ts
 * @description Comprehensive unit tests for Chatbox Sovereign Encrypted Vault & SHA-256 Checksum (Repo #44)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { VaultBackupEngine, BACKUP_FORMAT, BACKUP_FORMAT_VERSION } from '../../lib/saan/vault-backup-engine';

describe('Chatbox Sovereign Encrypted Vault & SHA-256 Checksum Engine (Repo #44)', () => {
  const engine = new VaultBackupEngine();

  test('SHA-256 Calculation - Computes deterministic hex hash for strings and buffers', () => {
    const text = 'Sovereign companion local vault state';
    const hash = engine.calculateChecksum(text);
    assert.equal(typeof hash, 'string');
    assert.equal(hash.length, 64);
    assert.match(hash, /^[0-9a-f]{64}$/);

    const hash2 = engine.calculateChecksum(Buffer.from(text, 'utf8'));
    assert.equal(hash, hash2);
  });

  test('Safe Session Path - Truncates long filenames safely using SHA-256 digest', () => {
    const shortId = 'chat-session-123';
    const safeShort = engine.safeSessionPathComponent(shortId);
    assert.equal(safeShort, 'chat-session-123');

    // Super long path > 200 bytes
    const longId = 'a'.repeat(300);
    const safeLong = engine.safeSessionPathComponent(longId);
    assert.ok(safeLong.startsWith('id-'));
    assert.ok(safeLong.length <= 70);
  });

  test('Settings Scrubber - Removes sensitive API keys and secrets prior to backup', () => {
    const rawSettings = {
      theme: 'dark',
      soundEnabled: true,
      openai_apiKey: 'sk-1234567890abcdef',
      anthropic_secret: 'sk-ant-12345',
      bearerToken: 'ey12345678',
    };

    const clean = engine.cleanSettingsForBackup(rawSettings, false);
    assert.equal(clean.theme, 'dark');
    assert.equal(clean.soundEnabled, true);
    assert.equal(clean.openai_apiKey, undefined);
    assert.equal(clean.anthropic_secret, undefined);
    assert.equal(clean.bearerToken, undefined);
  });

  test('Vault Package Creation & Verification - Deduplicates resources and validates SHA-256 checksums', () => {
    const pkg = engine.createBackupPackage({
      soul: { name: 'Saan', archetype: 'Architect' },
      memories: [{ id: 'mem_1', content: 'User likes green tea' }],
      tasks: [{ id: 'task_1', title: 'Complete repository review' }],
      sessions: [{ id: 'sess_1', title: 'Deep dive conversation' }],
      resources: [
        {
          id: 'res_1',
          filename: 'avatar.png',
          mimeType: 'image/png',
          contentBase64: Buffer.from('fake image data 1').toString('base64'),
        },
        // Duplicate resource content
        {
          id: 'res_2',
          filename: 'avatar_copy.png',
          mimeType: 'image/png',
          contentBase64: Buffer.from('fake image data 1').toString('base64'),
        },
      ],
    });

    assert.equal(pkg.manifest.format, BACKUP_FORMAT);
    assert.equal(pkg.manifest.version, BACKUP_FORMAT_VERSION);
    assert.equal(pkg.manifest.stats.memoryCount, 1);
    assert.equal(pkg.manifest.stats.deduplicatedCount, 1);
    assert.equal(pkg.resources.length, 1); // Only 1 unique resource stored

    // Verify package integrity
    const verifyResult = engine.verifyBackup(pkg);
    assert.equal(verifyResult.valid, true);
    assert.equal(verifyResult.errors.length, 0);
  });

  test('Restore Simulation - Accurately counts restored entities and handles duplicate conflicts', () => {
    const pkg = engine.createBackupPackage({
      memories: [{ id: 'mem_1', content: 'Original fact' }, { id: 'mem_2', content: 'New fact' }],
      sessions: [{ id: 'sess_1', title: 'First session' }],
    });

    // Existing state has mem_1
    const existing = {
      memories: [{ id: 'mem_1', content: 'Existing fact' }],
    };

    const restoreResult = engine.restoreBackup(pkg, existing, { conflictResolution: 'skip' });
    assert.equal(restoreResult.success, true);
    assert.equal(restoreResult.restoredMemories, 1); // skipped mem_1
    assert.equal(restoreResult.conflictsHandled, 1);
  });
});
