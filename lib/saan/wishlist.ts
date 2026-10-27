/**
 * Saan Wishlist Engine (Adapted from ericwang915/HerAndHim scheduler/wishlist.py)
 *
 * Tracks long-running things the user said they wanted ("I want to eat sushi", "planning a trip to Manali").
 * Uses mathematical scoring (urgency * time_appropriateness * recency_decay) to surface wishes at optimal moments.
 */

import { getDb } from "@/lib/db/client";
import crypto from "crypto";

export interface Wish {
  id: string;
  text: string;
  urgency: "low" | "medium" | "high";
  status: "pending" | "fulfilled" | "dismissed";
  createdAt: number;
  fulfilledAt?: number | null;
  lastSurfacedAt?: number | null;
  surfaceCount: number;
  context?: any;
}

const URGENCY_WEIGHTS: Record<Wish["urgency"], number> = {
  low: 0.3,
  medium: 0.6,
  high: 1.0,
};

const DEFAULT_TRIGGER_THRESHOLD = 0.5;
const RECENCY_HALF_LIFE_DAYS = 30; // Score decays over 30 days
const SURFACE_COOLDOWN_HOURS = 12; // Don't re-surface same wish within 12h

/**
 * Adds a new wish to persistent storage.
 */
export function addWish(
  text: string,
  urgency: Wish["urgency"] = "medium",
  context?: any
): Wish {
  const db = getDb();
  const trimmed = text.trim();

  // Check if identical pending wish exists
  const existing = db
    .prepare("SELECT id, text, urgency, status, created_at as createdAt, surface_count as surfaceCount FROM saan_wishlist WHERE status = 'pending' AND text = ?")
    .get(trimmed) as Wish | undefined;

  if (existing) {
    return existing;
  }

  const id = crypto.randomUUID().slice(0, 12);
  const createdAt = Date.now();
  const contextJson = context ? JSON.stringify(context) : null;

  db.prepare(`
    INSERT INTO saan_wishlist (id, text, urgency, status, created_at, surface_count, context_json)
    VALUES (?, ?, ?, 'pending', ?, 0, ?)
  `).run(id, trimmed, urgency, createdAt, contextJson);

  return {
    id,
    text: trimmed,
    urgency,
    status: "pending",
    createdAt,
    surfaceCount: 0,
    context,
  };
}

/**
 * Lists all pending wishes.
 */
export function listPendingWishes(): Wish[] {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT 
        id, 
        text, 
        urgency, 
        status, 
        created_at as createdAt, 
        fulfilled_at as fulfilledAt, 
        last_surfaced_at as lastSurfacedAt, 
        surface_count as surfaceCount,
        context_json as contextJson
      FROM saan_wishlist
      WHERE status = 'pending'
      ORDER BY created_at DESC
    `).all() as any[];

    return rows.map((r) => ({
      id: r.id,
      text: r.text,
      urgency: r.urgency as Wish["urgency"],
      status: r.status as Wish["status"],
      createdAt: r.createdAt,
      fulfilledAt: r.fulfilledAt,
      lastSurfacedAt: r.lastSurfacedAt,
      surfaceCount: r.surfaceCount,
      context: r.contextJson ? JSON.parse(r.contextJson) : undefined,
    }));
  } catch (err) {
    console.warn("[Wishlist] Error listing wishes:", err);
    return [];
  }
}

/**
 * Marks a wish fulfilled.
 */
export function markWishFulfilled(id: string): boolean {
  try {
    const db = getDb();
    const res = db.prepare(`
      UPDATE saan_wishlist
      SET status = 'fulfilled', fulfilled_at = ?
      WHERE id = ? AND status = 'pending'
    `).run(Date.now(), id);
    return res.changes > 0;
  } catch {
    return false;
  }
}

/**
 * Dismisses a wish without fulfilling.
 */
export function markWishDismissed(id: string): boolean {
  try {
    const db = getDb();
    const res = db.prepare(`
      UPDATE saan_wishlist
      SET status = 'dismissed'
      WHERE id = ? AND status = 'pending'
    `).run(id);
    return res.changes > 0;
  } catch {
    return false;
  }
}

/**
 * Updates last_surfaced_at timestamp and increments surface count.
 */
export function markWishSurfaced(id: string): void {
  try {
    const db = getDb();
    db.prepare(`
      UPDATE saan_wishlist
      SET last_surfaced_at = ?, surface_count = surface_count + 1
      WHERE id = ?
    `).run(Date.now(), id);
  } catch (err) {
    console.warn("[Wishlist] Error marking surfaced:", err);
  }
}

/**
 * Time appropriateness scoring:
 * Quiet hours (11pm-8am) -> 0.0
 * Morning (8am-12pm) -> 0.5
 * Midday (12pm-6pm) -> 0.7
 * Evening (6pm-11pm) -> 1.0 (Prime relaxation/planning hours)
 */
function calculateTimeAppropriateness(hour: number): number {
  if (hour < 8 || hour >= 23) return 0.0;
  if (hour >= 8 && hour < 12) return 0.5;
  if (hour >= 12 && hour < 18) return 0.7;
  return 1.0;
}

/**
 * Recency bonus: decays over 30-day half-life to minimum 0.3 floor.
 */
function calculateRecencyScore(createdAt: number, nowMs: number): number {
  const daysOld = Math.max(0, (nowMs - createdAt) / (1000 * 60 * 60 * 24));
  const decay = Math.pow(0.5, daysOld / RECENCY_HALF_LIFE_DAYS);
  return Math.max(0.3, decay);
}

/**
 * Computes exact HerAndHim formula: score = urgency * time_appropriateness * recency_bonus
 */
export function calculateWishScore(wish: Wish, now = new Date()): number {
  // Check 12h cooldown
  if (wish.lastSurfacedAt) {
    const hoursSinceSurfaced = (now.getTime() - wish.lastSurfacedAt) / (1000 * 60 * 60);
    if (hoursSinceSurfaced < SURFACE_COOLDOWN_HOURS) {
      return 0.0;
    }
  }

  const urgencyWeight = URGENCY_WEIGHTS[wish.urgency] || 0.6;
  const timeFactor = calculateTimeAppropriateness(now.getHours());
  const recencyFactor = calculateRecencyScore(wish.createdAt, now.getTime());

  return urgencyWeight * timeFactor * recencyFactor;
}

/**
 * Returns wishes due for surfacing right now, sorted highest score first.
 */
export function getDueWishes(now = new Date(), threshold = DEFAULT_TRIGGER_THRESHOLD): Array<{ wish: Wish; score: number }> {
  const pending = listPendingWishes();
  const scored = pending.map((w) => ({
    wish: w,
    score: calculateWishScore(w, now),
  }));

  return scored
    .filter((s) => s.score >= threshold)
    .sort((a, b) => b.score - a.score);
}

/**
 * Formats due wishes for system prompt injection.
 */
export function formatWishesForPrompt(now = new Date()): string {
  const due = getDueWishes(now);
  if (due.length === 0) return "";

  const lines = due.slice(0, 2).map((d) => `- "${d.wish.text}" (relevance score: ${(d.score * 100).toFixed(0)}%)`);
  return `USER WISHLIST (HerAndHim proactive opportunity):\nThings they casually wished for in the past. If the moment feels natural, casually bring one up:\n${lines.join("\n")}`;
}
