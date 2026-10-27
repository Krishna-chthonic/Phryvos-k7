/**
 * Saan Personal Dates Engine (Adapted from ericwang915/HerAndHim core/personal_dates.py)
 *
 * Tracks the user's real-life calendar events: birthdays, anniversaries, exams, interviews, flights, deadlines.
 * Injects a 7-day lookahead window into context so Saan proactively anticipates them instead of forgetting.
 */

import { getDb } from "@/lib/db/client";
import crypto from "crypto";

export interface PersonalDate {
  id: string;
  date: string; // "YYYY-MM-DD" or recurring "MM-DD"
  label: string; // e.g. "Civil Services Exam", "Birthday", "Flight to Bangalore"
  recurring: boolean;
  notes?: string | null;
  createdAt: number;
}

export interface UpcomingDate extends PersonalDate {
  daysAway: number;
  isToday: boolean;
  displayDate: string;
}

/**
 * Adds a new personal date to persistent storage.
 */
export function addPersonalDate(
  dateStr: string,
  label: string,
  recurring = false,
  notes?: string
): PersonalDate {
  const db = getDb();
  const id = crypto.randomUUID().slice(0, 12);
  const createdAt = Date.now();
  const trimmedDate = dateStr.trim();
  const trimmedLabel = label.trim();

  db.prepare(`
    INSERT INTO saan_personal_dates (id, date, label, recurring, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, trimmedDate, trimmedLabel, recurring ? 1 : 0, notes || null, createdAt);

  return {
    id,
    date: trimmedDate,
    label: trimmedLabel,
    recurring,
    notes,
    createdAt,
  };
}

/**
 * Lists all personal dates recorded for the user.
 */
export function listPersonalDates(): PersonalDate[] {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT id, date, label, recurring, notes, created_at as createdAt
      FROM saan_personal_dates
      ORDER BY date ASC
    `).all() as Array<{
      id: string;
      date: string;
      label: string;
      recurring: number;
      notes: string | null;
      createdAt: number;
    }>;

    return rows.map((r) => ({
      ...r,
      recurring: Boolean(r.recurring),
    }));
  } catch (err) {
    console.warn("[PersonalDates] Error loading dates:", err);
    return [];
  }
}

/**
 * Removes a personal date by ID.
 */
export function deletePersonalDate(id: string): boolean {
  try {
    const db = getDb();
    const res = db.prepare("DELETE FROM saan_personal_dates WHERE id = ?").run(id);
    return res.changes > 0;
  } catch {
    return false;
  }
}

/**
 * Calculates upcoming dates within lookaheadDays window (default: 7 days).
 * Accurately matches recurring yearly dates (matching MM-DD).
 */
export function getUpcomingDates(lookaheadDays = 7, fromDate = new Date()): UpcomingDate[] {
  const allDates = listPersonalDates();
  const results: UpcomingDate[] = [];

  const currentYear = fromDate.getFullYear();
  const startOfDay = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()).getTime();

  for (const item of allDates) {
    let targetYear = currentYear;
    let targetMonth = 0;
    let targetDay = 1;

    // Parse YYYY-MM-DD or MM-DD
    const parts = item.date.split("-").map(Number);
    if (parts.length === 3) {
      targetYear = parts[0];
      targetMonth = parts[1] - 1;
      targetDay = parts[2];

      if (item.recurring) {
        targetYear = currentYear;
      }
    } else if (parts.length === 2) {
      targetMonth = parts[0] - 1;
      targetDay = parts[1];
      targetYear = currentYear;
    } else {
      continue;
    }

    let targetDate = new Date(targetYear, targetMonth, targetDay);

    // If recurring and already passed this year, check next year
    if (item.recurring && targetDate.getTime() < startOfDay) {
      targetDate = new Date(currentYear + 1, targetMonth, targetDay);
    }

    const diffMs = targetDate.getTime() - startOfDay;
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays <= lookaheadDays) {
      results.push({
        ...item,
        daysAway: diffDays,
        isToday: diffDays === 0,
        displayDate: targetDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: targetDate.getFullYear() !== currentYear ? "numeric" : undefined,
        }),
      });
    }
  }

  // Sort closest first
  results.sort((a, b) => a.daysAway - b.daysAway);
  return results;
}

/**
 * Formats upcoming dates for injection into Saan's system prompt.
 */
export function formatDatesForPrompt(lookaheadDays = 7, fromDate = new Date()): string {
  const upcoming = getUpcomingDates(lookaheadDays, fromDate);
  if (upcoming.length === 0) return "";

  const lines = upcoming.map((d) => {
    if (d.isToday) {
      return `🌟 TODAY is: ${d.label}! Congratulate, support, or check in on them!`;
    }
    if (d.daysAway === 1) {
      return `⏰ TOMORROW (${d.displayDate}): ${d.label} - Anticipate it, ask if they're prepared or excited.`;
    }
    return `📅 In ${d.daysAway} days (${d.displayDate}): ${d.label}`;
  });

  return `UPCOMING PERSONAL DATES & MILESTONES (HerAndHim anticipation window):\n${lines.join("\n")}`;
}
