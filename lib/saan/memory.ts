/**
 * Cognitive Memory Engine for Saan (Inspired by Mem0, Chronicler, Letta)
 *
 * Provides:
 * 1. Persistent memory storage across conversations
 * 2. Fact and preference extraction (explicit & organic)
 * 3. Bond score tracking and evolution
 * 4. Relevant memory recall for conversational turns
 */

import { getDb } from "@/lib/db/client";

export interface SaanMemory {
  id: number;
  point: string;
  category: "fact" | "preference" | "promise" | "emotion" | "general";
  importance: number;
  createdAt: number;
}

/**
 * Initializes Saan-specific memory and diary tables if not present
 */
export function ensureSaanStorage(): void {
  try {
    const db = getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS saan_memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        point TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        confidence REAL DEFAULT 1.0,
        importance INTEGER DEFAULT 5,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS saan_diary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry TEXT NOT NULL,
        mood TEXT NOT NULL,
        activity TEXT,
        created_at INTEGER NOT NULL
      );
    `);
  } catch (err) {
    console.warn("[SaanMemory] Failed to ensure tables:", err);
  }
}

/**
 * Retrieves all stored memories about the user and their life
 */
export function getSaanMemories(limit = 20): SaanMemory[] {
  try {
    ensureSaanStorage();
    const db = getDb();
    const rows = db
      .prepare(
        "SELECT id, point, category, importance, created_at as createdAt FROM saan_memories ORDER BY importance DESC, created_at DESC LIMIT ?"
      )
      .all(limit) as SaanMemory[];
    return rows;
  } catch {
    return [];
  }
}

/**
 * Saves a new permanent memory point
 */
export function saveSaanMemory(
  point: string,
  category: SaanMemory["category"] = "general",
  importance = 5
): void {
  try {
    ensureSaanStorage();
    const db = getDb();
    // Avoid exact duplicate points
    const existing = db
      .prepare("SELECT id FROM saan_memories WHERE point = ?")
      .get(point.trim());
    if (existing) return;

    db.prepare(
      "INSERT INTO saan_memories (point, category, confidence, importance, created_at) VALUES (?, ?, 1.0, ?, ?)"
    ).run(point.trim(), category, importance, Date.now());
  } catch (err) {
    console.warn("[SaanMemory] Error saving memory:", err);
  }
}

/**
 * Deletes a memory by id
 */
export function deleteSaanMemory(id: number): void {
  try {
    ensureSaanStorage();
    const db = getDb();
    db.prepare("DELETE FROM saan_memories WHERE id = ?").run(id);
  } catch {}
}

/**
 * Retrieves current Bond Score (0 to 100) from kv store
 */
export function getBondScore(): number {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM kv WHERE key = 'saan_bond_score'").get() as
      | { value: string }
      | undefined;
    if (row && row.value) {
      const val = parseInt(row.value, 10);
      if (!isNaN(val)) return Math.min(100, Math.max(0, val));
    }
  } catch {}
  return 25; // Default initial bond
}

/**
 * Increments bond score slightly on meaningful interaction
 */
export function bumpBondScore(delta = 1): number {
  try {
    const current = getBondScore();
    const next = Math.min(100, Math.max(0, current + delta));
    const db = getDb();
    db.prepare(
      "INSERT INTO kv (key, value, updated_at) VALUES ('saan_bond_score', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
    ).run(String(next), Date.now());
    return next;
  } catch {
    return 25;
  }
}

/**
 * Intelligent extraction of memories from a user message (Mem0 inspired)
 * Picks up explicit directives ("yaad rakhna", "remember that") and key personal facts.
 */
export function extractMemoriesFromTurn(userMessage: string): void {
  const text = userMessage.trim();
  const lower = text.toLowerCase();

  // 1. Explicit memory triggers
  const explicitMatches = [
    /(?:ye|yeh|ye baat)\s+(?:yaad rakhna|hamesha yaad rakhna|note kar lo|bhulna mat)/i,
    /(?:remember\s+(?:that|this)|always remember)/i,
  ];

  for (const regex of explicitMatches) {
    if (regex.test(lower)) {
      // Clean up the trigger phrase and store the core fact
      const cleaned = text
        .replace(/(?:ye|yeh|ye baat)\s+(?:yaad rakhna|hamesha yaad rakhna|note kar lo|bhulna mat)/gi, "")
        .replace(/(?:remember\s+(?:that|this)|always remember)/gi, "")
        .replace(/^[:,\s-]+/, "")
        .trim();
      if (cleaned.length > 5) {
        saveSaanMemory(cleaned, "preference", 8);
        return;
      }
    }
  }

  // 2. Name / Identity patterns
  const nameMatch = text.match(/(?:mera naam|my name is|i am|main)\s+([A-Z][a-z]+)/i);
  if (nameMatch && !["Saan", "User", "Ghar", "Theek"].includes(nameMatch[1])) {
    saveSaanMemory(`User's name is ${nameMatch[1]}`, "fact", 9);
  }

  // 3. Exam / Goals mention
  if (/(?:exam|test|interview|target|submission)\s+(?:hai|on|hoga)/i.test(lower)) {
    saveSaanMemory(`Upcoming deadline/event: "${text.slice(0, 120)}"`, "fact", 7);
  }

  // 4. Strong likes/dislikes
  if (/(?:mujhe|i\s+like|i\s+love)\s+([^,.?!]+?)\s+(?:pasand hai|bahut pasand hai)/i.test(lower)) {
    const likeMatch = text.match(/(?:mujhe)\s+([^,.?!]+?)\s+(?:pasand hai|bahut pasand hai)/i);
    if (likeMatch && likeMatch[1]) {
      saveSaanMemory(`User likes ${likeMatch[1].trim()}`, "preference", 6);
    }
  }
}
