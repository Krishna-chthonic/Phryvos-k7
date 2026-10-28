/**
 * @file vault-backup-engine.ts
 * @description Clean-room TypeScript adaptation of Chatbox's sovereign local backup
 * packaging, resource deduplication, manifest graph verification, and restore engine.
 * Inspired by chatboxai/chatbox (0ac6385, GPL-3.0 clean-room adaptation).
 */

import { createHash } from 'crypto';

export const BACKUP_FORMAT = 'phryvos-vault-backup';
export const BACKUP_FORMAT_VERSION = '2.0.0';
export const MAX_BACKUP_JSON_ENTRY_BYTES = 128 * 1024 * 1024; // 128 MB
export const MAX_BACKUP_RESOURCE_ENTRY_BYTES = 512 * 1024 * 1024; // 512 MB

export type BackupResourceKind =
  | 'image'
  | 'parsed-attachment'
  | 'raw-attachment'
  | 'parsed-link'
  | 'tool-result'
  | 'avatar'
  | 'background'
  | 'copilot-image';

export type BackupResourceScope = 'session' | 'shared' | 'global';
export type BackupResourceEncoding = 'utf8' | 'data-url-base64';

export interface BackupResource {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  checksum: string;
  contentBase64: string;
  kind?: BackupResourceKind;
  scope?: BackupResourceScope;
  encoding?: BackupResourceEncoding;
  sessionIds?: string[];
  originalStorageKeys?: string[];
}

export interface BackupManifest {
  format: 'phryvos-vault-backup';
  version: string;
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
  sessions?: Array<{ id: string; meta: { id: string; title?: string } }>;
  resources?: Array<{
    id: string;
    originalStorageKeys: string[];
    sessionIds: string[];
    scope: BackupResourceScope;
  }>;
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

export interface RestoreOptions {
  conflictResolution: 'overwrite' | 'skip' | 'rename';
  restoreSettings?: boolean;
}

export interface RestoreResult {
  success: boolean;
  restoredSessions: number;
  restoredMemories: number;
  restoredTasks: number;
  restoredResources: number;
  conflictsHandled: number;
  errors: string[];
}

export class VaultBackupEngine {
  /**
   * Calculates deterministic SHA-256 checksum for byte or string payloads.
   */
  public calculateChecksum(content: string | Buffer): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Defensive filesystem path sanitization ensuring session path components
   * do not exceed 200 bytes, falling back to SHA-256 identifier.
   */
  public safeSessionPathComponent(sessionId: string): string {
    const encoded = encodeURIComponent(sessionId).replace(/\./g, '%2E');
    if (Buffer.byteLength(encoded, 'utf8') <= 200) {
      return encoded;
    }
    const checksum = this.calculateChecksum(sessionId);
    return `id-${checksum}`;
  }

  /**
   * Cleans sensitive API keys and tokens from settings unless explicitly included.
   */
  public cleanSettingsForBackup(
    settings: Record<string, any> = {},
    includeKeys: boolean = false
  ): Record<string, any> {
    if (includeKeys) return { ...settings };
    const cleaned = { ...settings };
    const sensitiveKeys = ['apikey', 'api_key', 'token', 'secret', 'password', 'bearer', 'key'];
    for (const key of Object.keys(cleaned)) {
      const lower = key.toLowerCase();
      if (sensitiveKeys.some(s => lower.includes(s))) {
        delete cleaned[key];
      }
    }
    return cleaned;
  }

  /**
   * Performs exhaustive relational graph validation on backup manifest.
   */
  public validateBackupManifestGraph(manifest: BackupManifest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!manifest || manifest.format !== BACKUP_FORMAT) {
      errors.push(`Invalid backup manifest format: expected '${BACKUP_FORMAT}'`);
      return { valid: false, errors };
    }

    const sessionIds = new Set<string>();
    if (manifest.sessions) {
      for (const s of manifest.sessions) {
        if (sessionIds.has(s.id)) {
          errors.push(`Duplicate session id in manifest: ${s.id}`);
        }
        sessionIds.add(s.id);
        if (s.meta && s.meta.id !== s.id) {
          errors.push(`Session metadata id does not match: expected ${s.id}, got ${s.meta.id}`);
        }
      }
    }

