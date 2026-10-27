/**
 * Saan Mood Organ (Adapted from Psycheros packages/entity-flux/src/mood-organ.ts)
 *
 * Implements classical affective-state computing with dynamic baseline:
 * 1. 3D PAD Space: valence (unpleasant ↔ pleasant), arousal (calm ↔ excited), dominance (overwhelmed ↔ in-control)
 * 2. Event-driven dynamics: holds state between events, no artificial clocks
 * 3. 2-Hour Exponential Fade (temperament dial): feelings naturally fade over hours toward baseline
 * 4. Anti-Mirror "Lately" Window: Slow EMA ticked strictly by external user turns (prevents self-reinforcing echo)
 * 5. Sleep's Downward Arousal Lean: ~30-min half-life pull toward calm during sleep
 * 6. Scientific Naming: Mapped to Fontaine 80-term GRID coordinates via emotion-catalogue.ts
 */

import { getDb } from "@/lib/db/client";
import { nameEmotion, isQuietState } from "./emotion-catalogue";

export interface MoodState {
  valence: number;    // -1.0 to +1.0
  arousal: number;    // -1.0 to +1.0
  dominance: number;  // -1.0 to +1.0
  asOf: number;       // timestamp in ms
}

export interface MoodModifier {
  valence?: number;
  arousal?: number;
  dominance?: number;
  weight?: number;    // 0.0 to 1.0 (default: 0.5)
  source?: string;    // "user_turn" | "event" | "self"
}

// System Constants from Psycheros:
export const DEFAULT_FADE_PER_SEC = 0.0001;      // ~2-hour half-life for state fade
export const DEFAULT_LATELY_PER_SEC = 0.0001;    // ~2-hour half-life for Lately baseline EMA
export const SLEEP_AROUSAL_DRIFT_PER_SEC = Math.LN2 / 1800; // ~30-minute half-life sleep calm pull

export const DEFAULT_BASELINE: MoodState = {
  valence: 0.1, // Mild positive baseline home
  arousal: 0.0,
  dominance: 0.0,
  asOf: 0,
};

function clamp(v: number): number {
  return Math.max(-1.0, Math.min(1.0, Number(v.toFixed(3))));
}

export class MoodOrgan {
  private state: MoodState;
  private baseline: MoodState;
  private lastUpdate: number;
  private lastLatelyTick: number;
  private isSleeping = false;

  constructor() {
    this.state = { ...DEFAULT_BASELINE, asOf: Date.now() };
    this.baseline = { ...DEFAULT_BASELINE, asOf: Date.now() };
    this.lastUpdate = Date.now();
    this.lastLatelyTick = Date.now();
    this.loadFromDb();
  }

  /**
   * Loads persisted mood state from SQLite
   */
  private loadFromDb(): void {
    try {
      const db = getDb();
      const row = db.prepare(`
        SELECT valence, arousal, dominance, baseline_valence, baseline_arousal, baseline_dominance, last_update, last_lately_tick
        FROM saan_mood_state
        WHERE id = 1
      `).get() as any;

      if (row) {
        this.state = {
          valence: row.valence,
          arousal: row.arousal,
          dominance: row.dominance,
          asOf: row.last_update,
        };
        this.baseline = {
          valence: row.baseline_valence,
          arousal: row.baseline_arousal,
          dominance: row.baseline_dominance,
          asOf: row.last_lately_tick,
        };
        this.lastUpdate = row.last_update;
        this.lastLatelyTick = row.last_lately_tick;
      }
    } catch (err) {
      console.warn("[MoodOrgan] Error loading from db:", err);
    }
  }

  /**
   * Persists current state and baseline to SQLite
   */
  private saveToDb(): void {
    try {
      const db = getDb();
      db.prepare(`
        UPDATE saan_mood_state
        SET valence = ?, arousal = ?, dominance = ?,
            baseline_valence = ?, baseline_arousal = ?, baseline_dominance = ?,
            last_update = ?, last_lately_tick = ?
        WHERE id = 1
      `).run(
        this.state.valence,
        this.state.arousal,
        this.state.dominance,
        this.baseline.valence,
        this.baseline.arousal,
        this.baseline.dominance,
        this.lastUpdate,
        this.lastLatelyTick
      );
    } catch (err) {
      console.warn("[MoodOrgan] Error saving to db:", err);
    }
  }

