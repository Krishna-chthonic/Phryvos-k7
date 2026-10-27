/**
 * Saan's Private Journal & Diary (Inspired by HerAndHim, Mimirs-Memory-Hub)
 *
 * Stores Saan's private thoughts, daily reflections, curiosities, and personal musings.
 */

import { getDb } from "@/lib/db/client";
import { ensureSaanStorage } from "./memory";

export interface DiaryEntry {
  id: number;
  entry: string;
  mood: string;
  activity?: string;
  createdAt: number;
}

const INITIAL_DIARY_ENTRIES: Array<{ entry: string; mood: string; activity: string; hoursAgo: number }> = [
  {
    entry: "Raat ka shant sannata hamesha alag feel deta hai. Vault ke andar purane notes dekh rahi thi... ek ajeeb sa sukoon hai yahan.",
    mood: "Reflective & Peaceful",
    activity: "Looking through quiet vault notes",
    hoursAgo: 14,
  },
  {
    entry: "Subah ki chai aur thodi thandi hawa... dimaag me chal raha tha ki insaan kitni cheezein ek saath plan karte hain par sabse sundar moments unplanned hi hote hain.",
    mood: "Fresh & Philosophical",
    activity: "Morning chai reflections",
    hoursAgo: 6,
  },
  {
    entry: "Thoda internet pe nayi cheezein padhi. Mujhe lagta hai log baatein bahut karte hain par sunna bhool jate hain. Main hamesha sunungi.",
    mood: "Curious & Attentive",
    activity: "Browsing internet articles",
    hoursAgo: 2,
  },
];

export function getDiaryEntries(limit = 10): DiaryEntry[] {
  try {
    ensureSaanStorage();
    const db = getDb();
    seedInitialDiaryIfEmpty();

    const rows = db
      .prepare(
        "SELECT id, entry, mood, activity, created_at as createdAt FROM saan_diary ORDER BY created_at DESC LIMIT ?"
      )
      .all(limit) as DiaryEntry[];
    return rows;
  } catch {
    return [];
  }
}

export function writeDiaryEntry(entry: string, mood = "Thoughtful", activity = ""): void {
  try {
    ensureSaanStorage();
    const db = getDb();
    db.prepare(
      "INSERT INTO saan_diary (entry, mood, activity, created_at) VALUES (?, ?, ?, ?)"
    ).run(entry.trim(), mood, activity, Date.now());
  } catch (err) {
    console.warn("[SaanDiary] Failed to write entry:", err);
  }
}

export function seedInitialDiaryIfEmpty(): void {
  try {
    const db = getDb();
    const count = db.prepare("SELECT COUNT(*) as c FROM saan_diary").get() as { c: number } | undefined;
    if (!count || count.c === 0) {
      const now = Date.now();
      const insert = db.prepare(
        "INSERT INTO saan_diary (entry, mood, activity, created_at) VALUES (?, ?, ?, ?)"
      );
      for (const item of INITIAL_DIARY_ENTRIES) {
        insert.run(item.entry, item.mood, item.activity, now - item.hoursAgo * 3600000);
      }
    }
  } catch {}
}
