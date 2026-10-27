/**
 * Saan Dyadic Relationship Drift Detector (Adapted from Chronicler src/lib/orchestrator/relationship-drift.ts)
 *
 * Couples qualitative evidence with K7's 4D numerical relationship tensor:
 * 1. Tracks relationship shifts along 4 labeled axes:
 *    - "trust": willingness to share vulnerability, reliance on user's word
 *    - "defensiveness": guardedness, suspicion, withdrawing under stress
 *    - "openness": emotional availability, curiosity, engaging with new ideas
 *    - "dependency": relying on the other's approval or presence
 * 2. Strict evidence requirement: MUST cite at least 2 distinct memory IDs (evidence_rids >= 2).
 * 3. Anti-fossilization bias: default to is_drift: false on uncertainty.
 */

import { getDb } from "@/lib/db/client";
import crypto from "crypto";

export type DriftAxis = "trust" | "defensiveness" | "openness" | "dependency";
export type DriftDirection = "up" | "down";

export interface DriftCandidate {
  character_id: string;
  character_name?: string;
  target: string;
  target_label?: string;
  recent_memories: Array<{ id: string | number; point: string }>;
}

export interface DriftVerdict {
  is_drift: boolean;
  axis: DriftAxis;
  direction: DriftDirection;
  body: string;
  confidence: "high" | "medium" | "low";
  evidence_rids: string[];
  why: string;
}

export interface FormedDrift {
  id: string;
  character_id: string;
  target: string;
  axis: DriftAxis;
  direction: DriftDirection;
  body: string;
  confidence: string;
  evidence_rids: string[];
  why: string;
  created_at: number;
}

/**
 * Validates and normalizes raw drift verdicts
 */
export function validateDriftVerdict(
  raw: any,
  candidate: DriftCandidate
): DriftVerdict {
  if (!raw || typeof raw !== "object" || !raw.is_drift) {
    return {
      is_drift: false,
      axis: "trust",
      direction: "up",
      body: "",
      confidence: "low",
      evidence_rids: [],
      why: raw?.why || "no drift detected",
    };
  }

  const validAxes: DriftAxis[] = ["trust", "defensiveness", "openness", "dependency"];
  const axis: DriftAxis = validAxes.includes(raw.axis) ? raw.axis : "trust";
  const direction: DriftDirection = raw.direction === "down" ? "down" : "up";
  const confidence = ["high", "medium", "low"].includes(raw.confidence) ? raw.confidence : "medium";

  // Evidence validation: must have at least 2 distinct memory IDs
  const rids: string[] = Array.isArray(raw.evidence_rids)
    ? Array.from(new Set(raw.evidence_rids.map((x: any) => String(x))))
    : [];

  if (rids.length < 2) {
    return {
      is_drift: false,
      axis,
      direction,
      body: "",
      confidence: "low",
      evidence_rids: [],
      why: "rejected: fewer than 2 distinct canon memory citations",
    };
  }

  const body = String(raw.body || "").trim();
  if (body.length < 20) {
    return {
      is_drift: false,
      axis,
      direction,
      body: "",
      confidence: "low",
      evidence_rids: [],
      why: "rejected: body description too short",
    };
  }

  return {
    is_drift: true,
    axis,
    direction,
    body,
    confidence,
    evidence_rids: rids,
    why: String(raw.why || "evidence-backed shift across multiple interactions"),
  };
}

/**
 * Saves a confirmed relationship drift to SQLite
 */
export function saveDriftToDb(drift: Omit<FormedDrift, "id" | "created_at">): FormedDrift {
  const db = getDb();
  const id = `drift_${drift.character_id}_${drift.axis}_${drift.direction}_${Date.now()}`;
  const now = Date.now();

  db.prepare(`
    INSERT INTO saan_relationship_drifts (
      id, character_id, target, axis, direction, body, confidence, evidence_rids, why, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    drift.character_id,
    drift.target,
    drift.axis,
    drift.direction,
    drift.body,
    drift.confidence,
    JSON.stringify(drift.evidence_rids),
    drift.why,
    now
  );

  return {
    id,
    ...drift,
    created_at: now,
  };
}

/**
 * Retrieves the latest recorded relationship drifts
 */
export function getRecentDrifts(limit = 5): FormedDrift[] {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT id, character_id, target, axis, direction, body, confidence, evidence_rids as evidenceRids, why, created_at as createdAt
      FROM saan_relationship_drifts
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit) as any[];

    return rows.map((r) => ({
      id: r.id,
      character_id: r.character_id,
      target: r.target,
      axis: r.axis,
      direction: r.direction,
      body: r.body,
      confidence: r.confidence,
      evidence_rids: JSON.parse(r.evidenceRids || "[]"),
      why: r.why,
      created_at: r.createdAt,
    }));
  } catch (err) {
    console.warn("[RelationshipDrift] Error loading drifts:", err);
    return [];
  }
}

/**
 * Renders recent relationship drifts for prompt injection
 */
export function renderDriftsForPrompt(drifts = getRecentDrifts(2)): string {
  if (drifts.length === 0) return "";
  const lines = drifts.map(
    (d) => `- ${d.axis} (${d.direction}): ${d.body} [backed by memories: ${d.evidence_rids.join(", ")}]`
  );
  return `RELATIONSHIP DRIFT REALITY (Chronicler Dyadic Engine):\n${lines.join("\n")}`;
}