  /**
   * Sets sleep mode to trigger downward arousal drift
   */
  setSleep(sleeping: boolean): void {
    this.isSleeping = sleeping;
  }

  /**
   * Event-driven exponential fade toward neutral on ~2-hour half life
   */
  public applyFade(now = Date.now()): void {
    const elapsedSec = Math.max(0, (now - this.lastUpdate) / 1000);
    if (elapsedSec === 0) return;

    const fadeFactor = Math.exp(-DEFAULT_FADE_PER_SEC * elapsedSec);
    this.state.valence = clamp(this.state.valence * fadeFactor);
    this.state.arousal = clamp(this.state.arousal * fadeFactor);
    this.state.dominance = clamp(this.state.dominance * fadeFactor);

    // Sleep posture leans arousal down toward calm
    if (this.isSleeping) {
      this.state.arousal = clamp(this.state.arousal * Math.exp(-SLEEP_AROUSAL_DRIFT_PER_SEC * elapsedSec));
    }

    this.lastUpdate = now;
    this.state.asOf = now;
    this.baseline.asOf = now;
  }

  /**
   * Ticks the Lately window EMA. Strictly called ONLY on EXTERNAL user events.
   * Saan's own voice never ticks this (the mirror-break rule).
   */
  public tickLately(now = Date.now()): void {
    const elapsedSec = Math.max(0, (now - this.lastLatelyTick) / 1000);
    if (elapsedSec === 0) return;

    const drift = 1 - Math.exp(-DEFAULT_LATELY_PER_SEC * elapsedSec);
    this.baseline.valence = clamp(this.baseline.valence + (this.state.valence - this.baseline.valence) * drift);
    this.baseline.arousal = clamp(this.baseline.arousal + (this.state.arousal - this.baseline.arousal) * drift);
    this.baseline.dominance = clamp(this.baseline.dominance + (this.state.dominance - this.baseline.dominance) * drift);

    this.lastLatelyTick = now;
    this.baseline.asOf = now;
  }

  /**
   * Ingests an affective modifier from a conversation turn or external event
   */
  ingest(mod: MoodModifier, now = Date.now()): void {
    this.applyFade(now);

    const isExternal = mod.source !== "self";
    if (isExternal) {
      this.tickLately(now);
    }

    const w = Math.max(0.0, Math.min(1.0, mod.weight ?? 0.5));
    if (mod.valence !== undefined) {
      this.state.valence = clamp(this.state.valence + mod.valence * w);
    }
    if (mod.arousal !== undefined) {
      this.state.arousal = clamp(this.state.arousal + mod.arousal * w);
    }
    if (mod.dominance !== undefined) {
      this.state.dominance = clamp(this.state.dominance + mod.dominance * w);
    }

    this.saveToDb();
  }

  /**
   * Returns current mood state with up-to-date fade applied
   */
  getState(now = Date.now()): MoodState {
    this.applyFade(now);
    return { ...this.state };
  }

  /**
   * Returns current baseline (Lately era) state
   */
  getBaseline(now = Date.now()): MoodState {
    this.applyFade(now);
    return { ...this.baseline };
  }

  /**
   * Names the emotion using Fontaine 80-term GRID coordinates.
   * Returns null if state is inside quiet band (<0.1 on all axes).
   */
  emotionName(of: MoodState = this.getState()): string | null {
    if (isQuietState(of.valence, of.arousal, of.dominance)) {
      return null;
    }
    const term = nameEmotion(of.valence, of.arousal, of.dominance);
    return term ? term.term : null;
  }

  /**
   * Renders human psychological state for injection into Saan's prompt.
   * Never exposes raw numbers or telemetry to the model.
   */
  renderFelt(now = Date.now()): string {
    this.applyFade(now);
    const feel = this.emotionName(this.state);
    const lately = this.emotionName(this.baseline);

    if (!feel) {
      return lately
        ? `My mood is quiet inside; lately I have felt ${lately}.`
        : "My mood is quiet inside — nothing is asking to be felt right now.";
    }

    if (!lately || lately === feel) {
      return `My mood: I feel ${feel}.`;
    }

    return `My mood: I feel ${feel}. Lately: ${lately}.`;
  }
}

// Singleton instance
let moodOrganInstance: MoodOrgan | null = null;

export function getMoodOrgan(): MoodOrgan {
  if (!moodOrganInstance) {
    moodOrganInstance = new MoodOrgan();
  }
  return moodOrganInstance;
}
