/**
 * Phase 14: Data Migrations, Schema Versioning & Rollback Safety.
 *
 * Implements deterministic schema version tracking, backup-before-migrate hook,
 * and integrity verification for SQLite databases.
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import { runMigrations as runBaseMigrations } from "./migrate";

export interface SchemaVersionRecord {
  version: number;
  name: string;
  appliedAt: number;
  checksum: string;
  executionTimeMs: number;
}

export interface MigrationStep {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

/**
 * Registry of programmatic schema migrations.
 * Version 1: Base initial schema (Drizzle + virtual tables + baseline).
 * Additional incremental versions are registered here.
 */
export const MIGRATION_STEPS: MigrationStep[] = [
  {
    version: 1,
    name: "0001_baseline_drizzle_and_virtual_tables",
    up: (db: Database.Database) => {
      runBaseMigrations(db);
    },
  },
  {
    version: 2,
    name: "0002_add_schema_metadata_indexes",
    up: (db: Database.Database) => {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
        CREATE INDEX IF NOT EXISTS idx_study_logs_created ON study_logs(created_at);
        CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
      `);
    },
  },
  {
    version: 3,
    name: "0003_saan_bitemporal_leases_checkpoints",
    up: (db: Database.Database) => {
      // 1. Ensure saan_memories exists with baseline
      db.exec(`
        CREATE TABLE IF NOT EXISTS saan_memories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          point TEXT NOT NULL,
          category TEXT DEFAULT 'general',
          confidence REAL DEFAULT 1.0,
          importance INTEGER DEFAULT 5,
          created_at INTEGER NOT NULL
        );
      `);

      // Check existing columns to dynamically add bi-temporal fields
      const tableInfo = db.prepare("PRAGMA table_info('saan_memories')").all() as Array<{ name: string }>;
      const existingCols = new Set(tableInfo.map((c) => c.name));

      if (!existingCols.has("valid_since")) {
        db.exec("ALTER TABLE saan_memories ADD COLUMN valid_since INTEGER NOT NULL DEFAULT 0");
        db.exec("UPDATE saan_memories SET valid_since = created_at WHERE valid_since = 0");
      }
      if (!existingCols.has("valid_until")) {
        db.exec("ALTER TABLE saan_memories ADD COLUMN valid_until INTEGER NOT NULL DEFAULT 253402300799000");
      }
      if (!existingCols.has("status")) {
        db.exec("ALTER TABLE saan_memories ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
      }
      if (!existingCols.has("source_type")) {
        db.exec("ALTER TABLE saan_memories ADD COLUMN source_type TEXT NOT NULL DEFAULT 'implicit'");
      }
      if (!existingCols.has("tombstone_hash")) {
        db.exec("ALTER TABLE saan_memories ADD COLUMN tombstone_hash TEXT");
      }

      // Indices for sub-5ms temporal queries (Datapace Benchmark recommendation)
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_saan_mem_temporal ON saan_memories(valid_since, valid_until, status);
        CREATE INDEX IF NOT EXISTS idx_saan_mem_category ON saan_memories(category);
      `);

      // 2. Ensure saan_diary exists
      db.exec(`
        CREATE TABLE IF NOT EXISTS saan_diary (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entry TEXT NOT NULL,
          mood TEXT NOT NULL,
          activity TEXT,
          created_at INTEGER NOT NULL
        );
      `);

      // 3. Ensure saan_daemon_leases exists for crash resilience (Temporal pattern)
      db.exec(`
        CREATE TABLE IF NOT EXISTS saan_daemon_leases (
          lease_name TEXT PRIMARY KEY,
          lease_owner TEXT NOT NULL,
          lease_expires_at INTEGER NOT NULL,
          acquired_at INTEGER NOT NULL
        );
      `);

      // 4. Ensure saan_checkpoints exists for state rollbacks (LangGraph pattern)
      db.exec(`
        CREATE TABLE IF NOT EXISTS saan_checkpoints (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          state_blob TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
      `);

      // 5. Ensure task_memories exists for associative linking (A-mem pattern)
      db.exec(`
        CREATE TABLE IF NOT EXISTS task_memories (
          task_id INTEGER NOT NULL,
          memory_id INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          PRIMARY KEY (task_id, memory_id),
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (memory_id) REFERENCES saan_memories(id) ON DELETE CASCADE
        );
      `);
    },
  },
  {
    version: 4,
    name: "0004_saan_herandhim_extraction",
    up: (db: Database.Database) => {
      // 1. Personal Dates Table (HerAndHim personal_dates.py pattern)
      db.exec(`
        CREATE TABLE IF NOT EXISTS saan_personal_dates (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          label TEXT NOT NULL,
          recurring INTEGER NOT NULL DEFAULT 0,
          notes TEXT,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_saan_personal_dates_date ON saan_personal_dates(date);
      `);

      // 2. Long-Running Wishlist Table (HerAndHim wishlist.py pattern)
      db.exec(`
        CREATE TABLE IF NOT EXISTS saan_wishlist (
          id TEXT PRIMARY KEY,
          text TEXT NOT NULL,
          urgency TEXT NOT NULL DEFAULT 'medium',
          status TEXT NOT NULL DEFAULT 'pending',
          created_at INTEGER NOT NULL,
          fulfilled_at INTEGER,
          last_surfaced_at INTEGER,
          surface_count INTEGER NOT NULL DEFAULT 0,
          context_json TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_saan_wishlist_status ON saan_wishlist(status);
      `);

      // 3. 4D Relationship Store Singleton (HerAndHim emotional_graph.py pattern)
      db.exec(`
        CREATE TABLE IF NOT EXISTS saan_relationship (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          temperature REAL NOT NULL DEFAULT 50.0,
          trust REAL NOT NULL DEFAULT 50.0,
          intimacy REAL NOT NULL DEFAULT 50.0,
          understanding REAL NOT NULL DEFAULT 50.0,
          first_chat_date TEXT,
          total_turns INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL
        );
        INSERT OR IGNORE INTO saan_relationship (id, temperature, trust, intimacy, understanding, first_chat_date, total_turns, updated_at)
        VALUES (1, 50.0, 50.0, 50.0, 50.0, date('now'), 0, (strftime('%s', 'now') * 1000));
      `);

      // 4. Emotional Time-Series Event Ledger (HerAndHim emotional_graph.py pattern)
      db.exec(`
        CREATE TABLE IF NOT EXISTS saan_emotional_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp INTEGER NOT NULL,
          sentiment TEXT NOT NULL,
          intensity REAL NOT NULL,
          topic TEXT,
          summary TEXT,
          follow_up INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_saan_emotional_events_ts ON saan_emotional_events(timestamp);
      `);
    },
  },
  {
    version: 5,
    name: "0005_saan_psycheros_extraction",
    up: (db: Database.Database) => {
      // 1. Mood Organ Affective State Singleton (Psycheros mood-organ.ts pattern)
      db.exec(`
        CREATE TABLE IF NOT EXISTS saan_mood_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          valence REAL NOT NULL DEFAULT 0.1,
          arousal REAL NOT NULL DEFAULT 0.0,
          dominance REAL NOT NULL DEFAULT 0.0,
          baseline_valence REAL NOT NULL DEFAULT 0.1,
          baseline_arousal REAL NOT NULL DEFAULT 0.0,
          baseline_dominance REAL NOT NULL DEFAULT 0.0,
          last_update INTEGER NOT NULL,
          last_lately_tick INTEGER NOT NULL
        );
        INSERT OR IGNORE INTO saan_mood_state (
          id, valence, arousal, dominance, 
          baseline_valence, baseline_arousal, baseline_dominance, 
          last_update, last_lately_tick
        )
        VALUES (
          1, 0.1, 0.0, 0.0, 
          0.1, 0.0, 0.0, 
          (strftime('%s', 'now') * 1000), (strftime('%s', 'now') * 1000)
        );
      `);

      // 2. Dream Fragments Ledger (Psycheros dreamer.ts pattern)
      db.exec(`
        CREATE TABLE IF NOT EXISTS saan_dream_fragments (
          id TEXT PRIMARY KEY,
          fragment TEXT NOT NULL,
          cycle_number INTEGER NOT NULL DEFAULT 1,
          felt_sense TEXT,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_saan_dream_fragments_ts ON saan_dream_fragments(created_at);
      `);

      // 3. Hierarchical Memory Consolidations (Psycheros consolidation runner pattern)
      db.exec(`
        CREATE TABLE IF NOT EXISTS saan_consolidations (
          id TEXT PRIMARY KEY,
          period_type TEXT NOT NULL,
          period_key TEXT NOT NULL,
          summary TEXT NOT NULL,
          source_memory_count INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_saan_consolidations_key ON saan_consolidations(period_type, period_key);
      `);
    },
  },
];