    if (manifest.resources) {
      const resourceIds = new Set<string>();
      const resourceStorageKeys = new Set<string>();

      for (const res of manifest.resources) {
        if (resourceIds.has(res.id)) {
          errors.push(`Duplicate resource id in manifest: ${res.id}`);
        }
        resourceIds.add(res.id);

        for (const k of res.originalStorageKeys || []) {
          if (resourceStorageKeys.has(k)) {
            errors.push(`Duplicate resource storage key in manifest: ${k}`);
          }
          resourceStorageKeys.add(k);
        }

        for (const sid of res.sessionIds || []) {
          if (sessionIds.size > 0 && !sessionIds.has(sid)) {
            errors.push(`Resource ${res.id} references an unknown session: ${sid}`);
          }
        }

        if (res.scope === 'session' && (!res.sessionIds || res.sessionIds.length !== 1)) {
          errors.push(`Session-scoped resource ${res.id} must be bound to exactly one session`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
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
    includeKeys?: boolean;
    rawResources?: Array<{
      filename: string;
      mimeType: string;
      content: string | Buffer;
      kind?: BackupResourceKind;
      scope?: BackupResourceScope;
      sessionId?: string;
      storageKey?: string;
    }>;
  }): VaultBackupPackage {
    const memories = input.memories || [];
    const tasks = input.tasks || [];
    const sessions = input.sessions || [];
    const rawResources = input.rawResources || [];
    const settings = this.cleanSettingsForBackup(input.settings || {}, input.includeKeys ?? false);

    // Resource deduplication by composite key: checksum:encoding:mimeType
    const resources: BackupResource[] = [];
    const dedupeMap = new Map<string, BackupResource>();
    let deduplicatedCount = 0;

    for (const raw of rawResources) {
      const buffer = typeof raw.content === 'string' ? Buffer.from(raw.content) : raw.content;
      if (buffer.length > MAX_BACKUP_RESOURCE_ENTRY_BYTES) {
        throw new Error(`Resource ${raw.filename} exceeds max entry size of ${MAX_BACKUP_RESOURCE_ENTRY_BYTES} bytes`);
      }

      const checksum = this.calculateChecksum(buffer);
      const encoding: BackupResourceEncoding = typeof raw.content === 'string' ? 'utf8' : 'data-url-base64';
      const dedupeKey = `${checksum}:${encoding}:${raw.mimeType}`;

      if (dedupeMap.has(dedupeKey)) {
        deduplicatedCount++;
        const existing = dedupeMap.get(dedupeKey)!;
        if (raw.sessionId && existing.sessionIds && !existing.sessionIds.includes(raw.sessionId)) {
          existing.sessionIds.push(raw.sessionId);
          if (existing.sessionIds.length > 1) existing.scope = 'shared';
        }
        if (raw.storageKey && existing.originalStorageKeys && !existing.originalStorageKeys.includes(raw.storageKey)) {
          existing.originalStorageKeys.push(raw.storageKey);
        }
      } else {
        const res: BackupResource = {
          id: `res_${resources.length + 1}`,
          filename: raw.filename,
          mimeType: raw.mimeType,
          size: buffer.length,
          checksum,
          contentBase64: buffer.toString('base64'),
          kind: raw.kind || 'raw-attachment',
          scope: raw.scope || (raw.sessionId ? 'session' : 'global'),
          encoding,
          sessionIds: raw.sessionId ? [raw.sessionId] : [],
          originalStorageKeys: raw.storageKey ? [raw.storageKey] : [`storage_${raw.filename}`],
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

    const manifestSessions = sessions.map(s => ({
      id: String(s.id || s.sessionId || `session_${Math.random()}`),
      meta: { id: String(s.id || s.sessionId || `session_${Math.random()}`), title: s.title || s.name },
    }));

    const manifestResources = resources.map(r => ({
      id: r.id,
      originalStorageKeys: r.originalStorageKeys || [],
      sessionIds: r.sessionIds || [],
      scope: r.scope || 'global',
    }));

    const manifest: BackupManifest = {
      format: BACKUP_FORMAT,
      version: BACKUP_FORMAT_VERSION,
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
      sessions: manifestSessions,
      resources: manifestResources,
    };

    return {
      manifest,
      data: {
        soul: input.soul,
        memories,
        tasks,
        sessions,
        settings,
      },
      resources,
    };
  }

  /**
   * Verifies manifest integrity and data checksums.
   */
  public verifyBackup(pkg: VaultBackupPackage): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!pkg.manifest || pkg.manifest.format !== BACKUP_FORMAT) {
      errors.push('Invalid or missing backup manifest format');
      return { valid: false, errors };
    }

    const graphValidation = this.validateBackupManifestGraph(pkg.manifest);
    if (!graphValidation.valid) {
      errors.push(...graphValidation.errors);
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

      const sessSum = this.calculateChecksum(JSON.stringify(pkg.data.sessions || []));
      if (pkg.manifest.checksums.sessions && pkg.manifest.checksums.sessions !== sessSum) {
        errors.push('Sessions checksum mismatch');
      }
    }

    for (const res of pkg.resources || []) {
      const buffer = Buffer.from(res.contentBase64, 'base64');
      const calcCheck = this.calculateChecksum(buffer);
      if (calcCheck !== res.checksum) {
        errors.push(`Resource ${res.filename} (${res.id}) checksum mismatch`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Simulates sovereign restore into a target database/state with conflict resolution.
   */
  public restoreBackup(
    pkg: VaultBackupPackage,
    existingState: {
      sessions?: any[];
      memories?: any[];
      tasks?: any[];
    } = {},
    options: RestoreOptions = { conflictResolution: 'overwrite' }
  ): RestoreResult {
    const verification = this.verifyBackup(pkg);
    if (!verification.valid) {
      return {
        success: false,
        restoredSessions: 0,
        restoredMemories: 0,
        restoredTasks: 0,
        restoredResources: 0,
        conflictsHandled: 0,
        errors: verification.errors,
      };
    }

    let conflicts = 0;
    const existingSessionIds = new Set((existingState.sessions || []).map(s => String(s.id)));
    const existingMemoryIds = new Set((existingState.memories || []).map(m => String(m.id)));

    let sessionCount = 0;
    for (const s of pkg.data.sessions || []) {
      if (existingSessionIds.has(String(s.id))) {
        conflicts++;
        if (options.conflictResolution === 'skip') continue;
      }
      sessionCount++;
    }

    let memoryCount = 0;
    for (const m of pkg.data.memories || []) {
      if (existingMemoryIds.has(String(m.id))) {
        conflicts++;
        if (options.conflictResolution === 'skip') continue;
      }
      memoryCount++;
    }

    return {
      success: true,
      restoredSessions: sessionCount,
      restoredMemories: memoryCount,
      restoredTasks: (pkg.data.tasks || []).length,
      restoredResources: (pkg.resources || []).length,
      conflictsHandled: conflicts,
      errors: [],
    };
  }
}
