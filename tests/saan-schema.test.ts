/**
 * Saan Schema Verification Tests
 *
 * Verifies that the memories table has all required columns for the 3-tier
 * cognitive memory system with bi-temporal history and tombstone enforcement.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";

import { runMigrations } from "../lib/db/migrate.ts";

describe("Saan Schema", () => {
  let db: Database.Database;

  before(() => {
    // Use in-memory database for testing
    db = new Database(":memory:");
    runMigrations(db);
  });

  after(() => {
    db.close();
  });

  it("should have memories table with all required columns", () => {
    const cols = db.prepare("PRAGMA table_info(memories)").all() as Array<{ name: string; type: string; notnull: number; dflt_value: string | null }>;
    const colNames = cols.map(c => c.name);

    // Core columns
    assert.ok(colNames.includes("id"), "missing id");
    assert.ok(colNames.includes("point"), "missing point");
    assert.ok(colNames.includes("category"), "missing category");
    assert.ok(colNames.includes("source_session_id"), "missing source_session_id");
    assert.ok(colNames.includes("source"), "missing source");
    assert.ok(colNames.includes("created_at"), "missing created_at");
    assert.ok(colNames.includes("updated_at"), "missing updated_at");

    // New 3-tier memory columns
    assert.ok(colNames.includes("tier"), "missing tier");
    assert.ok(colNames.includes("status"), "missing status");
    assert.ok(colNames.includes("confidence"), "missing confidence");
    assert.ok(colNames.includes("importance"), "missing importance");
    assert.ok(colNames.includes("source_turn_id"), "missing source_turn_id");
    assert.ok(colNames.includes("valid_since"), "missing valid_since");
    assert.ok(colNames.includes("valid_until"), "missing valid_until");
    assert.ok(colNames.includes("related_ids"), "missing related_ids");
    assert.ok(colNames.includes("sensitivity"), "missing sensitivity");
    assert.ok(colNames.includes("system_time"), "missing system_time");
    assert.ok(colNames.includes("transaction_time"), "missing transaction_time");
  });

  it("should have correct default values for tier, status, confidence, importance, sensitivity", () => {
    const cols = db.prepare("PRAGMA table_info(memories)").all() as Array<{ name: string; dflt_value: string | null }>;

    const tierCol = cols.find(c => c.name === "tier");
    assert.equal(tierCol?.dflt_value, "'canon'");

    const statusCol = cols.find(c => c.name === "status");
    assert.equal(statusCol?.dflt_value, "'active'");

    const confidenceCol = cols.find(c => c.name === "confidence");
    assert.equal(confidenceCol?.dflt_value, "1.0");

    const importanceCol = cols.find(c => c.name === "importance");
    assert.equal(importanceCol?.dflt_value, "5");

    const sensitivityCol = cols.find(c => c.name === "sensitivity");
    assert.equal(sensitivityCol?.dflt_value, "'normal'");
  });

  it("should allow inserting a memory with all fields", () => {
    const now = Date.now();
    const stmt = db.prepare(`
      INSERT INTO memories (point, category, tier, status, confidence, importance, source, source_turn_id, valid_since, valid_until, related_ids, sensitivity, system_time, transaction_time, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const res = stmt.run(
      "Test memory point",
      "fact",
      "canon",
      "active",
      1.0,
      5,
      "user",
      "turn-123",
      now,
      null,
      JSON.stringify([1, 2, 3]),
      "normal",
      now,
      now,
      now,
      now
    );

    assert.equal(res.changes, 1);
    assert.ok(res.lastInsertRowid > 0);
  });

  it("should allow inserting a memory with minimal fields (defaults apply)", () => {
    const now = Date.now();
    const stmt = db.prepare(`
      INSERT INTO memories (point, valid_since, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `);

    const res = stmt.run("Minimal memory", now, now, now);
    assert.equal(res.changes, 1);

    const row = db.prepare("SELECT * FROM memories WHERE id = ?").get(res.lastInsertRowid) as any;
    assert.equal(row.tier, "canon");
    assert.equal(row.status, "active");
    assert.equal(row.confidence, 1.0);
    assert.equal(row.importance, 5);
    assert.equal(row.sensitivity, "normal");
  });

  it("should have memory_tombstones table for deletion enforcement", () => {
    const cols = db.prepare("PRAGMA table_info(memory_tombstones)").all() as Array<{ name: string }>;
    const colNames = cols.map(c => c.name);
    assert.ok(colNames.includes("id"), "missing id in memory_tombstones");
    assert.ok(colNames.includes("content_hash"), "missing content_hash in memory_tombstones");
    assert.ok(colNames.includes("deleted_at"), "missing deleted_at in memory_tombstones");
  });

  it("should have memory_consolidation table for STM/LTM", () => {
    const cols = db.prepare("PRAGMA table_info(memory_consolidation)").all() as Array<{ name: string }>;
    const colNames = cols.map(c => c.name);
    assert.ok(colNames.includes("id"), "missing id in memory_consolidation");
    assert.ok(colNames.includes("stm_key"), "missing stm_key in memory_consolidation");
    assert.ok(colNames.includes("stm_value"), "missing stm_value in memory_consolidation");
    assert.ok(colNames.includes("ltm_promoted"), "missing ltm_promoted in memory_consolidation");
    assert.ok(colNames.includes("decay_score"), "missing decay_score in memory_consolidation");
  });
});