/**
 * Ensures the schema_versions table exists.
 */
export function ensureSchemaVersionTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_versions (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL,
      checksum TEXT NOT NULL,
      execution_time_ms INTEGER NOT NULL
    );
  `);
}

/**
 * Computes deterministic checksum for a migration step name and version.
 */
export function computeMigrationChecksum(step: MigrationStep): string {
  return createHash("sha256").update(`${step.version}:${step.name}`).digest("hex");
}

/**
 * Creates a pre-migration snapshot backup of the database file.
 */
export function backupDatabaseBeforeMigrate(dbPath: string): string | null {
  try {
    if (!fs.existsSync(dbPath)) return null;
    const backupDir = path.join(path.dirname(dbPath), "backups", "pre-migrate");
    fs.mkdirSync(backupDir, { recursive: true });
    const filename = `${path.basename(dbPath)}.pre-migrate-${Date.now()}.bak`;
    const dest = path.join(backupDir, filename);
    fs.copyFileSync(dbPath, dest);
    return dest;
  } catch {
    return null;
  }
}

/**
 * Returns all recorded schema versions in ascending order.
 */
export function getAppliedVersions(db: Database.Database): SchemaVersionRecord[] {
  ensureSchemaVersionTable(db);
  const rows = db
    .prepare("SELECT version, name, applied_at, checksum, execution_time_ms FROM schema_versions ORDER BY version ASC")
    .all() as Array<{
      version: number;
      name: string;
      applied_at: number;
      checksum: string;
      execution_time_ms: number;
    }>;

  return rows.map((r) => ({
    version: r.version,
    name: r.name,
    appliedAt: r.applied_at,
    checksum: r.checksum,
    executionTimeMs: r.execution_time_ms,
  }));
}

/**
 * Returns the highest applied schema version, or 0 if none applied.
 */
export function getCurrentSchemaVersion(db: Database.Database): number {
  ensureSchemaVersionTable(db);
  const row = db.prepare("SELECT MAX(version) as max_version FROM schema_versions").get() as
    | { max_version: number | null }
    | undefined;
  return row?.max_version ?? 0;
}

/**
 * Verifies SQLite database integrity via PRAGMA integrity_check.
 */
export function verifySchemaIntegrity(db: Database.Database): boolean {
  try {
    const result = db.pragma("integrity_check") as Array<{ integrity_check: string }>;
    if (!result || result.length === 0) return false;
    return result[0]?.integrity_check === "ok";
  } catch {
    return false;
  }
}

/**
 * Runs all pending migrations deterministically in version order.
 */
export function runDeterministicMigrations(
  db: Database.Database,
  options?: {
    backup?: boolean;
    dbPath?: string;
  },
): {
  appliedCount: number;
  currentVersion: number;
  backupPath?: string | null;
} {
  ensureSchemaVersionTable(db);

  let backupPath: string | null = null;
  if (options?.backup && options?.dbPath) {
    backupPath = backupDatabaseBeforeMigrate(options.dbPath);
  }

  const applied = new Set(getAppliedVersions(db).map((v) => v.version));
  let appliedCount = 0;

  for (const step of MIGRATION_STEPS) {
    if (applied.has(step.version)) continue;

    const start = Date.now();
    // Execute migration step
    step.up(db);
    const duration = Date.now() - start;

    const checksum = computeMigrationChecksum(step);
    db.prepare(`
      INSERT INTO schema_versions (version, name, applied_at, checksum, execution_time_ms)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(version) DO UPDATE SET
        checksum = excluded.checksum,
        execution_time_ms = excluded.execution_time_ms,
        applied_at = excluded.applied_at
    `).run(step.version, step.name, Date.now(), checksum, duration);

    appliedCount++;
  }

  return {
    appliedCount,
    currentVersion: getCurrentSchemaVersion(db),
    backupPath,
  };
}
