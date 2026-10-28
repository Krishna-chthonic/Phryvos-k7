/**
 * @file vault-backup-engine.ts
 * @description Clean-room TypeScript adaptation of Chatbox's sovereign local backup
 * packaging, resource deduplication, and SHA-256 integrity validation.
 * Inspired by chatboxai/chatbox (0ac6385).
 */

import { createHash } from 'crypto';

export interface BackupResource {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  checksum: string;
  contentBase64: string;
}

export interface BackupManifest {
  format: 'phryvos-vault-backup';
  version: '1.0.0';
  exportedAt: string;
  application: {
    name: 'Saan Sovereign Companion';
    version: '1.0.0';
    node: 'phryvos-k7';
  };
  stats: {
    sessionCount: number;
    memoryCount: number;
    taskCount: number;
    resourceCount: number;
    deduplicatedCount: number;
  };
  checksums: Record<string, string>;
}

export interface VaultBackupPackage {
  manifest: BackupManifest;
  data: {
    soul?: Record<string, any>;
    memories: any[];
    tasks: any[];
    sessions: any[];
    settings?: Record<string, any>;
  };
  resources: BackupResource[];
}

export class VaultBackupEngine {
  /**
   * Calculates deterministic SHA-256 checksum for byte or string payloads.
   */
  public calculateChecksum(content: string | Buffer): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Packages sovereign vault data into an export bundle with resource deduplication.
   */
  public packageBackup(input: {
    soul?: Record<string, any>;
    memories?: any[];
    tasks?: any[];
    sessions?: any[];
    settings?: Record<string, any>;
    rawResources?: Array<{ filename: string; mimeType: string; content: string | Buffer }>;
  }): VaultBackupPackage {
    const memories = input.memories || [];
    const tasks = input.tasks || [];
    const sessions = input.sessions || [];
    const rawResources = input.rawResources || [];

    // Deduplicate resources by SHA-256 checksum + MIME type
    const resources: BackupResource[] = [];
    const dedupeMap = new Map<string, BackupResource>();
    let deduplicatedCount = 0;

    for (const raw of rawResources) {
      const buffer = typeof raw.content === 'string' ? Buffer.from(raw.content) : raw.content;
      const checksum = this.calculateChecksum(buffer);
      const dedupeKey = `${checksum}:${raw.mimeType}`;

      if (dedupeMap.has(dedupeKey)) {
        deduplicatedCount++;
      } else {
        const res: BackupResource = {
          id: `res_${resources.length + 1}`,
          filename: raw.filename,
          mimeType: raw.mimeType,
          size: buffer.length,
          checksum,
          contentBase64: buffer.toString('base64'),
        };
        dedupeMap.set(dedupeKey, res);
        resources.push(res);
      }
    }

    const dataChecksums: Record<string, string> = {
      memories: this.calculateChecksum(JSON.stringify(memories)),
      tasks: this.calculateChecksum(JSON.stringify(tasks)),
      sessions: this.calculateChecksum(JSON.stringify(sessions)),
    };

    const manifest: BackupManifest = {
      format: 'phryvos-vault-backup',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      application: {
        name: 'Saan Sovereign Companion',
        version: '1.0.0',
        node: 'phryvos-k7',
      },
      stats: {
        sessionCount: sessions.length,
        memoryCount: memories.length,
        taskCount: tasks.length,
        resourceCount: resources.length,
        deduplicatedCount,
      },
      checksums: dataChecksums,
    };

    return {
      manifest,
      data: {
        soul: input.soul,
        memories,
        tasks,
        sessions,
        settings: input.settings,
      },
      resources,
    };
  }

  /**
   * Verifies manifest integrity and data checksums.
   */
  public verifyBackup(pkg: VaultBackupPackage): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!pkg.manifest || pkg.manifest.format !== 'phryvos-vault-backup') {
      errors.push('Invalid or missing backup manifest format');
    }

    if (pkg.manifest?.checksums) {
      const memSum = this.calculateChecksum(JSON.stringify(pkg.data.memories || []));
      if (pkg.manifest.checksums.memories !== memSum) {
        errors.push('Memories checksum mismatch');
      }

      const taskSum = this.calculateChecksum(JSON.stringify(pkg.data.tasks || []));
      if (pkg.manifest.checksums.tasks !== taskSum) {
        errors.push('Tasks checksum mismatch');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
