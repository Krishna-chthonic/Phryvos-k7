/**
 * Saan Thematic Arc Clustering (Adapted from Chronicler src/lib/arcs/cluster.ts)
 *
 * Groups memories into thematic narrative chapters/arcs around primary entities:
 * 1. Clusters memories by primary topic/entity (e.g. "Exam Prep", "Quantum Project", "Fitness").
 * 2. Temporal status tracking:
 *    - "active": touched within last 24 hours
 *    - "paused": 1-7 days idle
 *    - "abandoned": > 14 days idle
 *    - "resolved": explicitly marked complete
 */

export type ArcStatus = "active" | "paused" | "abandoned" | "resolved";

export interface ArcMember {
  id: string | number;
  text: string;
  importance: number;
  touchedAt: number; // timestamp in ms
}

export interface Arc {
  id: string;
  title: string;
  primaryEntity: string;
  members: ArcMember[];
  lastTouchedAt: number;
  status: ArcStatus;
}

export interface ArcInput {
  id: string | number;
  text: string;
  importance: number;
  touchedAt: number;
  entity?: string;
}

const ENTITY_DENYLIST = new Set([
  "user", "saan", "assistant", "system", "general", "today", "yesterday", "tomorrow",
  "kya", "hai", "hain", "karna"
]);

function extractFallbackEntity(text: string): string {
  const words = (text || "").replace(/[^\w\s\u0900-\u097F]/g, "").split(/\s+/);
  for (const w of words) {
    if (w.length >= 3 && !ENTITY_DENYLIST.has(w.toLowerCase())) {
      return w.toLowerCase();
    }
  }
  return "general";
}

export function deriveStatus(lastTouchedAt: number, now = Date.now()): ArcStatus {
  const ageMs = Math.max(0, now - lastTouchedAt);
  const hours = ageMs / (1000 * 60 * 60);

  if (hours <= 24) return "active";
  if (hours <= 7 * 24) return "paused";
  return "abandoned";
}

/**
 * Clusters a list of memory inputs into thematic arcs
 */
export function clusterArcs(memories: ArcInput[], now = Date.now()): Arc[] {
  const byEntity = new Map<string, ArcMember[]>();

  for (const m of memories) {
    const rawEntity = m.entity || extractFallbackEntity(m.text);
    const entity = rawEntity.toLowerCase().trim();
    if (!entity || ENTITY_DENYLIST.has(entity)) continue;

    if (!byEntity.has(entity)) {
      byEntity.set(entity, []);
    }

    byEntity.get(entity)!.push({
      id: m.id,
      text: m.text,
      importance: m.importance,
      touchedAt: m.touchedAt,
    });
  }

  const arcs: Arc[] = [];

  for (const [entity, members] of byEntity.entries()) {
    // Sort members descending by recency
    members.sort((a, b) => b.touchedAt - a.touchedAt);
    const lastTouchedAt = members[0]?.touchedAt ?? now;

    // Pick title from the most important member
    const topMember = [...members].sort((a, b) => b.importance - a.importance)[0];
    const cleanTitle = `${entity.charAt(0).toUpperCase() + entity.slice(1)} Arc: "${topMember?.text.slice(0, 45)}..."`;

    arcs.push({
      id: `arc_${entity}`,
      title: cleanTitle,
      primaryEntity: entity,
      members,
      lastTouchedAt,
      status: deriveStatus(lastTouchedAt, now),
    });
  }

  // Sort arcs: active first, then most recently touched
  arcs.sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1;
    if (b.status === "active" && a.status !== "active") return 1;
    return b.lastTouchedAt - a.lastTouchedAt;
  });

  return arcs;
}
