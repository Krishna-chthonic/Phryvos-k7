/**
 * Saan Hierarchical Memory Consolidation (Adapted from Psycheros packages/entity-core/src/consolidation/)
 *
 * Implements 3-tier temporal consolidation:
 * 1. Daily Memories -> Weekly Themes (ISO 8601 week boundaries)
 * 2. Weekly Themes -> Monthly Epochs
 * 3. Monthly Epochs -> Long-term Decade Archives
 *
 * Written in authentic first-person voice ("I review the week and capture what matters").
 */

import { getDb } from "@/lib/db/client";
import { getSaanMemories } from "./memory";
import crypto from "crypto";

export interface ConsolidationRecord {
  id: string;
  periodType: "weekly" | "monthly" | "yearly";
  periodKey: string;
  summary: string;
  sourceMemoryCount: number;
  createdAt: number;
}

/**
 * Returns ISO 8601 week number and year (Monday start)
 */
export function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const isoYear = d.getUTCFullYear();
  const jan1 = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + 1) / 7);
  return { year: isoYear, week };
}

export function getISOWeekKey(date = new Date()): string {
  const { year, week } = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function getMonthKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Builds weekly consolidation prompt template (Psycheros prompt pattern)
 */
export function buildWeeklyConsolidationPrompt(dailyMemories: string[]): string {
  const formatted = dailyMemories.map((m) => `- ${m}`).join("\n");
  return `I am consolidating my daily memories into a weekly summary. I review the week and capture what matters.

Guidelines:
- Write in first-person (my perspective)
- Capture major themes, project milestones, habit shifts, and meaningful emotional moments
- Focus on what will be useful to remember long-term
- Write as bullet points, one memory per line, starting with "- "

Daily memories from this week:
${formatted}`;
}

/**
 * Builds monthly consolidation prompt template (Psycheros prompt pattern)
 */
export function buildMonthlyConsolidationPrompt(weeklySummaries: string[]): string {
  const formatted = weeklySummaries.map((w) => `WEEKLY RETROSPECTIVE:\n${w}`).join("\n\n");
  return `I am consolidating my weekly memories into a monthly summary. I reflect on the month and capture what matters most.

Guidelines:
- Write in first-person (my perspective)
- Synthesize major personal growth, breakthroughs, and persistent commitments
- Compress the essence into 3-5 high-signal bullet points

Weekly summaries from this month:
${formatted}`;
}

/**
 * Saves a consolidated summary to SQLite
 */
export function saveConsolidation(
  periodType: ConsolidationRecord["periodType"],
  periodKey: string,
  summary: string,
  sourceMemoryCount = 0
): ConsolidationRecord {
  const db = getDb();
  const id = crypto.randomUUID().slice(0, 12);
  const createdAt = Date.now();
  const cleanSummary = summary.trim();

  db.prepare(`
    INSERT INTO saan_consolidations (id, period_type, period_key, summary, source_memory_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(period_type, period_key) DO UPDATE SET
      summary = excluded.summary,
      source_memory_count = excluded.source_memory_count,
      created_at = excluded.created_at
  `).run(id, periodType, periodKey, cleanSummary, sourceMemoryCount, createdAt);

  return {
    id,
    periodType,
    periodKey,
    summary: cleanSummary,
    sourceMemoryCount,
    createdAt,
  };
}

/**
 * Retrieves the latest consolidation record for a period type
 */
export function getLatestConsolidation(
  periodType: ConsolidationRecord["periodType"]
): ConsolidationRecord | null {
  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT id, period_type as periodType, period_key as periodKey, summary, source_memory_count as sourceMemoryCount, created_at as createdAt
      FROM saan_consolidations
      WHERE period_type = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(periodType) as ConsolidationRecord | undefined;
    return row || null;
  } catch (err) {
    console.warn("[Consolidation] Error loading latest:", err);
    return null;
  }
}

/**
 * Executes a deterministic weekly consolidation pass
 */
export function runWeeklyConsolidationPass(): ConsolidationRecord | null {
  const weekKey = getISOWeekKey();
  const memories = getSaanMemories(30);
  if (memories.length === 0) return null;

  // Synthesize into weekly retrospective
  const points = memories.map((m) => m.point);
  const summary = `Weekly Retrospective [${weekKey}]:\n- Active focus: ${points.slice(0, 3).join("; ")}\n- Key continuity: captured ${memories.length} memory events.`;

  return saveConsolidation("weekly", weekKey, summary, memories.length);
}
